/**
 * Host half of the balance burn plugin.
 *
 * It exposes two same-origin routes for the browser half:
 * - `GET /api/balance-burn` — one snapshot (balance, rates, comparisons,
 *   forecast, coverage). `?refresh=1` bypasses the caches.
 * - `POST /api/balance-burn/settings` — validate and persist a settings patch,
 *   then return the recomputed snapshot.
 *
 * The DeepSeek key is resolved per request through the host credential seam
 * and never leaves this process. Local usage comes from the durable session
 * logs under `<DSH_HOME>/sessions`; no billing endpoint is scraped.
 *
 * @module dsh-balance-burn
 */

import { createSnapshotService } from './src/snapshot.js'
import { resolveDshHome } from './src/settings.js'

/** Route serving one snapshot. */
export const SNAPSHOT_ROUTE = '/api/balance-burn'

/** Route accepting settings writes. */
export const SETTINGS_ROUTE = '/api/balance-burn/settings'

/**
 * The connection service is the only hard requirement: without an HTTP seam
 * there is nothing to serve. Credentials are optional so local history still
 * renders when no key is stored.
 */
export const inject = ['connection']

/** Host plugin name (matches the package name). */
export const name = 'dsh-balance-burn'

/**
 * Mount the routes.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {{ dshHome?: string }} [config] - optional composition overrides.
 * @returns {void}
 */
export function apply(ctx, config = {}) {
  const home = resolveDshHome(typeof config.dshHome === 'string' ? config.dshHome : undefined)
  const service = createSnapshotService({
    home,
    resolveKey: () => resolveCredential(ctx),
  })

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: SNAPSHOT_ROUTE,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const refresh = new URL(request.url).searchParams.get('refresh') === '1'
          try {
            return json(await service.getSnapshot({ refresh }))
          } catch (error) {
            return json({ error: messageOf(error) }, 500)
          }
        },
      }),
    'balance-burn: snapshot route',
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: SETTINGS_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let patch
          try {
            patch = await request.json()
          } catch {
            return json({ error: 'The settings body was not JSON.' }, 400)
          }
          try {
            const { report, errors } = await service.updateSettings(patch)
            if (report === null) return json({ error: 'Invalid settings.', fields: errors }, 400)
            return json(report)
          } catch (error) {
            return json({ error: messageOf(error) }, 500)
          }
        },
      }),
    'balance-burn: settings route',
  )
}

/**
 * Resolve the DeepSeek API key from the credential seam, then the environment.
 *
 * The value is returned to the caller only; nothing here logs or persists it.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @returns {Promise<string | undefined>} the key, or undefined when unset.
 */
async function resolveCredential(ctx) {
  try {
    const credentials = ctx.get('credentials')
    if (credentials !== undefined && typeof credentials.resolve === 'function') {
      const hit = await credentials.resolve('DEEPSEEK_API_KEY')
      const value = typeof hit?.value === 'string' ? hit.value.trim() : ''
      if (value !== '') return value
    }
  } catch {
    // Fall through to the environment: a credential-store failure should not
    // hide a key the user exported for this process.
  }
  const fromEnv = process.env.DEEPSEEK_API_KEY
  return typeof fromEnv === 'string' && fromEnv.trim() !== '' ? fromEnv.trim() : undefined
}

/**
 * Serialize one JSON response with caching disabled.
 *
 * @param {object} body - response payload.
 * @param {number} [status] - HTTP status.
 * @returns {Response} the response.
 */
function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

/** @param {unknown} error - thrown value. @returns {string} a readable message. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}
