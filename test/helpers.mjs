import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'

/**
 * Create a throwaway DSH home.
 *
 * @returns {Promise<string>} absolute path of the new directory.
 */
export async function makeHome() {
  return mkdtemp(join(tmpdir(), 'dsh-balance-burn-'))
}

/**
 * Build one `assistant/message` event with usage.
 *
 * @param {{ id?: string, time: number, model?: string, input?: number, output?: number, cacheRead?: number, cacheWrite?: number }} input
 *   event facts.
 * @returns {object} the event as the session log stores it.
 */
export function usageEvent({
  time,
  model = 'deepseek-flash',
  input = 100,
  output = 50,
  cacheRead = 0,
  cacheWrite = 0,
}) {
  return {
    type: 'assistant/message',
    seq: 0,
    time,
    data: {
      usage: {
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        totalTokens: input + output + cacheRead + cacheWrite,
      },
      message: { source: { model } },
    },
  }
}

/**
 * Write a session artifact made of one Zstandard frame per event.
 *
 * @param {string} root - sessions root.
 * @param {string} project - project directory name.
 * @param {string} session - session directory name.
 * @param {Array<object>} events - events to encode.
 * @returns {Promise<string>} the artifact path.
 */
export async function writeSession(root, project, session, events) {
  const dir = join(root, project, session)
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'session.v4.jsonl.zstd')
  const frames = events.map((event) => frameOf(event))
  await writeFile(path, Buffer.concat(frames))
  return path
}

/**
 * Append one event as a new frame.
 *
 * @param {string} path - artifact path.
 * @param {object} event - event to encode.
 * @returns {Promise<void>} resolves after the append.
 */
export async function appendEvent(path, event) {
  const { appendFile } = await import('node:fs/promises')
  await appendFile(path, frameOf(event))
}

/**
 * Append raw bytes, for torn-frame tests.
 *
 * @param {string} path - artifact path.
 * @param {Buffer} bytes - bytes to append.
 * @returns {Promise<void>} resolves after the append.
 */
export async function appendBytes(path, bytes) {
  const { appendFile } = await import('node:fs/promises')
  await appendFile(path, bytes)
}

/**
 * Encode arbitrary bytes as one Zstandard frame.
 *
 * @param {string | Buffer} input - payload.
 * @returns {Buffer} the encoded frame.
 */
export function frameOf(input) {
  const payload =
    typeof input === 'string' || Buffer.isBuffer(input) ? input : JSON.stringify(input)
  return zstdCompressSync(Buffer.from(payload))
}
