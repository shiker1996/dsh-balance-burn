import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { zstdCompressSync } from 'node:zlib'
import { createUsageStore, parseUsageRecord, RETENTION_DAYS } from '../src/usage-store.js'
import { DAY_MS } from '../src/metrics.js'
import { appendBytes, appendEvent, makeHome, usageEvent, writeSession } from './helpers.mjs'

const NOW = Date.parse('2026-11-12T12:00:00+08:00')

test('reads usage from every complete frame and caches per file', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    const path = await writeSession(sessions, '--proj--', 'session-1', [
      { type: 'session', version: 4, id: 'session-1' },
      usageEvent({ time: NOW - 3_600_000, input: 1000, output: 200 }),
      usageEvent({ time: NOW - 1_800_000, input: 500, output: 100, cacheRead: 9000 }),
    ])

    const store = createUsageStore({ root: sessions })
    const first = await store.read({ now: NOW })
    assert.equal(first.events.length, 2)
    assert.equal(first.coverage.sessions, 1)
    assert.equal(first.coverage.files, 1)
    assert.equal(first.events[0].billedTokens, 1200)
    assert.equal(first.events[1].cacheReadTokens, 9000)
    assert.equal(first.coverage.daysWithData, 1)

    const second = await store.read({ now: NOW })
    assert.equal(second.events.length, 2)

    await appendEvent(path, usageEvent({ time: NOW - 60_000, input: 10, output: 5 }))
    const third = await store.read({ now: NOW })
    assert.equal(third.events.length, 3)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('de-duplicates records a fork copied into a second session', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    const event = usageEvent({ time: NOW - 3_600_000, input: 42, output: 7 })
    await writeSession(sessions, '--proj--', 'parent', [event])
    await writeSession(sessions, '--proj--', 'child', [event, usageEvent({ time: NOW - 60_000 })])

    const store = createUsageStore({ root: sessions })
    const read = await store.read({ now: NOW })
    assert.equal(read.coverage.duplicates, 1)
    assert.equal(read.events.length, 2)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a torn tail is counted and the rest still reads', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    const path = await writeSession(sessions, '--proj--', 'live', [
      usageEvent({ time: NOW - 7_200_000 }),
    ])
    await appendBytes(path, zstdCompressSync(Buffer.from('{"type":"assistant/message"}')).subarray(0, 8))

    const store = createUsageStore({ root: sessions })
    const read = await store.read({ now: NOW })
    assert.equal(read.events.length, 1)
    assert.equal(read.coverage.tornFrames, 1)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a corrupt artifact is reported, not silently skipped', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    await writeSession(sessions, '--proj--', 'good', [usageEvent({ time: NOW - 60_000 })])
    const bad = join(sessions, '--proj--', 'bad', 'session.v4.jsonl.zstd')
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(join(sessions, '--proj--', 'bad'), { recursive: true })
    await writeFile(bad, Buffer.from('not zstd at all, but a file'))

    const store = createUsageStore({ root: sessions })
    const read = await store.read({ now: NOW })
    assert.equal(read.events.length, 1)
    assert.equal(read.coverage.unreadableFiles, 1)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('events older than the retention window are not kept', async () => {
  const home = await makeHome()
  try {
    const sessions = join(home, 'sessions')
    await writeSession(sessions, '--proj--', 'old', [
      usageEvent({ time: NOW - (RETENTION_DAYS + 2) * DAY_MS }),
      usageEvent({ time: NOW - 60_000 }),
    ])
    const store = createUsageStore({ root: sessions })
    const read = await store.read({ now: NOW })
    assert.equal(read.events.length, 1)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('parseUsageRecord ignores non-usage lines and malformed JSON', () => {
  const cutoff = 0
  assert.equal(parseUsageRecord('not json', cutoff), null)
  assert.equal(parseUsageRecord(JSON.stringify({ type: 'user/message' }), cutoff), null)
  assert.equal(parseUsageRecord(JSON.stringify({ type: 'assistant/message', time: 1 }), cutoff), null)
  assert.equal(parseUsageRecord(JSON.stringify(usageEvent({ time: 1000 })), cutoff).billedTokens, 150)
})

test('compaction summaries are billed model calls and are counted', () => {
  const event = {
    type: 'compaction/summary',
    time: 1_000,
    data: {
      model: 'deepseek-flash',
      usage: { inputTokens: 619, outputTokens: 7541, cacheReadTokens: 546688, cacheWriteTokens: 0 },
    },
  }
  const record = parseUsageRecord(JSON.stringify(event), 0)
  assert.equal(record.model, 'deepseek-flash')
  assert.equal(record.billedTokens, 8160)
  assert.equal(record.cacheReadTokens, 546688)
})
