import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildReport } from '../src/metrics.js'
import { DEFAULT_SETTINGS } from '../src/settings.js'
import { priceUsage } from '../src/pricing.js'
import { DAY_MS } from '../src/metrics.js'

const clientPath = fileURLToPath(new URL('../client.js', import.meta.url))
const NOW = Date.parse('2026-11-12T12:00:00+08:00')

/**
 * Minimal React stand-in: enough hook surface for the module's render path.
 *
 * @returns {object} a React-shaped object.
 */
function fakeReact() {
  const Fragment = Symbol('Fragment')
  return {
    Fragment,
    createElement(type, props, ...children) {
      return { type, props: { ...(props ?? {}), children } }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useRef(initial) {
      return { current: initial ?? null }
    },
    useEffect() {},
    useCallback(fn) {
      return fn
    },
    useMemo(fn) {
      return fn()
    },
  }
}

/**
 * Execute client.js against stub globals and return its module face.
 *
 * @returns {Promise<object>} the module returned by the loader factory.
 */
async function loadClient() {
  const source = await readFile(clientPath, 'utf8')
  let loaded
  const window = {
    __ModuleLoader__: {
      load(definition) {
        loaded = definition.factory(() => fakeReact())
      },
    },
  }
  const evaluate = new Function('window', 'document', 'navigator', source)
  evaluate(window, { addEventListener() {}, removeEventListener() {} }, {})
  assert.ok(loaded !== undefined)
  return loaded
}

const t = (key, values) => {
  let text = key
  for (const [name, value] of Object.entries(values ?? {})) {
    text = text.replace(`{${name}}`, String(value))
  }
  return text
}

function sampleReport() {
  const events = [
    { t: NOW - 3_600_000, model: 'deepseek-flash', input: 100_000, output: 20_000, cacheRead: 2_000_000, cacheWrite: 0 },
    { t: NOW - 2 * DAY_MS, model: 'deepseek-flash', input: 200_000, output: 40_000, cacheRead: 4_000_000, cacheWrite: 0 },
    { t: NOW - 9 * DAY_MS, model: 'deepseek-v4-pro', input: 50_000, output: 10_000, cacheRead: 1_000_000, cacheWrite: 0 },
  ].map((record) => {
    const priced = priceUsage(record, record.model, record.t)
    return { ...record, cost: priced.cost, billedTokens: record.input + record.output, cacheReadTokens: record.cacheRead }
  })

  const report = buildReport({
    events,
    now: NOW,
    settings: { targetDays: 30, safetyCushion: 5, primaryWindow: 'r7', refreshSeconds: 60 },
    balance: {
      status: 'ok',
      currency: 'CNY',
      total: 37.49,
      granted: 5.77,
      toppedUp: 31.71,
      available: true,
      fetchedAt: new Date(NOW).toISOString(),
      error: null,
    },
    coverage: {
      sessions: 12,
      files: 12,
      events: 3,
      daysWithData: 3,
      firstDay: '2026-11-03',
      lastDay: '2026-11-12',
      duplicates: 0,
      unpricedEvents: 0,
      unpricedModels: [],
      unreadableFiles: 0,
      tornFrames: 0,
    },
  })
  report.accountDelta = {
    day: '2026-11-12',
    spend: 7.4,
    total: 37.49,
    previousDay: '2026-11-11',
    previousTotal: 44.89,
    currency: 'CNY',
  }
  return report
}

test('the client module loads, applies, and registers both slots', async () => {
  const module = await loadClient()
  assert.deepEqual(module.inject, ['slots', 'locale'])
  assert.deepEqual(module.__defaults, DEFAULT_SETTINGS)

  const registered = []
  const ctx = {
    effect(fn) {
      fn()
    },
    locale: {
      bind: () => t,
      register: () => () => {},
    },
    slots: {
      inject(name, callback) {
        callback()
      },
      register(options, component) {
        registered.push({ name: options.name, id: options.id, component })
        return () => {}
      },
    },
  }
  module.apply(ctx)
  assert.deepEqual(
    registered.map((entry) => entry.name),
    ['shell.bottom', 'settings.section'],
  )
  assert.equal(registered[1].id, 'balance-burn')
})

test('every presentation component renders a tree without throwing', async () => {
  const module = await loadClient()
  const report = sampleReport()
  const components = module.__components
  const noop = () => {}
  const anchor = { left: 40, top: 500 }

  const trees = {
    bar: components.Bar({
      t,
      open: false,
      report,
      error: null,
      phase: 'ready',
      refreshing: false,
      onOpen: noop,
      onRefresh: noop,
      triggerRef: { current: null },
    }),
    popover: components.Popover({
      report,
      error: null,
      anchor,
      onClose: noop,
      onSave: noop,
      saving: false,
      t,
      closeRef: { current: null },
      popoverRef: { current: null },
    }),
    balance: components.BalanceBlock({ report, t }),
    rates: components.RatesBlock({ report, t }),
    compare: components.CompareBlock({ report, t }),
    topUp: components.TopUpBlock({ report, t, onSave: noop, saving: false }),
    footer: components.CoverageFooter({ report, error: null, t }),
    settings: components.SettingsFields({ report, saving: false, onSave: noop, t, includeHolidays: true }),
    price: components.PriceTable({ report, t }),
  }

  for (const [name, tree] of Object.entries(trees)) {
    assert.ok(tree !== null && typeof tree === 'object', `${name} rendered nothing`)
    assert.ok(tree.type !== undefined, `${name} should render an element`)
  }

  // Minimum and target days are separate figures with separate jobs.
  const bar = JSON.stringify(trees.bar)
  assert.ok(bar.includes('minDaysShort'))
  assert.ok(bar.includes('targetShort'))
  assert.ok(bar.includes('bb-meter-fill'))
  const topUp = JSON.stringify(trees.topUp)
  assert.ok(topUp.includes('https://platform.deepseek.com/top_up'))
  assert.ok(topUp.includes('topUpNow'))
  const facts = JSON.stringify(trees.balance)
  assert.ok(facts.includes('minDaysLabel'))
  assert.ok(facts.includes('maxDaysLabel'))

  // Acceptance #3: a day without usage is drawn as a baseline tick, never a
  // zero-height bar that would read as "spent nothing".
  const rates = JSON.stringify(trees.rates)
  assert.ok(rates.includes('bb-spark-bar bb-empty'))
  assert.ok(rates.includes('"height":"2px"'))
})

test('the bar degrades to a loading and an error label', async () => {
  const module = await loadClient()
  const noop = () => {}
  const loading = module.__components.Bar({
    t,
    open: false,
    report: null,
    error: null,
    phase: 'loading',
    refreshing: true,
    onOpen: noop,
    onRefresh: noop,
    triggerRef: { current: null },
  })
  assert.ok(JSON.stringify(loading).includes('loading'))

  const failed = module.__components.Bar({
    t,
    open: false,
    report: null,
    error: 'HTTP 500',
    phase: 'error',
    refreshing: false,
    onOpen: noop,
    onRefresh: noop,
    triggerRef: { current: null },
  })
  assert.ok(JSON.stringify(failed).includes('unavailable'))
})

test('a report with no balance renders without a divide-by-zero', async () => {
  const module = await loadClient()
  const report = sampleReport()
  report.balance = {
    status: 'unconfigured',
    currency: '',
    total: null,
    granted: null,
    toppedUp: null,
    available: false,
    fetchedAt: '',
    error: 'No DEEPSEEK_API_KEY is configured.',
  }
  report.forecast = { ...report.forecast, balance: null, daysLeft: null, daysLow: null, daysHigh: null, suggestedTopUp: null }
  const tree = module.__components.Popover({
    report,
    error: null,
    anchor: { left: 10, top: 400 },
    onClose: () => {},
    onSave: () => {},
    saving: false,
    t,
    closeRef: { current: null },
    popoverRef: { current: null },
  })
  assert.ok(JSON.stringify(tree).includes('unconfigured'))
})
