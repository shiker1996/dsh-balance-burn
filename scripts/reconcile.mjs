/**
 * Reconcile local DSH usage against a platform billing export.
 *
 * The export pair is:
 * - `cost-*.csv`: per day, wallet and model total charged (CNY).
 * - `amount-*.csv`: per day, per price tier: price, token count / call count.
 *
 * Usage: node scripts/reconcile.mjs [samplesDir]
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createUsageStore } from '../src/usage-store.js'
import { priceUsage, isPeak, shanghaiParts } from '../src/pricing.js'
import { resolveDshHome } from '../src/settings.js'

const dir = resolve(process.argv[2] ?? 'samples')
const files = await readdir(dir)
const amountFile = files.find((name) => name.startsWith('amount-') && name.endsWith('.csv'))
const costFile = files.find((name) => name.startsWith('cost-') && name.endsWith('.csv'))
if (amountFile === undefined || costFile === undefined) {
  console.error('Expected amount-*.csv and cost-*.csv in', dir)
  process.exit(1)
}

/**
 * Parse one simple CSV file (no embedded commas in these exports).
 *
 * @param {string} path - file path.
 * @returns {Promise<Array<Record<string, string>>>} row objects.
 */
async function parseCsv(path) {
  const text = (await readFile(path, 'utf8')).replace(/^\uFEFF/u, '')
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== '')
  const header = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']))
  })
}

const amountRows = await parseCsv(join(dir, amountFile))
const costRows = await parseCsv(join(dir, costFile))

const platform = new Map()
const ensureDay = (day) => {
  let entry = platform.get(day)
  if (entry === undefined) {
    entry = {
      costTokens: 0,
      costSearch: 0,
      costAll: 0,
      requests: 0,
      tokens: { missPeak: 0, missOff: 0, outputPeak: 0, outputOff: 0, hitPeak: 0, hitOff: 0 },
      tokensAny: { miss: 0, output: 0, hit: 0 },
    }
    platform.set(day, entry)
  }
  return entry
}

const priceTier = (type, price) => {
  // Flash prices: hit 0.02/0.04, miss 1/2, output 4/8 per token.
  if (type === 'input_cache_hit_tokens') return price >= 0.00000003 ? 'peak' : 'off'
  if (type === 'input_cache_miss_tokens') return price >= 0.0000015 ? 'peak' : 'off'
  if (type === 'output_tokens') return price >= 0.000006 ? 'peak' : 'off'
  return 'off'
}

for (const row of amountRows) {
  const day = row.start_time_iso.slice(0, 10)
  const entry = ensureDay(day)
  const price = Number(row.price)
  const amount = Number(row.amount)
  if (!Number.isFinite(amount)) continue
  if (row.type === 'request_count') {
    entry.requests += amount
    continue
  }
  if (row.type === 'function_call') {
    entry.costSearch += price * amount
    entry.costAll += price * amount
    continue
  }
  const tier = priceTier(row.type, price)
  if (row.type === 'input_cache_hit_tokens') {
    entry.tokens.hitPeak += tier === 'peak' ? amount : 0
    entry.tokens.hitOff += tier === 'off' ? amount : 0
    entry.tokensAny.hit += amount
  } else if (row.type === 'input_cache_miss_tokens') {
    entry.tokens.missPeak += tier === 'peak' ? amount : 0
    entry.tokens.missOff += tier === 'off' ? amount : 0
    entry.tokensAny.miss += amount
  } else if (row.type === 'output_tokens') {
    entry.tokens.outputPeak += tier === 'peak' ? amount : 0
    entry.tokens.outputOff += tier === 'off' ? amount : 0
    entry.tokensAny.output += amount
  }
  const cost = price * amount
  entry.costTokens += cost
  entry.costAll += cost
}

const costByDay = new Map()
for (const row of costRows) {
  const day = row.start_time_iso.slice(0, 10)
  costByDay.set(day, (costByDay.get(day) ?? 0) + Number(row.cost))
}

const home = resolveDshHome(process.env.DSH_HOME)
const store = createUsageStore({ root: join(home, 'sessions') })
const { events } = await store.read({ now: Date.now() })

const local = new Map()
const ensureLocal = (day) => {
  let entry = local.get(day)
  if (entry === undefined) {
    entry = { cost: 0, requests: 0, tokens: { missPeak: 0, missOff: 0, outputPeak: 0, outputOff: 0, hitPeak: 0, hitOff: 0 } }
    local.set(day, entry)
  }
  return entry
}

for (const event of events) {
  const day = shanghaiParts(event.t).dayKey
  const entry = ensureLocal(day)
  const peak = isPeak(event.t)
  const priced = priceUsage(event, event.model, event.t)
  entry.cost += priced.cost ?? 0
  entry.requests += 1
  entry.tokens.missPeak += peak ? event.input : 0
  entry.tokens.missOff += peak ? 0 : event.input
  entry.tokens.outputPeak += peak ? event.output : 0
  entry.tokens.outputOff += peak ? 0 : event.output
  entry.tokens.hitPeak += peak ? event.cacheRead : 0
  entry.tokens.hitOff += peak ? 0 : event.cacheRead
}

const days = [...new Set([...platform.keys(), ...local.keys()])].sort()
const mismatched = [...costByDay.entries()].filter(([day, value]) => Math.abs(value - (platform.get(day)?.costAll ?? 0)) > 0.001)
if (mismatched.length > 0) {
  console.error('cost-*.csv and amount-*.csv disagree on:', mismatched)
}
const money = (value) => (value === undefined ? '—' : value.toFixed(2))
const int = (value) => (value === undefined ? '—' : Math.round(value).toLocaleString('en-US'))
const pct = (a, b) => (b === 0 ? '—' : `${(((a - b) / b) * 100).toFixed(1)}%`)

const lines = []
const exportDays = [...costByDay.keys()].sort()
const firstDay = exportDays[0]
const lastDay = exportDays[exportDays.length - 1]
let totalPlatform = 0
let totalLocal = 0
for (const day of days) {
  const p = platform.get(day)
  const l = local.get(day)
  const inRange = day >= firstDay && day <= lastDay
  const platformCost = p === undefined ? 0 : p.costAll
  const localCost = l?.cost ?? 0
  if (inRange) {
    totalPlatform += platformCost
    totalLocal += localCost
  }
  const costFileValue = costByDay.get(day) ?? 0
  lines.push({
    day,
    inRange,
    platformCost,
    costFileValue,
    tokenCost: p?.costTokens ?? 0,
    searchCost: p?.costSearch ?? 0,
    localCost,
    requests: p?.requests ?? 0,
    localRequests: l?.requests ?? 0,
    tokens: p?.tokensAny ?? { miss: 0, output: 0, hit: 0 },
    localTokens: {
      miss: (l?.tokens.missPeak ?? 0) + (l?.tokens.missOff ?? 0),
      output: (l?.tokens.outputPeak ?? 0) + (l?.tokens.outputOff ?? 0),
      hit: (l?.tokens.hitPeak ?? 0) + (l?.tokens.hitOff ?? 0),
    },
    split: { platform: p?.tokens, local: l?.tokens },
  })
}

const lines2 = []
lines2.push('# 平台账单 vs 本机日志 对账')
lines2.push('')
lines2.push(`> 导出：\`${amountFile}\` / \`${costFile}\`；日志：\`${home}\\sessions\``)
lines2.push(`> 导出覆盖：${firstDay} ~ ${lastDay}（最后一天是导出时刻的快照，本机日志可能多出导出后的几分钟）`)
lines2.push(`> 生成时间：${new Date().toISOString()}`)
lines2.push('')
lines2.push('## 每日金额与请求数')
lines2.push('')
lines2.push('| 日期 | 平台金额 | token 金额 | 搜索费 | 本机推算 | 差额 | 差额% | 平台请求 | 本机记录 | 缺失请求 |')
lines2.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const line of lines) {
  if (!line.inRange) {
    lines2.push(
      `| ${line.day} | 范围外 | — | — | ${money(line.localCost)} | — | — | — | ${int(line.localRequests)} | — |`,
    )
    continue
  }
  lines2.push(
    `| ${line.day} | ${money(line.platformCost)} | ${money(line.tokenCost)} | ${money(line.searchCost)} | ${money(line.localCost)} | ${money(line.localCost - line.platformCost)} | ${pct(line.localCost, line.platformCost)} | ${int(line.requests)} | ${int(line.localRequests)} | ${int(line.requests - line.localRequests)} |`,
  )
}
lines2.push(
  `| **合计（导出范围内）** | **${money(totalPlatform)}** | | | **${money(totalLocal)}** | **${money(totalLocal - totalPlatform)}** | **${pct(totalLocal, totalPlatform)}** | | | |`,
)
lines2.push('')
lines2.push('## 每日 token：平台 vs 本机')
lines2.push('')
lines2.push('| 日期 | 平台未命中 | 本机未命中 | 平台输出 | 本机输出 | 平台缓存读 | 本机缓存读 |')
lines2.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
for (const line of lines) {
  if (!line.inRange) {
    lines2.push(`| ${line.day} | 范围外 | — | 范围外 | — | 范围外 | — |`)
    continue
  }
  lines2.push(
    `| ${line.day} | ${int(line.tokens.miss)} | ${int(line.localTokens.miss)} | ${int(line.tokens.output)} | ${int(line.localTokens.output)} | ${int(line.tokens.hit)} | ${int(line.localTokens.hit)} |`,
  )
}
lines2.push('')
lines2.push('## 峰谷拆分（平台 vs 本机）')
lines2.push('')
lines2.push('| 日期 | 平台 峰/闲 未命中 | 本机 峰/闲 未命中 | 平台 峰/闲 输出 | 本机 峰/闲 输出 |')
lines2.push('| --- | ---: | ---: | ---: | ---: |')
for (const line of lines) {
  if (!line.inRange) {
    lines2.push(`| ${line.day} | 范围外 | — | 范围外 | — |`)
    continue
  }
  const p = line.split.platform ?? { missPeak: 0, missOff: 0, outputPeak: 0, outputOff: 0 }
  const l = line.split.local ?? { missPeak: 0, missOff: 0, outputPeak: 0, outputOff: 0 }
  lines2.push(
    `| ${line.day} | ${int(p.missPeak)} / ${int(p.missOff)} | ${int(l.missPeak)} / ${int(l.missOff)} | ${int(p.outputPeak)} / ${int(p.outputOff)} | ${int(l.outputPeak)} / ${int(l.outputOff)} |`,
  )
}

const report = lines2.join('\n')
console.log(report)
const target = join(dir, 'reconciliation.md')
await writeFile(target, `${report}\n`, 'utf8')
console.error('wrote', target)
