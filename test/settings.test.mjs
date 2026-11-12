import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  mergeSettings,
  resolveDshHome,
  saveSettings,
  settingsPath,
} from '../src/settings.js'
import { makeHome } from './helpers.mjs'

test('mergeSettings validates ranges and ignores unknown fields', () => {
  const { value, errors } = mergeSettings({
    targetDays: 45,
    safetyCushion: '12.5',
    primaryWindow: 'r30',
    refreshSeconds: 90,
    fromTheFuture: true,
  })
  assert.deepEqual(errors, [])
  assert.equal(value.targetDays, 45)
  assert.equal(value.safetyCushion, 12.5)
  assert.equal(value.primaryWindow, 'r30')
  assert.equal(value.refreshSeconds, 90)
  assert.equal(Object.hasOwn(value, 'fromTheFuture'), false)
})

test('mergeSettings rejects out-of-range and mistyped fields', () => {
  assert.deepEqual(mergeSettings({ targetDays: 0 }).errors, ['targetDays'])
  assert.deepEqual(mergeSettings({ targetDays: 1.5 }).errors, ['targetDays'])
  assert.deepEqual(mergeSettings({ targetDays: 366 }).errors, ['targetDays'])
  assert.deepEqual(mergeSettings({ refreshSeconds: 5 }).errors, ['refreshSeconds'])
  assert.deepEqual(mergeSettings({ safetyCushion: -1 }).errors, ['safetyCushion'])
  assert.deepEqual(mergeSettings({ primaryWindow: 'r2' }).errors, ['primaryWindow'])
  assert.deepEqual(mergeSettings({ holidays: 'x'.repeat(501) }).errors, ['holidays'])
  assert.deepEqual(mergeSettings(null).errors, ['settings'])
})

test('mergeSettings keeps the baseline for rejected fields', () => {
  const { value } = mergeSettings({ targetDays: 0, safetyCushion: 9 }, { ...DEFAULT_SETTINGS, targetDays: 21 })
  assert.equal(value.targetDays, 21)
  assert.equal(value.safetyCushion, 9)
})

test('settings round-trip through the plugin document', async () => {
  const home = await makeHome()
  try {
    const initial = await loadSettings(home)
    assert.deepEqual(initial.settings, DEFAULT_SETTINGS)
    assert.equal(initial.persisted, false)

    const next = { ...DEFAULT_SETTINGS, targetDays: 60, holidays: '2026-10-01,2026-10-02' }
    await saveSettings(home, next)
    const stored = JSON.parse(await readFile(settingsPath(home), 'utf8'))
    assert.equal(stored.targetDays, 60)

    const reloaded = await loadSettings(home)
    assert.deepEqual(reloaded.settings, next)
    assert.equal(reloaded.persisted, true)

    await saveSettings(home, { ...next, targetDays: 90 })
    const replaced = await loadSettings(home)
    assert.equal(replaced.settings.targetDays, 90)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('a corrupt document falls back to defaults and reports it', async () => {
  const home = await makeHome()
  try {
    await mkdir(join(home, 'storages', 'balance-burn'), { recursive: true })
    await writeFile(settingsPath(home), '{not json')
    const loaded = await loadSettings(home)
    assert.deepEqual(loaded.settings, DEFAULT_SETTINGS)
    assert.match(loaded.error, /not JSON/)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('resolveDshHome follows override, env, then home', () => {
  assert.equal(resolveDshHome('D:\\custom', {}), 'D:\\custom')
  assert.equal(resolveDshHome('', { DSH_HOME: 'D:\\env' }), 'D:\\env')
  assert.equal(resolveDshHome(undefined, { DSH_HOME: '  ' }).endsWith('.dsh'), true)
})
