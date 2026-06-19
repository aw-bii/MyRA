import { IPC } from '../shared/ipc'
import type { IpcInvokeMap } from '../shared/ipc'
import type { Conversation, Message, Persona, BackendInfo, MessageChunk, PipelineTemplate, PipelineChunk } from '../shared/types'

// window.ipc is injected by preload/index.ts via contextBridge
declare global {
  interface Window {
    ipc: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on(channel: string, listener: (...args: unknown[]) => void): () => void
      getPathForFile(file: File): string
    }
  }
}

export async function sendChat(payload: IpcInvokeMap[typeof IPC.CHAT_SEND]): Promise<string> {
  return window.ipc.invoke(IPC.CHAT_SEND, payload) as Promise<string>
}
export function onChatChunk(cb: (chunk: MessageChunk & { conversationId: string }) => void) {
  return window.ipc.on(IPC.CHAT_CHUNK, cb as any)
}
export function onChatDone(cb: (payload: { conversationId: string; messageId: string }) => void) {
  return window.ipc.on(IPC.CHAT_DONE, cb as any)
}
export async function abortChat(conversationId: string): Promise<void> {
  await window.ipc.invoke(IPC.CHAT_ABORT, { conversationId })
}
export async function listConversations(limit = 50, offset = 0): Promise<Conversation[]> {
  return window.ipc.invoke(IPC.CONV_LIST, { limit, offset }) as Promise<Conversation[]>
}
export async function getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
  return window.ipc.invoke(IPC.CONV_GET, { conversationId }) as Promise<any>
}
export async function searchConversations(query: string): Promise<Message[]> {
  return window.ipc.invoke(IPC.CONV_SEARCH, { query }) as Promise<Message[]>
}
export async function listPersonas(): Promise<Persona[]> {
  return window.ipc.invoke(IPC.PERSONA_LIST) as Promise<Persona[]>
}
export async function savePersona(p: Omit<Persona, 'id'> & { id?: string }): Promise<Persona> {
  return window.ipc.invoke(IPC.PERSONA_SAVE, p) as Promise<Persona>
}
export async function deletePersona(id: string): Promise<void> {
  await window.ipc.invoke(IPC.PERSONA_DELETE, { id })
}
export async function listBackends(): Promise<BackendInfo[]> {
  return window.ipc.invoke(IPC.BACKEND_LIST) as Promise<BackendInfo[]>
}
export async function probeBackend(backend: string): Promise<{ available: boolean; authenticated: boolean }> {
  return window.ipc.invoke(IPC.WIZARD_PROBE, { backend }) as Promise<any>
}
export async function installBackend(backend: string): Promise<boolean> {
  return window.ipc.invoke(IPC.WIZARD_INSTALL, { backend }) as Promise<boolean>
}
export async function markWizardDone(): Promise<void> {
  await window.ipc.invoke(IPC.WIZARD_DONE)
}

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return window.ipc.invoke(IPC.PIPELINE_LIST) as Promise<PipelineTemplate[]>
}
export async function savePipelineTemplate(p: {
  id?: string
  name: string
  steps: Array<{ id?: string; stepOrder: number; backendId: string; personaId: string | null }>
}): Promise<PipelineTemplate> {
  return window.ipc.invoke(IPC.PIPELINE_SAVE, p) as Promise<PipelineTemplate>
}
export async function deletePipelineTemplate(id: string): Promise<void> {
  await window.ipc.invoke(IPC.PIPELINE_DELETE, { id })
}
export async function runPipeline(payload: {
  conversationId: string | null
  message: string
  templateId: string
}): Promise<string> {
  return window.ipc.invoke(IPC.PIPELINE_RUN, payload) as Promise<string>
}
export async function abortPipeline(conversationId: string): Promise<void> {
  await window.ipc.invoke(IPC.PIPELINE_ABORT, { conversationId })
}
export function onPipelineChunk(cb: (chunk: PipelineChunk & { conversationId: string }) => void) {
  return window.ipc.on(IPC.PIPELINE_CHUNK, cb as any)
}
export function onPipelineStepDone(cb: (payload: { conversationId: string; stepIndex: number }) => void) {
  return window.ipc.on(IPC.PIPELINE_STEP_DONE, cb as any)
}
export function onPipelineDone(cb: (payload: { conversationId: string }) => void) {
  return window.ipc.on(IPC.PIPELINE_DONE, cb as any)
}

export async function ingestAttachments(filePaths: string[], messageId: string): Promise<import('../shared/types').Attachment[]> {
  return window.ipc.invoke(IPC.ATTACHMENT_INGEST, { filePaths, messageId }) as Promise<import('../shared/types').Attachment[]>
}
export async function listAttachments(messageId: string): Promise<import('../shared/types').Attachment[]> {
  return window.ipc.invoke(IPC.ATTACHMENT_LIST, { messageId }) as Promise<import('../shared/types').Attachment[]>
}
export async function getAttachmentDataUrl(storedPath: string): Promise<string> {
  return window.ipc.invoke(IPC.ATTACHMENT_DATA_URL, { storedPath }) as Promise<string>
}
