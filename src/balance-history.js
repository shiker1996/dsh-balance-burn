/**
 * Daily balance snapshots and the account-wide spend they imply.
 *
 * The local session log cannot see calls that never persisted a usage record
 * (title generation, aborted retries) or another tool using the same key. The
 * account balance can: its day-to-day drop is the total spend of the whole
 * account. This ledger stores one balance per local day and derives that drop.
 *
 * Deliberate limits:
 * - A rise in the balance is a top-up or a grant, not negative spend. Such a
 *   day yields no delta at all; the UI simply omits the comparison rather than
 *   explaining bookkeeping the user already knows.
 * - A missing day breaks the chain. Only consecutive days produce a daily
 *   figure, so a gap never turns into a fake average.
 * - Snapshots are day-granular by design: they are a coverage check for the
 *   real-time local estimate, not a replacement for it.
 *
 * @module dsh-balance-burn/balance-history
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { shanghaiParts } from './pricing.js'

/** How many days of snapshots are kept. */
const MAX_DAYS = 120

/**
 * Path of the balance ledger under one DSH home.
 *
 * @param {string} home - resolved DSH home.
 * @returns {string} absolute ledger path.
 */
export function balanceHistoryPath(home) {
  return join(home, 'storages', 'balance-burn', 'balance-history.json')
}

/**
 * Create a ledger that reads once and then serves an in-memory copy.
 *
 * @param {{ home: string }} options - resolved DSH home.
 * @returns {{
 *   record: (balance: object, at: number) => Promise<void>,
 *   delta: (at: number) => object | null,
 *   history: () => Array<object>,
 * }}
 *   the ledger used by the snapshot service.
 */
export function createBalanceLedger({ home }) {
  /** @type {Map<string, { total: number, currency: string, at: string }> | undefined} */
  let days
  /** @type {Promise<Map<string, object>> | undefined} */
  let loading
  /** @type {Promise<void>} */
  let writing = Promise.resolve()

  /**
   * Load the ledger once.
   *
   * @returns {Promise<Map<string, object>>} day key to snapshot.
   */
  async function load() {
    if (days !== undefined) return days
    if (loading !== undefined) return loading
    loading = (async () => {
      const map = new Map()
      try {
        const parsed = JSON.parse(await readFile(balanceHistoryPath(home), 'utf8'))
        const stored = parsed?.days
        if (stored !== null && typeof stored === 'object') {
          for (const [day, value] of Object.entries(stored)) {
            if (day.length !== 10) continue
            const total = Number(value?.total)
            if (!Number.isFinite(total)) continue
            map.set(day, {
              total,
              currency: typeof value?.currency === 'string' ? value.currency : '',
              at: typeof value?.at === 'string' ? value.at : '',
            })
          }
        }
      } catch {
        // A missing or malformed ledger simply starts empty; it is a cache of
        // observations, never the source of truth for a balance.
      }
      days = map
      return map
    })().finally(() => {
      loading = undefined
    })
    return loading
  }

  /**
   * Store the latest successful reading of the current local day.
   *
   * @param {{ status: string, currency: string, total: number | null }} balance
   *   the balance reading to keep.
   * @param {number} at - reading time, epoch milliseconds.
   * @returns {Promise<void>} resolves once the ledger is durable.
   */
  async function record(balance, at) {
    if (balance?.status !== 'ok' || !Number.isFinite(balance.total)) return
    const map = await load()
    const day = shanghaiParts(at).dayKey
    map.set(day, {
      total: balance.total,
      currency: typeof balance.currency === 'string' ? balance.currency : '',
      at: new Date(at).toISOString(),
    })

    for (const key of [...map.keys()].sort()) {
      if (map.size <= MAX_DAYS) break
      map.delete(key)
    }

    writing = writing.catch(() => {}).then(async () => {
      const path = balanceHistoryPath(home)
      await mkdir(join(home, 'storages', 'balance-burn'), { recursive: true })
      const temporary = `${path}.${process.pid}.tmp`
      await writeFile(
        temporary,
        `${JSON.stringify({ version: 1, days: Object.fromEntries(map) }, null, 2)}\n`,
        'utf8',
      )
      await rename(temporary, path)
    })
    await writing
  }

  /**
   * Spend implied by the last two consecutive daily snapshots.
   *
   * @param {number} at - current instant.
   * @returns {Promise<{ day: string, spend: number, total: number, previousDay: string, previousTotal: number, currency: string } | null>}
   *   null when there is no comparable pair, the balance rose, or the
   *   currency changed. Those cases are intentionally silent.
   */
  async function delta(at) {
    const map = await load()
    const today = shanghaiParts(at).dayKey
    const current = map.get(today)
    if (current === undefined) return null

    const previousDay = [...map.keys()]
      .filter((day) => day < today)
      .sort()
      .at(-1)
    if (previousDay === undefined) return null

    const gap = dayGap(previousDay, today)
    if (gap !== 1) return null
    const previous = map.get(previousDay)
    if (previous === undefined || previous.currency !== current.currency) return null

    const spend = previous.total - current.total
    if (!(spend > 0)) return null
    return {
      day: today,
      spend,
      total: current.total,
      previousDay,
      previousTotal: previous.total,
      currency: current.currency,
    }
  }

  /**
   * Detached snapshot history, newest first.
   *
   * @returns {Array<{ day: string, total: number, currency: string, at: string }>}
   *   the stored days.
   */
  function history() {
    if (days === undefined) return []
    return [...days.entries()]
      .sort(([left], [right]) => (left < right ? 1 : -1))
      .map(([day, value]) => ({ day, ...value }))
  }

  return { record, delta, history }
}

/**
 * Whole days between two `YYYY-MM-DD` keys.
 *
 * @param {string} from - earlier day.
 * @param {string} to - later day.
 * @returns {number} day distance, or NaN when a key is malformed.
 */
function dayGap(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN
  return Math.round((end - start) / 86_400_000)
}
