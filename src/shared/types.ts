export interface Conversation {
  id: string
  title: string
  backend: string
  personaId: string | null
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  backend: string
  createdAt: number
}

export interface Persona {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
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

export interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string): AsyncIterable<MessageChunk>
  abort(): void
}
