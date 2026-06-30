export interface Conversation {
  id: string;
  title: string;
  backend: string;
  personaId: string | null;
  pipelineTemplateId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  backend: string;
  stepIndex: number | null;
  createdAt: number;
}

export interface VariableDef {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
}

export interface Persona {
  id: string;
  name: string;
  systemPrompt: string;
  isDefault: boolean;
  isTemplate?: boolean;
  category?: string | null;
  description?: string | null;
  variables?: VariableDef[];
}

export interface BackendInfo {
  id: string;
  label: string;
  available: boolean;
  authenticated: boolean;
}

export interface MessageChunk {
  type: "text" | "tool_use" | "error" | "done";
  content: string;
  raw?: unknown;
}

export interface PipelineStep {
  id: string;
  templateId: string;
  stepOrder: number;
  backendId: string;
  personaId: string | null;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  steps: PipelineStep[];
  createdAt: number;
}

export interface PipelineChunk extends MessageChunk {
  stepIndex: number;
}

export interface BackendAdapter {
  id: string;
  isAvailable(): Promise<boolean>;
  checkAuth(): Promise<boolean>;
  send(
    message: string,
    persona?: string,
    attachments?: Attachment[],
  ): AsyncIterable<MessageChunk>;
  abort(): void;
}

export interface Attachment {
  id: string;
  messageId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  extractionError: boolean;
  createdAt: number;
}

export interface SecurityEvent {
  type:
    | "injection_detected"
    | "write_approval_needed"
    | "path_traversal_blocked";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  detail: string;
  source: string;
  filePath?: string;
  content?: string;
  id?: string;
}

export interface WriteApprovalRequest {
  filePath: string;
  content: string;
}

export interface SecurityRespondPayload {
  id: string;
  approved: boolean;
}

export interface SearchResult {
  message: Message;
  conversationTitle: string;
  snippet: string;
  rank: number;
}

export type CronJobStatus = "active" | "paused" | "error";

export interface CronJob {
  id: string;
  name: string;
  cronExpression: string;
  prompt: string;
  backend: string;
  conversationId: string | null;
  status: CronJobStatus;
  lastRunAt: number | null;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  lastError: string | null;
}

export interface CronJobLog {
  id: string;
  cronJobId: string;
  startedAt: number;
  finishedAt: number | null;
  success: boolean;
  conversationId: string | null;
  error: string | null;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools: McpTool[];
  lastSeen: number | null;
  backendId?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface McpToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpToolCallResult {
  success: boolean;
  content: string;
  error?: string;
}

export type PluginHook =
  | "beforePrompt"
  | "afterResponse"
  | "onConversationStart"
  | "onConversationEnd"
  | "onError";

export interface PluginInfo {
  id: string;
  name: string;
  path: string;
  command: string;
  enabled: boolean;
  hooks: PluginHook[];
  version: string;
  lastLoadedAt: number | null;
  lastError: string | null;
}

export interface PluginEvent {
  hook: PluginHook;
  conversationId?: string;
  messageContent?: string;
  responseContent?: string;
  error?: string;
}
