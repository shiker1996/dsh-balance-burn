import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { apply, SNAPSHOT_ROUTE, SETTINGS_ROUTE } from '../index.js'
import { DAY_MS } from '../src/metrics.js'
import { makeHome, usageEvent, writeSession } from './helpers.mjs'

const NOW = Date.parse('2026-11-12T12:00:00+08:00')

function fakeContext() {
  const routes = new Map()
  const ctx = {
    effect(fn) {
      fn()
    },
    connection: {
      fetch: {
        register(config) {
          routes.set(`${config.methods.join(',')} ${config.path}`, config)
          return () => routes.delete(config.path)
        },
      },
    },
    get() {
      return undefined
    },
  }
  return { ctx, routes }
}

function jsonRequest(url, method = 'GET', body) {
  return new Request(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('the host plugin registers both routes and serves a snapshot', async () => {
  const home = await makeHome()
  const previousFetch = globalThis.fetch
  const previousKey = process.env.DEEPSEEK_API_KEY
  try {
    const sessions = join(home, 'sessions')
    await writeSession(sessions, '--proj--', 'a', [
      usageEvent({ time: NOW - 3_600_000 }),
      usageEvent({ time: NOW - 2 * DAY_MS, input: 2000, output: 300 }),
    ])

    process.env.DEEPSEEK_API_KEY = 'sk-test'
    globalThis.fetch = async () =>
      Response.json({
        is_available: true,
        balance_infos: [
          { currency: 'CNY', total_balance: '37.49', granted_balance: '5.77', topped_up_balance: '31.71' },
        ],
      })

    const { ctx, routes } = fakeContext()
    apply(ctx, { dshHome: home })
    assert.equal(routes.has(`GET ${SNAPSHOT_ROUTE}`), true)
    assert.equal(routes.has(`POST ${SETTINGS_ROUTE}`), true)

    const route = routes.get(`GET ${SNAPSHOT_ROUTE}`)
    const response = await route.fetch(jsonRequest(`http://localhost${SNAPSHOT_ROUTE}`))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.balance.total, 37.49)
    assert.equal(body.coverage.events, 2)
    assert.equal(body.rates.length, 3)
    assert.equal(body.priceTable.currency, 'CNY')
  } finally {
    globalThis.fetch = previousFetch
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = previousKey
    await rm(home, { recursive: true, force: true })
  }
})

test('the settings route rejects bad input and accepts valid input', async () => {
  const home = await makeHome()
  const previousFetch = globalThis.fetch
  try {
    globalThis.fetch = async () =>
      Response.json({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '10', granted_balance: '0', topped_up_balance: '10' }],
      })
    const { ctx, routes } = fakeContext()
    apply(ctx, { dshHome: home })
    const route = routes.get(`POST ${SETTINGS_ROUTE}`)

    const bad = await route.fetch(jsonRequest(`http://localhost${SETTINGS_ROUTE}`, 'POST', { refreshSeconds: 5 }))
    assert.equal(bad.status, 400)
    const badBody = await bad.json()
    assert.deepEqual(badBody.fields, ['refreshSeconds'])

    const good = await route.fetch(jsonRequest(`http://localhost${SETTINGS_ROUTE}`, 'POST', { refreshSeconds: 30 }))
    assert.equal(good.status, 200)
    const body = await good.json()
    assert.equal(body.settings.refreshSeconds, 30)

    const malformed = await route.fetch(new Request(`http://localhost${SETTINGS_ROUTE}`, { method: 'POST', body: '{oops' }))
    assert.equal(malformed.status, 400)
  } finally {
    globalThis.fetch = previousFetch
    await rm(home, { recursive: true, force: true })
  }
})

test('a corrupt body and an empty home still answer deterministically', async () => {
  const home = await makeHome()
  try {
    const { ctx, routes } = fakeContext()
    apply(ctx, { dshHome: home })
    const route = routes.get(`GET ${SNAPSHOT_ROUTE}`)
    const response = await route.fetch(jsonRequest(`http://localhost${SNAPSHOT_ROUTE}`))
    const body = await response.json()
    assert.equal(body.coverage.files, 0)
    assert.equal(body.coverage.events, 0)
    assert.equal(body.rates.every((rate) => rate.cost === 0), true)
    assert.equal(body.forecast.daysLeft, null)
    assert.equal(body.daily.length, 30)
    assert.equal(body.daily.every((day) => day.hasData === false), true)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
