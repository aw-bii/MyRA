import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdapterManager } from './manager'

vi.mock('./claude.adapter', () => ({
  ClaudeAdapter: class {
    id = 'claude'
    isAvailable = vi.fn().mockResolvedValue(true)
    checkAuth = vi.fn().mockResolvedValue(true)
    send = vi.fn()
    abort = vi.fn()
  }
}))
vi.mock('./gemini.adapter', () => ({
  GeminiAdapter: class {
    id = 'gemini'
    isAvailable = vi.fn().mockResolvedValue(false)
    checkAuth = vi.fn().mockResolvedValue(false)
    send = vi.fn()
    abort = vi.fn()
  }
}))
vi.mock('./opencode.adapter', () => ({
  OpencodeAdapter: class {
    id = 'opencode'
    isAvailable = vi.fn().mockResolvedValue(false)
    checkAuth = vi.fn().mockResolvedValue(false)
    send = vi.fn()
    abort = vi.fn()
  }
}))

describe('AdapterManager', () => {
  it('defaults to claude as active adapter', () => {
    expect(AdapterManager.getActive().id).toBe('claude')
  })

  it('setActive switches the active adapter', () => {
    AdapterManager.setActive('gemini')
    expect(AdapterManager.getActive().id).toBe('gemini')
    AdapterManager.setActive('claude') // reset
  })

  it('throws when setActive receives unknown id', () => {
    expect(() => AdapterManager.setActive('unknown')).toThrow()
  })

  it('listAvailable reflects isAvailable() results', async () => {
    const infos = await AdapterManager.listAvailable()
    const claude = infos.find(i => i.id === 'claude')
    expect(claude?.available).toBe(true)
    const gemini = infos.find(i => i.id === 'gemini')
    expect(gemini?.available).toBe(false)
  })
})
