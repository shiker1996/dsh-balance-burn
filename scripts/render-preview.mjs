/**
 * Render the real bar and popover with React to a static preview page.
 *
 * The preview is a design aid only: DSH's runtime supplies the CSS alias
 * tokens, so this page defines a close approximation of the light/dark themes.
 *
 * Usage: node scripts/render-preview.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { renderToString } from 'react-dom/server'
import { buildReport } from '../src/metrics.js'
import { priceUsage } from '../src/pricing.js'
import { DAY_MS } from '../src/metrics.js'

const require = createRequire(import.meta.url)
const React = require('react')
const clientPath = fileURLToPath(new URL('../client.js', import.meta.url))
const source = await readFile(clientPath, 'utf8')

globalThis.window = {
  innerWidth: 900,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
}
globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
}

let module
globalThis.window.__ModuleLoader__ = {
  load(definition) {
    module = definition.factory(() => React)
  },
}
new Function('window', 'document', 'navigator', source)(globalThis.window, globalThis.document, {})

const NOW = Date.parse('2026-11-12T11:40:00+08:00')
const records = [
  [3 * 3_600_000, 'deepseek-flash', 420_000, 96_000, 18_400_000],
  [4 * 3_600_000, 'deepseek-flash', 88_000, 12_000, 3_100_000],
  [DAY_MS + 5 * 3_600_000, 'deepseek-flash', 310_000, 64_000, 9_800_000],
  [2 * DAY_MS, 'deepseek-flash', 205_000, 41_000, 5_400_000],
  [3 * DAY_MS, 'deepseek-flash', 1_530_000, 555_000, 154_900_000],
  [4 * DAY_MS, 'deepseek-flash', 336_000, 100_000, 13_200_000],
  [5 * DAY_MS, 'deepseek-flash', 622_000, 214_000, 34_300_000],
  [7 * DAY_MS, 'deepseek-flash', 120_000, 3_600, 855_000],
  [8 * DAY_MS, 'deepseek-flash', 327_000, 146_000, 27_800_000],
  [13 * DAY_MS, 'deepseek-flash', 48_000, 6_800, 229_000],
  [23 * DAY_MS, 'deepseek-flash', 1_633_000, 639_000, 527_800_000],
  [24 * DAY_MS, 'deepseek-flash', 84_000, 116_000, 12_520_000],
].map(([ago, model, input, output, cacheRead]) => {
  const record = { t: NOW - ago, model, input, output, cacheRead, cacheWrite: 0 }
  const priced = priceUsage(record, model, record.t)
  return {
    ...record,
    cost: priced.cost,
    billedTokens: input + output,
    cacheReadTokens: cacheRead,
  }
})

const report = buildReport({
  events: records,
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
    sessions: 69,
    files: 69,
    events: 4255,
    daysWithData: 9,
    firstDay: '2026-08-14',
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

const t = (key, values) => {
  let text = dictionaries?.zh?.[key] ?? key
  for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value))
  return text
}
const noop = () => {}

let dictionaries
const registered = []
module.apply({
  effect(fn) {
    fn()
  },
  locale: {
    bind: () => t,
    register(namespace, value) {
      dictionaries = value
      return () => {}
    },
  },
  slots: {
    inject(name, callback) {
      callback()
    },
    register(options, component) {
      registered.push({ options, component })
      return () => {}
    },
  },
})

const components = module.__components
const bar = renderToString(
  React.createElement(components.Bar, {
    t,
    open: true,
    report,
    error: null,
    phase: 'ready',
    refreshing: false,
    onOpen: noop,
    onRefresh: noop,
    triggerRef: { current: null },
  }),
)
const popover = renderToString(
  React.createElement(components.Popover, {
    report,
    error: null,
    anchor: { left: 16, top: 640 },
    onClose: noop,
    onSave: noop,
    saving: false,
    t,
    closeRef: { current: null },
    popoverRef: { current: null },
  }),
)
const settings = renderToString(
  React.createElement(
    'div',
    { className: 'bb-page' },
    React.createElement('h2', null, t('sectionTitle')),
    React.createElement('p', null, t('sectionDesc')),
    React.createElement(components.SettingsFields, {
      report: {
        ...report,
        settings: { ...report.settings, holidays: '2026-10-01, 2026-10-02' },
      },
      saving: false,
      onSave: noop,
      t,
      includeHolidays: true,
    }),
    React.createElement(components.PriceTable, { report, t }),
  ),
)

const css = module.__css

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dsh-balance-burn · UI 预览</title>
<style>
:root {
  color-scheme: light;
  --dsw-alias-bg-base: #ffffff;
  --dsw-alias-bg-layer-1: #ffffff;
  --dsw-alias-bg-layer-2: #f2f3f5;
  --dsw-alias-label-primary: #16181d;
  --dsw-alias-label-secondary: #4d5361;
  --dsw-alias-label-tertiary: #8b909c;
  --dsw-alias-border-l2: #e3e5e9;
  --dsw-alias-border-l3: #eceef1;
  --dsw-alias-interactive-bg-hover: #f2f3f5;
  --dsw-alias-state-warn-primary: #b25e09;
  --dsw-alias-state-error-primary: #c0392b;
  --dsw-alias-state-business-primary: #3f6ae0;
  --dsw-alias-state-success-primary: #2f8a5b;
  --dsw-radius-sm: 6px;
  --dsw-radius-md: 12px;
  --dsw-elevation-panel: 0 10px 30px rgba(16, 20, 30, 0.14), 0 2px 6px rgba(16, 20, 30, 0.08);
}
body {
  margin: 0;
  padding: 28px 24px 40px;
  background: #f6f7f9;
  color: #16181d;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}
.wrap { max-width: 980px; margin: 0 auto; }
h1 { margin: 0 0 4px; font-size: 20px; }
.lede { margin: 0 0 22px; color: #5b6070; font-size: 13px; line-height: 1.7; }
.card { background: #fff; border: 1px solid #e3e5e9; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,20,30,.04); }
.card + .card { margin-top: 18px; }
.card-head { padding: 10px 14px; border-bottom: 1px solid #eceef1; font-size: 12px; color: #6b7080; display: flex; gap: 8px; align-items: center; }
.card-body { padding: 16px; }
.card-body.dark, .dark {
  color-scheme: dark;
  --dsw-alias-bg-base: #17191f;
  --dsw-alias-bg-layer-1: #1d2028;
  --dsw-alias-bg-layer-2: #262a34;
  --dsw-alias-label-primary: #f0f1f4;
  --dsw-alias-label-secondary: #b9bdc8;
  --dsw-alias-label-tertiary: #8a8f9c;
  --dsw-alias-border-l2: #333844;
  --dsw-alias-border-l3: #2a2e38;
  --dsw-alias-interactive-bg-hover: #262a34;
  --dsw-alias-state-warn-primary: #e0a15a;
  --dsw-alias-state-error-primary: #e56a5a;
  --dsw-alias-state-business-primary: #6c93f0;
  background: #17191f;
  color: #f0f1f4;
}
.bar-frame { margin-top: 10px; border: 1px solid #e3e5e9; border-radius: 10px; overflow: hidden; }
.mock-chat { padding: 14px; font-size: 12px; color: #8b909c; border-bottom: 1px dashed #e3e5e9; }
.mock-chat p { margin: 0 0 6px; }
.popover-slot { position: relative; }
.popover-slot .bb-pop { position: static !important; width: 400px !important; max-height: none !important; left: auto !important; bottom: auto !important; }
.two { display: grid; grid-template-columns: minmax(0, 420px) minmax(0, 1fr); gap: 18px; align-items: start; }
.note { margin: 10px 0 0; font-size: 11px; color: #8b909c; line-height: 1.7; }
${css}
.dark .bb-bar { background: #1d2028; }
.dark .bb-pop { background: #1d2028; }
@media (max-width: 760px) { .two { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="wrap">
  <h1>dsh-balance-burn · 界面预览</h1>
  <p class="lede">用插件真实组件渲染的静态预览，数据为样例。颜色取自 DSH 主题变量的近似值；运行时由宿主提供真实 token。</p>

  <section class="card">
    <div class="card-head">底栏（shell.bottom）</div>
    <div class="card-body">
      <div class="mock-chat">
        <p>会话区域……</p>
        <p>底栏常驻在窗口最下方。</p>
      </div>
      <div class="bar-frame">${bar}</div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">浮层（点击底栏打开，Esc 关闭）</div>
    <div class="card-body two">
      <div class="popover-slot">${popover}</div>
      <div>
        <p class="note">
          四块内容：余额与预测、1/7/30 天速率、日/周/月对比（可切换金额与计费 token）、充值建议（目标天数与金额互相反算）。
          页脚给出本机口径、数据覆盖、单价版本与刷新时间。
        </p>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">深色主题</div>
    <div class="card-body dark">
      <div class="bar-frame">${bar}</div>
      <div class="popover-slot">${popover}</div>
    </div>
  </section>

  <section class="card">
    <div class="card-head">设置页（Settings → 余额与消耗）</div>
    <div class="card-body">${settings}</div>
  </section>
</div>
</body>
</html>
`

await mkdir(new URL('../preview/', import.meta.url), { recursive: true })
const target = fileURLToPath(new URL('../preview/ui-preview.html', import.meta.url))
await writeFile(target, page, 'utf8')
console.log('wrote', target, `${page.length} bytes`)
