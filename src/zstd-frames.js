/**
 * Zstandard frame container reader for DSH session logs.
 *
 * A `session.v4.jsonl.zstd` file is a concatenation of independently encoded
 * Zstandard frames — one frame per durable event batch. Node's one-shot
 * `zstdDecompressSync` stops at the first frame, so a multi-frame log must be
 * split structurally before any frame is decoded. This module implements the
 * structural scan (RFC 8878 §3.1) and yields one plaintext buffer per frame.
 *
 * Nothing here depends on a DSH package or a native addon: the scan is pure
 * byte arithmetic and decoding uses `node:zlib`'s built-in Zstandard support.
 * A torn final frame (a batch still being written) is reported separately and
 * never decoded, so a concurrent writer cannot fail the aggregation.
 *
 * @module dsh-balance-burn/zstd-frames
 */

import { zstdDecompressSync } from 'node:zlib'

/** Little-endian magic that opens every standard Zstandard frame. */
export const ZSTD_MAGIC = 0xfd2fb528
const SKIPPABLE_MAGIC_MIN = 0x184d2a50
const SKIPPABLE_MAGIC_MAX = 0x184d2a5f

const DICT_ID_SIZES = [0, 1, 2, 4]
const FCS_SIZES = [0, 2, 4, 8]

/**
 * A malformed container, as opposed to a truncated one. Truncation is expected
 * while a live session is being appended and is reported as `tornStart`.
 */
export class ZstdFrameError extends Error {
  /** @param message - what is structurally wrong. */
  constructor(message) {
    super(message)
    this.name = 'ZstdFrameError'
  }
}

/**
 * Locate every complete frame without decompressing its blocks.
 *
 * The scan stops at the first byte range it cannot prove complete: the tail is
 * then `tornStart`, never an error. Structural violations before that point
 * throw, because silently skipping them would corrupt an aggregate.
 *
 * @param {Buffer} buffer - bytes currently present in the session artifact.
 * @returns {{ frames: Array<{start: number, end: number}>, tornStart?: number }}
 *   frame ranges in file order, plus the start of a trailing incomplete frame.
 */
export function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0

  while (offset < buffer.length) {
    if (buffer.length - offset < 4) return { frames, tornStart: offset }

    const magic = buffer.readUInt32LE(offset)
    if (magic >= SKIPPABLE_MAGIC_MIN && magic <= SKIPPABLE_MAGIC_MAX) {
      if (buffer.length - offset < 8) return { frames, tornStart: offset }
      const skip = 8 + buffer.readUInt32LE(offset + 4)
      if (buffer.length - offset < skip) return { frames, tornStart: offset }
      offset += skip
      continue
    }
    if (magic !== ZSTD_MAGIC) {
      throw new ZstdFrameError(`Unexpected bytes at offset ${offset}: no Zstandard frame magic.`)
    }

    const end = frameEnd(buffer, offset)
    if (end === undefined) return { frames, tornStart: offset }
    frames.push({ start: offset, end })
    offset = end
  }

  return { frames }
}

/**
 * Read one frame's structural length from its header and block headers.
 *
 * @param {Buffer} buffer - complete artifact bytes.
 * @param {number} start - frame start (already known to carry the magic).
 * @returns {number | undefined} exclusive frame end, or undefined when the
 *   available bytes do not yet prove the frame complete.
 */
function frameEnd(buffer, start) {
  let offset = start + 4
  if (buffer.length <= offset) return undefined

  const descriptor = buffer[offset]
  offset += 1

  const fcsFlag = descriptor >> 6
  const singleSegment = (descriptor >> 5) & 1
  const checksumFlag = (descriptor >> 2) & 1
  const dictIdFlag = descriptor & 3

  if (singleSegment === 0) {
    if (buffer.length <= offset) return undefined
    offset += 1 // window descriptor
  }

  const dictIdSize = DICT_ID_SIZES[dictIdFlag]
  if (buffer.length < offset + dictIdSize) return undefined
  offset += dictIdSize

  const fcsSize = fcsFlag === 0 ? (singleSegment === 1 ? 1 : 0) : FCS_SIZES[fcsFlag]
  if (buffer.length < offset + fcsSize) return undefined
  offset += fcsSize

  for (;;) {
    if (buffer.length < offset + 3) return undefined
    const header = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
    offset += 3

    const lastBlock = header & 1
    const blockType = (header >> 1) & 3
    const blockSize = header >>> 3

    if (blockType === 3) throw new ZstdFrameError(`Reserved block type at offset ${offset - 3}.`)
    const payload = blockType === 1 ? 1 : blockSize // RLE blocks store one byte
    if (buffer.length < offset + payload) return undefined
    offset += payload

    if (lastBlock === 1) break
  }

  if (checksumFlag === 1) {
    if (buffer.length < offset + 4) return undefined
    offset += 4
  }
  return offset
}

/**
 * Decode one complete frame and parse it as JSONL.
 *
 * A frame that fails to decode is reported as an error rather than silently
 * dropped: a checksum failure means the file changed underneath the read (or
 * is corrupt), and hiding it would bias every downstream number.
 *
 * @param {Buffer} frame - exactly one complete frame's bytes.
 * @returns {string} the frame's UTF-8 plaintext.
 */
export function decodeZstdFrame(frame) {
  return zstdDecompressSync(frame).toString('utf8')
}
