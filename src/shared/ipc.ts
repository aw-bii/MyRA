export const IPC = {
  CHAT_SEND: "chat:send",
  CHAT_CHUNK: "chat:chunk",
  CHAT_DONE: "chat:done",
  CHAT_ABORT: "chat:abort",
  CONV_LIST: "conv:list",
  CONV_GET: "conv:get",
  CONV_SEARCH: "conv:search",
  PERSONA_LIST: "persona:list",
  PERSONA_SAVE: "persona:save",
  PERSONA_DELETE: "persona:delete",
  BACKEND_LIST: "backend:list",
  WIZARD_PROBE: "wizard:probe",
  WIZARD_INSTALL: "wizard:install",
  WIZARD_DONE: "wizard:done",
  PIPELINE_LIST: "pipeline:list",
  PIPELINE_SAVE: "pipeline:save",
  PIPELINE_DELETE: "pipeline:delete",
  PIPELINE_RUN: "pipeline:run",
  PIPELINE_CHUNK: "pipeline:chunk",
  PIPELINE_STEP_DONE: "pipeline:step-done",
  PIPELINE_DONE: "pipeline:done",
  PIPELINE_ABORT: "pipeline:abort",
  ATTACHMENT_INGEST: "attachment:ingest",
  ATTACHMENT_LIST: "attachment:list",
  ATTACHMENT_DATA_URL: "attachment:dataurl",
  SECURITY_EVENT: "security:event",
  SECURITY_RESPOND: "security:respond",
  SETTING_GET: "setting:get",
  SETTING_SET: "setting:set",
  SETTING_GET_ALL: "setting:get-all",
  APP_VERSION: "app:version",
  CONV_DELETE: "conv:delete",
  CONV_RENAME: "conv:rename",
  UPDATE_DOWNLOAD: "update:download",
  UPDATE_INSTALL: "update:install",
  UPDATE_STATUS: "update:status",
  UPDATE_AVAILABLE: "update:available",
  UPDATE_PROGRESS: "update:progress",
  UPDATE_ERROR: "update:error",
  UPDATE_DOWNLOADED: "update:downloaded",
  CRON_LIST: "cron:list",
  CRON_CREATE: "cron:create",
  CRON_UPDATE: "cron:update",
  CRON_DELETE: "cron:delete",
  CRON_TOGGLE: "cron:toggle",
  CRON_LOGS: "cron:logs",
  CRON_RUN_NOW: "cron:run-now",
} as const;

export type IpcChannels = typeof IPC;

export interface IpcInvokeMap {
  [IPC.CHAT_SEND]: {
    conversationId: string | null;
    message: string;
    backend: string;
    personaId?: string;
    messageId?: string;
  };
  [IPC.CHAT_ABORT]: { conversationId: string };
  [IPC.CONV_LIST]: { limit: number; offset: number };
  [IPC.CONV_GET]: { conversationId: string };
  [IPC.CONV_SEARCH]: { query: string };
  [IPC.PERSONA_LIST]: void;
  [IPC.PERSONA_SAVE]: {
    id?: string;
    name: string;
    systemPrompt: string;
    isDefault: boolean;
  };
  [IPC.PERSONA_DELETE]: { id: string };
  [IPC.BACKEND_LIST]: void;
  [IPC.WIZARD_PROBE]: { backend: string };
  [IPC.WIZARD_INSTALL]: { backend: string };
  [IPC.WIZARD_DONE]: void;
  [IPC.PIPELINE_LIST]: void;
  [IPC.PIPELINE_SAVE]: {
    id?: string;
    name: string;
    steps: Array<{
      id?: string;
      stepOrder: number;
      backendId: string;
      personaId: string | null;
    }>;
  };
  [IPC.PIPELINE_DELETE]: { id: string };
  [IPC.PIPELINE_RUN]: {
    conversationId: string | null;
    message: string;
    templateId: string;
  };
  [IPC.PIPELINE_ABORT]: { conversationId: string };
  [IPC.ATTACHMENT_INGEST]: { filePaths: string[]; messageId: string };
  [IPC.ATTACHMENT_LIST]: { messageId: string };
  [IPC.ATTACHMENT_DATA_URL]: { storedPath: string };
  [IPC.SETTING_GET]: { key: string };
  [IPC.SETTING_SET]: { key: string; value: string };
  [IPC.SETTING_GET_ALL]: void;
  [IPC.APP_VERSION]: void;
  [IPC.CONV_DELETE]: { conversationId: string };
  [IPC.SECURITY_RESPOND]: import("./types").SecurityRespondPayload;
  [IPC.CONV_RENAME]: { conversationId: string; title: string };
  [IPC.UPDATE_DOWNLOAD]: void;
  [IPC.UPDATE_INSTALL]: void;
  [IPC.CRON_LIST]: void;
  [IPC.CRON_CREATE]: { name: string; cronExpression: string; prompt: string; backend: string };
  [IPC.CRON_UPDATE]: { id: string } & Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>;
  [IPC.CRON_DELETE]: { id: string };
  [IPC.CRON_TOGGLE]: { id: string };
  [IPC.CRON_LOGS]: { cronJobId: string };
  [IPC.CRON_RUN_NOW]: { id: string };
}

export interface IpcPushMap {
  [IPC.CHAT_CHUNK]: import("./types").MessageChunk & { conversationId: string };
  [IPC.CHAT_DONE]: { conversationId: string; messageId: string };
  [IPC.PIPELINE_CHUNK]: import("./types").PipelineChunk & {
    conversationId: string;
  };
  [IPC.PIPELINE_STEP_DONE]: { conversationId: string; stepIndex: number };
  [IPC.PIPELINE_DONE]: { conversationId: string };
  [IPC.UPDATE_STATUS]: string;
  [IPC.UPDATE_AVAILABLE]: { version: string; releaseNotes: string };
  [IPC.UPDATE_PROGRESS]: number;
  [IPC.UPDATE_ERROR]: string;
  [IPC.UPDATE_DOWNLOADED]: void;
  [IPC.SECURITY_EVENT]: import("./types").SecurityEvent;
}

export interface IpcReturnMap {
  [IPC.CONV_SEARCH]: import("./types").SearchResult[];
}
