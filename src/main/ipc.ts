import { ipcMain, BrowserWindow, app } from 'electron'
import { IPC } from '../shared/ipc'
import { AdapterManager } from './adapters/manager'
import { ConvStore } from './store'
import { probeBackend } from './wizard/probe'
import { installBackend } from './wizard/install'
import { pipelineRunner } from './pipeline/runner'
import { AttachmentService } from './attachments/service'
import { downloadUpdate, quitAndInstall } from './updater'

export const MAX_PROMPT_LENGTH = 100_000
export const MAX_MESSAGE_LENGTH = 100_000

export function validatePersona(p: { systemPrompt?: string; name?: string }): void {
  if (p.systemPrompt !== undefined && p.systemPrompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`System prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`)
  }
}

export function registerIpcHandlers(_win: BrowserWindow): void {
  // chat:send — starts streaming, pushes chat:chunk and chat:done via webContents
  ipcMain.handle(IPC.CHAT_SEND, async (event, { conversationId, message, backend, personaId, messageId: pregenMessageId }) => {
    if (typeof message !== 'string') {
      throw new Error('Message must be a string')
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`)
    }
    const adapter = AdapterManager.get(backend) ?? AdapterManager.getActive()
    AdapterManager.setActive(adapter.id)

    const persona = personaId ? ConvStore.listPersonas().find(p => p.id === personaId) : ConvStore.getDefaultPersona()

    let conv = conversationId ? ConvStore.getConversation(conversationId) : undefined
    if (!conv) {
      conv = ConvStore.createConversation(message.slice(0, 60), adapter.id, persona?.id ?? null)
    }

    ConvStore.createMessage({ id: pregenMessageId, conversationId: conv.id, role: 'user', content: message, backend: adapter.id, stepIndex: null })

    const attachments = pregenMessageId ? AttachmentService.listForMessage(pregenMessageId) : []

    let fullContent = ''
    for await (const chunk of adapter.send(message, persona?.systemPrompt, attachments)) {
      if (chunk.type === 'text') fullContent += chunk.content
      event.sender.send(IPC.CHAT_CHUNK, { ...chunk, conversationId: conv.id })
      if (chunk.type === 'done') break
    }

    const saved = ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: fullContent, backend: adapter.id, stepIndex: null })
    event.sender.send(IPC.CHAT_DONE, { conversationId: conv.id, messageId: saved.id })
    return conv.id
  })

  ipcMain.handle(IPC.CHAT_ABORT, (_event, { conversationId: _id }) => {
    AdapterManager.getActive().abort()
  })

  ipcMain.handle(IPC.CONV_LIST, (_event, { limit, offset }) =>
    ConvStore.listConversations(limit, offset))

  ipcMain.handle(IPC.CONV_GET, (_event, { conversationId }) => ({
    conversation: ConvStore.getConversation(conversationId),
    messages: ConvStore.getMessages(conversationId),
  }))

  ipcMain.handle(IPC.CONV_SEARCH, (_event, { query }) =>
    ConvStore.searchMessages(query))

  ipcMain.handle(IPC.PERSONA_LIST, () => ConvStore.listPersonas())

  ipcMain.handle(IPC.PERSONA_SAVE, (_event, p) => {
    validatePersona(p)
    return p.id ? ConvStore.updatePersona(p.id, p) : ConvStore.createPersona(p)
  })

  ipcMain.handle(IPC.PERSONA_DELETE, (_event, { id }) => ConvStore.deletePersona(id))

  ipcMain.handle(IPC.BACKEND_LIST, () => AdapterManager.listAvailable())

  ipcMain.handle(IPC.WIZARD_PROBE, (_event, { backend }) => probeBackend(backend))

  ipcMain.handle(IPC.WIZARD_INSTALL, (event, { backend }) =>
    installBackend(backend, line => event.sender.send('wizard:install:line', line)))

  ipcMain.handle(IPC.WIZARD_DONE, () => {
    ConvStore.setSetting('wizard_done', '1')
  })

  ipcMain.handle(IPC.CONV_DELETE, (_event, { conversationId }) => {
    ConvStore.deleteConversation(conversationId)
  })

  ipcMain.handle(IPC.CONV_RENAME, (_event, { conversationId, title }) => {
    if (typeof title !== 'string' || title.trim().length === 0) throw new Error('Title must be a non-empty string')
    ConvStore.renameConversation(conversationId, title.trim())
  })

  ipcMain.handle(IPC.APP_VERSION, () => app.getVersion())

  ipcMain.handle(IPC.SETTING_GET, (_event, { key }) => ConvStore.getSetting(key))
  ipcMain.handle(IPC.SETTING_SET, (_event, { key, value }) => ConvStore.setSetting(key, value))
  ipcMain.handle(IPC.SETTING_GET_ALL, () => ConvStore.getAllSettings())

  ipcMain.handle(IPC.PIPELINE_LIST, () => ConvStore.listPipelineTemplates())

  ipcMain.handle(IPC.PIPELINE_SAVE, (_event, { id, name, steps }) => {
    if (!name || typeof name !== 'string') throw new Error('Pipeline name is required')
    if (!Array.isArray(steps) || steps.length < 2) throw new Error('Pipeline must have at least 2 steps')
    return id
      ? ConvStore.updatePipelineTemplate(id, name, steps)
      : ConvStore.createPipelineTemplate(name, steps)
  })

  ipcMain.handle(IPC.PIPELINE_DELETE, (_event, { id }) => ConvStore.deletePipelineTemplate(id))

  ipcMain.handle(IPC.PIPELINE_RUN, async (event, { conversationId, message, templateId }) => {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`)
    }

    const template = ConvStore.getPipelineTemplate(templateId)
    if (!template) throw new Error(`Pipeline template not found: ${templateId}`)
    if (template.steps.length < 2) throw new Error('Pipeline must have at least 2 steps')

    const personas = ConvStore.listPersonas()
    const resolvedSteps = template.steps.map(step => ({
      adapterId: step.backendId,
      persona: step.personaId ? personas.find(p => p.id === step.personaId)?.systemPrompt : undefined,
    }))

    let conv = conversationId ? ConvStore.getConversation(conversationId) : undefined
    if (!conv) {
      conv = ConvStore.createPipelineConversation(message.slice(0, 60), templateId)
    }

    ConvStore.createMessage({
      conversationId: conv.id,
      role: 'user',
      content: message,
      backend: 'pipeline',
      stepIndex: null,
    })

    const accumulators: string[] = new Array(resolvedSteps.length).fill('')

    await pipelineRunner.run({
      conversationId: conv.id,
      userMessage: message,
      steps: resolvedSteps,
      onChunk: (chunk) => {
        if (chunk.type === 'text') accumulators[chunk.stepIndex] += chunk.content
        event.sender.send(IPC.PIPELINE_CHUNK, { ...chunk, conversationId: conv!.id })
      },
      onStepDone: (stepIndex) => {
        ConvStore.createMessage({
          conversationId: conv!.id,
          role: 'assistant',
          content: accumulators[stepIndex],
          backend: resolvedSteps[stepIndex].adapterId,
          stepIndex,
        })
        event.sender.send(IPC.PIPELINE_STEP_DONE, { conversationId: conv!.id, stepIndex })
      },
    })

    event.sender.send(IPC.PIPELINE_DONE, { conversationId: conv!.id })
    return conv.id
  })

  ipcMain.handle(IPC.PIPELINE_ABORT, (_event, { conversationId }) => {
    pipelineRunner.abort(conversationId)
  })

  ipcMain.handle(IPC.ATTACHMENT_INGEST, async (_event, { filePaths, messageId }) => {
    return AttachmentService.ingest(filePaths, messageId, app.getPath('userData'))
  })

  ipcMain.handle(IPC.ATTACHMENT_LIST, (_event, { messageId }) => {
    return AttachmentService.listForMessage(messageId)
  })

  ipcMain.handle(IPC.ATTACHMENT_DATA_URL, (_event, { storedPath }) => {
    return AttachmentService.getDataUrl(storedPath)
  })

  ipcMain.handle(IPC.UPDATE_DOWNLOAD, () => downloadUpdate())
  ipcMain.handle(IPC.UPDATE_INSTALL, () => quitAndInstall())
}
