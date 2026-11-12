import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReport,
  compareSpans,
  dailySeries,
  daysForAmount,
  forecast,
  roundUpToTen,
  startOfLocalDay,
  summarizeWindow,
  DAY_MS,
} from '../src/metrics.js'

const at = (iso) => Date.parse(iso)

function event(iso, cost, billedTokens = 1000, cacheReadTokens = 0) {
  return { t: at(iso), cost, billedTokens, cacheReadTokens }
}

const SETTINGS = { targetDays: 30, safetyCushion: 5, primaryWindow: 'r7', refreshSeconds: 60 }
const COVERAGE = { sessions: 1, files: 1, events: 1, daysWithData: 1, firstDay: '2026-11-01', lastDay: '2026-11-12', duplicates: 0, unpricedEvents: 0, unpricedModels: [], unreadableFiles: 0, tornFrames: 0 }
const BALANCE = { status: 'ok', currency: 'CNY', total: 37.49, granted: 5.77, toppedUp: 31.71, available: true, fetchedAt: '2026-11-12T04:00:00.000Z', error: null }

test('windows sum half-open ranges and report days with data', () => {
  const events = [
    event('2026-11-12T10:00:00+08:00', 1),
    event('2026-11-11T10:00:00+08:00', 2),
    event('2026-11-05T10:00:00+08:00', 3),
  ]
  const now = at('2026-11-12T12:00:00+08:00')
  const day = summarizeWindow(events, now - DAY_MS, now, 1)
  assert.equal(day.cost, 1)
  assert.equal(day.daysWithData, 1)

  const week = summarizeWindow(events, now - 7 * DAY_MS, now, 7)
  assert.equal(week.cost, 3)
  assert.equal(week.perDay, 3 / 7)
  assert.equal(week.daysWithData, 2)
})

test('today compares against yesterday at the same clock time', () => {
  const events = [
    event('2026-11-12T10:00:00+08:00', 1),
    event('2026-11-11T10:00:00+08:00', 2),
    event('2026-11-11T20:00:00+08:00', 100),
  ]
  const now = at('2026-11-12T12:00:00+08:00')
  const todayStart = startOfLocalDay(now)
  const pair = compareSpans(
    events,
    todayStart,
    now,
    todayStart - DAY_MS,
    todayStart - DAY_MS + (now - todayStart),
  )
  assert.equal(pair.current.cost, 1)
  assert.equal(pair.previous.cost, 2)
  assert.equal(pair.change.cost, -50)
})

test('week and month comparisons use equal rolling windows', () => {
  const events = [
    event('2026-11-12T10:00:00+08:00', 1),
    event('2026-11-10T10:00:00+08:00', 2),
    event('2026-11-01T10:00:00+08:00', 4),
    event('2026-10-01T10:00:00+08:00', 8),
  ]
  const now = at('2026-11-12T12:00:00+08:00')
  const week = compareSpans(events, now - 7 * DAY_MS, now, now - 14 * DAY_MS, now - 7 * DAY_MS)
  assert.equal(week.current.cost, 3)
  assert.equal(week.previous.cost, 4)
  assert.equal(week.change.cost, -25)

  const month = compareSpans(events, now - 30 * DAY_MS, now, now - 60 * DAY_MS, now - 30 * DAY_MS)
  assert.equal(month.current.cost, 7)
  assert.equal(month.previous.cost, 8)
})

test('days without data are null in the series, never zero', () => {
  const events = [event('2026-11-12T10:00:00+08:00', 1)]
  const now = at('2026-11-12T12:00:00+08:00')
  const series = dailySeries(events, now, 3)
  assert.equal(series.length, 3)
  assert.deepEqual(series.map((day) => day.day), ['2026-11-10', '2026-11-11', '2026-11-12'])
  assert.deepEqual(series.map((day) => day.hasData), [false, false, true])
  assert.equal(series[0].cost, null)
  assert.equal(series[1].cost, null)
  assert.equal(series[2].cost, 1)
})

test('forecast derives days left, a range, and a rounded top-up', () => {
  const advice = forecast({
    balanceCny: 37.49,
    rates: [
      { key: 'r1', perDay: 0.5 },
      { key: 'r7', perDay: 1 },
      { key: 'r30', perDay: 2 },
    ],
    primaryWindow: 'r7',
    targetDays: 30,
    cushion: 5,
  })
  assert.equal(advice.daysLeft, 37.49)
  assert.equal(advice.daysLow, 37.49 / 2)
  assert.equal(advice.daysHigh, 37.49)
  assert.equal(advice.suggestedTopUp, 0)

  const topUp = forecast({
    balanceCny: 10,
    rates: [
      { key: 'r1', perDay: 1 },
      { key: 'r7', perDay: 2 },
      { key: 'r30', perDay: 4 },
    ],
    primaryWindow: 'r7',
    targetDays: 30,
    cushion: 5,
  })
  // 2 × 30 + 5 − 10 = 55 → 60
  assert.equal(topUp.suggestedTopUp, 60)
})

test('forecast refuses to divide by a zero rate or a missing balance', () => {
  const noRate = forecast({
    balanceCny: 37.49,
    rates: [
      { key: 'r1', perDay: 0 },
      { key: 'r7', perDay: 0 },
      { key: 'r30', perDay: 0 },
    ],
    primaryWindow: 'r7',
    targetDays: 30,
    cushion: 5,
  })
  assert.equal(noRate.daysLeft, null)
  assert.equal(noRate.daysLow, null)
  assert.equal(noRate.rateAvailable, false)
  assert.equal(noRate.suggestedTopUp, 0)

  const noBalance = forecast({
    balanceCny: null,
    rates: [
      { key: 'r1', perDay: 1 },
      { key: 'r7', perDay: 2 },
      { key: 'r30', perDay: 3 },
    ],
    primaryWindow: 'r7',
    targetDays: 30,
    cushion: 5,
  })
  assert.equal(noBalance.daysLeft, null)
  assert.equal(noBalance.suggestedTopUp, null)
})

test('rounding and reverse calculation follow the agreed formulas', () => {
  assert.equal(roundUpToTen(36.5), 40)
  assert.equal(roundUpToTen(0.4), 10)
  assert.equal(roundUpToTen(0), 0)
  assert.equal(roundUpToTen(-3), 0)
  assert.equal(daysForAmount(37.49, 1.5), 37.49 / 1.5)
  assert.equal(daysForAmount(37.49, 0), null)
  assert.equal(daysForAmount(null, 1), null)
})

test('a report assembles rates, comparisons, coverage, and advice', () => {
  const now = at('2026-11-12T12:00:00+08:00')
  const events = [
    event('2026-11-12T10:00:00+08:00', 1, 1000, 5000),
    event('2026-11-11T10:00:00+08:00', 2, 2000, 6000),
    event('2026-11-03T10:00:00+08:00', 3, 3000, 7000),
  ]
  const report = buildReport({
    events,
    now,
    settings: SETTINGS,
    balance: BALANCE,
    coverage: COVERAGE,
  })

  assert.equal(report.scope, 'local')
  assert.equal(report.rates.length, 3)
  assert.equal(report.rates[2].cost, 6)
  assert.equal(report.primary.key, 'r7')
  assert.equal(report.today.current.cost, 1)
  assert.equal(report.today.previous.cost, 2)
  assert.equal(report.forecast.daysLeft, 37.49 / (3 / 7))
  assert.equal(report.settings.targetDays, 30)
  assert.equal(report.daily.length, 30)
  assert.equal(report.daily[report.daily.length - 1].day, '2026-11-12')
  assert.equal(report.daily[report.daily.length - 2].cost, 2)
  assert.equal(report.priceTable.currency, 'CNY')
})

test('a report with no balance still carries local usage', () => {
  const now = at('2026-11-12T12:00:00+08:00')
  const report = buildReport({
    events: [event('2026-11-12T10:00:00+08:00', 1)],
    now,
    settings: SETTINGS,
    balance: { status: 'error', currency: '', total: null, granted: null, toppedUp: null, available: false, fetchedAt: '', error: 'HTTP 500' },
    coverage: COVERAGE,
  })
  assert.equal(report.forecast.daysLeft, null)
  assert.equal(report.forecast.suggestedTopUp, null)
  assert.equal(report.rates[0].cost, 1)
})
