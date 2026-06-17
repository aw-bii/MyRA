import { describe, it, expect, vi } from 'vitest'
import { probeBackend } from './probe'
import * as child_process from 'child_process'
import { EventEmitter } from 'events'

vi.mock('child_process')

function mockSpawn(exitCode: number) {
  const proc = new EventEmitter() as any
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  vi.mocked(child_process.spawn).mockReturnValue(proc as any)
  setTimeout(() => proc.emit('close', exitCode), 0)
}

describe('probeBackend', () => {
  it('returns available=true for exit code 0', async () => {
    mockSpawn(0)
    const result = await probeBackend('claude')
    expect(result.available).toBe(true)
  })

  it('returns available=false for non-zero exit code', async () => {
    mockSpawn(1)
    const result = await probeBackend('claude')
    expect(result.available).toBe(false)
  })

  it('returns available=false for unknown backend id', async () => {
    const result = await probeBackend('unknown')
    expect(result.available).toBe(false)
  })
})
