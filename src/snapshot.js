/**
 * Snapshot assembly: settings + local usage + balance, priced and folded.
 *
 * The service owns the only caching policy the route needs. A three-second
 * snapshot cache absorbs several tabs polling at once, while the per-file log
 * cache keeps a normal refresh at a handful of `stat` calls.
 *
 * @module dsh-balance-burn/snapshot
 */

import { join } from 'node:path'
import { createBalanceReader } from './balance.js'
import { createBalanceLedger } from './balance-history.js'
import { buildReport } from './metrics.js'
import { priceUsage, parseHolidays } from './pricing.js'
import { createUsageStore } from './usage-store.js'
import { loadSettings, mergeSettings, saveSettings } from './settings.js'

/** How long one assembled snapshot is reused. */
const SNAPSHOT_CACHE_MS = 3_000

/**
 * Create the snapshot service for one DSH home.
 *
 * @param {{
 *   home: string,
 *   resolveKey: () => Promise<string | undefined>,
 *   now?: () => number,
 *   sessionsRoot?: string,
 *   fetchImpl?: typeof fetch,
 * }} options - resolved home, credential resolver, and optional overrides.
 * @returns {{
 *   getSnapshot: (options?: { refresh?: boolean }) => Promise<object>,
 *   updateSettings: (patch: unknown) => Promise<{ report: object, errors: string[] }>,
 *   getSettings: () => Promise<object>,
 * }}
 *   the service used by the HTTP routes.
 */
export function createSnapshotService({ home, resolveKey, now = () => Date.now(), sessionsRoot, fetchImpl = fetch }) {
  const usageStore = createUsageStore({ root: sessionsRoot ?? join(home, 'sessions'), now })
  const balanceReader = createBalanceReader({ resolveKey, fetchImpl })
  const ledger = createBalanceLedger({ home })
  /** @type {{ at: number, report: object } | undefined} */
  let cached
  /** @type {object | undefined} */
  let settings

  /**
   * Read settings once per process, then serve the in-memory copy.
   *
   * @returns {Promise<object>} effective settings.
   */
  async function getSettings() {
    if (settings !== undefined) return settings
    const loaded = await loadSettings(home)
    settings = loaded.settings
    return settings
  }

  /**
   * Assemble one report.
   *
   * @param {{ refresh?: boolean }} [options] - `refresh` bypasses every cache.
   * @returns {Promise<object>} the report body.
   */
  async function getSnapshot(options = {}) {
    const at = now()
    if (options.refresh !== true && cached !== undefined && at - cached.at < SNAPSHOT_CACHE_MS) {
      return cached.report
    }

    const current = await getSettings()
    const holidays = parseHolidays(current.holidays)
    const [usage, balance] = await Promise.all([
      usageStore.read({ force: options.refresh === true, now: at }),
      balanceReader.read({ force: options.refresh === true, now: at }),
    ])

    const events = usage.events.map((record) => {
      const priced = priceUsage(record, record.model, record.t, holidays)
      return { ...record, cost: priced.cost }
    })

    const unpricedModels = new Set()
    let unpricedEvents = 0
    for (const event of events) {
      if (event.cost !== null) continue
      unpricedEvents += 1
      unpricedModels.add(event.model)
    }

    const coverage = {
      ...usage.coverage,
      unpricedEvents,
      unpricedModels: [...unpricedModels].sort(),
    }

    const report = buildReport({ events, now: at, settings: current, balance, coverage })

    if (balance.status === 'ok') {
      try {
        await ledger.record(balance, at)
      } catch {
        // A ledger write failure must not hide the live reading.
      }
    }
    try {
      report.accountDelta = await ledger.delta(at)
    } catch {
      report.accountDelta = null
    }

    cached = { at, report }
    return report
  }

  /**
   * Validate, persist, and re-derive after a settings change.
   *
   * @param {unknown} patch - partial settings from the client.
   * @returns {Promise<{ report: object | null, errors: string[] }>} the fresh
   *   report (null when nothing was accepted) and rejected field names.
   */
  async function updateSettings(patch) {
    const current = await getSettings()
    const merged = mergeSettings(patch, current)
    if (merged.errors.length > 0) return { report: null, errors: merged.errors }

    await saveSettings(home, merged.value)
    settings = merged.value
    cached = undefined
    return { report: await getSnapshot({ refresh: true }), errors: [] }
  }

  return { getSnapshot, updateSettings, getSettings }
}
