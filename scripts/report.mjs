/**
 * Print one live snapshot from the real DSH home, for design verification.
 *
 * Usage: node scripts/report.mjs [--json]
 */

import { createSnapshotService } from '../src/snapshot.js'
import { resolveDshHome } from '../src/settings.js'

const json = process.argv.includes('--json')
const home = resolveDshHome(process.env.DSH_HOME)
const service = createSnapshotService({ home, resolveKey: async () => undefined })
const report = await service.getSnapshot({ refresh: true })

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const money = (value) =>
    value === null || value === undefined ? '—' : `¥${Number(value).toFixed(2)}`
  console.log('home', home)
  console.log('coverage', report.coverage)
  console.log('balance', report.balance.status, report.balance.error ?? '')
  console.log('today', money(report.today.current.cost), 'yesterday-same-span', money(report.today.previous.cost))
  console.log('week', money(report.week.current.cost), 'previous', money(report.week.previous.cost))
  console.log('month', money(report.month.current.cost), 'previous', money(report.month.previous.cost))
  for (const rate of report.rates) {
    console.log(
      rate.key,
      'billed', rate.billedTokens,
      'cacheRead', rate.cacheReadTokens,
      'cost', money(rate.cost),
      'perDay', money(rate.perDay),
      'daysWithData', `${rate.daysWithData}/${rate.days}`,
    )
  }
  console.log('forecast', report.forecast)
  console.log('price', report.priceTable.version, report.priceTable.models.length, 'models')
}
