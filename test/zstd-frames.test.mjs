import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zstdCompressSync } from 'node:zlib'
import { scanZstdFrames, decodeZstdFrame, ZstdFrameError } from '../src/zstd-frames.js'

function frame(text) {
  return zstdCompressSync(Buffer.from(text, 'utf8'))
}

test('scans concatenated frames and decodes each one', () => {
  const lines = [
    '{"type":"session","version":4}',
    '{"type":"assistant/message","time":1}',
    '{"type":"assistant/message","time":2}',
  ]
  const buffer = Buffer.concat(lines.map(frame))

  const { frames, tornStart } = scanZstdFrames(buffer)
  assert.equal(tornStart, undefined)
  assert.equal(frames.length, 3)
  assert.deepEqual(
    frames.map((range) => decodeZstdFrame(buffer.subarray(range.start, range.end))),
    lines,
  )
})

test('reports a torn final frame instead of throwing', () => {
  const buffer = Buffer.concat([frame('{"a":1}\n'), frame('{"b":2}\n')])
  const partial = frame('{"c":3}\n').subarray(0, 12)
  const combined = Buffer.concat([buffer, partial])

  const { frames, tornStart } = scanZstdFrames(combined)
  assert.equal(frames.length, 2)
  assert.equal(tornStart, buffer.length)
})

test('skips skippable frames between data frames', () => {
  const skippable = Buffer.alloc(8 + 4)
  skippable.writeUInt32LE(0x184d2a50, 0)
  skippable.writeUInt32LE(4, 4)
  const buffer = Buffer.concat([skippable, frame('{"a":1}\n')])

  const { frames, tornStart } = scanZstdFrames(buffer)
  assert.equal(tornStart, undefined)
  assert.equal(frames.length, 1)
  assert.equal(decodeZstdFrame(buffer.subarray(frames[0].start, frames[0].end)), '{"a":1}\n')
})

test('rejects bytes that do not start with a frame magic', () => {
  const buffer = Buffer.concat([Buffer.from('not a zstd frame'), frame('{"a":1}\n')])
  assert.throws(() => scanZstdFrames(buffer), ZstdFrameError)
})

test('an empty artifact has no frames and no torn tail', () => {
  assert.deepEqual(scanZstdFrames(Buffer.alloc(0)), { frames: [] })
})
