import { IPC } from "../shared/ipc";
import type { IpcInvokeMap } from "../shared/ipc";
import type {
  Conversation,
  Message,
  SearchResult,
  Persona,
  BackendInfo,
  MessageChunk,
  PipelineTemplate,
  PipelineChunk,
  SecurityEvent,
  SecurityRespondPayload,
  CronJob,
  CronJobLog,
  McpServerConfig,
  McpTool,
  McpToolCallResult,
  PluginInfo,
} from "../shared/types";

// window.ipc is injected by preload/index.ts via contextBridge
declare global {
  interface Window {
    ipc: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      on(channel: string, listener: (...args: unknown[]) => void): () => void;
      getPathForFile(file: File): string;
    };
  }
}

export let lastIpcError: Error | null = null;
export function clearIpcError() {
  lastIpcError = null;
}

function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args).catch((err: Error) => {
    lastIpcError = err;
    console.error(`IPC ${channel} failed:`, err);
    throw err;
  }) as Promise<T>;
}

export async function sendChat(
  payload: IpcInvokeMap[typeof IPC.CHAT_SEND],
): Promise<string> {
  return ipcInvoke<string>(IPC.CHAT_SEND, payload);
}
export function onChatChunk(
  cb: (chunk: MessageChunk & { conversationId: string }) => void,
) {
  return window.ipc.on(IPC.CHAT_CHUNK, cb as any);
}
export function onChatDone(
  cb: (payload: { conversationId: string; messageId: string }) => void,
) {
  return window.ipc.on(IPC.CHAT_DONE, cb as any);
}
export async function abortChat(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.CHAT_ABORT, { conversationId });
}
export async function listConversations(
  limit = 50,
  offset = 0,
): Promise<Conversation[]> {
  return ipcInvoke<Conversation[]>(IPC.CONV_LIST, { limit, offset });
}
export async function createConversation(
  title: string,
  backend: string,
  personaId?: string,
  pipelineTemplateId?: string,
): Promise<Conversation> {
  return ipcInvoke<Conversation>(IPC.CONV_CREATE, {
    title,
    backend,
    personaId,
    pipelineTemplateId,
  });
}

export async function getConversation(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  return ipcInvoke<any>(IPC.CONV_GET, { conversationId });
}
export async function searchConversations(
  query: string,
): Promise<SearchResult[]> {
  return ipcInvoke<SearchResult[]>(IPC.CONV_SEARCH, { query });
}
export async function listPersonas(): Promise<Persona[]> {
  return ipcInvoke<Persona[]>(IPC.PERSONA_LIST);
}
export async function savePersona(
  p: Omit<Persona, "id"> & { id?: string },
): Promise<Persona> {
  return ipcInvoke<Persona>(IPC.PERSONA_SAVE, p);
}
export async function deletePersona(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PERSONA_DELETE, { id });
}
export async function listBackends(): Promise<BackendInfo[]> {
  return ipcInvoke<BackendInfo[]>(IPC.BACKEND_LIST);
}
export async function probeBackend(
  backend: string,
): Promise<{ available: boolean; authenticated: boolean }> {
  return ipcInvoke<any>(IPC.WIZARD_PROBE, { backend });
}
export async function installBackend(
  backend: string,
): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke<{
    success: boolean;
    error?: string;
  }>(IPC.WIZARD_INSTALL, { backend });
}
export async function markWizardDone(): Promise<void> {
  await ipcInvoke<void>(IPC.WIZARD_DONE);
}

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return ipcInvoke<PipelineTemplate[]>(IPC.PIPELINE_LIST);
}
export async function savePipelineTemplate(p: {
  id?: string;
  name: string;
  steps: Array<{
    id?: string;
    stepOrder: number;
    backendId: string;
    personaId: string | null;
  }>;
}): Promise<PipelineTemplate> {
  return ipcInvoke<PipelineTemplate>(IPC.PIPELINE_SAVE, p);
}
export async function deletePipelineTemplate(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_DELETE, { id });
}
export async function runPipeline(payload: {
  conversationId: string | null;
  message: string;
  templateId: string;
}): Promise<string> {
  return ipcInvoke<string>(IPC.PIPELINE_RUN, payload);
}
export async function abortPipeline(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_ABORT, { conversationId });
}
export function onPipelineChunk(
  cb: (chunk: PipelineChunk & { conversationId: string }) => void,
) {
  return window.ipc.on(IPC.PIPELINE_CHUNK, cb as any);
}
export function onPipelineStepDone(
  cb: (payload: { conversationId: string; stepIndex: number }) => void,
) {
  return window.ipc.on(IPC.PIPELINE_STEP_DONE, cb as any);
}
export function onPipelineDone(
  cb: (payload: { conversationId: string }) => void,
) {
  return window.ipc.on(IPC.PIPELINE_DONE, cb as any);
}

export async function ingestAttachments(
  filePaths: string[],
  messageId: string,
): Promise<import("../shared/types").Attachment[]> {
  return ipcInvoke<import("../shared/types").Attachment[]>(
    IPC.ATTACHMENT_INGEST,
    { filePaths, messageId },
  );
}
export async function listAttachments(
  messageId: string,
): Promise<import("../shared/types").Attachment[]> {
  return ipcInvoke<import("../shared/types").Attachment[]>(
    IPC.ATTACHMENT_LIST,
    { messageId },
  );
}
export async function getAttachmentDataUrl(
  storedPath: string,
): Promise<string> {
  return ipcInvoke<string>(IPC.ATTACHMENT_DATA_URL, { storedPath });
}
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_DELETE, { conversationId });
}
export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_RENAME, { conversationId, title });
}

export async function getAppVersion(): Promise<string> {
  return ipcInvoke<string>(IPC.APP_VERSION);
}

export async function getSetting(key: string): Promise<string | undefined> {
  return ipcInvoke<string | undefined>(IPC.SETTING_GET, { key });
}
export async function setSetting(key: string, value: string): Promise<void> {
  await ipcInvoke<void>(IPC.SETTING_SET, { key, value });
}
export async function getAllSettings(): Promise<Record<string, string>> {
  return ipcInvoke<Record<string, string>>(IPC.SETTING_GET_ALL);
}

export async function storeKey(provider: string, key: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_STORE, { provider, key });
}
export async function getKey(provider: string): Promise<string | null> {
  return ipcInvoke<string | null>(IPC.KEY_GET, { provider });
}
export async function deleteKey(provider: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_DELETE, { provider });
}
export async function hasKey(provider: string): Promise<boolean> {
  return ipcInvoke<boolean>(IPC.KEY_HAS, { provider });
}
export async function listProviders(): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.KEY_LIST);
}

export async function getDefaultModel(provider: string): Promise<string> {
  return ipcInvoke<string>(IPC.MODEL_GET_DEFAULT, { provider });
}
export async function setDefaultModel(
  provider: string,
  model: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.MODEL_SET_DEFAULT, { provider, model });
}
export async function listModels(provider: string): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.MODEL_LIST, { provider });
}

export function onSecurityEvent(
  listener: (event: SecurityEvent) => void,
): () => void {
  return window.ipc.on(IPC.SECURITY_EVENT, (_event: unknown, data: unknown) => {
    listener(data as SecurityEvent);
  });
}

export async function respondSecurity(
  payload: SecurityRespondPayload,
): Promise<void> {
  await ipcInvoke<void>(IPC.SECURITY_RESPOND, payload);
}

export async function getCronJobs(): Promise<CronJob[]> {
  return ipcInvoke<CronJob[]>(IPC.CRON_LIST);
}
export async function createCronJob(input: {
  name: string;
  cronExpression: string;
  prompt: string;
  backend: string;
}): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_CREATE, input);
}
export async function updateCronJob(
  id: string,
  changes: Partial<{
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }>,
): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_UPDATE, { id, ...changes });
}
export async function deleteCronJob(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CRON_DELETE, { id });
}
export async function toggleCronJob(id: string): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_TOGGLE, { id });
}
export async function getCronJobLogs(cronJobId: string): Promise<CronJobLog[]> {
  return ipcInvoke<CronJobLog[]>(IPC.CRON_LOGS, { cronJobId });
}
export async function runCronJobNow(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CRON_RUN_NOW, { id });
}

export async function listMcpServers(): Promise<McpServerConfig[]> {
  return ipcInvoke<McpServerConfig[]>(IPC.MCP_LIST_SERVERS);
}
export async function addMcpServer(config: {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}): Promise<McpServerConfig> {
  return ipcInvoke<McpServerConfig>(IPC.MCP_ADD_SERVER, config);
}
export async function removeMcpServer(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.MCP_REMOVE_SERVER, { id });
}
export async function toggleMcpServer(
  id: string,
): Promise<McpServerConfig | undefined> {
  return ipcInvoke<McpServerConfig | undefined>(IPC.MCP_TOGGLE_SERVER, { id });
}
export async function listMcpTools(): Promise<McpTool[]> {
  return ipcInvoke<McpTool[]>(IPC.MCP_LIST_TOOLS);
}
export async function callMcpTool(
  request: import("../shared/types").McpToolCallRequest,
): Promise<McpToolCallResult> {
  return ipcInvoke<McpToolCallResult>(IPC.MCP_CALL_TOOL, request);
}

export async function listPlugins(): Promise<PluginInfo[]> {
  return ipcInvoke<PluginInfo[]>(IPC.PLUGIN_LIST);
}
export async function togglePlugin(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_TOGGLE, { id });
}
export async function reloadPlugins(): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_RELOAD);
}

export async function downloadUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_DOWNLOAD);
}

export async function installUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_INSTALL);
}

export function onUpdateAvailable(
  cb: (info: { version: string; releaseNotes: string }) => void,
): () => void {
  return window.ipc.on(IPC.UPDATE_AVAILABLE, cb as any);
}

export function onUpdateProgress(cb: (percent: number) => void): () => void {
  return window.ipc.on(IPC.UPDATE_PROGRESS, cb as any);
}

export function onUpdateDownloaded(cb: () => void): () => void {
  return window.ipc.on(IPC.UPDATE_DOWNLOADED, cb as any);
}

export function onUpdateError(cb: (message: string) => void): () => void {
  return window.ipc.on(IPC.UPDATE_ERROR, cb as any);
}

export async function checkConnectivity(): Promise<{ online: boolean }> {
  return ipcInvoke<{ online: boolean }>(IPC.NET_CHECK);
}
export async function getProxySettings(): Promise<{
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
}> {
  return ipcInvoke<{ httpProxy: string; httpsProxy: string; noProxy: string }>(
    IPC.NET_GET_PROXY,
  );
}
export async function setProxySettings(settings: {
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
}): Promise<void> {
  await ipcInvoke(IPC.NET_SET_PROXY, settings);
}
