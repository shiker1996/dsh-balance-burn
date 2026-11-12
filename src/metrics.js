/**
 * Deterministic folds behind every number the balance burn plugin shows.
 *
 * All functions here are pure: they take events that were already priced and
 * return detached plain objects. That keeps the accounting rules testable
 * without a filesystem, a clock, or a network, and it keeps the HTTP layer a
 * thin adapter.
 *
 * Window definitions (mirrored verbatim in the UI's methodology block):
 * - Rates use rolling windows ending at `now`, not calendar days, so a
 *   half-finished day cannot halve a daily average.
 * - "Today" compares 00:00→now with yesterday 00:00→the same clock time.
 * - Week/month comparisons use equal-length rolling windows: 7×24h ending now
 *   against the 7×24h immediately before it, and likewise for 30×24h.
 * - A day with no billable event is "no data" (`hasData: false`), never zero,
 *   and takes no part in day counts or averages.
 *
 * @module dsh-balance-burn/metrics
 */

import { shanghaiParts, PRICE_TABLE, describePriceTable } from './pricing.js'

/** Milliseconds in one day. */
export const DAY_MS = 86_400_000

/** The three rate windows, in presentation order. */
export const RATE_WINDOWS = Object.freeze([
  Object.freeze({ key: 'r1', days: 1 }),
  Object.freeze({ key: 'r7', days: 7 }),
  Object.freeze({ key: 'r30', days: 30 }),
])

/**
 * Sum priced events in one half-open window.
 *
 * @param {Array<{ t: number, cost: number | null, billedTokens: number, cacheReadTokens: number }>} events
 *   events sorted ascending by `t`.
 * @param {number} from - inclusive start (epoch ms).
 * @param {number} to - exclusive end (epoch ms).
 * @param {number} days - window length, used for the per-day rate.
 * @returns {{ from: number, to: number, days: number, cost: number, billedTokens: number, cacheReadTokens: number, events: number, unpricedEvents: number, daysWithData: number, perDay: number }}
 *   one window's totals.
 */
export function summarizeWindow(events, from, to, days) {
  let cost = 0
  let billedTokens = 0
  let cacheReadTokens = 0
  let count = 0
  let unpricedEvents = 0
  const dayKeys = new Set()

  for (const event of events) {
    if (event.t < from) continue
    if (event.t >= to) continue
    count += 1
    billedTokens += event.billedTokens
    cacheReadTokens += event.cacheReadTokens
    if (event.cost === null) unpricedEvents += 1
    else cost += event.cost
    dayKeys.add(shanghaiParts(event.t).dayKey)
  }

  return {
    from,
    to,
    days,
    cost,
    billedTokens,
    cacheReadTokens,
    events: count,
    unpricedEvents,
    daysWithData: dayKeys.size,
    perDay: days > 0 ? cost / days : 0,
  }
}

/**
 * Percentage change from one amount to another.
 *
 * @param {number} current - the newer amount.
 * @param {number} previous - the baseline amount.
 * @returns {number | null} percent change, or null when no baseline exists.
 */
export function changePercent(current, previous) {
  if (!Number.isFinite(previous) || previous <= 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * Compare two equal-length spans and carry both sides forward.
 *
 * @param {Array<object>} events - priced events.
 * @param {number} from - current span start.
 * @param {number} to - current span end.
 * @param {number} previousFrom - previous span start (same length as current).
 * @param {number} previousTo - previous span end.
 * @returns {{ current: object, previous: object, change: { cost: number | null, billedTokens: number | null, cacheReadTokens: number | null } }}
 *   both summaries and their changes.
 */
export function compareSpans(events, from, to, previousFrom, previousTo) {
  const spanMs = to - from
  const days = spanMs / DAY_MS
  const current = summarizeWindow(events, from, to, days)
  const previous = summarizeWindow(events, previousFrom, previousTo, days)
  return {
    current,
    previous,
    change: {
      cost: changePercent(current.cost, previous.cost),
      billedTokens: changePercent(current.billedTokens, previous.billedTokens),
      cacheReadTokens: changePercent(current.cacheReadTokens, previous.cacheReadTokens),
    },
  }
}

/**
 * Start of the local calendar day containing one instant.
 *
 * @param {number} timeMs - epoch milliseconds.
 * @returns {number} epoch milliseconds at 00:00 Asia/Shanghai.
 */
export function startOfLocalDay(timeMs) {
  const parts = shanghaiParts(timeMs)
  return Date.UTC(parts.year, parts.month - 1, parts.day) - PRICE_TABLE.peak.utcOffsetMinutes * 60_000
}

/**
 * Build the 30-day daily series, marking days without billable events.
 *
 * @param {Array<object>} events - priced events.
 * @param {number} now - current instant.
 * @param {number} [days] - series length.
 * @returns {Array<{ day: string, hasData: boolean, cost: number | null, billedTokens: number | null, cacheReadTokens: number | null, events: number }>}
 *   oldest first; no-data days carry nulls rather than zeros.
 */
export function dailySeries(events, now, days = 30) {
  const buckets = new Map()
  const todayStart = startOfLocalDay(now)
  const firstStart = todayStart - (days - 1) * DAY_MS

  for (let index = 0; index < days; index += 1) {
    const start = firstStart + index * DAY_MS
    buckets.set(shanghaiParts(start).dayKey, {
      day: shanghaiParts(start).dayKey,
      hasData: false,
      cost: 0,
      billedTokens: 0,
      cacheReadTokens: 0,
      events: 0,
      start,
    })
  }

  for (const event of events) {
    if (event.t < firstStart) continue
    const bucket = buckets.get(shanghaiParts(event.t).dayKey)
    if (bucket === undefined) continue
    bucket.hasData = true
    bucket.events += 1
    bucket.billedTokens += event.billedTokens
    bucket.cacheReadTokens += event.cacheReadTokens
    if (event.cost !== null) bucket.cost += event.cost
  }

  return [...buckets.values()].map((bucket) => ({
    day: bucket.day,
    hasData: bucket.hasData,
    cost: bucket.hasData ? bucket.cost : null,
    billedTokens: bucket.hasData ? bucket.billedTokens : null,
    cacheReadTokens: bucket.hasData ? bucket.cacheReadTokens : null,
    events: bucket.events,
  }))
}

/**
 * Ratios and top-up advice for one balance reading.
 *
 * The day range follows the agreed rule: divide the balance by the highest and
 * the lowest of the 7-day and 30-day rates, so one outlier day widens the range
 * instead of pretending to be the trend.
 *
 * @param {{ balanceCny: number | null, rates: Array<{ key: string, perDay: number }>, primaryWindow: string, targetDays: number, cushion: number }} input
 *   a balance in the price table's currency (CNY), the three window rates, and
 *   the two configured knobs.
 * @returns {{ currency: string, balance: number | null, primaryWindow: string, perDay: number, daysLeft: number | null, daysLow: number | null, daysHigh: number | null, targetDays: number, cushion: number, suggestedTopUp: number | null, rateAvailable: boolean }}
 *   forecast figures; nulls mean "not computable", which the UI renders as —.
 */
export function forecast({ balanceCny, rates, primaryWindow, targetDays, cushion }) {
  const byKey = new Map(rates.map((rate) => [rate.key, rate.perDay]))
  const primaryPerDay = byKey.get(primaryWindow) ?? 0
  const rateAvailable = primaryPerDay > 0
  const balance = Number.isFinite(balanceCny) && balanceCny !== null ? Math.max(0, balanceCny) : null

  const bounds = [byKey.get('r7') ?? 0, byKey.get('r30') ?? 0].filter((value) => value > 0 && Number.isFinite(value))
  let daysLow = null
  let daysHigh = null
  if (balance !== null && bounds.length > 0) {
    daysHigh = balance / Math.min(...bounds)
    daysLow = balance / Math.max(...bounds)
  }

  const daysLeft = balance !== null && rateAvailable ? balance / primaryPerDay : null
  const suggestedTopUp =
    balance === null
      ? null
      : Math.max(0, roundUpToTen(primaryPerDay * targetDays + cushion - balance))

  return {
    currency: PRICE_TABLE.currency,
    balance,
    primaryWindow,
    perDay: primaryPerDay,
    daysLeft,
    daysLow,
    daysHigh,
    targetDays,
    cushion,
    suggestedTopUp,
    rateAvailable,
  }
}

/**
 * Days one balance would last at a given daily rate.
 *
 * @param {number} balance - amount in the price currency.
 * @param {number} perDay - the configured primary rate.
 * @param {number} [extra] - additional top-up to include.
 * @returns {number | null} days, or null when the rate is zero.
 */
export function daysForAmount(balance, perDay, extra = 0) {
  if (!Number.isFinite(perDay) || perDay <= 0) return null
  if (!Number.isFinite(balance) || balance === null) return null
  return (Math.max(0, balance) + Math.max(0, extra)) / perDay
}

/**
 * Round an amount up to the next whole ten, so a suggested top-up is one the
 * payment page accepts.
 *
 * @param {number} amount - raw amount in CNY.
 * @returns {number} a multiple of ten (0 stays 0).
 */
export function roundUpToTen(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.ceil(amount / 10) * 10
}

/**
 * Assemble the whole report body for one snapshot.
 *
 * @param {{
 *   events: Array<object>,
 *   now: number,
 *   settings: { targetDays: number, safetyCushion: number, primaryWindow: string },
 *   balance: object | null,
 *   coverage: object,
 *   holidays?: Set<string>,
 * }} input - priced events and the surrounding facts.
 * @returns {object} the snapshot body shared by the route and the client.
 */
export function buildReport({ events, now, settings, balance, coverage }) {
  const rates = RATE_WINDOWS.map(({ key, days }) => {
    const window = summarizeWindow(events, now - days * DAY_MS, now, days)
    return { key, days, ...window }
  })

  const todayStart = startOfLocalDay(now)
  const elapsed = now - todayStart
  const today = compareSpans(
    events,
    todayStart,
    now,
    todayStart - DAY_MS,
    todayStart - DAY_MS + elapsed,
  )

  const week = compareSpans(
    events,
    now - 7 * DAY_MS,
    now,
    now - 14 * DAY_MS,
    now - 7 * DAY_MS,
  )

  const month = compareSpans(
    events,
    now - 30 * DAY_MS,
    now,
    now - 60 * DAY_MS,
    now - 30 * DAY_MS,
  )

  const balanceCny = balance !== null && balance.status === 'ok' && balance.currency === PRICE_TABLE.currency
    ? balance.total
    : null
  const advice = forecast({
    balanceCny,
    rates,
    primaryWindow: settings.primaryWindow,
    targetDays: settings.targetDays,
    cushion: settings.safetyCushion,
  })

  return {
    generatedAt: new Date(now).toISOString(),
    scope: 'local',
    settings: {
      targetDays: settings.targetDays,
      safetyCushion: settings.safetyCushion,
      primaryWindow: settings.primaryWindow,
      refreshSeconds: settings.refreshSeconds,
    },
    balance,
    rates,
    primary: rates.find((rate) => rate.key === settings.primaryWindow) ?? rates[1],
    forecast: advice,
    today,
    week,
    month,
    daily: dailySeries(events, now),
    coverage,
    priceTable: describePriceTable(),
  }
}
