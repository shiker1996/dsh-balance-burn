/**
 * Durable plugin settings and DSH home resolution.
 *
 * Settings live in the plugin's own JSON document under the DSH home rather
 * than in the host's user-settings document. That is deliberate: the settings
 * service's schemas are built with a host-internal schema library, and a
 * plugin that imports it breaks whenever the host moves. A small validated
 * document keeps this plugin installable on its own, while the settings page
 * still renders inside DSH's Settings panel.
 *
 * Writes are atomic (temporary file + rename) and serialized, so two browsers
 * saving at once cannot interleave partial JSON.
 *
 * @module dsh-balance-burn/settings
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Accepted primary-rate windows. */
export const PRIMARY_WINDOWS = Object.freeze(['r1', 'r7', 'r30'])

/** Defaults for every setting; also the reset state. */
export const DEFAULT_SETTINGS = Object.freeze({
  targetDays: 30,
  safetyCushion: 5,
  primaryWindow: 'r7',
  refreshSeconds: 60,
  holidays: '',
})

/** Accepted bounds for each numeric setting. */
const LIMITS = Object.freeze({
  targetDays: Object.freeze({ min: 1, max: 365, integer: true }),
  safetyCushion: Object.freeze({ min: 0, max: 10_000, integer: false }),
  refreshSeconds: Object.freeze({ min: 15, max: 600, integer: true }),
})

/** Longest holiday list accepted, in characters. */
const HOLIDAYS_MAX_LENGTH = 500

/**
 * Resolve the DSH home directory.
 *
 * Mirrors the host's precedence: an explicit override, then `$DSH_HOME`, then
 * `~/.dsh`. An empty `$DSH_HOME` is treated as unset.
 *
 * @param {string} [configured] - explicit path from the composition entry.
 * @param {Record<string, string | undefined>} [env] - environment to read.
 * @returns {string} absolute home path.
 */
export function resolveDshHome(configured, env = process.env) {
  const explicit = typeof configured === 'string' ? configured.trim() : ''
  if (explicit !== '') return explicit
  const fromEnv = typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  if (fromEnv !== '') return fromEnv
  return join(homedir(), '.dsh')
}

/**
 * Absolute settings document path under one DSH home.
 *
 * @param {string} home - resolved DSH home.
 * @returns {string} path to the plugin's settings file.
 */
export function settingsPath(home) {
  return join(home, 'storages', 'balance-burn', 'settings.json')
}

/**
 * Validate and merge a settings patch over a known baseline.
 *
 * Unknown fields are ignored rather than persisted: a stale browser can send
 * a field this version no longer understands without corrupting the document.
 *
 * @param {unknown} patch - candidate partial settings.
 * @param {object} [base] - current settings to merge over.
 * @returns {{ value: object, errors: string[] }} merged settings and any
 *   rejected field names.
 */
export function mergeSettings(patch, base = DEFAULT_SETTINGS) {
  const value = { ...DEFAULT_SETTINGS, ...usableFields(base) }
  const errors = []
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return { value, errors: ['settings'] }
  }

  for (const [field, limit] of Object.entries(LIMITS)) {
    if (!Object.hasOwn(patch, field)) continue
    const candidate = toNumber(patch[field])
    if (
      candidate === undefined ||
      candidate < limit.min ||
      candidate > limit.max ||
      (limit.integer && !Number.isInteger(candidate))
    ) {
      errors.push(field)
      continue
    }
    value[field] = candidate
  }

  if (Object.hasOwn(patch, 'primaryWindow')) {
    if (PRIMARY_WINDOWS.includes(patch.primaryWindow)) value.primaryWindow = patch.primaryWindow
    else errors.push('primaryWindow')
  }

  if (Object.hasOwn(patch, 'holidays')) {
    if (typeof patch.holidays === 'string' && patch.holidays.length <= HOLIDAYS_MAX_LENGTH) {
      value.holidays = patch.holidays.trim()
    } else {
      errors.push('holidays')
    }
  }

  return { value, errors }
}

/**
 * Load settings from disk, falling back to defaults.
 *
 * A malformed or partially corrupt document is repaired field by field instead
 * of being discarded, so one bad number does not reset every preference.
 *
 * @param {string} home - resolved DSH home.
 * @returns {Promise<{ settings: object, persisted: boolean, error: string | null }>}
 *   effective settings and what happened while reading.
 */
export async function loadSettings(home) {
  const path = settingsPath(home)
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
      return { settings: { ...DEFAULT_SETTINGS }, persisted: false, error: null }
    }
    return { settings: { ...DEFAULT_SETTINGS }, persisted: false, error: messageOf(error) }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, persisted: true, error: 'settings.json is not JSON' }
  }

  const { value, errors } = mergeSettings(parsed, DEFAULT_SETTINGS)
  return {
    settings: value,
    persisted: true,
    error: errors.length > 0 ? `ignored fields: ${errors.join(', ')}` : null,
  }
}

/**
 * Persist one settings document atomically.
 *
 * @param {string} home - resolved DSH home.
 * @param {object} settings - already validated settings.
 * @returns {Promise<void>} resolves once the new document is durable.
 */
export async function saveSettings(home, settings) {
  const path = settingsPath(home)
  await mkdir(join(home, 'storages', 'balance-burn'), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await rename(temporary, path)
}

/**
 * Coerce a JSON value to a finite number.
 *
 * @param {unknown} value - candidate.
 * @returns {number | undefined} the number, or undefined when not numeric.
 */
function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

/**
 * Copy the recognised, in-range fields of one stored object.
 *
 * @param {unknown} settings - stored value.
 * @returns {object} settings usable as a merge baseline.
 */
function usableFields(settings) {
  const source = settings !== null && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
  const value = {}
  for (const [field, limit] of Object.entries(LIMITS)) {
    const candidate = toNumber(source[field])
    if (
      candidate === undefined ||
      candidate < limit.min ||
      candidate > limit.max ||
      (limit.integer && !Number.isInteger(candidate))
    ) {
      continue
    }
    value[field] = candidate
  }
  if (PRIMARY_WINDOWS.includes(source.primaryWindow)) value.primaryWindow = source.primaryWindow
  if (typeof source.holidays === 'string' && source.holidays.length <= HOLIDAYS_MAX_LENGTH) {
    value.holidays = source.holidays.trim()
  }
  return value
}

/** @param {unknown} error - thrown value. @returns {string} a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
