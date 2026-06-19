export interface Conversation {
  id: string
  title: string
  backend: string
  personaId: string | null
  pipelineTemplateId: string | null
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  backend: string
  stepIndex: number | null
  createdAt: number
}

export interface VariableDef {
  name: string
  label: string
  placeholder: string
  required: boolean
}

export interface Persona {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
  isTemplate?: boolean
  category?: string | null
  description?: string | null
  variables?: VariableDef[]
}

export interface BackendInfo {
  id: string
  label: string
  available: boolean
  authenticated: boolean
}

export interface MessageChunk {
  type: 'text' | 'tool_use' | 'error' | 'done'
  content: string
  raw?: unknown
}

export interface PipelineStep {
  id: string
  templateId: string
  stepOrder: number
  backendId: string
  personaId: string | null
}

export interface PipelineTemplate {
  id: string
  name: string
  steps: PipelineStep[]
  createdAt: number
}

export interface PipelineChunk extends MessageChunk {
  stepIndex: number
}

export interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  checkAuth(): Promise<boolean>
  send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk>
  abort(): void
}

export interface Attachment {
  id: string
  messageId: string
  originalName: string
  storedPath: string
  mimeType: string
  sizeBytes: number
  extractedText: string | null
  extractionError: boolean
  createdAt: number
}
