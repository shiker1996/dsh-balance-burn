/**
 * DeepSeek balance reader.
 *
 * `GET /user/balance` is the only documented, non-scraping source of the
 * account balance. The API key is resolved through the host credential seam at
 * call time and never cached, logged, or returned. A failure is reported as a
 * status, never as a response body or a URL that could quote a key.
 *
 * @module dsh-balance-burn/balance
 */

/** Default endpoint of the balance API. */
export const BALANCE_URL = 'https://api.deepseek.com/user/balance'

/**
 * Create a cached balance reader.
 *
 * @param {{
 *   resolveKey: () => Promise<string | undefined>,
 *   url?: string,
 *   timeoutMs?: number,
 *   fetchImpl?: typeof fetch,
 * }} options - credential resolver and transport overrides.
 * @returns {{ read: (options?: { force?: boolean, now?: number }) => Promise<object> }}
 *   a reader returning `{ status: 'ok' | 'unconfigured' | 'error', ... }`.
 */
export function createBalanceReader({ resolveKey, url = BALANCE_URL, timeoutMs = 12_000, fetchImpl = fetch }) {
  const cacheMs = 30_000
  /** @type {{ at: number, value: object } | undefined} */
  let cache
  /** @type {Promise<object> | undefined} */
  let pending

  /**
   * Read the balance, sharing one upstream request across concurrent callers.
   *
   * @param {{ force?: boolean, now?: number }} [options] - `force` bypasses the
   *   short cache for a manual refresh.
   * @returns {Promise<object>} a detached reading.
   */
  async function read(options = {}) {
    const now = Number.isFinite(options.now) ? options.now : Date.now()
    if (options.force !== true && cache !== undefined && now - cache.at < cacheMs) return cache.value
    if (pending !== undefined) return pending

    pending = load({ resolveKey, url, timeoutMs, fetchImpl })
      .then((value) => {
        cache = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }

  return { read }
}

/**
 * Fetch and normalize one balance reading.
 *
 * @param {{ resolveKey: () => Promise<string | undefined>, url: string, timeoutMs: number, fetchImpl: typeof fetch }} options
 *   transport facts.
 * @returns {Promise<object>} the reading.
 */
async function load({ resolveKey, url, timeoutMs, fetchImpl }) {
  const fetchedAt = new Date().toISOString()
  let key
  try {
    key = await resolveKey()
  } catch {
    return failure('unconfigured', fetchedAt, 'The credential store could not be read.')
  }
  if (typeof key !== 'string' || key.trim() === '') {
    return failure('unconfigured', fetchedAt, 'No DEEPSEEK_API_KEY is configured.')
  }

  let response
  try {
    response = await fetchImpl(url, {
      headers: { accept: 'application/json', authorization: `Bearer ${key.trim()}` },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    return failure('error', fetchedAt, networkMessage(error))
  }

  if (!response.ok) {
    // The API's error bodies can echo request details; report the status only.
    return failure('error', fetchedAt, `HTTP ${response.status}`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    return failure('error', fetchedAt, 'The balance response was not JSON.')
  }

  const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : []
  const usable = infos.filter((info) => info !== null && typeof info === 'object')
  if (usable.length === 0) return failure('error', fetchedAt, 'The balance response carried no balance.')

  const chosen = usable.find((info) => info.currency === 'CNY') ?? usable[0]
  const total = asAmount(chosen.total_balance)
  if (total === null) return failure('error', fetchedAt, 'The balance amount was not numeric.')

  return {
    status: 'ok',
    currency: typeof chosen.currency === 'string' ? chosen.currency : '',
    total,
    granted: asAmount(chosen.granted_balance) ?? 0,
    toppedUp: asAmount(chosen.topped_up_balance) ?? 0,
    available: body?.is_available !== false,
    fetchedAt,
    error: null,
  }
}

/**
 * Build one failure reading with the same shape as a success.
 *
 * @param {'unconfigured' | 'error'} status - why there is no balance.
 * @param {string} fetchedAt - ISO attempt time.
 * @param {string} message - user-safe explanation.
 * @returns {object} the reading.
 */
function failure(status, fetchedAt, message) {
  return {
    status,
    currency: '',
    total: null,
    granted: null,
    toppedUp: null,
    available: false,
    fetchedAt,
    error: message,
  }
}

/**
 * Parse an amount that the API reports as a string.
 *
 * @param {unknown} value - reported amount.
 * @returns {number | null} the amount, or null when unusable.
 */
function asAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Turn a transport failure into a message that cannot leak the request.
 *
 * @param {unknown} error - thrown value.
 * @returns {string} a short reason.
 */
function networkMessage(error) {
  if (error !== null && typeof error === 'object' && error.name === 'TimeoutError') {
    return 'The balance request timed out.'
  }
  return 'The balance request failed.'
}
