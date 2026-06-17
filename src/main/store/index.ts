import { getDb } from './db'
import type { Conversation, Message, Persona } from '../../shared/types'

export const ConvStore = {
  createConversation(title: string, backend: string, personaId: string | null): Conversation {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO conversations (id, title, backend, persona_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, title, backend, personaId, now, now)
    return { id, title, backend, personaId, createdAt: now, updatedAt: now }
  },

  getConversation(id: string): Conversation | undefined {
    const row = getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any
    return row ? rowToConv(row) : undefined
  },

  listConversations(limit: number, offset: number): Conversation[] {
    const rows = getDb().prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(limit, offset) as any[]
    return rows.map(rowToConv)
  },

  searchMessages(query: string): Message[] {
    const rows = getDb().prepare(`
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.rowid = fts.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank LIMIT 50
    `).all(query) as any[]
    return rows.map(rowToMsg)
  },

  createMessage(msg: Omit<Message, 'id' | 'createdAt'>): Message {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content, backend, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, msg.conversationId, msg.role, msg.content, msg.backend, now)
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, msg.conversationId)
    return { ...msg, id, createdAt: now }
  },

  getMessages(conversationId: string): Message[] {
    const rows = getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId) as any[]
    return rows.map(rowToMsg)
  },

  createPersona(p: Omit<Persona, 'id'>): Persona {
    const db = getDb()
    const id = crypto.randomUUID()
    if (p.isDefault) db.prepare('UPDATE personas SET is_default = 0').run()
    db.prepare(`INSERT INTO personas (id, name, system_prompt, is_default) VALUES (?, ?, ?, ?)`)
      .run(id, p.name, p.systemPrompt, p.isDefault ? 1 : 0)
    return { id, ...p }
  },

  listPersonas(): Persona[] {
    return (getDb().prepare('SELECT * FROM personas').all() as any[]).map(rowToPersona)
  },

  updatePersona(id: string, p: Partial<Omit<Persona, 'id'>>): Persona {
    const db = getDb()
    if (p.isDefault) db.prepare('UPDATE personas SET is_default = 0').run()
    if (p.name !== undefined) db.prepare('UPDATE personas SET name = ? WHERE id = ?').run(p.name, id)
    if (p.systemPrompt !== undefined) db.prepare('UPDATE personas SET system_prompt = ? WHERE id = ?').run(p.systemPrompt, id)
    if (p.isDefault !== undefined) db.prepare('UPDATE personas SET is_default = ? WHERE id = ?').run(p.isDefault ? 1 : 0, id)
    return ConvStore.listPersonas().find(x => x.id === id)!
  },

  deletePersona(id: string): void {
    getDb().prepare('DELETE FROM personas WHERE id = ?').run(id)
  },

  getDefaultPersona(): Persona | undefined {
    const row = getDb().prepare('SELECT * FROM personas WHERE is_default = 1').get() as any
    return row ? rowToPersona(row) : undefined
  },
}

function rowToConv(r: any): Conversation {
  return { id: r.id, title: r.title, backend: r.backend, personaId: r.persona_id, createdAt: r.created_at, updatedAt: r.updated_at }
}
function rowToMsg(r: any): Message {
  return { id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, backend: r.backend, createdAt: r.created_at }
}
function rowToPersona(r: any): Persona {
  return { id: r.id, name: r.name, systemPrompt: r.system_prompt, isDefault: r.is_default === 1 }
}
