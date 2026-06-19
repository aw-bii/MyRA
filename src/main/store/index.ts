import { getDb } from './db'
import type { Conversation, Message, Persona, PipelineTemplate, PipelineStep, Attachment } from '../../shared/types'

export const ConvStore = {
  createConversation(title: string, backend: string, personaId: string | null): Conversation {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO conversations (id, title, backend, persona_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`).run(id, title, backend, personaId, now, now)
    return { id, title, backend, personaId, pipelineTemplateId: null, createdAt: now, updatedAt: now }
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
    try {
      const rows = getDb().prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts fts ON m.rowid = fts.rowid
        WHERE messages_fts MATCH ?
        ORDER BY rank LIMIT 50
      `).all(query) as any[]
      return rows.map(rowToMsg)
    } catch {
      return []
    }
  },

  createMessage(msg: Omit<Message, 'createdAt'> & { id?: string }): Message {
    const db = getDb()
    const id = msg.id ?? crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content, backend, step_index, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, msg.conversationId, msg.role, msg.content, msg.backend, msg.stepIndex ?? null, now)
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
    const result = ConvStore.listPersonas().find(x => x.id === id)
    if (!result) throw new Error(`Persona not found: ${id}`)
    return result
  },

  deletePersona(id: string): void {
    getDb().prepare('DELETE FROM personas WHERE id = ?').run(id)
  },

  getDefaultPersona(): Persona | undefined {
    const row = getDb().prepare('SELECT * FROM personas WHERE is_default = 1').get() as any
    return row ? rowToPersona(row) : undefined
  },

  createPipelineConversation(title: string, pipelineTemplateId: string): Conversation {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO conversations (id, title, backend, persona_id, pipeline_template_id, created_at, updated_at)
                VALUES (?, ?, 'pipeline', NULL, ?, ?, ?)`)
      .run(id, title, pipelineTemplateId, now, now)
    return { id, title, backend: 'pipeline', personaId: null, pipelineTemplateId, createdAt: now, updatedAt: now }
  },

  createPipelineTemplate(
    name: string,
    steps: Array<{ stepOrder: number; backendId: string; personaId: string | null }>
  ): PipelineTemplate {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare('INSERT INTO pipeline_templates (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now)
    const savedSteps: PipelineStep[] = steps.map(s => {
      const stepId = crypto.randomUUID()
      db.prepare(`INSERT INTO pipeline_steps (id, template_id, step_order, backend_id, persona_id)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(stepId, id, s.stepOrder, s.backendId, s.personaId ?? null)
      return { id: stepId, templateId: id, stepOrder: s.stepOrder, backendId: s.backendId, personaId: s.personaId }
    })
    return { id, name, steps: savedSteps, createdAt: now }
  },

  listPipelineTemplates(): PipelineTemplate[] {
    const db = getDb()
    const templates = db.prepare('SELECT * FROM pipeline_templates ORDER BY created_at DESC').all() as any[]
    return templates.map(t => {
      const steps = db.prepare('SELECT * FROM pipeline_steps WHERE template_id = ? ORDER BY step_order ASC').all(t.id) as any[]
      return {
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
        steps: steps.map(s => ({ id: s.id, templateId: s.template_id, stepOrder: s.step_order, backendId: s.backend_id, personaId: s.persona_id ?? null })),
      }
    })
  },

  getPipelineTemplate(id: string): PipelineTemplate | undefined {
    const db = getDb()
    const t = db.prepare('SELECT * FROM pipeline_templates WHERE id = ?').get(id) as any
    if (!t) return undefined
    const steps = db.prepare('SELECT * FROM pipeline_steps WHERE template_id = ? ORDER BY step_order ASC').all(id) as any[]
    return {
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      steps: steps.map(s => ({ id: s.id, templateId: s.template_id, stepOrder: s.step_order, backendId: s.backend_id, personaId: s.persona_id ?? null })),
    }
  },

  updatePipelineTemplate(
    id: string,
    name: string,
    steps: Array<{ stepOrder: number; backendId: string; personaId: string | null }>
  ): PipelineTemplate {
    const db = getDb()
    db.prepare('UPDATE pipeline_templates SET name = ? WHERE id = ?').run(name, id)
    db.prepare('DELETE FROM pipeline_steps WHERE template_id = ?').run(id)
    const savedSteps: PipelineStep[] = steps.map(s => {
      const stepId = crypto.randomUUID()
      db.prepare(`INSERT INTO pipeline_steps (id, template_id, step_order, backend_id, persona_id)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(stepId, id, s.stepOrder, s.backendId, s.personaId ?? null)
      return { id: stepId, templateId: id, stepOrder: s.stepOrder, backendId: s.backendId, personaId: s.personaId }
    })
    const t = db.prepare('SELECT * FROM pipeline_templates WHERE id = ?').get(id) as any
    return { id: t.id, name: t.name, createdAt: t.created_at, steps: savedSteps }
  },

  deletePipelineTemplate(id: string): void {
    getDb().prepare('DELETE FROM pipeline_templates WHERE id = ?').run(id)
  },

  createAttachment(a: Omit<Attachment, 'id' | 'createdAt'>): Attachment {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`
      INSERT INTO attachments (id, message_id, original_name, stored_path, mime_type, size_bytes, extracted_text, extraction_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, a.messageId, a.originalName, a.storedPath, a.mimeType, a.sizeBytes, a.extractedText ?? null, a.extractionError ? 1 : 0, now)
    return { ...a, id, createdAt: now }
  },

  getAttachmentsForMessage(messageId: string): Attachment[] {
    const rows = getDb().prepare('SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC').all(messageId) as any[]
    return rows.map(r => ({
      id: r.id,
      messageId: r.message_id,
      originalName: r.original_name,
      storedPath: r.stored_path,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      extractedText: r.extracted_text ?? null,
      extractionError: r.extraction_error === 1,
      createdAt: r.created_at,
    }))
  },

  deleteAttachmentsForMessage(messageId: string): void {
    getDb().prepare('DELETE FROM attachments WHERE message_id = ?').run(messageId)
  },
}

function rowToConv(r: any): Conversation {
  return {
    id: r.id,
    title: r.title,
    backend: r.backend,
    personaId: r.persona_id,
    pipelineTemplateId: r.pipeline_template_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
function rowToMsg(r: any): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    backend: r.backend,
    stepIndex: r.step_index ?? null,
    createdAt: r.created_at,
  }
}
function rowToPersona(r: any): Persona {
  return { id: r.id, name: r.name, systemPrompt: r.system_prompt, isDefault: r.is_default === 1 }
}
