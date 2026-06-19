import { describe, it, expect, vi } from 'vitest'
import { probeBackend } from './probe'

vi.mock('../adapters/manager', () => ({
  AdapterManager: {
    get: vi.fn((id: string) => {
      if (id === 'unknown') return undefined
      return {
        id,
        isAvailable: vi.fn().mockResolvedValue(id === 'claude'),
        checkAuth: vi.fn().mockResolvedValue(id === 'claude'),
      }
    }),
  },
}))

describe('probeBackend', () => {
  it('returns available=true for backend that is available', async () => {
    const result = await probeBackend('claude')
    expect(result.available).toBe(true)
  })

  it('returns available=false for backend that is not available', async () => {
    const result = await probeBackend('gemini')
    expect(result.available).toBe(false)
  })

  it('returns available=false for unknown backend id', async () => {
    const result = await probeBackend('unknown')
    expect(result.available).toBe(false)
  })
})
