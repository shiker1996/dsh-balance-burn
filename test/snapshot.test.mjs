import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFile, rm } from 'node:fs/promises'
import { createSnapshotService } from '../src/snapshot.js'
import { createBalanceLedger } from '../src/balance-history.js'
import { settingsPath } from '../src/settings.js'
import { DAY_MS } from '../src/metrics.js'
import { makeHome, usageEvent, writeSession } from './helpers.mjs'

const NOW = Date.parse('2026-11-12T12:00:00+08:00')

function balanceFetch(body = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '37.49', granted_balance: '5.77', topped_up_balance: '31.71' }] }) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url: String(url), authorization: init?.headers?.authorization })
    return Response.json(body)
  }
  return { impl, calls }
}

test('a snapshot joins local usage, balance, and advice', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    await writeSession(sessions, '--proj--', 'a', [
      usageEvent({ time: NOW - 3_600_000, input: 1_000_000, output: 0 }),
      usageEvent({ time: NOW - 2 * DAY_MS, input: 0, output: 1_000_000 }),
      usageEvent({ time: NOW - 10 * DAY_MS, input: 500_000, output: 0 }),
    ])
    const { impl, calls } = balanceFetch()
    const service = createSnapshotService({
      home,
      now: () => NOW,
      resolveKey: async () => 'sk-test',
      fetchImpl: impl,
    })

    const report = await service.getSnapshot()
    assert.equal(report.balance.status, 'ok')
    assert.equal(report.balance.total, 37.49)
    assert.equal(report.coverage.events, 3)
    assert.equal(report.coverage.sessions, 1)
    assert.equal(report.rates.length, 3)
    assert.equal(report.rates[0].events, 1)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].authorization, 'Bearer sk-test')
    assert.equal(JSON.stringify(report).includes('sk-test'), false)
    assert.equal(report.today.current.cost, report.rates[0].cost)
    assert.ok(report.forecast.daysLeft > 0)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('settings updates are validated, persisted, and reflected in the report', async () => {
  const home = await makeHome()
  try {
    const service = createSnapshotService({
      home,
      now: () => NOW,
      resolveKey: async () => undefined,
      fetchImpl: balanceFetch().impl,
    })

    const rejected = await service.updateSettings({ targetDays: 0 })
    assert.deepEqual(rejected.errors, ['targetDays'])
    assert.equal(rejected.report, null)

    const accepted = await service.updateSettings({ targetDays: 60, safetyCushion: 10 })
    assert.deepEqual(accepted.errors, [])
    assert.equal(accepted.report.settings.targetDays, 60)
    assert.equal(accepted.report.settings.safetyCushion, 10)
    assert.equal(accepted.report.balance.status, 'unconfigured')

    const stored = JSON.parse(await readFile(settingsPath(home), 'utf8'))
    assert.equal(stored.targetDays, 60)

    const reread = await service.getSnapshot({ refresh: true })
    assert.equal(reread.settings.targetDays, 60)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a snapshot reports the account delta once two days exist', async () => {
  const home = await makeHome()
  try {
    const ledger = createBalanceLedger({ home })
    await ledger.record(
      { status: 'ok', currency: 'CNY', total: 47.49, granted: 0, toppedUp: 47.49, available: true },
      NOW - DAY_MS,
    )
    const service = createSnapshotService({
      home,
      now: () => NOW,
      resolveKey: async () => 'sk-test',
      fetchImpl: balanceFetch().impl,
    })

    const report = await service.getSnapshot()
    assert.equal(report.balance.total, 37.49)
    assert.equal(report.accountDelta.spend, 10)
    assert.equal(report.accountDelta.previousDay, '2026-11-11')

    const again = await service.getSnapshot({ refresh: true })
    assert.equal(again.accountDelta.spend, 10)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('an unreadable key does not break local history', async () => {
  const home = await makeHome()
  try {
    await writeSession(join(home, 'sessions'), '--proj--', 'a', [usageEvent({ time: NOW - 60_000 })])
    const service = createSnapshotService({
      home,
      now: () => NOW,
      resolveKey: async () => {
        throw new Error('store unavailable')
      },
      fetchImpl: balanceFetch().impl,
    })
    const report = await service.getSnapshot()
    assert.equal(report.balance.status, 'unconfigured')
    assert.equal(report.coverage.events, 1)
    assert.equal(report.rates[0].cost > 0, true)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a balance in another currency cannot be divided by CNY prices', async () => {
  const home = await makeHome()
  try {
    await writeSession(join(home, 'sessions'), '--proj--', 'a', [usageEvent({ time: NOW - 60_000 })])
    const service = createSnapshotService({
      home,
      now: () => NOW,
      resolveKey: async () => 'sk-test',
      fetchImpl: balanceFetch({
        is_available: true,
        balance_infos: [{ currency: 'USD', total_balance: '5.00', granted_balance: '0', topped_up_balance: '5.00' }],
      }).impl,
    })
    const report = await service.getSnapshot()
    assert.equal(report.balance.currency, 'USD')
    assert.equal(report.forecast.daysLeft, null)
    assert.equal(report.forecast.suggestedTopUp, null)
    assert.equal(report.rates[0].cost > 0, true)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
