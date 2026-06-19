import { describe, it, expect, vi } from 'vitest'
import { ClaudeAdapter } from './claude.adapter'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'
import type { Attachment } from '../../shared/types'

vi.mock('electron', () => ({ app: { isPackaged: false } }))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual, default: { ...actual, existsSync: vi.fn((p: string) => !p.includes('claude-bin')) },
    existsSync: vi.fn((p: string) => !p.includes('claude-bin')),
  }
})
vi.mock('child_process')
vi.mock('../attachments/service', () => ({
  AttachmentService: { getContent: vi.fn((a: any) => a.extractedText ?? '') },
}))
vi.mock('../store', () => ({ ConvStore: {} }))

function mockSpawn(stdoutLines: string[], exitCode = 0) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = vi.fn()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => {
    for (const line of stdoutLines) proc.stdout.emit('data', Buffer.from(line + '\n'))
    proc.emit('close', exitCode)
  }, 0)
  return proc
}

describe('ClaudeAdapter.isAvailable', () => {
  it('returns true when spawn exits 0', async () => {
    mockSpawn([], 0)
    const adapter = new ClaudeAdapter()
    expect(await adapter.isAvailable()).toBe(true)
  })

  it('returns false when spawn exits non-zero', async () => {
    mockSpawn([], 1)
    const adapter = new ClaudeAdapter()
    expect(await adapter.isAvailable()).toBe(false)
  })
})

describe('ClaudeAdapter.send', () => {
  it('yields text chunks from stream-json output', async () => {
    const line = JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } })
    mockSpawn([line])
    const adapter = new ClaudeAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('say hi')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('Hello')
  })
})

describe('ClaudeAdapter attachment routing', () => {
  const validAttachment: Attachment = {
    id: 'att-1', messageId: 'msg-1', originalName: 'doc.pdf',
    storedPath: '/tmp/doc.pdf', mimeType: 'application/pdf',
    sizeBytes: 1000, extractedText: 'pdf text', extractionError: false, createdAt: 0,
  }

  it('passes --file flag for a valid attachment', async () => {
    mockSpawn([])
    const adapter = new ClaudeAdapter()
    for await (const _ of adapter.send('hello', undefined, [validAttachment])) { /* drain */ }
    expect(child_process.spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--file', '/tmp/doc.pdf']),
      expect.any(Object)
    )
  })

  it('injects content block instead of --file when extractionError is true', async () => {
    mockSpawn([])
    const errorAttachment: Attachment = { ...validAttachment, extractionError: true }
    const adapter = new ClaudeAdapter()
    for await (const _ of adapter.send('hello', undefined, [errorAttachment])) { /* drain */ }
    const spawnArgs = vi.mocked(child_process.spawn).mock.calls.at(-1)![1] as string[]
    expect(spawnArgs).not.toContain('--file')
    const msgArg = spawnArgs[spawnArgs.length - 1]
    expect(msgArg).toContain('[Attachment: doc.pdf]')
    expect(msgArg).toContain('(extraction failed)')
  })
})
