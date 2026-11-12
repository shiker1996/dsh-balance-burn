/**
 * Local DSH session-log reader.
 *
 * Every durable event batch is one Zstandard frame, so a session file is a
 * concatenation of frames rather than a single stream (see `zstd-frames.js`).
 * This module walks `<DSH_HOME>/sessions`, decodes only billable
 * `assistant/message` usage records, and caches the result per file keyed by
 * size and mtime. Unchanged files cost one `stat`, which keeps a 60-second
 * refresh cheap even with months of history.
 *
 * Two data-quality rules matter for the totals:
 * - A forked session may persist the events it inherited, so identical usage
 *   records can appear in two files. Records are de-duplicated by their full
 *   token/time signature; two genuinely separate calls never share a
 *   millisecond and every token count.
 * - A file that cannot be decoded is counted as unreadable and excluded; the
 *   UI reports the count instead of silently reporting a smaller total.
 *
 * @module dsh-balance-burn/usage-store
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { scanZstdFrames, decodeZstdFrame } from './zstd-frames.js'
import { shanghaiParts } from './pricing.js'
import { DAY_MS } from './metrics.js'

/** Session artifact names this reader understands. */
const SESSION_FILE = /^session(?:\.v\d+)?\.jsonl\.zstd$/u

/**
 * Event types known to carry provider-reported usage. Compaction summarization
 * is a separate billed model call and is not duplicated by an
 * `assistant/message`, so both count. Other event types are ignored rather than
 * summed speculatively: an unknown event carrying an aggregate would otherwise
 * double-count the calls it aggregates.
 */
const USAGE_EVENT_TYPES = new Set(['assistant/message', 'compaction/summary'])

/** How much history is kept in memory; enough for the 60-day comparison. */
export const RETENTION_DAYS = 95

/**
 * Create a cached reader over one sessions directory.
 *
 * @param {{ root: string, now?: () => number }} options - sessions root and a
 *   clock (injectable for tests).
 * @returns {{ read: (options?: { force?: boolean, now?: number }) => Promise<{ events: Array<object>, coverage: object }> }}
 *   a reader whose `read` resolves the merged, de-duplicated event list.
 */
export function createUsageStore({ root, now = () => Date.now() }) {
  /** @type {Map<string, { size: number, mtimeMs: number, records: Array<object>, tornFrames: number }>} */
  const cache = new Map()

  /**
   * Resolve all billable events, re-reading only changed files.
   *
   * @param {{ force?: boolean, now?: number }} [options] - `force` discards the
   *   per-file cache (a manual refresh); `now` fixes the retention cut.
   * @returns {Promise<{ events: Array<object>, coverage: object }>}
   */
  async function read(options = {}) {
    const started = Date.now()
    const current = Number.isFinite(options.now) ? options.now : now()
    const cutoff = current - RETENTION_DAYS * DAY_MS
    if (options.force === true) cache.clear()

    const files = await listSessionFiles(root)
    const coverage = {
      sessions: 0,
      files: files.length,
      unreadableFiles: 0,
      tornFrames: 0,
      events: 0,
      duplicates: 0,
      firstDay: null,
      lastDay: null,
      daysWithData: 0,
      retainedDays: RETENTION_DAYS,
    }

    /** @type {Map<string, object>} */
    const unique = new Map()

    for (const path of files) {
      let facts
      try {
        facts = await stat(path)
      } catch {
        coverage.unreadableFiles += 1
        continue
      }

      let entry = cache.get(path)
      if (entry === undefined || entry.size !== facts.size || entry.mtimeMs !== facts.mtimeMs) {
        try {
          entry = await readFileRecords(path, cutoff)
          cache.set(path, { size: facts.size, mtimeMs: facts.mtimeMs, records: entry.records, tornFrames: entry.tornFrames })
        } catch {
          coverage.unreadableFiles += 1
          cache.delete(path)
          continue
        }
      }

      coverage.sessions += 1
      coverage.tornFrames += entry.tornFrames
      for (const record of entry.records) {
        if (record.t < cutoff) continue
        const signature = `${record.t}|${record.model}|${record.input}|${record.output}|${record.cacheRead}|${record.cacheWrite}`
        if (unique.has(signature)) {
          coverage.duplicates += 1
          continue
        }
        unique.set(signature, record)
      }

      // Free the yielding loop once per file; a large first scan must not
      // monopolize the host process.
      await new Promise((resolve) => setImmediate(resolve))
    }

    const events = [...unique.values()].sort((left, right) => left.t - right.t)
    const dayKeys = new Set()
    for (const event of events) {
      const day = shanghaiParts(event.t).dayKey
      if (coverage.firstDay === null || day < coverage.firstDay) coverage.firstDay = day
      if (coverage.lastDay === null || day > coverage.lastDay) coverage.lastDay = day
      if (event.t >= current - 30 * DAY_MS) dayKeys.add(day)
    }

    coverage.events = events.length
    coverage.daysWithData = dayKeys.size
    coverage.scanMs = Date.now() - started
    return { events, coverage }
  }

  return { read }
}

/**
 * List every session artifact under a sessions root.
 *
 * @param {string} root - `<DSH_HOME>/sessions`.
 * @returns {Promise<string[]>} absolute file paths, sorted for determinism.
 */
export async function listSessionFiles(root) {
  const found = []
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return found
  }

  const walk = async (path, depth) => {
    if (depth > 4) return
    let children
    try {
      children = await readdir(path, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of children) {
      const full = join(path, child.name)
      if (child.isDirectory()) await walk(full, depth + 1)
      else if (child.isFile() && SESSION_FILE.test(child.name)) found.push(full)
    }
  }

  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) await walk(full, 1)
    else if (entry.isFile() && SESSION_FILE.test(entry.name)) found.push(full)
  }

  return found.sort()
}

/**
 * Decode one session artifact into usage records.
 *
 * @param {string} path - artifact path.
 * @param {number} cutoff - oldest event time worth keeping.
 * @returns {Promise<{ records: Array<object>, tornFrames: number }>}
 */
async function readFileRecords(path, cutoff) {
  const bytes = await readFile(path)
  const { frames, tornStart } = scanZstdFrames(bytes)
  const tornFrames = tornStart === undefined ? 0 : 1

  /** @type {Array<object>} */
  const records = []
  for (const frame of frames) {
    let text
    try {
      text = decodeZstdFrame(bytes.subarray(frame.start, frame.end))
    } catch {
      // A frame that fails its checksum means the file moved under us; the
      // caller retries on the next refresh instead of mixing partial data.
      throw new Error(`frame decode failed in ${basename(path)}`)
    }
    for (const line of text.split('\n')) {
      if (line === '') continue
      const record = parseUsageRecord(line, cutoff)
      if (record !== null) records.push(record)
    }
  }

  return { records, tornFrames }
}

/**
 * Parse one JSONL event into a billable usage record.
 *
 * @param {string} line - one event line.
 * @param {number} cutoff - oldest event time worth keeping.
 * @returns {object | null} the record, or null for non-usage lines.
 */
export function parseUsageRecord(line, cutoff) {
  let event
  try {
    event = JSON.parse(line)
  } catch {
    return null
  }
  if (event === null || typeof event !== 'object') return null
  if (!USAGE_EVENT_TYPES.has(event.type)) return null

  const usage = event.data?.usage
  if (usage === null || typeof usage !== 'object') return null
  const time = Number(event.time)
  if (!Number.isFinite(time) || time < cutoff) return null

  const input = tokenCount(usage.inputTokens)
  const output = tokenCount(usage.outputTokens)
  const cacheRead = tokenCount(usage.cacheReadTokens)
  const cacheWrite = tokenCount(usage.cacheWriteTokens)
  if (input + output + cacheRead + cacheWrite === 0) return null

  const model = modelOf(event.data)

  return {
    t: time,
    model,
    input,
    output,
    cacheRead,
    cacheWrite,
    billedTokens: input + output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
  }
}

/** @param {unknown} value - reported token count. @returns {number} a safe count. */
function tokenCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(Number(value)) : 0
}

/**
 * Resolve the model that produced one usage event.
 *
 * Chat messages name their route under `message.source.model`; compaction
 * summaries carry a top-level `model`. An unresolved route stays `unknown` so
 * the pricing layer can refuse to guess.
 *
 * @param {object} data - event data.
 * @returns {string} model id, or `unknown`.
 */
function modelOf(data) {
  const candidates = [data?.message?.source?.model, data?.model]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  return 'unknown'
}
