import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { createBalanceLedger, balanceHistoryPath } from '../src/balance-history.js'
import { DAY_MS } from '../src/metrics.js'
import { makeHome } from './helpers.mjs'

const NOW = Date.parse('2026-11-12T12:00:00+08:00')

function reading(total, currency = 'CNY', status = 'ok') {
  return { status, currency, total, granted: 0, toppedUp: total, available: true, fetchedAt: '', error: null }
}

test('a consecutive day drop becomes the account delta', async () => {
  const home = await makeHome()
  try {
    const ledger = createBalanceLedger({ home })
    await ledger.record(reading(47.49), NOW - DAY_MS)
    await ledger.record(reading(37.49), NOW)

    const delta = await ledger.delta(NOW)
    assert.equal(delta.spend, 10)
    assert.equal(delta.day, '2026-11-12')
    assert.equal(delta.previousDay, '2026-11-11')
    assert.equal(delta.currency, 'CNY')
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('the latest reading of a day replaces the earlier one', async () => {
  const home = await makeHome()
  try {
    const ledger = createBalanceLedger({ home })
    await ledger.record(reading(47.49), NOW - DAY_MS)
    await ledger.record(reading(40), NOW - 2 * 3_600_000)
    await ledger.record(reading(37.49), NOW)

    const delta = await ledger.delta(NOW)
    assert.equal(delta.spend, 10)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a balance rise, a gap, or a currency change yields no delta', async () => {
  const home = await makeHome()
  try {
    const ledger = createBalanceLedger({ home })
    await ledger.record(reading(10), NOW - DAY_MS)
    await ledger.record(reading(20), NOW)
    assert.equal(await ledger.delta(NOW), null, 'a rise is a top-up, not negative spend')
  } finally {
    await rm(home, { recursive: true, force: true })
  }

  const gapHome = await makeHome()
  try {
    const ledger = createBalanceLedger({ home: gapHome })
    await ledger.record(reading(50), NOW - 3 * DAY_MS)
    await ledger.record(reading(37.49), NOW)
    assert.equal(await ledger.delta(NOW), null, 'a missing day must not become a daily figure')
  } finally {
    await rm(gapHome, { recursive: true, force: true })
  }

  const currencyHome = await makeHome()
  try {
    const ledger = createBalanceLedger({ home: currencyHome })
    await ledger.record(reading(7, 'USD'), NOW - DAY_MS)
    await ledger.record(reading(37.49, 'CNY'), NOW)
    assert.equal(await ledger.delta(NOW), null)
  } finally {
    await rm(currencyHome, { recursive: true, force: true })
  }
})

test('a failed balance reading is never stored', async () => {
  const home = await makeHome()
  try {
    const ledger = createBalanceLedger({ home })
    await ledger.record(reading(null, '', 'error'), NOW)
    assert.deepEqual(ledger.history(), [])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('the ledger persists and reloads', async () => {
  const home = await makeHome()
  try {
    const first = createBalanceLedger({ home })
    await first.record(reading(47.49), NOW - DAY_MS)
    await first.record(reading(37.49), NOW)

    const second = createBalanceLedger({ home })
    const delta = await second.delta(NOW)
    assert.equal(delta.spend, 10)
    assert.equal(second.history().length, 2)
    assert.equal(balanceHistoryPath(home).endsWith('balance-history.json'), true)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a corrupt ledger starts empty instead of failing', async () => {
  const home = await makeHome()
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    await mkdir(dirname(balanceHistoryPath(home)), { recursive: true })
    await writeFile(balanceHistoryPath(home), '{not json')
    const ledger = createBalanceLedger({ home })
    assert.equal(await ledger.delta(NOW), null)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
