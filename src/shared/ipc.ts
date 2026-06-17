export const IPC = {
  CHAT_SEND:      'chat:send',
  CHAT_CHUNK:     'chat:chunk',
  CHAT_DONE:      'chat:done',
  CHAT_ABORT:     'chat:abort',
  CONV_LIST:      'conv:list',
  CONV_GET:       'conv:get',
  CONV_SEARCH:    'conv:search',
  PERSONA_LIST:   'persona:list',
  PERSONA_SAVE:   'persona:save',
  PERSONA_DELETE: 'persona:delete',
  BACKEND_LIST:   'backend:list',
  WIZARD_PROBE:   'wizard:probe',
  WIZARD_INSTALL: 'wizard:install',
  WIZARD_DONE:    'wizard:done',
} as const

export type IpcChannels = typeof IPC

// Payload types per channel (Renderer → Main, invoke/handle)
export interface IpcInvokeMap {
  [IPC.CHAT_SEND]:      { conversationId: string | null; message: string; backend: string; personaId?: string }
  [IPC.CHAT_ABORT]:     { conversationId: string }
  [IPC.CONV_LIST]:      { limit: number; offset: number }
  [IPC.CONV_GET]:       { conversationId: string }
  [IPC.CONV_SEARCH]:    { query: string }
  [IPC.PERSONA_LIST]:   void
  [IPC.PERSONA_SAVE]:   { id?: string; name: string; systemPrompt: string; isDefault: boolean }
  [IPC.PERSONA_DELETE]: { id: string }
  [IPC.BACKEND_LIST]:   void
  [IPC.WIZARD_PROBE]:   { backend: string }
  [IPC.WIZARD_INSTALL]: { backend: string }
  [IPC.WIZARD_DONE]:    void
}

// Push channels (Main → Renderer, webContents.send)
export interface IpcPushMap {
  [IPC.CHAT_CHUNK]: import('./types').MessageChunk & { conversationId: string }
  [IPC.CHAT_DONE]:  { conversationId: string; messageId: string }
}
