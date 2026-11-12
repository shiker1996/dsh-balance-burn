window.__ModuleLoader__.load({
  id: 'dsh-balance-burn',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'balanceBurn'
    const ROUTE = '/api/balance-burn'
    const SETTINGS_ROUTE = '/api/balance-burn/settings'
    /** Kept in step with `src/settings.js`; a test asserts equality. */
    const DEFAULT_SETTINGS = Object.freeze({
      targetDays: 30,
      safetyCushion: 5,
      primaryWindow: 'r7',
      refreshSeconds: 60,
      holidays: '',
    })
    const zh = {
      barLabel: '余额与消耗',
      openDetails: '打开余额与消耗详情',
      loading: '读取中…',
      unavailable: '余额看板不可用',
      balanceUnavailable: '余额不可用',
      heroBalance: '余额',
      todayLabel: '今日',
      gaugeTarget: '目标 {days} 天',
      accountScope: '账号口径',
      vsLocal: '较本机 {amount}',
      minDaysShort: '最低 {days} 天',
      targetShort: '目标 {days} 天',
      minDaysLabel: '最低可用',
      maxDaysLabel: '最长可用',
      noRate: '数据不足',
      today: '今日 {amount}',
      noData: '暂无消耗记录',
      updated: '更新于 {time}',
      stale: '上次读数',
      compareNote: '今日 vs 昨日同时段；周/月为截至现在的等长滚动窗口',
      refresh: '刷新余额与消耗',
      refreshing: '正在刷新',
      close: '关闭',
      dialogTitle: '余额与消耗',
      localScope: '本机口径',
      balanceTitle: '余额与预测',
      available: '可用',
      notAvailable: '余额不足',
      granted: '赠送',
      toppedUp: '充值',
      primaryRate: '主速率',
      perDay: '{amount}/天',
      daysLeft: '预计可用',
      range: '区间',
      method: '口径：最低 = 余额 ÷ max(r7, r30)，最长 = 余额 ÷ min(r7, r30)；主速率取近 {days}×24 小时；无数据日不计入。',
      balanceError: '无法读取余额：{reason}',
      unconfigured: '未配置 DEEPSEEK_API_KEY，仅显示本机消耗。',
      currencyMismatch: '余额币种为 {currency}，与单价表（人民币）不一致，无法折算天数。',
      ratesTitle: '速率',
      window: '口径',
      billedTokens: '计费 token',
      cacheTokens: '缓存 token',
      amount: '金额',
      perDayShort: '日均',
      rateDay1: '近 1 天',
      rateDay7: '近 7 天',
      rateDay30: '近 30 天',
      coverageDays: '有数据 {days} 天',
      sparkTitle: '近 30 天（柱高 = 当日金额，短线 = 无数据）',
      sparkEmpty: '无数据',
      compareTitle: '对比',
      byCost: '按金额',
      byToken: '按 token',
      current: '本期',
      previous: '上期',
      compareToday: '今日',
      compareWeek: '近 7 天',
      compareMonth: '近 30 天',
      changeNew: '新增',
      noBaseline: '—',
      topUpTitle: '充值建议',
      suggestedLabel: '建议充值',
      suggested: '建议充值 {amount}',
      targetDays: '目标天数',
      dayUnit: '天',
      cushion: '安全垫',
      formula: '建议 = 向上取整到 10 元（日均 × 目标天数 + 安全垫 − 余额）',
      modeDays: '我想用 N 天',
      modeAmount: '我充 ¥X',
      needAmount: '需要充值',
      modeLabel: '计算方式',
      wantDays: '想用天数',
      topUpAmount: '充值金额',
      daysFor: '可用天数',
      copy: '复制金额',
      copied: '已复制',
      advanced: '更多设置',
      primaryWindow: '主速率口径',
      refreshSeconds: '刷新周期',
      secondUnit: '秒',
      saving: '保存中…',
      saved: '已保存',
      saveError: '设置未保存：{reason}',
      coverage: '{sessions} 个会话 · {events} 条记录 · {days} 天有数据',
      priceVersion: '单价 {version}',
      footnote: '只统计本机 DSH 会话日志，通常略低于平台账单；历史价格变动未回溯。',
      unpriced: '{count} 条记录没有对应单价（{models}），未计入金额。',
      unreadable: '{count} 个会话文件无法读取。',
      torn: '{count} 个会话中有未写完的批次，已忽略该批次。',
      sectionNav: '余额与消耗',
      sectionTitle: '余额与消耗',
      sectionDesc: '底栏常驻显示余额、最低可用天数与今日消耗；展开可看 1/7/30 天速率、对比和充值建议。只读取本机 DSH 会话日志。',
      targetHint: '目标天数决定建议充值，也是底栏「最低 N 天 / 目标 M 天」的提醒线。',
      holidays: '节假日（停峰）',
      holidaysHint: '北京时间法定节假日的日期，格式 YYYY-MM-DD，逗号分隔。当天全天按空闲价计费；不填则只按工作日峰时判断。',
      priceTableTitle: '单价表',
      priceTableNote: '每百万 token，人民币；格式为「空闲 / 峰时」。峰时：工作日 9:00–12:00、14:00–18:00（节假日除外）。',
      reset: '恢复默认',
      priceSource: '官方价格页',
      cacheHit: '缓存命中',
      cacheMiss: '缓存未命中',
      output: '输出',
      settingsHint: '修改即时生效；单价表只读，用于对账。',
      confirmReset: '恢复默认设置？',
      toAccount: '余额来自 DeepSeek `/user/balance`，不抓取平台账单。',
    }

    const en = {
      barLabel: 'Balance and burn',
      openDetails: 'Open balance and burn details',
      loading: 'Reading…',
      unavailable: 'Balance panel unavailable',
      balanceUnavailable: 'Balance unavailable',
      heroBalance: 'Balance',
      todayLabel: 'Today',
      gaugeTarget: 'target {days} days',
      accountScope: 'Account-wide',
      vsLocal: 'vs local {amount}',
      minDaysShort: 'min {days} days',
      targetShort: 'target {days} days',
      minDaysLabel: 'Minimum',
      maxDaysLabel: 'Maximum',
      noRate: 'not enough data',
      today: 'today {amount}',
      noData: 'no usage logged',
      updated: 'updated {time}',
      stale: 'last reading',
      compareNote: 'Today compares with the same clock window yesterday; week and month are equal rolling windows ending now.',
      refresh: 'Refresh balance and usage',
      refreshing: 'Refreshing',
      close: 'Close',
      dialogTitle: 'Balance and burn',
      localScope: 'this machine',
      balanceTitle: 'Balance and forecast',
      available: 'available',
      notAvailable: 'insufficient balance',
      granted: 'granted',
      toppedUp: 'topped up',
      primaryRate: 'Primary rate',
      perDay: '{amount}/day',
      daysLeft: 'Days left',
      range: 'Range',
      method: 'Method: minimum = balance ÷ max(r7, r30), maximum = balance ÷ min(r7, r30); the primary rate uses the last {days}×24h; days without data are excluded.',
      balanceError: 'Could not read the balance: {reason}',
      unconfigured: 'DEEPSEEK_API_KEY is not configured; local usage only.',
      currencyMismatch: 'The balance is in {currency} while the price table is in CNY, so days cannot be derived.',
      ratesTitle: 'Rates',
      window: 'Window',
      billedTokens: 'Billed tokens',
      cacheTokens: 'Cache tokens',
      amount: 'Cost',
      perDayShort: 'Per day',
      rateDay1: 'Last 1 day',
      rateDay7: 'Last 7 days',
      rateDay30: 'Last 30 days',
      coverageDays: '{days} days with data',
      sparkTitle: 'Last 30 days (bar = daily cost, tick = no data)',
      sparkEmpty: 'no data',
      compareTitle: 'Compare',
      byCost: 'By cost',
      byToken: 'By tokens',
      current: 'Current',
      previous: 'Previous',
      compareToday: 'Today',
      compareWeek: 'Last 7 days',
      compareMonth: 'Last 30 days',
      changeNew: 'new',
      noBaseline: '—',
      topUpTitle: 'Top-up advice',
      suggestedLabel: 'Suggested top-up',
      suggested: 'Suggested top-up {amount}',
      targetDays: 'Target days',
      dayUnit: 'days',
      cushion: 'Safety cushion',
      formula: 'Suggested = round up to ¥10 (daily rate × target days + cushion − balance)',
      modeDays: 'I need N days',
      modeAmount: 'I top up ¥X',
      needAmount: 'Top-up needed',
      modeLabel: 'Calculator',
      wantDays: 'Days wanted',
      topUpAmount: 'Top-up amount',
      daysFor: 'Days available',
      copy: 'Copy amount',
      copied: 'Copied',
      advanced: 'More settings',
      primaryWindow: 'Primary rate',
      refreshSeconds: 'Refresh every',
      secondUnit: 's',
      saving: 'Saving…',
      saved: 'Saved',
      saveError: 'Settings not saved: {reason}',
      coverage: '{sessions} sessions · {events} records · {days} days with data',
      priceVersion: 'prices {version}',
      footnote: 'Counts this machine’s DSH sessions only and usually runs slightly below the platform bill; historical price changes are not applied.',
      unpriced: '{count} records have no published price ({models}) and are excluded from cost.',
      unreadable: '{count} session files could not be read.',
      torn: '{count} sessions had an unfinished batch; it was ignored.',
      sectionNav: 'Balance and burn',
      sectionTitle: 'Balance and burn',
      sectionDesc: 'The footer keeps the balance, minimum days, and today’s spend visible; open it for 1/7/30-day rates, comparisons, and top-up advice. It reads local DSH session logs only.',
      targetHint: 'The target drives the top-up suggestion and is the threshold shown as “min N / target M days” in the footer.',
      holidays: 'Holidays (off-peak)',
      holidaysHint: 'China public holiday dates (YYYY-MM-DD, comma separated). Those days bill off-peak; leave empty to use weekday peak hours only.',
      priceTableTitle: 'Price table',
      priceTableNote: 'CNY per million tokens, shown as off-peak / peak. Peak: weekdays 09:00–12:00 and 14:00–18:00 Asia/Shanghai, excluding holidays.',
      reset: 'Reset to defaults',
      priceSource: 'Official pricing page',
      cacheHit: 'cache hit',
      cacheMiss: 'cache miss',
      output: 'output',
      settingsHint: 'Changes apply immediately; the price table is read-only and shown for reconciliation.',
      confirmReset: 'Reset all settings to defaults?',
      toAccount: 'The balance comes from DeepSeek `/user/balance`; platform bills are never scraped.',
    }

    const CSS = `
.bb-bar {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 2px 8px 5px 6px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
}
.bb-bar.bb-alert {
  border-top-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 50%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 6%, var(--dsw-alias-bg-base));
}
.bb-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
  min-width: 0;
  padding: 5px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-align: left;
}
.bb-main:hover, .bb-main[aria-expanded="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.bb-main:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.bb-balance { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.bb-balance.bb-warn { color: var(--dsw-alias-state-warn-primary); }
.bb-balance.bb-muted { color: var(--dsw-alias-label-tertiary); font-weight: 500; }
.bb-sep { flex: none; width: 1px; height: 12px; background: var(--dsw-alias-border-l2); }
.bb-days-wrap { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.bb-status-dot {
  flex: none; width: 6px; height: 6px; border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
}
.bb-status-dot.bb-warn {
  background: var(--dsw-alias-state-warn-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent);
}
.bb-status-dot.bb-muted { background: var(--dsw-alias-label-tertiary); box-shadow: none; }
.bb-days { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.bb-days.bb-warn { color: var(--dsw-alias-state-warn-primary); font-weight: 500; }
.bb-target { color: var(--dsw-alias-label-tertiary); font-weight: 400; }
.bb-today { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.bb-today b { color: var(--dsw-alias-label-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.bb-pill {
  display: inline-flex; align-items: center;
  padding: 1px 6px; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10.5px; font-weight: 500; font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.bb-pill.bb-up {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
  color: var(--dsw-alias-state-warn-primary);
}
.bb-pill.bb-down {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary)) 12%, transparent);
  color: var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary));
}
.bb-tail { display: flex; align-items: center; gap: 2px; margin-left: auto; padding-right: 2px; }
.bb-updated { font-size: 10.5px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.bb-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.bb-iconbtn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.bb-iconbtn:disabled { opacity: 0.5; cursor: default; }
.bb-iconbtn svg { display: block; width: 14px; height: 14px; }

.bb-meter {
  position: absolute; left: 12px; right: 12px; bottom: 1px; height: 2px;
  border-radius: 2px; overflow: hidden;
  background: var(--dsw-alias-border-l2);
}
.bb-meter-fill {
  display: block; height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent), var(--dsw-alias-state-business-primary));
  transition: width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.bb-meter-fill.bb-warn {
  background: linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-state-warn-primary) 50%, transparent), var(--dsw-alias-state-warn-primary));
}
.bb-pop {
  position: fixed; z-index: 60; box-sizing: border-box;
  padding: 15px 18px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 18px 48px rgba(9, 14, 25, 0.18), 0 3px 10px rgba(9, 14, 25, 0.08);
  color: var(--dsw-alias-label-primary);
  overflow: auto;
}
.bb-pop-head { display: flex; align-items: center; gap: 8px; }
.bb-pop-headtext { flex: 1; min-width: 0; }
.bb-pop-title { margin: 0; font-size: 13.5px; font-weight: 600; letter-spacing: 0.01em; }
.bb-badge {
  display: inline-block; margin-left: 7px; padding: 1px 7px;
  border-radius: 999px; background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-tertiary); font-size: 9.5px; font-weight: 400;
  letter-spacing: 0.02em; vertical-align: 1px;
}
.bb-close {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 24px; height: 24px; padding: 0; border: 0; border-radius: 7px;
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.bb-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.bb-close svg { display: block; width: 12px; height: 12px; }
.bb-hero { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.bb-hero-main { flex: 1; min-width: 0; }
.bb-hero-label { margin: 0; font-size: 10.5px; color: var(--dsw-alias-label-tertiary); letter-spacing: 0.03em; }
.bb-hero-amount {
  margin: 2px 0 0; font-size: 28px; font-weight: 600;
  line-height: 1.15; letter-spacing: -0.025em; font-variant-numeric: tabular-nums;
}
.bb-hero-split { margin: 4px 0 0; font-size: 11px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.bb-gauge-wrap { flex: none; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.bb-gauge { position: relative; width: 76px; height: 76px; display: grid; place-items: center; }
.bb-gauge svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.bb-gauge-track { fill: none; stroke: var(--dsw-alias-bg-layer-2); stroke-width: 6; }
.bb-gauge-arc { fill: none; stroke: var(--dsw-alias-state-business-primary); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.4s ease; }
.bb-gauge-arc.bb-warn { stroke: var(--dsw-alias-state-warn-primary); }
.bb-gauge-arc.bb-idle { stroke: var(--dsw-alias-border-l2); }
.bb-gauge-text { position: relative; text-align: center; line-height: 1; }
.bb-gauge-num { display: block; font-size: 19px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.bb-gauge-unit { display: block; margin-top: 3px; font-size: 9px; color: var(--dsw-alias-label-tertiary); }
.bb-gauge-sub { font-size: 9.5px; color: var(--dsw-alias-label-tertiary); white-space: nowrap; }
.bb-facts {
  display: grid; grid-template-columns: auto 1fr; gap: 5px 14px;
  margin: 14px 0 0; padding-top: 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
  font-size: 11.5px;
}
.bb-facts dt { color: var(--dsw-alias-label-tertiary); white-space: nowrap; }
.bb-facts dd { margin: 0; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.bb-facts dd b { color: var(--dsw-alias-label-primary); font-weight: 500; }
.bb-facts dd b.bb-warn { color: var(--dsw-alias-state-warn-primary); }
.bb-note { margin: 8px 0 0; font-size: 10.5px; line-height: 1.6; color: var(--dsw-alias-label-tertiary); }
.bb-section { margin-top: 14px; padding-top: 12px; border-top: 0.5px solid var(--dsw-alias-border-l3); }
.bb-section-head { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; }
.bb-section-title {
  margin: 0; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.08em; color: var(--dsw-alias-label-tertiary);
}
.bb-section-note { margin-left: auto; font-size: 10px; color: var(--dsw-alias-label-tertiary); }
.bb-table { width: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.bb-table th {
  padding: 0 0 5px; color: var(--dsw-alias-label-tertiary); font-size: 9.5px;
  font-weight: 400; text-align: right; white-space: nowrap; letter-spacing: 0.03em;
}
.bb-table th:first-child, .bb-table td:first-child { text-align: left; }
.bb-table td {
  padding: 5px 0; color: var(--dsw-alias-label-secondary);
  text-align: right; white-space: nowrap;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
}
.bb-table tr:first-child td { border-top: 0; }
.bb-table td.bb-money { color: var(--dsw-alias-label-primary); font-weight: 500; }
.bb-table .bb-gap { color: var(--dsw-alias-label-tertiary); }
.bb-spark-title { margin: 10px 0 0; font-size: 9.5px; color: var(--dsw-alias-label-tertiary); letter-spacing: 0.02em; }
.bb-spark { display: flex; align-items: flex-end; gap: 2px; height: 34px; margin-top: 5px; }
.bb-spark-col { display: flex; flex: 1; align-items: flex-end; min-width: 0; height: 100%; }
.bb-spark-bar {
  display: block; width: 100%; border-radius: 2px 2px 0 0;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 38%, transparent);
}
.bb-spark-bar.bb-today { background: var(--dsw-alias-state-business-primary); }
.bb-spark-bar.bb-empty { height: 1px !important; border-radius: 0; background: var(--dsw-alias-border-l2); }
.bb-spark-caption { display: flex; justify-content: space-between; margin-top: 3px; font-size: 9px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.bb-cmp { display: flex; flex-direction: column; gap: 10px; margin-top: 2px; }
.bb-cmp-row { display: flex; flex-direction: column; gap: 5px; }
.bb-cmp-head { display: flex; align-items: baseline; gap: 8px; font-size: 11px; }
.bb-cmp-label { min-width: 46px; color: var(--dsw-alias-label-secondary); font-weight: 500; }
.bb-cmp-values { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.bb-cmp-values b { color: var(--dsw-alias-label-primary); font-weight: 500; }
.bb-cmp-prev { margin-left: 5px; font-style: normal; color: var(--dsw-alias-label-tertiary); }
.bb-cmp-head .bb-pill { margin-left: auto; }
.bb-bars { display: grid; gap: 3px; }
.bb-track { height: 5px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.bb-fill { display: block; height: 100%; border-radius: 999px; }
.bb-fill.bb-fill-cur { background: var(--dsw-alias-state-business-primary); }
.bb-fill.bb-fill-prev { background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 42%, transparent); }
.bb-toggle { display: inline-flex; gap: 2px; }
.bb-toggle button {
  padding: 1px 7px; border: 0; border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-tertiary);
  font: inherit; font-size: 10px; cursor: pointer;
}
.bb-toggle button[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.bb-linkbtn {
  margin-left: auto; padding: 0; border: 0; background: transparent;
  color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 10px;
  cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
}
.bb-linkbtn:hover { color: var(--dsw-alias-label-primary); }
.bb-suggest-label { margin: 0; font-size: 9.5px; letter-spacing: 0.05em; color: var(--dsw-alias-label-tertiary); }
.bb-suggest {
  margin: 2px 0 0; font-size: 26px; font-weight: 600;
  line-height: 1.1; letter-spacing: -0.025em; font-variant-numeric: tabular-nums;
}
.bb-formula { margin: 4px 0 0; font-size: 10px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.bb-card {
  margin-top: 10px; padding: 10px;
  border-radius: 10px; background: var(--dsw-alias-bg-layer-2);
}
.bb-card .bb-fields + .bb-fields {
  margin-top: 9px; padding-top: 9px;
  border-top: 0.5px dashed var(--dsw-alias-border-l2);
}
.bb-fields { display: grid; gap: 7px; }
.bb-field { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.bb-field > span:first-child { flex: 1; min-width: 0; }
.bb-field input {
  box-sizing: border-box; width: 62px; padding: 3px 7px;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 6px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 11px; font-variant-numeric: tabular-nums; text-align: right;
}
.bb-field input:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.bb-field .bb-unit { flex: none; color: var(--dsw-alias-label-tertiary); }
.bb-field-wide { align-items: flex-start; flex-direction: column; gap: 4px; }
.bb-field-wide textarea {
  box-sizing: border-box; width: 100%; min-height: 48px; padding: 5px 7px;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 6px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 11px; resize: vertical;
}
.bb-segmented {
  display: inline-flex; padding: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 10%, transparent);
}
.bb-segmented button {
  padding: 3px 10px; border: 0; border-radius: 999px; background: transparent;
  color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 10px; cursor: pointer;
}
.bb-segmented button[aria-pressed="true"] {
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  box-shadow: 0 1px 2px rgba(9, 14, 25, 0.12);
}
.bb-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.bb-button {
  padding: 4px 11px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: 7px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 11px; cursor: pointer;
}
.bb-button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.bb-button:disabled { opacity: 0.5; cursor: default; }
.bb-button.bb-primary {
  border-color: transparent;
  background: var(--dsw-alias-state-business-primary);
  color: #fff; font-weight: 500;
}
.bb-button.bb-primary:hover { filter: brightness(1.06); }
.bb-feedback { font-size: 10px; color: var(--dsw-alias-label-tertiary); }
.bb-feedback.bb-error { color: var(--dsw-alias-state-error-primary); }
.bb-pop-foot {
  margin-top: 14px; padding-top: 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
  font-size: 10px; line-height: 1.65; color: var(--dsw-alias-label-tertiary);
}
.bb-pop-foot p { margin: 0; }
.bb-page { display: flex; flex-direction: column; gap: 12px; padding: 2px 0 12px; max-width: 620px; font-size: 13px; color: var(--dsw-alias-label-primary); }
.bb-page h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.bb-page p { margin: 0; font-size: 12px; line-height: 1.65; color: var(--dsw-alias-label-secondary); }
.bb-page .bb-fields { max-width: 400px; }
.bb-page .bb-price { display: grid; grid-template-columns: auto repeat(3, minmax(0, 1fr)); gap: 4px 12px; font-size: 11px; font-variant-numeric: tabular-nums; }
.bb-page .bb-price span { color: var(--dsw-alias-label-tertiary); }
.bb-page .bb-price b { font-weight: 500; color: var(--dsw-alias-label-secondary); }
.bb-page a { color: var(--dsw-alias-state-business-primary); text-decoration: none; }
.bb-page a:hover { text-decoration: underline; }
@media (max-width: 620px) {
  .bb-bar { padding: 2px 6px 5px; }
  .bb-main { gap: 8px; padding: 5px 6px; }
  .bb-updated { display: none; }
  .bb-pop { padding: 13px 14px 10px; }
  .bb-hero-amount { font-size: 25px; }
}
`

    function IconRefresh() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M13 8a5 5 0 1 1-1.46-3.54M13 3.2v3.2h-3.2',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function IconGear() {
      return h(
        'svg',
        { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, focusable: false },
        h('circle', { cx: 8, cy: 8, r: 2.2, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M8 1.6v1.6M8 12.8v1.6M2.5 8H1M15 8h-1.5M3.9 3.9 4.9 5M11.1 11l1 1M12.1 3.9 11.1 5M4.9 11l-1 1',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        }),
      )
    }

    function IconClose() {
      return h(
        'svg',
        { viewBox: '0 0 12 12', fill: 'none', 'aria-hidden': true, focusable: false },
        h('path', {
          d: 'M2.5 2.5l7 7M9.5 2.5l-7 7',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
        }),
      )
    }

    function symbolOf(currency) {
      switch (currency) {
        case 'CNY':
          return '¥'
        case 'USD':
          return '$'
        default:
          return ''
      }
    }

    function formatNumber(value, digits) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('zh-CN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    }

    function formatMoney(value, currency, digits = 2) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      if (number > 0 && number < 0.005 && digits === 2) return `${symbolOf(currency)}<0.01`
      return `${symbolOf(currency)}${formatNumber(number, digits)}`
    }

    function formatSigned(value, currency) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      const sign = number > 0 ? '+' : number < 0 ? '−' : ''
      return sign + formatMoney(Math.abs(number), currency)
    }

    function unitOf(currency) {
      return currency === 'CNY' ? '元' : currency
    }

    function formatCompact(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      if (number >= 1e8) return `${formatNumber(number / 1e8, 2)} 亿`
      if (number >= 1e4) return `${formatNumber(number / 1e4, 1)} 万`
      return formatNumber(number, 0)
    }

    function formatExact(value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '—'
    }

    function formatClock(iso) {
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    function formatDays(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return null
      const days = Math.max(0, Number(value))
      if (days === 0) return '0'
      if (days < 1) return '<1'
      if (days > 3650) return '>3650'
      return String(Math.floor(days))
    }

    function formatPercent(change) {
      if (change === null || change === undefined || !Number.isFinite(change)) return null
      const rounded = Math.round(change)
      if (Math.abs(change) < 0.5) return { text: '0%', tone: '' }
      return rounded > 0
        ? { text: `↑${rounded}%`, tone: 'bb-up' }
        : { text: `↓${Math.abs(rounded)}%`, tone: 'bb-down' }
    }

    function percentText(t, change, hasCurrent) {
      const formatted = formatPercent(change)
      if (formatted !== null) return formatted
      return hasCurrent ? { text: t('changeNew'), tone: '' } : { text: t('noBaseline'), tone: '' }
    }

    async function fetchSnapshot(force) {
      const response = await fetch(`${ROUTE}${force ? '?refresh=1' : ''}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
      if (body === null || typeof body !== 'object' || body.rates === undefined) {
        throw new Error('Malformed snapshot response.')
      }
      return body
    }

    async function postSettings(patch) {
      const response = await fetch(SETTINGS_ROUTE, {
        method: 'POST',
        cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`)
      return body
    }

    function useSnapshot(t) {
      const [state, setState] = React.useState({ phase: 'loading', data: null, error: null, refreshing: false })
      const inFlight = React.useRef(false)

      const load = React.useCallback(async (force) => {
        if (inFlight.current) return
        inFlight.current = true
        setState((current) => ({ ...current, refreshing: true }))
        try {
          const data = await fetchSnapshot(force === true)
          setState({ phase: 'ready', data, error: null, refreshing: false })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setState((current) => ({
            phase: current.data === null ? 'error' : 'ready',
            data: current.data,
            error: message,
            refreshing: false,
          }))
        } finally {
          inFlight.current = false
        }
      }, [])

      const refreshSeconds = state.data?.settings?.refreshSeconds ?? 60
      const intervalMs = Math.max(15, Number(refreshSeconds) || 60) * 1000

      React.useEffect(() => {
        load(false)
        const onVisible = () => {
          if (document.visibilityState === 'visible') load(false)
        }
        const timer = setInterval(() => {
          if (document.visibilityState !== 'hidden') load(false)
        }, intervalMs)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [load, intervalMs])

      const save = React.useCallback(async (patch) => {
        try {
          const data = await postSettings(patch)
          setState({ phase: 'ready', data, error: null, refreshing: false })
          return { ok: true }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          setState((current) => ({ ...current, error: message }))
          return { ok: false, error: message }
        }
      }, [])

      return { ...state, load, save, t }
    }

    function NumberField({ label, value, min, max, step, unit, onCommit, disabled }) {
      const [text, setText] = React.useState(String(value))
      React.useEffect(() => {
        setText(String(value))
      }, [value])

      const commit = () => {
        const parsed = Number(text)
        if (!Number.isFinite(parsed)) {
          setText(String(value))
          return
        }
        const clamped = Math.min(max, Math.max(min, parsed))
        setText(String(clamped))
        if (clamped !== value) onCommit(clamped)
      }

      return h(
        'label',
        { className: 'bb-field' },
        h('span', null, label),
        h('input', {
          type: 'number',
          min,
          max,
          step: step ?? 1,
          value: text,
          disabled: disabled === true,
          onChange: (event) => setText(event.target.value),
          onBlur: commit,
          onKeyDown: (event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
            event.currentTarget.blur()
          },
        }),
        unit === undefined ? null : h('span', { className: 'bb-unit' }, unit),
      )
    }

    function Segmented({ label, options, value, onChange }) {
      return h(
        'div',
        { className: 'bb-field' },
        h('span', null, label),
        h(
          'div',
          { className: 'bb-segmented', role: 'group', 'aria-label': label },
          options.map((option) =>
            h(
              'button',
              {
                key: option.value,
                type: 'button',
                'aria-pressed': option.value === value,
                onClick: () => onChange(option.value),
              },
              option.label,
            ),
          ),
        ),
      )
    }

    function Section({ title, note, children }) {
      return h(
        'section',
        { className: 'bb-section' },
        h(
          'div',
          { className: 'bb-section-head' },
          h('h3', { className: 'bb-section-title' }, title),
          note === undefined ? null : h('span', { className: 'bb-section-note' }, note),
        ),
        children,
      )
    }

    function Gauge({ minDays, targetDays, t }) {
      const known = minDays !== null && Number.isFinite(Number(minDays))
      const ratio = known && targetDays > 0 ? Math.min(1, Math.max(0, minDays / targetDays)) : 0
      const below = known && minDays < targetDays
      const radius = 32
      const circumference = 2 * Math.PI * radius
      const label = known ? `${formatDays(minDays)} ${t('dayUnit')}` : t('noRate')
      return h(
        'div',
        { className: 'bb-gauge-wrap' },
        h(
          'div',
          { className: 'bb-gauge', role: 'img', 'aria-label': `${label} · ${t('gaugeTarget', { days: targetDays })}` },
          h(
            'svg',
            { viewBox: '0 0 76 76', 'aria-hidden': true, focusable: false },
            h('circle', { className: 'bb-gauge-track', cx: 38, cy: 38, r: radius }),
            h('circle', {
              className: `bb-gauge-arc${known ? (below ? ' bb-warn' : '') : ' bb-idle'}`,
              cx: 38,
              cy: 38,
              r: radius,
              strokeDasharray: String(circumference),
              strokeDashoffset: String(circumference * (1 - ratio)),
            }),
          ),
          h(
            'div',
            { className: 'bb-gauge-text' },
            h('span', { className: 'bb-gauge-num' }, known ? formatDays(minDays) : '—'),
            h('span', { className: 'bb-gauge-unit' }, t('dayUnit')),
          ),
        ),
        h('span', { className: 'bb-gauge-sub' }, t('gaugeTarget', { days: targetDays })),
      )
    }

    function BalanceBlock({ report, t }) {
      const balance = report.balance
      const forecast = report.forecast
      const minDays = forecast.daysLow
      const maxDays = forecast.daysHigh
      const targetDays = forecast.targetDays
      const minText = formatDays(minDays)
      const maxText = maxDays === null ? null : String(Math.ceil(Math.max(0, Number(maxDays))))
      const belowTarget = minDays !== null && minDays < targetDays
      const primary = report.rates.find((rate) => rate.key === forecast.primaryWindow)
      const primaryDays = primary?.days ?? 7
      const hasBalance = balance !== null && balance.status === 'ok'
      const currencyMismatch = hasBalance && balance.currency !== report.priceTable.currency
      const account = report.accountDelta ?? null
      const accountDiff = account === null ? null : account.spend - report.today.current.cost

      return h(
        Section,
        { title: t('balanceTitle') },
        h(
          'div',
          { className: 'bb-hero' },
          h(
            'div',
            { className: 'bb-hero-main' },
            h('p', { className: 'bb-hero-label' }, t('heroBalance')),
            h(
              'p',
              { className: 'bb-hero-amount' },
              hasBalance ? formatMoney(balance.total, balance.currency) : '—',
            ),
            hasBalance
              ? h(
                  'p',
                  { className: 'bb-hero-split' },
                  `${t('granted')} ${formatMoney(balance.granted, balance.currency)} · ${t('toppedUp')} ${formatMoney(balance.toppedUp, balance.currency)}`,
                )
              : null,
            balance !== null && balance.status === 'error'
              ? h('p', { className: 'bb-note bb-error' }, t('balanceError', { reason: balance.error ?? '—' }))
              : null,
            balance !== null && balance.status === 'unconfigured'
              ? h('p', { className: 'bb-note' }, t('unconfigured'))
              : null,
            hasBalance && !balance.available
              ? h('p', { className: 'bb-note bb-warn' }, t('notAvailable'))
              : null,
            currencyMismatch
              ? h('p', { className: 'bb-note bb-warn' }, t('currencyMismatch', { currency: balance.currency }))
              : null,
          ),
          h(Gauge, { minDays, targetDays, t }),
        ),
        h(
          'dl',
          { className: 'bb-facts' },
          h('dt', null, t('primaryRate')),
          h(
            'dd',
            null,
            forecast.rateAvailable
              ? `${t('perDay', { amount: formatMoney(forecast.perDay, report.priceTable.currency) })} · ${t(`rateDay${primaryDays}`)}`
              : t('noRate'),
          ),
          h('dt', null, t('minDaysLabel')),
          h(
            'dd',
            null,
            h(
              'b',
              { className: belowTarget ? 'bb-warn' : undefined },
              minText === null ? '—' : `${minText} ${t('dayUnit')}`,
            ),
          ),
          h('dt', null, t('maxDaysLabel')),
          h('dd', null, h('b', null, maxText === null ? '—' : `${maxText} ${t('dayUnit')}`)),
          h('dt', null, t('targetDays')),
          h('dd', null, h('b', null, `${targetDays} ${t('dayUnit')}`)),
          account === null
            ? null
            : h('dt', null, t('accountScope')),
          account === null
            ? null
            : h(
                'dd',
                null,
                h('b', null, formatMoney(account.spend, account.currency)),
                ` · ${t('vsLocal', { amount: formatSigned(accountDiff, account.currency) })}`,
              ),
        ),
        h('p', { className: 'bb-note' }, t('method', { days: primaryDays })),
      )
    }

    function RatesBlock({ report, t }) {
      const rows = report.rates.map((rate) => {
        const gap = rate.daysWithData < rate.days
        const coverage = rate.daysWithData > 0 && rate.daysWithData < rate.days
        return h(
          'tr',
          { key: rate.key },
          h('td', null, t(`rateDay${rate.days}`)),
          h('td', { className: gap ? 'bb-gap' : undefined }, formatExact(rate.billedTokens)),
          h('td', { className: gap ? 'bb-gap' : undefined }, formatExact(rate.cacheReadTokens)),
          h('td', { className: `bb-money${gap ? ' bb-gap' : ''}` }, formatMoney(rate.cost, report.priceTable.currency)),
          h(
            'td',
            {
              className: gap ? 'bb-gap' : undefined,
              title: coverage ? t('coverageDays', { days: rate.daysWithData }) : undefined,
            },
            formatMoney(rate.perDay, report.priceTable.currency),
          ),
        )
      })

      const series = Array.isArray(report.daily) ? report.daily : []
      const peak = Math.max(0, ...series.filter((day) => day.hasData).map((day) => Number(day.cost) || 0))
      const scale = peak > 0 ? peak : 1
      const spark = series.length === 0
        ? null
        : h(
            'div',
            null,
            h('p', { className: 'bb-spark-title' }, t('sparkTitle')),
            h(
              'div',
              { className: 'bb-spark', role: 'img', 'aria-label': t('sparkTitle') },
              series.map((day, index) =>
                h(
                  'span',
                  {
                    key: day.day,
                    className: 'bb-spark-col',
                    title: day.hasData
                      ? `${day.day} · ${formatMoney(day.cost, report.priceTable.currency)} · ${formatExact(day.billedTokens)} ${t('billedTokens')}`
                      : `${day.day} · ${t('sparkEmpty')}`,
                  },
                  h('span', {
                    className: `bb-spark-bar${day.hasData ? '' : ' bb-empty'}${index === series.length - 1 ? ' bb-today' : ''}`,
                    style: {
                      height: day.hasData ? `${Math.max(4, ((Number(day.cost) || 0) / scale) * 100)}%` : '2px',
                    },
                  }),
                ),
              ),
            ),
            h(
              'div',
              { className: 'bb-spark-caption', 'aria-hidden': true },
              h('span', null, series[0]?.day ?? ''),
              h('span', null, series[series.length - 1]?.day ?? ''),
            ),
          )

      return h(
        Section,
        { title: t('ratesTitle') },
        h(
          'table',
          { className: 'bb-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, t('window')),
              h('th', null, t('billedTokens')),
              h('th', null, t('cacheTokens')),
              h('th', null, t('amount')),
              h('th', null, t('perDayShort')),
            ),
          ),
          h('tbody', null, rows),
        ),
        spark,
      )
    }

    function CompareBlock({ report, t }) {
      const [unit, setUnit] = React.useState('cost')
      const groups = [
        { key: 'today', label: t('compareToday'), pair: report.today },
        { key: 'week', label: t('compareWeek'), pair: report.week },
        { key: 'month', label: t('compareMonth'), pair: report.month },
      ]
      const valueOf = (side) => (unit === 'cost' ? side.cost : side.billedTokens)
      const renderValue = (side) =>
        unit === 'cost'
          ? formatMoney(valueOf(side), report.priceTable.currency)
          : formatCompact(valueOf(side))

      const rows = groups.map((group) => {
        const current = valueOf(group.pair.current)
        const previous = valueOf(group.pair.previous)
        const max = Math.max(current, previous, 1)
        const change = percentText(t, group.pair.change[unit === 'cost' ? 'cost' : 'billedTokens'], current > 0)
        return h(
          'div',
          { className: 'bb-cmp-row', key: group.key },
          h(
            'div',
            { className: 'bb-cmp-head' },
            h('span', { className: 'bb-cmp-label' }, group.label),
            h(
              'span',
              { className: 'bb-cmp-values' },
              h('b', null, renderValue(group.pair.current)),
              h('i', { className: 'bb-cmp-prev' }, `vs ${renderValue(group.pair.previous)}`),
            ),
            h('span', { className: `bb-pill${change.tone ? ` ${change.tone}` : ''}` }, change.text),
          ),
          h(
            'div',
            { className: 'bb-bars', 'aria-hidden': true },
            h('span', { className: 'bb-track' }, h('span', {
              className: 'bb-fill bb-fill-cur',
              style: { width: `${Math.max(current > 0 ? 1.5 : 0, (current / max) * 100)}%` },
            })),
            h('span', { className: 'bb-track' }, h('span', {
              className: 'bb-fill bb-fill-prev',
              style: { width: `${Math.max(previous > 0 ? 1.5 : 0, (previous / max) * 100)}%` },
            })),
          ),
        )
      })

      return h(
        Section,
        {
          title: t('compareTitle'),
          note: h(
            'span',
            { className: 'bb-toggle' },
            h(
              'button',
              { type: 'button', 'aria-pressed': unit === 'cost', onClick: () => setUnit('cost') },
              t('byCost'),
            ),
            h(
              'button',
              { type: 'button', 'aria-pressed': unit === 'token', onClick: () => setUnit('token') },
              t('byToken'),
            ),
          ),
        },
        h('div', { className: 'bb-cmp' }, rows),
        h('p', { className: 'bb-note' }, t('compareNote')),
      )
    }

    function TopUpBlock({ report, t, onSave, saving }) {
      const currency = report.priceTable.currency
      const forecast = report.forecast
      const [mode, setMode] = React.useState('days')
      const [days, setDays] = React.useState(forecast.targetDays)
      const [amount, setAmount] = React.useState(30)
      const [copied, setCopied] = React.useState(false)
      const [showAdvanced, setShowAdvanced] = React.useState(false)

      React.useEffect(() => {
        setDays(forecast.targetDays)
      }, [forecast.targetDays])

      const perDay = forecast.perDay
      const balance = forecast.balance
      const needs =
        balance === null
          ? null
          : Math.max(0, Math.ceil((perDay * days + forecast.cushion - balance) / 10) * 10)
      const availableDays =
        balance === null || perDay <= 0 ? null : (balance + amount) / perDay

      const copy = async () => {
        const value = forecast.suggestedTopUp === null ? '' : String(forecast.suggestedTopUp)
        if (value === '') return
        try {
          if (navigator.clipboard !== undefined) await navigator.clipboard.writeText(value)
          else {
            const area = document.createElement('textarea')
            area.value = value
            document.body.appendChild(area)
            area.select()
            document.execCommand('copy')
            area.remove()
          }
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }

      return h(
        Section,
        {
          title: t('topUpTitle'),
          note: h(
            'button',
            {
              type: 'button',
              className: 'bb-linkbtn',
              'aria-expanded': showAdvanced,
              onClick: () => setShowAdvanced((value) => !value),
            },
            t('advanced'),
          ),
        },
        h('p', { className: 'bb-suggest-label' }, t('suggestedLabel')),
        h(
          'p',
          { className: 'bb-suggest' },
          forecast.suggestedTopUp === null
            ? '—'
            : formatMoney(forecast.suggestedTopUp, currency, 0),
        ),
        h('p', { className: 'bb-formula' }, t('formula')),
        h(
          'div',
          { className: 'bb-card' },
          h(
            'div',
            { className: 'bb-fields' },
            h(NumberField, {
              label: t('targetDays'),
              value: forecast.targetDays,
              min: 1,
              max: 365,
              unit: t('dayUnit'),
              disabled: saving,
              onCommit: (value) => onSave({ targetDays: value }),
            }),
            h(Segmented, {
              label: t('modeLabel'),
              value: mode,
              options: [
                { value: 'days', label: t('modeDays') },
                { value: 'amount', label: t('modeAmount') },
              ],
              onChange: setMode,
            }),
            mode === 'days'
              ? h(NumberField, {
                  label: t('wantDays'),
                  value: days,
                  min: 1,
                  max: 3650,
                  unit: t('dayUnit'),
                  disabled: saving,
                  onCommit: (value) => {
                    setDays(value)
                    if (needs !== null) setAmount(needs)
                  },
                })
              : h(NumberField, {
                  label: t('topUpAmount'),
                  value: amount,
                  min: 0,
                  max: 1_000_000,
                  step: 10,
                  unit: unitOf(currency),
                  disabled: saving,
                  onCommit: setAmount,
                }),
            h(
              'div',
              { className: 'bb-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'bb-button bb-primary',
                  disabled: forecast.suggestedTopUp === null,
                  onClick: copy,
                },
                copied ? t('copied') : t('copy'),
              ),
              h(
                'span',
                { className: 'bb-feedback' },
                saving
                  ? t('saving')
                  : mode === 'days'
                    ? `${t('needAmount')} ${needs === null ? '—' : formatMoney(needs, currency, 0)}`
                    : `${t('daysFor')} ${availableDays === null ? '—' : `${formatNumber(availableDays, 1)} ${t('dayUnit')}`}`,
              ),
            ),
          ),
          showAdvanced
            ? h(
                'div',
                { className: 'bb-fields' },
                h(NumberField, {
                  label: t('cushion'),
                  value: report.settings.safetyCushion,
                  min: 0,
                  max: 10_000,
                  unit: unitOf(currency),
                  disabled: saving,
                  onCommit: (value) => onSave({ safetyCushion: value }),
                }),
                h(Segmented, {
                  label: t('primaryWindow'),
                  value: report.settings.primaryWindow,
                  options: [
                    { value: 'r1', label: t('rateDay1') },
                    { value: 'r7', label: t('rateDay7') },
                    { value: 'r30', label: t('rateDay30') },
                  ],
                  onChange: (value) => onSave({ primaryWindow: value }),
                }),
                h(NumberField, {
                  label: t('refreshSeconds'),
                  value: report.settings.refreshSeconds,
                  min: 15,
                  max: 600,
                  unit: t('secondUnit'),
                  disabled: saving,
                  onCommit: (value) => onSave({ refreshSeconds: value }),
                }),
              )
            : null,
        ),
      )
    }

    function CoverageFooter({ report, error, t }) {
      const coverage = report.coverage
      const notes = []
      if (coverage.unpricedEvents > 0) {
        notes.push(
          t('unpriced', { count: coverage.unpricedEvents, models: coverage.unpricedModels.join(', ') }),
        )
      }
      if (coverage.unreadableFiles > 0) notes.push(t('unreadable', { count: coverage.unreadableFiles }))
      if (coverage.tornFrames > 0) notes.push(t('torn', { count: coverage.tornFrames }))

      return h(
        'div',
        { className: 'bb-pop-foot' },
        h(
          'p',
          null,
          `${t('coverage', {
            sessions: coverage.sessions,
            events: formatExact(coverage.events),
            days: coverage.daysWithData,
          })} · ${t('priceVersion', { version: report.priceTable.version })} · ${t('updated', {
            time: formatClock(report.generatedAt),
          })}${error === null ? '' : ` · ${t('stale')}`}`,
        ),
        h('p', null, t('footnote')),
        notes.map((note) => h('p', { key: note, className: 'bb-warn' }, note)),
      )
    }

    function Popover({ report, error, anchor, onClose, onSave, saving, t, closeRef, popoverRef }) {
      const width = Math.min(400, window.innerWidth - 16)
      const style = {
        left: `${Math.min(Math.max(anchor.left, 8), Math.max(8, window.innerWidth - width - 8))}px`,
        bottom: `${Math.max(8, window.innerHeight - anchor.top + 8)}px`,
        width: `${width}px`,
        maxHeight: `${Math.max(220, Math.min(620, anchor.top - 16))}px`,
      }

      return h(
        'div',
        {
          className: 'bb-pop',
          role: 'dialog',
          'aria-modal': false,
          'aria-labelledby': 'bb-pop-title',
          style,
          ref: popoverRef,
        },
        h(
          'div',
          { className: 'bb-pop-head' },
          h(
            'div',
            { className: 'bb-pop-headtext' },
            h(
              'h2',
              { className: 'bb-pop-title', id: 'bb-pop-title' },
              t('dialogTitle'),
              h('span', { className: 'bb-badge' }, t('localScope')),
            ),
          ),
          h(
            'button',
            { type: 'button', className: 'bb-close', 'aria-label': t('close'), onClick: onClose, ref: closeRef },
            h(IconClose),
          ),
        ),
        h(BalanceBlock, { report, t }),
        h(RatesBlock, { report, t }),
        h(CompareBlock, { report, t }),
        h(TopUpBlock, { report, t, onSave, saving }),
        h(CoverageFooter, { report, error, t }),
      )
    }

    function Bar({ t, onOpen, open, report, error, phase, refreshing, onRefresh, triggerRef }) {
      const balance = report?.balance
      const forecast = report?.forecast
      const currency = report?.priceTable?.currency ?? 'CNY'
      const cushion = report?.settings?.safetyCushion ?? 0
      const targetDays = report?.settings?.targetDays ?? 0
      const lowBalance =
        balance !== undefined && balance !== null && balance.status === 'ok' && balance.total < cushion
      const minDays = forecast?.daysLow ?? null
      const belowTarget = minDays !== null && minDays < targetDays
      const progress =
        minDays !== null && targetDays > 0
          ? Math.min(1, Math.max(0, minDays / targetDays))
          : null
      const hasBalance = balance !== undefined && balance !== null && balance.status === 'ok'
      let content
      if (report === null) {
        content =
          phase === 'error'
            ? h('span', { className: 'bb-balance bb-muted' }, `${t('unavailable')}${error === null ? '' : ` · ${error}`}`)
            : h('span', { className: 'bb-balance bb-muted' }, t('loading'))
      } else if (report.coverage.events === 0 && !hasBalance) {
        content = h('span', { className: 'bb-balance bb-muted' }, t('noData'))
      } else {
        const minText = formatDays(minDays)
        const today = report.today.current
        const change = percentText(t, report.today.change.cost, today.cost > 0)

        content = h(
          React.Fragment,
          null,
          h(
            'span',
            { className: `bb-balance${lowBalance ? ' bb-warn' : hasBalance ? '' : ' bb-muted'}` },
            hasBalance ? formatMoney(balance.total, balance.currency) : t('balanceUnavailable'),
          ),
          h('span', { className: 'bb-sep', 'aria-hidden': true }),
          h(
            'span',
            { className: 'bb-days-wrap' },
            h('span', {
              className: `bb-status-dot${belowTarget ? ' bb-warn' : minText === null ? ' bb-muted' : ''}`,
              'aria-hidden': true,
            }),
            minText === null
              ? h('span', { className: 'bb-days bb-muted' }, t('noRate'))
              : h(
                  'span',
                  { className: `bb-days${belowTarget ? ' bb-warn' : ''}` },
                  t('minDaysShort', { days: minText }),
                  h('span', { className: 'bb-target' }, ` / ${t('targetShort', { days: targetDays })}`),
                ),
          ),
          h('span', { className: 'bb-sep', 'aria-hidden': true }),
          h(
            'span',
            { className: 'bb-today' },
            t('todayLabel'),
            h('b', null, formatMoney(today.cost, currency)),
            h(
              'span',
              { className: `bb-pill${change.tone ? ` ${change.tone}` : ''}` },
              change.text,
            ),
          ),
        )
      }

      return h(
        'div',
        { className: `bb-bar${lowBalance ? ' bb-alert' : ''}`, role: 'region', 'aria-label': t('barLabel') },
        h(
          'button',
          {
            type: 'button',
            className: 'bb-main',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': t('openDetails'),
            title: t('openDetails'),
            onClick: onOpen,
            ref: triggerRef,
          },
          content,
        ),
        h(
          'div',
          { className: 'bb-tail' },
          h(
            'span',
            {
              className: 'bb-updated',
              title: error ?? (report === null ? '' : t('updated', { time: formatClock(report.generatedAt) })),
            },
            report !== null && error !== null ? t('stale') : report === null ? '' : formatClock(report.generatedAt),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'bb-iconbtn',
              disabled: refreshing || report === null,
              'aria-label': refreshing ? t('refreshing') : t('refresh'),
              title: refreshing ? t('refreshing') : t('refresh'),
              onClick: () => onRefresh(true),
            },
            h(IconRefresh),
          ),
        ),
        progress === null
          ? null
          : h(
              'div',
              {
                className: 'bb-meter',
                title: `${t('minDaysShort', { days: formatDays(minDays) })} / ${t('targetShort', { days: targetDays })}`,
                'aria-hidden': true,
              },
              h('span', {
                className: `bb-meter-fill${belowTarget ? ' bb-warn' : ''}`,
                style: { width: `${progress > 0 ? Math.max(1.5, progress * 100) : 0}%` },
              }),
            ),
      )
    }

    function BalanceBar(props) {
      const t = props.t
      const snapshot = useSnapshot(t)
      const [open, setOpen] = React.useState(false)
      const [saving, setSaving] = React.useState(false)
      const anchorRef = React.useRef({ left: 8, top: 0 })
      const triggerRef = React.useRef(null)
      const closeRef = React.useRef(null)
      const popoverRef = React.useRef(null)

      const close = React.useCallback(() => {
        setOpen(false)
        if (triggerRef.current !== null) triggerRef.current.focus()
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        if (closeRef.current !== null) closeRef.current.focus()
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          close()
        }
        const onPointer = (event) => {
          const target = event.target
          if (popoverRef.current !== null && popoverRef.current.contains(target)) return
          if (triggerRef.current !== null && triggerRef.current.contains(target)) return
          setOpen(false)
        }
        const onLayout = () => setOpen(false)
        document.addEventListener('keydown', onKey, true)
        document.addEventListener('pointerdown', onPointer, true)
        window.addEventListener('resize', onLayout)
        return () => {
          document.removeEventListener('keydown', onKey, true)
          document.removeEventListener('pointerdown', onPointer, true)
          window.removeEventListener('resize', onLayout)
        }
      }, [open, close])

      const toggle = (event) => {
        if (open) {
          close()
          return
        }
        const rect = (event?.currentTarget ?? triggerRef.current)?.getBoundingClientRect()
        if (rect !== undefined) anchorRef.current = { left: rect.left, top: rect.top }
        setOpen(true)
      }

      const save = async (patch) => {
        setSaving(true)
        try {
          return await snapshot.save(patch)
        } finally {
          setSaving(false)
        }
      }

      return h(
        React.Fragment,
        null,
        h('style', null, CSS),
        h(Bar, {
          t,
          open,
          report: snapshot.data,
          error: snapshot.error,
          phase: snapshot.phase,
          refreshing: snapshot.refreshing,
          onOpen: toggle,
          onRefresh: snapshot.load,
          triggerRef,
        }),
        open && snapshot.data !== null
          ? h(Popover, {
              report: snapshot.data,
              error: snapshot.error,
              anchor: anchorRef.current,
              onClose: close,
              onSave: save,
              saving,
              t,
              closeRef,
              popoverRef,
            })
          : null,
      )
    }

    function SettingsFields({ report, saving, onSave, t, includeHolidays }) {
      const [holidays, setHolidays] = React.useState(report.settings.holidays ?? '')
      React.useEffect(() => {
        setHolidays(report.settings.holidays ?? '')
      }, [report.settings.holidays])

      const commitHolidays = () => {
        if (holidays !== (report.settings.holidays ?? '')) onSave({ holidays })
      }

      return h(
        'div',
        { className: 'bb-fields' },
        h(NumberField, {
          label: t('targetDays'),
          value: report.settings.targetDays,
          min: 1,
          max: 365,
          unit: t('dayUnit'),
          disabled: saving,
          onCommit: (value) => onSave({ targetDays: value }),
        }),
        h(NumberField, {
          label: t('cushion'),
          value: report.settings.safetyCushion,
          min: 0,
          max: 10_000,
          unit: symbolOf(report.priceTable.currency),
          disabled: saving,
          onCommit: (value) => onSave({ safetyCushion: value }),
        }),
        h(Segmented, {
          label: t('primaryWindow'),
          value: report.settings.primaryWindow,
          options: [
            { value: 'r1', label: t('rateDay1') },
            { value: 'r7', label: t('rateDay7') },
            { value: 'r30', label: t('rateDay30') },
          ],
          onChange: (value) => onSave({ primaryWindow: value }),
        }),
        h(NumberField, {
          label: t('refreshSeconds'),
          value: report.settings.refreshSeconds,
          min: 15,
          max: 600,
          unit: t('secondUnit'),
          disabled: saving,
          onCommit: (value) => onSave({ refreshSeconds: value }),
        }),
        includeHolidays
          ? h(
              'label',
              { className: 'bb-field bb-field-wide' },
              h('span', null, t('holidays')),
              h('textarea', {
                value: holidays,
                disabled: saving,
                spellCheck: false,
                onChange: (event) => setHolidays(event.target.value),
                onBlur: commitHolidays,
              }),
              h('span', { className: 'bb-note' }, t('holidaysHint')),
            )
          : null,
      )
    }

    function PriceTable({ report, t }) {
      const table = report.priceTable
      const models = table.models ?? []
      return h(
        Section,
        { title: t('priceTableTitle'), note: t('priceVersion', { version: table.version }) },
        h(
          'div',
          { className: 'bb-price' },
          h('span', null, ''),
          h('span', null, t('cacheHit')),
          h('span', null, t('cacheMiss')),
          h('span', null, t('output')),
          ...models.flatMap((model) => [
            h('b', { key: `${model.id}-name` }, model.id),
            h('span', { key: `${model.id}-hit` }, `${model.cacheHit.offPeak} / ${model.cacheHit.peak}`),
            h('span', { key: `${model.id}-miss` }, `${model.cacheMiss.offPeak} / ${model.cacheMiss.peak}`),
            h('span', { key: `${model.id}-out` }, `${model.output.offPeak} / ${model.output.peak}`),
          ]),
        ),
        h('p', { className: 'bb-note' }, t('priceTableNote')),
        h(
          'p',
          { className: 'bb-note' },
          h('a', { href: table.source, target: '_blank', rel: 'noreferrer noopener' }, t('priceSource')),
          ` · ${t('toAccount')}`,
        ),
      )
    }

    function BalanceSettingsPage({ t }) {
      const snapshot = useSnapshot(t)
      const [saving, setSaving] = React.useState(false)
      const [feedback, setFeedback] = React.useState(null)
      const [confirmingReset, setConfirmingReset] = React.useState(false)

      const save = async (patch) => {
        setSaving(true)
        setFeedback(null)
        const result = await snapshot.save(patch)
        setSaving(false)
        setFeedback(result.ok ? { ok: true } : { ok: false, message: result.error })
      }

      let body
      if (snapshot.data === null) {
        body =
          snapshot.phase === 'error'
            ? h('p', { className: 'bb-note bb-error' }, `${t('unavailable')} · ${snapshot.error ?? ''}`)
            : h('p', { className: 'bb-note' }, t('loading'))
      } else {
        body = h(
          React.Fragment,
          null,
          h(SettingsFields, {
            report: snapshot.data,
            saving,
            onSave: save,
            t,
            includeHolidays: true,
          }),
          h('p', { className: 'bb-note' }, t('targetHint')),
          h(
            'div',
            { className: 'bb-actions' },
            h('span', { className: `bb-feedback${feedback !== null && !feedback.ok ? ' bb-error' : ''}` },
              feedback === null ? t('settingsHint') : feedback.ok ? t('saved') : t('saveError', { reason: feedback.message })),
            h(
              'button',
              {
                type: 'button',
                className: 'bb-button',
                style: { marginLeft: 'auto' },
                disabled: saving,
                onClick: () => {
                  if (!confirmingReset) {
                    setConfirmingReset(true)
                    setTimeout(() => setConfirmingReset(false), 3000)
                    return
                  }
                  setConfirmingReset(false)
                  save({ ...DEFAULT_SETTINGS })
                },
              },
              confirmingReset ? t('confirmReset') : t('reset'),
            ),
          ),
          h(PriceTable, { report: snapshot.data, t }),
        )
      }

      return h(
        'div',
        { className: 'bb-page' },
        h('h2', null, t('sectionTitle')),
        h('p', null, t('sectionDesc')),
        body,
      )
    }

    return {
      inject: ['slots', 'locale'],
      // Presentation components are exposed for the render smoke test; the
      // host only reads `inject` and `apply`.
      __components: {
        Bar,
        Popover,
        BalanceBlock,
        RatesBlock,
        CompareBlock,
        TopUpBlock,
        CoverageFooter,
        SettingsFields,
        PriceTable,
      },
      __css: CSS,
      __defaults: DEFAULT_SETTINGS,
      apply(ctx) {
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'balance-burn: dictionaries')
        ctx.effect(
          () =>
            ctx.slots.inject('shell.bottom', () =>
              ctx.slots.register({ name: 'shell.bottom', locale: NS }, BalanceBar),
            ),
          'balance-burn: footer bar',
        )
        ctx.effect(
          () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'balance-burn',
                  order: 40,
                  label: () => ctx.locale.bind(NS)('sectionNav'),
                  locale: NS,
                },
                BalanceSettingsPage,
              ),
            ),
          'balance-burn: settings page',
        )
      },
    }
  },
})
