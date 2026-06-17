import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb, closeDb } from './db'
import { ConvStore } from './index'
import path from 'path'
import os from 'os'
import fs from 'fs'

let dbPath: string

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `test-${crypto.randomUUID()}.db`)
  initDb(dbPath)
})

afterEach(() => {
  closeDb()
  fs.unlinkSync(dbPath)
})

describe('ConvStore.createConversation', () => {
  it('returns a Conversation with generated id and timestamps', () => {
    const conv = ConvStore.createConversation('Hello world', 'claude', null)
    expect(conv.id).toBeTruthy()
    expect(conv.title).toBe('Hello world')
    expect(conv.backend).toBe('claude')
    expect(conv.personaId).toBeNull()
    expect(conv.createdAt).toBeGreaterThan(0)
  })
})

describe('ConvStore.createMessage + getMessages', () => {
  it('creates and retrieves messages by conversationId', () => {
    const conv = ConvStore.createConversation('Test', 'claude', null)
    ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: 'hi', backend: 'claude' })
    const msgs = ConvStore.getMessages(conv.id)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('hi')
  })
})

describe('ConvStore.searchMessages', () => {
  it('finds messages by content keyword', () => {
    const conv = ConvStore.createConversation('Test', 'claude', null)
    ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: 'pineapple juice', backend: 'claude' })
    ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: 'mango smoothie', backend: 'claude' })
    const results = ConvStore.searchMessages('pineapple')
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('pineapple juice')
  })
})

describe('ConvStore persona methods', () => {
  it('creates, lists, and marks default persona', () => {
    ConvStore.createPersona({ name: 'Coder', systemPrompt: 'You are a coder.', isDefault: false })
    const p2 = ConvStore.createPersona({ name: 'Writer', systemPrompt: 'You write.', isDefault: true })
    const personas = ConvStore.listPersonas()
    expect(personas).toHaveLength(2)
    expect(ConvStore.getDefaultPersona()?.id).toBe(p2.id)
  })
})
