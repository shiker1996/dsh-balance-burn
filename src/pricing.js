/**
 * Price table and per-call costing for DeepSeek API usage.
 *
 * DSH's token meter measures tokens, not money, and the platform exposes no
 * billing API (see the plugin's DESIGN.md, N1). Costs are therefore computed
 * from the published price table below, with a visible version date so every
 * figure in the UI can be traced back to a source.
 *
 * Rules encoded here:
 * - Billing tokens are uncached input + output; cache reads are metered and
 *   priced separately.
 * - Peak prices apply on weekdays 09:00-12:00 and 14:00-18:00 Asia/Shanghai.
 *   Asia/Shanghai has no daylight saving time, so the local calendar is a
 *   fixed +08:00 offset.
 * - Chinese public holidays are off-peak all day. The plugin does not ship a
 *   holiday calendar (it would silently go stale); users can list dates in
 *   settings instead, and the UI states the boundary.
 * - An unknown model is never guessed: its cost is `null`, and callers must
 *   report how many events are unpriced rather than quietly summing less.
 *
 * @module dsh-balance-burn/pricing
 */

/** Milliseconds in one hour. */
const HOUR = 3_600_000

/** Asia/Shanghai is a fixed UTC+8 calendar with no DST. */
export const SHANGHAI_OFFSET_MS = 8 * HOUR

/**
 * Published DeepSeek prices, per one million tokens, in CNY.
 *
 * Verified 2026-11-12 against the official pricing page (Chinese edition,
 * whose currency is CNY). USD prices on the English page are the same rates
 * converted, so this table keeps one currency and never invents an FX rate.
 */
export const PRICE_TABLE = Object.freeze({
  version: '2026-11-12',
  currency: 'CNY',
  unit: 1_000_000,
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  peak: Object.freeze({
    timeZone: 'Asia/Shanghai',
    utcOffsetMinutes: 480,
    weekdayRanges: Object.freeze([
      Object.freeze([9, 12]),
      Object.freeze([14, 18]),
    ]),
    excludesHolidays: true,
  }),
  models: Object.freeze({
    'deepseek-flash': Object.freeze({
      cacheHit: Object.freeze({ offPeak: 0.02, peak: 0.04 }),
      cacheMiss: Object.freeze({ offPeak: 1, peak: 2 }),
      output: Object.freeze({ offPeak: 4, peak: 8 }),
    }),
    'deepseek-v4-pro': Object.freeze({
      cacheHit: Object.freeze({ offPeak: 0.15, peak: 0.3 }),
      cacheMiss: Object.freeze({ offPeak: 4.5, peak: 9 }),
      output: Object.freeze({ offPeak: 13.5, peak: 27 }),
    }),
  }),
  /**
   * Names the provider still accepts but no longer serves as distinct models.
   * The official note says they are served by the Flash model at Flash prices.
   */
  aliases: Object.freeze({
    'deepseek-v4-flash': 'deepseek-flash',
    'deepseek-v4-flash-vision-exp': 'deepseek-flash',
  }),
})

/**
 * Calendar facts for one instant in Asia/Shanghai.
 *
 * @param {number} timeMs - epoch milliseconds.
 * @returns {{ year: number, month: number, day: number, weekday: number, hour: number, minute: number, dayKey: string }}
 *   local fields, `weekday` 0 = Sunday, and a `YYYY-MM-DD` key.
 */
export function shanghaiParts(timeMs) {
  const local = new Date(timeMs + SHANGHAI_OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth() + 1
  const day = local.getUTCDate()
  return {
    year,
    month,
    day,
    weekday: local.getUTCDay(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    dayKey: `${year}-${pad2(month)}-${pad2(day)}`,
  }
}

/**
 * Parse a comma/newline separated holiday list into day keys.
 *
 * @param {string} value - configured dates, `YYYY-MM-DD` entries.
 * @returns {Set<string>} accepted day keys; malformed entries are ignored.
 */
export function parseHolidays(value) {
  const days = new Set()
  if (typeof value !== 'string') return days
  for (const raw of value.split(/[\s,;]+/u)) {
    const entry = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}$/u.test(entry)) days.add(entry)
  }
  return days
}

/**
 * Whether one instant falls in a peak-price window.
 *
 * @param {number} timeMs - epoch milliseconds of the call.
 * @param {Set<string>} [holidays] - off-peak all-day dates.
 * @returns {boolean} true when peak pricing applies.
 */
export function isPeak(timeMs, holidays = new Set()) {
  const parts = shanghaiParts(timeMs)
  if (parts.weekday === 0 || parts.weekday === 6) return false
  if (holidays.has(parts.dayKey)) return false
  for (const [from, to] of PRICE_TABLE.peak.weekdayRanges) {
    if (parts.hour >= from && parts.hour < to) return true
  }
  return false
}

/**
 * Resolve a logged model name to a priced table entry.
 *
 * @param {string} model - `usage` event model id.
 * @returns {string | null} canonical table key, or null when unpriced.
 */
export function canonicalModel(model) {
  if (typeof model !== 'string' || model === '') return null
  if (Object.hasOwn(PRICE_TABLE.models, model)) return model
  const alias = PRICE_TABLE.aliases[model]
  return alias !== undefined && Object.hasOwn(PRICE_TABLE.models, alias) ? alias : null
}

/**
 * Price one `assistant/message` usage record.
 *
 * Cache writes are charged at the cache-miss input rate: DeepSeek has no
 * separate write price, and treating a write as uncached input is the only
 * reading the published table supports.
 *
 * @param {{ input: number, output: number, cacheRead: number, cacheWrite: number }} usage
 *   token counts for one billable message.
 * @param {string} model - logged model id.
 * @param {number} timeMs - message time, used for the peak/off-peak tier.
 * @param {Set<string>} [holidays] - off-peak all-day dates.
 * @returns {{ cost: number | null, model: string | null, peak: boolean }}
 *   `cost` in CNY; null when the model has no published price.
 */
export function priceUsage(usage, model, timeMs, holidays = new Set()) {
  const canonical = canonicalModel(model)
  const peak = isPeak(timeMs, holidays)
  if (canonical === null) return { cost: null, model: null, peak }

  const prices = PRICE_TABLE.models[canonical]
  const tier = peak ? 'peak' : 'offPeak'
  const input = countOf(usage.input)
  const output = countOf(usage.output)
  const cacheRead = countOf(usage.cacheRead)
  const cacheWrite = countOf(usage.cacheWrite)

  const cost =
    (cacheRead * prices.cacheHit[tier] +
      (input + cacheWrite) * prices.cacheMiss[tier] +
      output * prices.output[tier]) /
    PRICE_TABLE.unit

  return { cost, model: canonical, peak }
}

/**
 * Describe the price table for the UI without exposing mutable internals.
 *
 * @returns {{ version: string, currency: string, source: string, models: Array<{ id: string, cacheHit: object, cacheMiss: object, output: object }>, peak: { timeZone: string, weekdayRanges: number[][], excludesHolidays: boolean } }}
 *   a detached summary.
 */
export function describePriceTable() {
  return {
    version: PRICE_TABLE.version,
    currency: PRICE_TABLE.currency,
    source: PRICE_TABLE.source,
    peak: {
      timeZone: PRICE_TABLE.peak.timeZone,
      weekdayRanges: PRICE_TABLE.peak.weekdayRanges.map((range) => [...range]),
      excludesHolidays: PRICE_TABLE.peak.excludesHolidays,
    },
    models: Object.entries(PRICE_TABLE.models).map(([id, prices]) => ({
      id,
      cacheHit: { ...prices.cacheHit },
      cacheMiss: { ...prices.cacheMiss },
      output: { ...prices.output },
    })),
  }
}

/**
 * Coerce a token count to a non-negative finite number.
 *
 * @param {unknown} value - reported count.
 * @returns {number} a safe count; malformed values count as zero.
 */
function countOf(value) {
  return Number.isFinite(value) && value > 0 ? Number(value) : 0
}

/** @param {number} value - 0-99. @returns {string} zero-padded two digits. */
function pad2(value) {
  return String(value).padStart(2, '0')
}
