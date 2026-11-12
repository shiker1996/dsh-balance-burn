import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalModel,
  isPeak,
  parseHolidays,
  priceUsage,
  describePriceTable,
  PRICE_TABLE,
} from '../src/pricing.js'

const at = (iso) => Date.parse(iso)

test('peak windows follow Beijing weekdays 09-12 and 14-18', () => {
  // 2026-11-12 is a Thursday.
  assert.equal(isPeak(at('2026-11-12T08:59:00+08:00')), false)
  assert.equal(isPeak(at('2026-11-12T09:00:00+08:00')), true)
  assert.equal(isPeak(at('2026-11-12T11:59:59+08:00')), true)
  assert.equal(isPeak(at('2026-11-12T12:00:00+08:00')), false)
  assert.equal(isPeak(at('2026-11-12T13:59:00+08:00')), false)
  assert.equal(isPeak(at('2026-11-12T14:00:00+08:00')), true)
  assert.equal(isPeak(at('2026-11-12T17:59:00+08:00')), true)
  assert.equal(isPeak(at('2026-11-12T18:00:00+08:00')), false)
})

test('weekends and configured holidays are off-peak all day', () => {
  assert.equal(isPeak(at('2026-11-14T10:00:00+08:00')), false) // Saturday
  assert.equal(isPeak(at('2026-11-15T15:00:00+08:00')), false) // Sunday
  assert.equal(isPeak(at('2026-11-12T10:00:00+08:00')), true)
  assert.equal(isPeak(at('2026-11-12T10:00:00+08:00'), parseHolidays('2026-11-12')), false)
})

test('holiday parsing ignores malformed entries', () => {
  const days = parseHolidays('2026-10-01, 2026-10-02\n2026-13-x, nope')
  assert.deepEqual([...days].sort(), ['2026-10-01', '2026-10-02'])
})

test('prices all four billing combinations', () => {
  const peak = at('2026-11-12T10:00:00+08:00')
  const off = at('2026-11-12T20:00:00+08:00')
  const million = { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }
  const cacheHit = { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 }
  const output = { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }

  assert.equal(priceUsage(million, 'deepseek-flash', peak).cost, 2)
  assert.equal(priceUsage(million, 'deepseek-flash', off).cost, 1)
  assert.equal(priceUsage(cacheHit, 'deepseek-flash', peak).cost, 0.04)
  assert.equal(priceUsage(cacheHit, 'deepseek-flash', off).cost, 0.02)
  assert.equal(priceUsage(output, 'deepseek-flash', peak).cost, 8)
  assert.equal(priceUsage(output, 'deepseek-flash', off).cost, 4)
  assert.equal(priceUsage(million, 'deepseek-v4-pro', off).cost, 4.5)
})

test('a mixed record adds cache, miss, and output prices exactly', () => {
  const usage = { input: 1000, output: 2000, cacheRead: 3000, cacheWrite: 0 }
  const priced = priceUsage(usage, 'deepseek-flash', at('2026-11-12T10:00:00+08:00'))
  const expected = (3000 * 0.04 + 1000 * 2 + 2000 * 8) / 1_000_000
  assert.equal(priced.cost, expected)
  assert.equal(priced.peak, true)
})

test('cache writes are charged at the cache-miss rate', () => {
  const priced = priceUsage(
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 1_000_000 },
    'deepseek-flash',
    at('2026-11-12T20:00:00+08:00'),
  )
  assert.equal(priced.cost, 1)
})

test('legacy model aliases resolve and unknown models are never guessed', () => {
  assert.equal(canonicalModel('deepseek-v4-flash'), 'deepseek-flash')
  assert.equal(canonicalModel('deepseek-v4-flash-vision-exp'), 'deepseek-flash')
  assert.equal(canonicalModel('deepseek-chat'), null)
  assert.equal(canonicalModel('some-future-model'), null)

  const priced = priceUsage(
    { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 },
    'deepseek-chat',
    Date.now(),
  )
  assert.equal(priced.cost, null)
})

test('the described table is detached and carries its version', () => {
  const described = describePriceTable()
  assert.equal(described.version, PRICE_TABLE.version)
  assert.match(described.version, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(described.models.length, Object.keys(PRICE_TABLE.models).length)
  described.models[0].cacheHit.offPeak = 999
  assert.notEqual(PRICE_TABLE.models['deepseek-flash'].cacheHit.offPeak, 999)
})
