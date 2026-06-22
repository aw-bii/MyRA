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

export async function sendChat(
  payload: IpcInvokeMap[typeof IPC.CHAT_SEND],
): Promise<string> {
  return window.ipc.invoke(IPC.CHAT_SEND, payload) as Promise<string>;
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
  await window.ipc.invoke(IPC.CHAT_ABORT, { conversationId });
}
export async function listConversations(
  limit = 50,
  offset = 0,
): Promise<Conversation[]> {
  return window.ipc.invoke(IPC.CONV_LIST, { limit, offset }) as Promise<
    Conversation[]
  >;
}
export async function getConversation(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  return window.ipc.invoke(IPC.CONV_GET, { conversationId }) as Promise<any>;
}
export async function searchConversations(query: string): Promise<SearchResult[]> {
  return window.ipc.invoke(IPC.CONV_SEARCH, { query }) as Promise<SearchResult[]>;
}
export async function listPersonas(): Promise<Persona[]> {
  return window.ipc.invoke(IPC.PERSONA_LIST) as Promise<Persona[]>;
}
export async function savePersona(
  p: Omit<Persona, "id"> & { id?: string },
): Promise<Persona> {
  return window.ipc.invoke(IPC.PERSONA_SAVE, p) as Promise<Persona>;
}
export async function deletePersona(id: string): Promise<void> {
  await window.ipc.invoke(IPC.PERSONA_DELETE, { id });
}
export async function listBackends(): Promise<BackendInfo[]> {
  return window.ipc.invoke(IPC.BACKEND_LIST) as Promise<BackendInfo[]>;
}
export async function probeBackend(
  backend: string,
): Promise<{ available: boolean; authenticated: boolean }> {
  return window.ipc.invoke(IPC.WIZARD_PROBE, { backend }) as Promise<any>;
}
export async function installBackend(
  backend: string,
): Promise<{ success: boolean; error?: string }> {
  return window.ipc.invoke(IPC.WIZARD_INSTALL, { backend }) as Promise<{
    success: boolean;
    error?: string;
  }>;
}
export async function markWizardDone(): Promise<void> {
  await window.ipc.invoke(IPC.WIZARD_DONE);
}

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return window.ipc.invoke(IPC.PIPELINE_LIST) as Promise<PipelineTemplate[]>;
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
  return window.ipc.invoke(IPC.PIPELINE_SAVE, p) as Promise<PipelineTemplate>;
}
export async function deletePipelineTemplate(id: string): Promise<void> {
  await window.ipc.invoke(IPC.PIPELINE_DELETE, { id });
}
export async function runPipeline(payload: {
  conversationId: string | null;
  message: string;
  templateId: string;
}): Promise<string> {
  return window.ipc.invoke(IPC.PIPELINE_RUN, payload) as Promise<string>;
}
export async function abortPipeline(conversationId: string): Promise<void> {
  await window.ipc.invoke(IPC.PIPELINE_ABORT, { conversationId });
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
  return window.ipc.invoke(IPC.ATTACHMENT_INGEST, {
    filePaths,
    messageId,
  }) as Promise<import("../shared/types").Attachment[]>;
}
export async function listAttachments(
  messageId: string,
): Promise<import("../shared/types").Attachment[]> {
  return window.ipc.invoke(IPC.ATTACHMENT_LIST, { messageId }) as Promise<
    import("../shared/types").Attachment[]
  >;
}
export async function getAttachmentDataUrl(
  storedPath: string,
): Promise<string> {
  return window.ipc.invoke(IPC.ATTACHMENT_DATA_URL, {
    storedPath,
  }) as Promise<string>;
}
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await window.ipc.invoke(IPC.CONV_DELETE, { conversationId });
}
export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<void> {
  await window.ipc.invoke(IPC.CONV_RENAME, { conversationId, title });
}

export async function getAppVersion(): Promise<string> {
  return window.ipc.invoke(IPC.APP_VERSION) as Promise<string>;
}

export async function getSetting(key: string): Promise<string | undefined> {
  return window.ipc.invoke(IPC.SETTING_GET, { key }) as Promise<
    string | undefined
  >;
}
export async function setSetting(key: string, value: string): Promise<void> {
  await window.ipc.invoke(IPC.SETTING_SET, { key, value });
}
export async function getAllSettings(): Promise<Record<string, string>> {
  return window.ipc.invoke(IPC.SETTING_GET_ALL) as Promise<
    Record<string, string>
  >;
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
  await window.ipc.invoke(IPC.SECURITY_RESPOND, payload);
}

export async function getCronJobs(): Promise<CronJob[]> {
  return window.ipc.invoke(IPC.CRON_LIST) as Promise<CronJob[]>;
}
export async function createCronJob(input: { name: string; cronExpression: string; prompt: string; backend: string }): Promise<CronJob> {
  return window.ipc.invoke(IPC.CRON_CREATE, input) as Promise<CronJob>;
}
export async function updateCronJob(id: string, changes: Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>): Promise<CronJob> {
  return window.ipc.invoke(IPC.CRON_UPDATE, { id, ...changes }) as Promise<CronJob>;
}
export async function deleteCronJob(id: string): Promise<void> {
  await window.ipc.invoke(IPC.CRON_DELETE, { id });
}
export async function toggleCronJob(id: string): Promise<CronJob> {
  return window.ipc.invoke(IPC.CRON_TOGGLE, { id }) as Promise<CronJob>;
}
export async function getCronJobLogs(cronJobId: string): Promise<CronJobLog[]> {
  return window.ipc.invoke(IPC.CRON_LOGS, { cronJobId }) as Promise<CronJobLog[]>;
}
export async function runCronJobNow(id: string): Promise<void> {
  await window.ipc.invoke(IPC.CRON_RUN_NOW, { id });
}
