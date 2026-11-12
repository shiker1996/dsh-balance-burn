# 余额消耗看板 · 设计说明

> 对应 `REQUIREMENTS.md` v0.2（§9 已拍板）。本文说明**怎么实现、为什么这样实现、哪些没做**，并给出可核对的实测数据。

---

## 1. 目标与交付范围

一句话：把「我还有多少钱」变成「还能撑多久、花得多快、该充多少」，常驻底栏，点开可核对每个数字的口径。

| 需求 | 交付 | 落点 |
| --- | --- | --- |
| G1 常驻：余额、最低/最长可用天数、今日消耗（目标天数单独展示） | ✅ | `shell.bottom` 底栏 |
| G2 速率：近 1/7/30 天（token 与金额） | ✅ | 浮层「速率」 |
| G3 对比：日 / 周 / 月 | ✅ | 浮层「对比」，金额/token 可切换 |
| G4 建议充值 + 两种反算 | ✅ | 浮层「充值建议」 |
| G5 口径可核对 | ✅ | 浮层内「口径 / 建议公式」、页脚覆盖范围、设置页单价表 |
| §6.3 配置页 | ✅ | `settings.section`「余额与消耗」 |
| §9 只统计本机 DSH | ✅ | 只读本地会话日志，界面标注「本机口径」 |
| §9 底部一条 + 点开浮层 | ✅ | 单槽位底栏 + 固定定位浮层 |
| §9 按天数充值、默认 30 天 | ✅ | `ceil10(日均 × 目标天数 + 安全垫 − 余额)` |
| P2 余额差值（账号口径） | ✅ 已做 | 每日余额快照差值，见 §6.1 |
| P2 30 天曲线 | ✅ 简版 | 「速率」下方的每日柱状 |
| P2 异常日 / 消耗进度 | ⛔ 不做 | 需要更多历史与期初值 |

非目标保持不变：不抓平台账单（N1），不做机器学习预测（N2），不做财务对账（N3），不接管其他 provider 额度（N4）。

---

## 2. 总体架构

```
浏览器（client.js）                                 宿主（index.js）
┌───────────────────────────┐   GET /api/balance-burn   ┌──────────────────────────────┐
│ shell.bottom 底栏          │ ────────────────────────► │ snapshot.js                  │
│ 余额 · 最低/目标天数 · 今日 │ ◄──────────────────────── │   ├─ usage-store.js          │
│ 浮层：余额/速率/对比/建议   │   POST …/settings         │   │    └─ zstd-frames.js     │
│ 设置页：settings.section   │ ────────────────────────► │   ├─ balance.js              │
└───────────────────────────┘                           │   ├─ pricing.js              │
        （拿不到 API key）                                │   ├─ metrics.js              │
                                                        │   └─ settings.js             │
                                                        └───────────┬──────────────────┘
                                                                    │
                        ~/.dsh/sessions/**/session.v4.jsonl.zstd ───┤ 只读
                        ~/.dsh/storages/balance-burn/settings.json ─┤ 读写
                        ~/.dsh/storages/balance-burn/balance-history.json ─┤ 读写
                        api.deepseek.com/user/balance ──────────────┘ 密钥仅宿主
```

**为什么数字都在宿主算**：密钥只在宿主；日志在本地磁盘；聚合与计价是纯函数，可以在无浏览器、无网络的环境里单测。浏览器只做展示与输入，避免同一套口径在两端各写一遍。

**为什么两个 HTTP 路由而不是 IPC**：与 `dsh-quota-bar` 相同的做法，走宿主 `ctx.connection.fetch.register`。好处是浏览器刷新、多标签页共享同一份宿主缓存，且不新增远程方法注册面。

---

## 3. 文件与职责

| 文件 | 职责 | 测试 |
| --- | --- | --- |
| `index.js` | 宿主入口：注册两条路由、解析凭据、参数校验 | `test/host.test.mjs` |
| `client.js` | 底栏、浮层、设置页；zh/en 字典；轮询 | `test/client.test.mjs`（渲染冒烟 + 字典一致性） |
| `src/zstd-frames.js` | Zstandard 多帧容器扫描与逐帧解码 | `test/zstd-frames.test.mjs` |
| `src/usage-store.js` | 遍历会话日志、解析 usage、按文件缓存、去重 | `test/usage-store.test.mjs` |
| `src/pricing.js` | 单价表、峰谷判定、单次计价、未定价模型 | `test/pricing.test.mjs` |
| `src/metrics.js` | 窗口、对比、每日序列、预测与建议 | `test/metrics.test.mjs` |
| `src/balance.js` | `/user/balance` 读取与规范化 | `test/snapshot.test.mjs` |
| `src/balance-history.js` | 每日余额快照与账号口径差值 | `test/balance-history.test.mjs` |
| `src/settings.js` | 配置校验、原子持久化、DSH home 解析 | `test/settings.test.mjs` |
| `src/snapshot.js` | 组装快照、三级缓存、设置写入 | `test/snapshot.test.mjs` |

单测共 53 条，`npm test` 全绿。

---

## 4. 数据层：会话日志怎么读

### 4.1 文件形态

```
~/.dsh/sessions/<项目目录>/<会话 ID>/session.v4.jsonl.zstd    # 当前格式
~/.dsh/sessions/<项目目录>/<会话 ID>/session.jsonl.zstd       # 旧格式，仍有历史数据
```

两种文件名都读取（`/^session(?:\.v\d+)?\.jsonl\.zstd$/`）。本机 69 个文件里 42 个是 v4、27 个是旧格式；8 月–10 月的历史主要来自旧格式，缺了它 30 天口径会明显偏低。

每个**持久化批次是一个独立的 Zstandard 帧**，文件是帧的串联，不是一个流。文件里每行一个 JSON 事件；本插件取两种带 provider usage 的事件：

- `assistant/message`：普通对话调用，模型在 `data.message.source.model`；
- `compaction/summary`：压缩摘要是一次独立的计费调用，模型在 `data.model`，不重复出现在 `assistant/message` 里。

其它事件即使带 `usage` 也不汇总，避免把某个聚合事件重复计入。

`assistant/message` 的形态：

```json
{"type":"assistant/message","time":1794039013341,
 "data":{"usage":{"inputTokens":1222,"outputTokens":10,
                  "cacheReadTokens":19584,"cacheWriteTokens":0,"totalTokens":20816},
         "message":{"source":{"model":"deepseek-flash"}}}}
```

### 4.2 必须逐帧解码（实测）

Node 的 `zlib.zstdDecompressSync` 遇到串联帧只解第一帧就停。实测把 42 个文件整文件解码，只得到 **8,590 字节 / 42 行**（每个文件恰好第一帧）；按帧切分后解出 **61,737,895 字节 / 25,122 行 / 3,211 条 usage**。所以 `zstd-frames.js` 先做结构扫描：

- 校验 magic `0xFD2FB528`，跳过 skippable 帧；
- 解析 frame header（FCS、字典 ID、checksum）与 block header，算出完整帧边界；
- 末尾写了一半的帧报 `tornStart`，**不解码、不抛错**，等下次刷新；
- 结构非法（magic 不对、保留 block 类型）直接报错，不静默跳过。

### 4.3 缓存与增量

- 每个文件按 `size + mtimeMs` 缓存解析结果；未变化的文件只花一次 `stat`。
- 文件被追加时整文件重扫。单个文件约 1 MB 量级，重扫通常几十毫秒，比维护「帧偏移增量」更不容易在半个帧上出错。
- 首扫 69 个文件（39.6 MB 压缩）约 **1.8 s**，此后每次刷新接近零成本；扫描按文件 `await` 让出事件循环，不卡住宿主。
- 只保留最近 **95 天**的事件，足够覆盖 60 天对比窗口。

### 4.4 去重（fork）

DSH 的 fork 会把继承事件写进子会话日志。若直接相加，同一笔消耗会算两次。本插件按 `时间|模型|四类 token 数` 生成签名去重，重复条数上报为 `coverage.duplicates`。本机实测 69 个会话、4,255 条记录，重复为 0；去重是防御性的。

### 4.5 失败可见

- 文件无法解码 → `unreadableFiles++`，其余文件照常统计。
- 尾部半帧 → `tornFrames++`，该批次丢弃，界面提示。
- 未知模型 → `unpricedEvents++`，金额不猜，界面明确提示「N 条记录没有对应单价」。

任何一项都不会被静默吞掉，因为「少算」和「算错」一样会误导充值决策。

---

## 5. 计价

宿主没有价格来源：`dsh-token-meter` 只做 token 估算，不含单价表；DeepSeek 也没有公开的账单 API。因此内置价表，并把它做成**带日期的公开事实**：

| 模型 | 缓存命中（空闲/峰时） | 缓存未命中（空闲/峰时） | 输出（空闲/峰时） |
| --- | --- | --- | --- |
| `deepseek-flash` | ¥0.02 / ¥0.04 | ¥1 / ¥2 | ¥4 / ¥8 |
| `deepseek-v4-pro` | ¥0.15 / ¥0.30 | ¥4.5 / ¥9 | ¥13.5 / ¥27 |

> 单位：每百万 token，人民币。版本 `2026-11-12`，来源 <https://api-docs.deepseek.com/zh-cn/quick_start/pricing>。

规则：

- **峰时**：北京时间周一至周五 09:00–12:00、14:00–18:00；周末与配置的节假日全天空闲。`Asia/Shanghai` 无夏令时，实现用固定 +08:00，避免每次计价都走 `Intl`。
- **单价维度**：缓存命中读 / 未命中输入 / 输出。缓存写入按未命中输入计价——官方没有单独的写入价，这是唯一有据的读法。
- **别名**：`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 按官方说明按 Flash 价计。
- **未知模型**：`cost = null`，绝不套用相似模型的价格，UI 单独提示数量与模型名。
- **历史价格不回溯**：30 天前的调用也用当前价表估算；这是明确的已知边界，写在界面页脚。
- **币种**：价表是人民币。余额若返回 USD，不猜汇率，天数与建议充值显示为不可计算（`currencyMismatch`）。

---

## 6. 指标口径（与需求 §5 逐条对应）

| 指标 | 实现 |
| --- | --- |
| 计费 token | `inputTokens + outputTokens` |
| 缓存 token | `cacheReadTokens`，单列展示 |
| 单次消耗 | Σ(缓存读×命中价 + (未命中+缓存写)×未命中价 + 输出×输出价) / 1e6 |
| 速率 r(n) | 半开区间 `[now − n×24h, now)` 的金额 ÷ n |
| 主速率 | 默认 r7，可切 r1 / r30 |
| 最低可用天数 | 余额 ÷ max(r7, r30)；底栏提醒线取它 |
| 最长可用天数 | 余额 ÷ min(r7, r30)；只作上界参考，不参与提醒 |
| 目标天数 | 配置项（默认 30）；只用于建议充值与提醒比较，不参与「还能用几天」的估算 |
| 主速率天数 | 余额 ÷ r(主)，仍在接口里（`forecast.daysLeft`），界面不再单独展示 |
| 建议充值 | `max(0, ceil10(r(主) × 目标天数 + 安全垫 − 余额))`，`ceil10` 即向上取整到 10 元 |
| 自定义金额 → 天数 | `(余额 + X) ÷ r(主)` |
| 日对比 | 今日 00:00→now vs 昨日 00:00→同一时刻（等长） |
| 周 / 月对比 | 7×24h vs 前 7×24h；30×24h vs 前 30×24h（等长滚动窗口） |
| 消耗进度 | 未实现；需要期初余额与充值记录 |


### 6.1 账号口径（余额差值）

本机日志看不见标题生成、失败重试，也看不见同 key 的其它工具；余额能。每次成功读余额时按自然日落一条快照，就能得到账号级的消耗：

- 存储：`<DSH_HOME>/storages/balance-burn/balance-history.json`，每个自然日只保留最后一条；
- 公式：`账号口径 = 前一自然日快照余额 − 当日快照余额`；
- 只有同时满足「两天相邻、币种一致、余额没有上升」才出数，否则**整行不显示**——不标注充值，也不标注断档，因为这些是用户自己知道的记账细节，界面上只留可信的数；
- 只在浮层「余额与预测」里出现一行：`账号口径 ¥7.40 · 较本机 +¥6.03`；没有可比数据时这一行完全不存在；
- 从安装当天开始积累，历史补不回来；它不参与预测，只做覆盖校验。

边界处理：

- 无数据日期在 `daily` 序列里是 `hasData: false, cost: null`，不是 0；速率的 `daysWithData` 只用于提示覆盖，不参与平均。
- 展示取整：金额两位小数（小于 0.01 显示 `<¥0.01`）；天数下界 floor、上界 ceil，保证区间不缩水；`¥` 建议金额为整数。
- 对比基准为 0 时不算百分比，显示「新增」；双方都为 0 显示「—」。

---

## 7. HTTP 契约

### `GET /api/balance-burn[?refresh=1]`

```jsonc
{
  "generatedAt": "2026-11-12T03:47:00.000Z",
  "scope": "local",
  "settings": { "targetDays": 30, "safetyCushion": 5, "primaryWindow": "r7", "refreshSeconds": 60 },
  "balance": {
    "status": "ok",              // ok | unconfigured | error
    "currency": "CNY", "total": 37.49, "granted": 5.77, "toppedUp": 31.71,
    "available": true, "fetchedAt": "2026-11-12T03:47:00.000Z", "error": null
  },
  "accountDelta": {
    "day": "2026-11-12", "spend": 7.40, "total": 37.49,
    "previousDay": "2026-11-11", "previousTotal": 44.89, "currency": "CNY"
  },
  "rates": [
    { "key": "r1", "days": 1, "cost": 6.77, "perDay": 6.77,
      "billedTokens": 883256, "cacheReadTokens": 77165184,
      "events": 190, "daysWithData": 2, "unpricedEvents": 0, "from": 0, "to": 0 },
    { "key": "r7", "days": 7, "cost": 24.31, "perDay": 3.47,
      "billedTokens": 4833595, "cacheReadTokens": 304216832,
      "events": 1100, "daysWithData": 6, "unpricedEvents": 0, "from": 0, "to": 0 },
    { "key": "r30", "days": 30, "cost": 44.14, "perDay": 1.47,
      "billedTokens": 7362986, "cacheReadTokens": 844785280,
      "events": 4255, "daysWithData": 9, "unpricedEvents": 0, "from": 0, "to": 0 }
  ],
  "primary": { "key": "r7", "…": "同 rates 的一项" },
  "forecast": {
    "currency": "CNY", "balance": 37.49, "primaryWindow": "r7", "perDay": 3.47,
    "daysLeft": 10.8, "daysLow": 10.8, "daysHigh": 25.5,
    "targetDays": 30, "cushion": 5, "suggestedTopUp": 80, "rateAvailable": true
  },
  "today": {
    "current": { "cost": 6.65, "billedTokens": 0, "cacheReadTokens": 0, "events": 0, "…": "" },
    "previous": { "cost": 2.70, "…": "" },
    "change": { "cost": 146.3, "billedTokens": null, "cacheReadTokens": null }
  },
  "week": { "current": {}, "previous": {}, "change": {} },
  "month": { "current": {}, "previous": {}, "change": {} },
  "daily": [ { "day": "2026-11-12", "hasData": true, "cost": 6.65, "billedTokens": 0, "cacheReadTokens": 0, "events": 0 } ],
  "coverage": {
    "sessions": 69, "files": 69, "events": 4255, "daysWithData": 9,
    "firstDay": "2026-08-14", "lastDay": "2026-11-12",
    "duplicates": 0, "unpricedEvents": 0, "unpricedModels": [],
    "unreadableFiles": 0, "tornFrames": 0, "retainedDays": 95, "scanMs": 18
  },
  "priceTable": { "version": "2026-11-12", "currency": "CNY", "source": "…", "models": [], "peak": {} }
}
```

`?refresh=1` 跳过快照缓存、文件缓存与余额缓存，用于手动刷新。

### `POST /api/balance-burn/settings`

```json
{ "targetDays": 45, "safetyCushion": 8, "primaryWindow": "r30", "refreshSeconds": 90, "holidays": "2026-10-01,2026-10-02" }
```

- 合法字段合并后持久化，返回**重新计算后的完整快照**（客户端无需二次请求）。
- 非法字段返回 `400 { "error": "Invalid settings.", "fields": ["refreshSeconds"] }`，不落盘。
- 未识别的字段忽略，避免旧页面把新版本不认识的字段写坏。

---

## 8. 界面设计

### 8.1 底栏（`shell.bottom`，单槽位）

| 状态 | 展示 |
| --- | --- |
| 正常 | `¥37.49 · 最低 10 天 / 目标 30 天 · 今日 ¥6.65 ↑146%` |
| 余额 < 安全垫 | 整条淡警示底色 + 余额文字警示色 |
| 最低可用 < 目标天数 | 「最低 N 天」与状态点转琥珀色；目标天数保持弱化 |
| 无消耗记录 | `暂无消耗记录` |
| 余额不可用 | `余额不可用` / `余额看板不可用`（含原因 title） |
| 加载 / 刷新失败 | `读取中…`；失败但仍有旧数据时右侧显示「上次读数」 |

右侧是更新时刻与刷新按钮（转圈禁用）；页面隐藏时轮询暂停，恢复可见立即刷新。底边有一条 2px 的「最低可用 ÷ 目标天数」细进度条：低于目标转琥珀色，达到/超过目标为强调色，悬停显示「最低 N 天 / 目标 M 天」；没有速率数据时整条不显示。

### 8.2 浮层（点击底栏，`Esc` / 点外部关闭，焦点回到触发点）

1. **余额与预测**：余额大数字 + 可用天数环（最低可用 ÷ 目标天数）、充值/赠送拆分、主速率、最低可用、最长可用、目标天数；有可比余额快照时多一行「账号口径」（见 §6.1），没有就整行不出现；下方一行口径说明。
2. **速率**：1/7/30 三行，每行计费 token、缓存 token、金额、日均；覆盖不足时该行变灰并在 title 标注有数据天数。下方是近 30 天每日柱状：柱高按当日金额，无数据当天画成基线短线（title 显示「无数据」），今天加深。
3. **对比**：日 / 周 / 月三组，双条对比 + 百分比，右上角切换「按金额 / 按 token」；底部注明窗口定义。
4. **充值建议**：建议金额、公式、「目标天数」直接可改（即时保存）、「我想用 N 天 / 我充 ¥X」两种反算、**去充值**（新标签打开 `https://platform.deepseek.com/top_up`，与 DSH 账号面板同址）、复制金额；「更多设置」展开安全垫、主速率口径、刷新周期。
5. **页脚**：会话数 / 记录数 / 有数据天数、单价版本、更新时间、本机口径声明、未定价与不可读提示。

### 8.3 设置页（`settings.section`，DSH 设置 → 余额与消耗）

目标天数、安全垫、主速率口径、刷新周期、节假日（停峰）、恢复默认；只读单价表（版本、来源、空闲/峰时格式说明）与数据口径说明。

### 8.4 无障碍与 i18n

- 底栏主体是 `<button aria-haspopup="dialog">`，浮层 `role="dialog"`、`aria-labelledby`，关闭按钮可聚焦，Esc 关闭。
- 对比条形图对读屏隐藏（`aria-hidden`），数值以文本给出。
- 中英文字典各 95 个键，`test/client.test.mjs` 断言键集合一致。

---

## 9. 配置与持久化

| 字段 | 默认 | 校验 |
| --- | --- | --- |
| `targetDays` | 30 | 整数 1–365 |
| `safetyCushion` | 5 | 0–10000 |
| `primaryWindow` | `r7` | `r1` / `r7` / `r30` |
| `refreshSeconds` | 60 | 整数 15–600 |
| `holidays` | `''` | ≤ 500 字符，`YYYY-MM-DD` 逗号分隔 |

- 路径：`~/.dsh/storages/balance-burn/settings.json`（跟随 `$DSH_HOME`）；余额快照在同目录的 `balance-history.json`。
- 写入：临时文件 + `rename` 原子替换；损坏文档逐字段修复而不是整体重置。
- **为什么不用 `ctx.settings`**：宿主设置服务要求用 `@deepseek-ai/schemastery` 构造 schema。该包只在 DSH 应用内部保证可用，插件从 profile 目录导入会随宿主升级/裁剪而断。用自带的校验函数 + 自有文档，安装面最小；设置页仍然长在 DSH 设置里，用户无感。
- **为什么不用 `ctx.sessionQuery`**：它能把会话读成完整事件流，但要为每个会话解码整份日志，30 天量级下比「按文件 stat + 只解 usage」重。当前实现只依赖文件系统与 Node 内置 zstd，跨版本更稳。

---

## 10. 验收标准对照（需求 §8）

| # | 标准 | 证据 |
| --- | --- | --- |
| 1 | 固定样例日志的日/周/月聚合与手算一致，误差 0 | `test/metrics.test.mjs` 用固定时间戳与金额逐项断言；`test/usage-store.test.mjs` 用真实编码的 zstd 帧构造日志 |
| 2 | 预计天数 = 余额 ÷ 速率，误差 < 1%；三档可切 | 最低/最长按 r7、r30 上下界，主速率仍可切 r1/r7/r30；`test/metrics.test.mjs` 断言精确值 |
| 3 | 无数据日期显示「—」，不显示 0，不参与均值 | `dailySeries` 返回 `null`；`test/metrics.test.mjs` 断言 `hasData/cost`；浮层柱状图对无数据日画基线短线并提示「无数据」，不画零高柱；速率按窗口总额 ÷ 窗口长度，不按有数据天数平均 |
| 4 | 金额 = Σ token × 单价，覆盖缓存命中/未命中/峰谷四种组合 | `test/pricing.test.mjs` 逐一断言四个组合，并覆盖缓存写、别名、未知模型 |
| 5 | 刷新后数据陈旧度 < 60s；页面隐藏暂停轮询 | 客户端默认 60s 轮询 + `visibilitychange` 暂停/恢复；快照缓存 3s、余额缓存 30s；手动刷新 `?refresh=1` 全绕过 |
| 6 | 凭据只在宿主进程使用，浏览器拿不到明文 | 密钥仅在 `index.js` 的凭据解析与 `Authorization` 头中出现；`test/snapshot.test.mjs` 断言快照 JSON 不含密钥字符串 |
| 7 | 账号口径只在可信时出现 | `test/balance-history.test.mjs` 覆盖连续日、余额上升、断档、币种变化；不可信时接口返回 `null`，界面整行不渲染 |

### 真实数据交叉验证

同一台机器、同一批日志（2026-11-12 11:47 实测）：

| 口径 | 需求文档记录 | 本插件实测 | 差异 |
| --- | --- | --- | --- |
| 会话文件 | 69 | 69 | — |
| usage 消息 | 4,133 | 4,255 | +122（文档之后新增的会话） |
| 近 30 天计费 token | 7,123,124 | 7,362,986 | +3.4%（同一原因） |
| 近 30 天缓存读 | 827,100,160 | 844,785,280 | +2.1% |
| 近 30 天金额 | — | ¥44.14 | 按 2026-11-12 单价、含峰谷 |
| 数据首日 | 2026-08-14 | 2026-08-14 | — |

差异全部可由「文档写成之后又产生了消耗」解释，聚合口径与文档一致。这也验证了逐帧解码没有漏帧。

### 平台账单对账（用户导入的导出，2026-11-12）

用户从平台导出 10-21 ~ 11-12 的 `amount`（按价格档的 token / 次数）与 `cost`（按钱包的金额）两份 CSV。插件不抓平台页面，这里只是拿导出做一次性校准：

| 校验项 | 结果 |
| --- | --- |
| 四种单价（缓存命中 / 未命中 / 输出，空闲 / 峰时） | 与平台账单逐行完全一致：0.00000002 / 0.00000004、0.000001 / 0.000002、0.000004 / 0.000008 元/token |
| 峰时判定 | 平台按价格档拆出的峰/闲 token 与本机判定吻合（如 11-11 峰时占比 97.8% vs 97.6%） |
| 金额合计（导出范围内） | 平台 ¥49.10（token ¥48.97 + 搜索 ¥0.13），本机 ¥46.78，**低 4.7%** |
| 请求覆盖 | 平台 3,879 次，本机记录 3,450 条（88.9%） |

差额不是价表错，而是**有调用没在日志里留下 usage**：

- 会话标题生成走 `ctx.llm`，只记 `session/title-llm-request`，不带 usage；
- 失败/中断/重试的请求可能被计费但只保住最终一次 usage；
- 平台搜索/抓取按次计费（¥5/1000），不产生 token，本机永远算不到；
- 个别天差异明显（10-28 平台 21 次 vs 本机 11 次；11-08 523 vs 383），无法只靠日志解释，可能还有同 key 的其它调用。

结论：**本机口径是偏低的一致估算，不是账单**。要覆盖全部消耗，只能靠余额快照差值（已实现为「账号口径」）或用户导入账单；界面文案已按这个结论调整。

---

## 11. 与需求文档的偏差及原因

| 项 | 需求写法 | 实际实现 | 原因 |
| --- | --- | --- | --- |
| 单价来源 | 优先复用宿主 `token-meter` 的价格来源 | 内置价表 + 版本日期 + 只读展示 | 宿主 `token-meter` 只测 token，不含价格；DeepSeek 无账单 API。`src/pricing.js` 是唯一替换点，将来宿主暴露价格可一处接入 |
| 时区 | 一律 `Asia/Shanghai` | 固定 +08:00 | 上海无夏令时；避免每条事件走 `Intl`，结果等价 |
| 节假日 | 按官方定义（高峰排除法定节假日） | 内置规则只排除周末，节假日由设置补充 | 无法可靠内置未来年份的放假安排；不填时可能把节假日高峰估高，已在界面说明 |
| 底栏 `[⚙]` | 点击进入配置 | 底栏右侧为刷新；设置在浮层「更多设置」与 DSH 设置页 | 宿主没有「从任意插件打开指定设置分节」的公开接口；不伪造入口 |
| 消耗进度条 | 期初余额 + 本期充值反推 | 不显示 | 需要期初余额与充值记录，余额快照本身不够 |
| 30 天曲线、异常日 | P2 | 已有近 30 天每日柱状；异常日标注不做 | 保留趋势可见性，同时控制本期范围 |
| `cacheWrite` 计价 | 需求列了四种单价 | 按未命中输入价计 | DeepSeek 价表没有写入价；这是唯一不猜的读法 |
| 汇率 | 未提 | 非 CNY 余额不折算 | 不引入会过期的汇率假设 |
| 刷新周期 / 陈旧度 | 刷新周期 60s；验收要求陈旧度 < 60s | 默认 60s，可下调到 15s；每次刷新拿到的都是请求时刻的数据 | 严格说「陈旧度 ≈ 间隔 + 请求耗时」，默认值贴着上限；需要更紧就把周期调到 15–55s，快照缓存只有 3s，不会拖慢 |

---

## 12. 风险与后续

| 风险 | 现状 | 后续 |
| --- | --- | --- |
| 单价过期 | 版本号可见 + 单测锁价 | P2：从宿主或可配置源更新价表 |
| 本机口径 ≠ 平台账单 | 界面声明；对账实测低 4.7%；浮层用账号口径展示差额 | 继续保留两条口径，不混用 |
| 一次性大额消耗 | 给区间而非单点 | 异常日标注（P2） |
| 日志清理 / 换机器 | 覆盖天数与首末日期可见 | 缺口日期在曲线上标空（P2） |
| 首扫耗时 | 69 会话约 1.8 s，仅进程内一次 | 可移到 worker，或按帧偏移增量读 |
| fork 复制事件 | 签名去重，本机重复为 0 | 若出现同毫秒同 token 的真实重复，需改用事件 ID（宿主暂未暴露） |

---

## 13. 安装、验证与回滚

1. 卸载 `dsh-quota-bar`（`shell.bottom` 单槽位）。
2. 安装本包（设置 → 插件；或按 README 的写法把 `dsh-balance-burn` 加入 profile 的 `dependencies` 与 `dsh.profile.bundles`，再 `pnpm install`）。
3. 重启 DSH；底栏出现即成功。DevTools 里 `GET /api/balance-burn` 应返回 `scope: "local"`。
4. 回滚：从 bundles 移除本包并重启；需要恢复旧底栏时重新启用 `dsh-quota-bar`。

> 本次设计交付**没有**写入你的 DSH profile：插件源码在 `D:\dsh-balance-notify`，安装动作留给第 13 步确认后执行。
