import { describe, it, expect, vi } from 'vitest'
import { OpencodeAdapter } from './opencode.adapter'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

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
}

describe('OpencodeAdapter.send', () => {
  it('falls back to plain-text lines', async () => {
    mockSpawn(['opencode reply'])
    const adapter = new OpencodeAdapter()
    const chunks: string[] = []
    for await (const chunk of adapter.send('hello')) {
      if (chunk.type === 'text') chunks.push(chunk.content)
    }
    expect(chunks).toContain('opencode reply')
  })
})
