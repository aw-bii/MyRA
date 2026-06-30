export const IPC = {
  CHAT_SEND: "chat:send",
  CHAT_CHUNK: "chat:chunk",
  CHAT_DONE: "chat:done",
  CHAT_ABORT: "chat:abort",
  CONV_LIST: "conv:list",
  CONV_CREATE: "conv:create",
  CONV_GET: "conv:get",
  CONV_SEARCH: "conv:search",
  PERSONA_LIST: "persona:list",
  PERSONA_SAVE: "persona:save",
  PERSONA_DELETE: "persona:delete",
  BACKEND_LIST: "backend:list",
  WIZARD_PROBE: "wizard:probe",
  WIZARD_INSTALL: "wizard:install",
  WIZARD_DONE: "wizard:done",
  OLLAMA_START: "ollama:start",
  PIPELINE_LIST: "pipeline:list",
  PIPELINE_SAVE: "pipeline:save",
  PIPELINE_DELETE: "pipeline:delete",
  PIPELINE_RUN: "pipeline:run",
  PIPELINE_CHUNK: "pipeline:chunk",
  PIPELINE_STEP_DONE: "pipeline:step-done",
  PIPELINE_DONE: "pipeline:done",
  NET_CHECK: "net:check",
  NET_SET_PROXY: "net:set-proxy",
  NET_GET_PROXY: "net:get-proxy",
  NET_OPEN_EXTERNAL: "net:open-external",
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
  APP_RELAUNCH: "app:relaunch",
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

  MCP_LIST_SERVERS: "mcp:list-servers",
  MCP_ADD_SERVER: "mcp:add-server",
  MCP_REMOVE_SERVER: "mcp:remove-server",
  MCP_TOGGLE_SERVER: "mcp:toggle-server",
  MCP_LIST_TOOLS: "mcp:list-tools",
  MCP_CALL_TOOL: "mcp:call-tool",

  PLUGIN_LIST: "plugin:list",
  PLUGIN_TOGGLE: "plugin:toggle",
  PLUGIN_RELOAD: "plugin:reload",
  PLUGIN_GET_EVENTS: "plugin:get-events",

  KEY_STORE: "key:store",
  KEY_GET: "key:get",
  KEY_DELETE: "key:delete",
  KEY_HAS: "key:has",
  KEY_LIST: "key:list",
  MODEL_GET_DEFAULT: "model:get-default",
  MODEL_SET_DEFAULT: "model:set-default",
  MODEL_LIST: "model:list",
} as const;

export type IpcChannels = typeof IPC;

export interface IpcInvokeMap {
  [IPC.CHAT_SEND]: {
    conversationId: string | null;
    message: string;
    backend: string;
    personaId?: string;
    messageId?: string;
    model?: string;
  };
  [IPC.CHAT_ABORT]: { conversationId: string };
  [IPC.CONV_LIST]: { limit: number; offset: number };
  [IPC.CONV_CREATE]: {
    title: string;
    backend: string;
    personaId?: string;
    pipelineTemplateId?: string;
  };
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
  [IPC.OLLAMA_START]: void;
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
  [IPC.APP_RELAUNCH]: void;
  [IPC.CONV_DELETE]: { conversationId: string };
  [IPC.SECURITY_RESPOND]: import("./types").SecurityRespondPayload;
  [IPC.CONV_RENAME]: { conversationId: string; title: string };
  [IPC.UPDATE_DOWNLOAD]: void;
  [IPC.UPDATE_INSTALL]: void;
  [IPC.CRON_LIST]: void;
  [IPC.CRON_CREATE]: {
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  };
  [IPC.CRON_UPDATE]: { id: string } & Partial<{
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }>;
  [IPC.CRON_DELETE]: { id: string };
  [IPC.CRON_TOGGLE]: { id: string };
  [IPC.CRON_LOGS]: { cronJobId: string };
  [IPC.CRON_RUN_NOW]: { id: string };

  [IPC.MCP_LIST_SERVERS]: void;
  [IPC.MCP_ADD_SERVER]: {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
  [IPC.MCP_REMOVE_SERVER]: { id: string };
  [IPC.MCP_TOGGLE_SERVER]: { id: string };
  [IPC.MCP_LIST_TOOLS]: void;
  [IPC.MCP_CALL_TOOL]: import("./types").McpToolCallRequest;

  [IPC.PLUGIN_LIST]: void;
  [IPC.PLUGIN_TOGGLE]: { id: string };
  [IPC.PLUGIN_RELOAD]: void;
  [IPC.PLUGIN_GET_EVENTS]: { conversationId?: string };

  [IPC.KEY_STORE]: { provider: string; key: string };
  [IPC.KEY_GET]: { provider: string };
  [IPC.KEY_DELETE]: { provider: string };
  [IPC.KEY_HAS]: { provider: string };
  [IPC.KEY_LIST]: void;
  [IPC.MODEL_GET_DEFAULT]: { provider: string };
  [IPC.MODEL_SET_DEFAULT]: { provider: string; model: string };
  [IPC.MODEL_LIST]: { provider: string };

  [IPC.NET_CHECK]: void;
  [IPC.NET_SET_PROXY]: {
    httpProxy: string;
    httpsProxy: string;
    noProxy: string;
  };
  [IPC.NET_GET_PROXY]: void;
  [IPC.NET_OPEN_EXTERNAL]: { url: string };
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
  [IPC.KEY_GET]: string | null;
  [IPC.KEY_HAS]: boolean;
  [IPC.KEY_LIST]: string[];
  [IPC.MODEL_GET_DEFAULT]: string;
  [IPC.MODEL_LIST]: string[];

  [IPC.NET_CHECK]: { online: boolean };
  [IPC.NET_GET_PROXY]: {
    httpProxy: string;
    httpsProxy: string;
    noProxy: string;
  };
}
