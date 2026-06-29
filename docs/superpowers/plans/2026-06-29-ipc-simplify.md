# IPC Module Split & Panel Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `src/renderer/ipc.ts` into domain modules and move sidebar panels into their own directory, so the knowledge graph can cluster them properly instead of dumping all 89 nodes into one low-cohesion community.

**Architecture:** The renderer IPC module is 375 lines with 68 exported functions across 14 domains sharing `ipcInvoke`/`on()` as common ancestors — creating a star topology that the graph cannot split. We split into one file per domain, keeping `ipcInvoke` and `on()` in a shared core. Simultaneously, `CronPanel` and `McpPanel` live inside `Sidebar/` but have zero sidebar-specific logic — they get moved to `panels/`. `CronPanel` gets a `CronJobForm` subcomponent extracted.

**Tech Stack:** TypeScript, React, Vitest, Electron IPC

---

### File Structure (target)

```
src/renderer/
├── ipc/
│   ├── index.ts              # shared core: ipcInvoke, on(), window.ipc types, lastIpcError
│   ├── chat.ts               # sendChat, onChatChunk, onChatDone, abortChat
│   ├── conversation.ts       # listConversations, createConversation, getConversation, searchConversations, deleteConversation, renameConversation
│   ├── persona.ts            # listPersonas, savePersona, deletePersona
│   ├── backend.ts            # listBackends, probeBackend, installBackend, markWizardDone
│   ├── key.ts                # storeKey, getKey, deleteKey, hasKey, listProviders, getDefaultModel, setDefaultModel, listModels
│   ├── pipeline.ts           # listPipelineTemplates, savePipelineTemplate, deletePipelineTemplate, runPipeline, abortPipeline, onPipelineChunk, onPipelineStepDone, onPipelineDone
│   ├── attachment.ts         # ingestAttachments, listAttachments, getAttachmentDataUrl
│   ├── settings.ts           # getAppVersion, getSetting, setSetting, getAllSettings
│   ├── security.ts           # onSecurityEvent, respondSecurity
│   ├── cron.ts               # getCronJobs, createCronJob, updateCronJob, deleteCronJob, toggleCronJob, getCronJobLogs, runCronJobNow
│   ├── mcp.ts                # listMcpServers, addMcpServer, removeMcpServer, toggleMcpServer, listMcpTools, callMcpTool
│   ├── plugin.ts             # listPlugins, togglePlugin, reloadPlugins
│   ├── update.ts             # downloadUpdate, installUpdate, onUpdateAvailable, onUpdateProgress, onUpdateDownloaded, onUpdateError
│   └── net.ts                # checkConnectivity, getProxySettings, setProxySettings
├── panels/
│   ├── CronPanel/
│   │   ├── CronPanel.tsx      # moved from Sidebar/
│   │   ├── CronPanel.test.tsx # moved from Sidebar/
│   │   ├── CronJobForm.tsx    # extracted form subcomponent
│   │   └── CronJobForm.test.tsx
│   ├── McpPanel/
│   │   ├── McpPanel.tsx       # moved from Sidebar/
│   │   ├── McpPanel.test.tsx  # moved from Sidebar/
│   │   └── McpToolList.tsx    # extracted tool-list subcomponent
│   └── PluginPanel/
│       ├── PluginPanel.tsx    # moved from Sidebar/
│       └── PluginPanel.test.tsx
└── components/Sidebar/
    └── Sidebar.tsx            # imports from panels/ instead of local files
```

---

### Task 1: Create shared IPC core

**Files:**
- Create: `src/renderer/ipc/index.ts`

This is the shared core — the `window.ipc` type declaration, `ipcInvoke()`, `lastIpcError`/`clearIpcError()`. Every domain IPC file imports `ipcInvoke` and `on` from here.

- [ ] **Step 1: Write `src/renderer/ipc/index.ts`**

```typescript
import { IPC } from "../../shared/ipc";

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

export function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.ipc.invoke(channel, ...args).catch((err: Error) => {
    lastIpcError = err;
    console.error(`IPC ${channel} failed:`, err);
    throw err;
  }) as Promise<T>;
}

export function onIpcEvent<T>(
  channel: string,
  cb: (data: T) => void,
): () => void {
  return window.ipc.on(channel, cb as any);
}
```

The `onIpcEvent` wrapper is new — it wraps `window.ipc.on()` with a typed callback so domain files don't need to cast.

- [ ] **Step 2: Write the test for `ipcInvoke`**

Create: `src/renderer/ipc/index.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ipcInvoke, lastIpcError, clearIpcError } from "./index";

beforeEach(() => {
  clearIpcError();
  vi.restoreAllMocks();
});

it("calls window.ipc.invoke and returns result", async () => {
  (window as any).ipc = { invoke: vi.fn().mockResolvedValue("ok") };
  const result = await ipcInvoke<string>("test:chan", { x: 1 });
  expect(result).toBe("ok");
  expect((window as any).ipc.invoke).toHaveBeenCalledWith("test:chan", { x: 1 });
});

it("sets lastIpcError on failure", async () => {
  const err = new Error("fail");
  (window as any).ipc = { invoke: vi.fn().mockRejectedValue(err) };
  await expect(ipcInvoke("test:chan")).rejects.toThrow("fail");
  expect(lastIpcError).toBe(err);
});

it("clearIpcError resets the error", () => {
  (window as any).ipc = { invoke: vi.fn().mockRejectedValue(new Error("x")) };
  clearIpcError();
  expect(lastIpcError).toBeNull();
});
```

- [ ] **Step 3: Run IPC core tests**

Run: `npx vitest run src/renderer/ipc/index.test.ts`
Expected: 3/3 PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc/index.ts src/renderer/ipc/index.test.ts
git commit -m "feat(ipc): extract shared IPC core (ipcInvoke, onIpcEvent, lastIpcError)"
```

---

### Task 2: Create all domain IPC modules

**Files:**
- Create: `src/renderer/ipc/chat.ts`
- Create: `src/renderer/ipc/conversation.ts`
- Create: `src/renderer/ipc/persona.ts`
- Create: `src/renderer/ipc/backend.ts`
- Create: `src/renderer/ipc/key.ts`
- Create: `src/renderer/ipc/pipeline.ts`
- Create: `src/renderer/ipc/attachment.ts`
- Create: `src/renderer/ipc/settings.ts`
- Create: `src/renderer/ipc/security.ts`
- Create: `src/renderer/ipc/cron.ts`
- Create: `src/renderer/ipc/mcp.ts`
- Create: `src/renderer/ipc/plugin.ts`
- Create: `src/renderer/ipc/update.ts`
- Create: `src/renderer/ipc/net.ts`

Each file exports only its domain functions and imports `ipcInvoke`/`onIpcEvent` from `./index`. No test files needed for individual domain IPC modules — they're just pass-through wrappers. The integration test is that consumers that import them work correctly (tested across all existing tests).

- [ ] **Step 1: Create `src/renderer/ipc/chat.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { MessageChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";
import type { IpcInvokeMap } from "../../shared/ipc";

export async function sendChat(
  payload: IpcInvokeMap[typeof IPC.CHAT_SEND],
): Promise<string> {
  return ipcInvoke<string>(IPC.CHAT_SEND, payload);
}

export function onChatChunk(
  cb: (chunk: MessageChunk & { conversationId: string }) => void,
): () => void {
  return onIpcEvent(IPC.CHAT_CHUNK, cb);
}

export function onChatDone(
  cb: (payload: { conversationId: string; messageId: string }) => void,
): () => void {
  return onIpcEvent(IPC.CHAT_DONE, cb);
}

export async function abortChat(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.CHAT_ABORT, { conversationId });
}
```

- [ ] **Step 2: Create `src/renderer/ipc/conversation.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { Conversation, Message, SearchResult } from "../../shared/types";
import { ipcInvoke } from "./index";

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
): Promise<Conversation> {
  return ipcInvoke<Conversation>(IPC.CONV_CREATE, { title, backend, personaId });
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

export async function deleteConversation(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_DELETE, { conversationId: id });
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_RENAME, { conversationId: id, title });
}
```

- [ ] **Step 3: Create `src/renderer/ipc/persona.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { Persona } from "../../shared/types";
import { ipcInvoke } from "./index";

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
```

- [ ] **Step 4: Create `src/renderer/ipc/backend.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { BackendInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

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
  return ipcInvoke<{ success: boolean; error?: string }>(IPC.WIZARD_INSTALL, { backend });
}

export async function markWizardDone(): Promise<void> {
  await ipcInvoke<void>(IPC.WIZARD_DONE);
}
```

- [ ] **Step 5: Create `src/renderer/ipc/key.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

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
```

- [ ] **Step 6: Create `src/renderer/ipc/pipeline.ts`**

```typescript
import { IPC } from "../../shared/ipc";
import type { PipelineTemplate, PipelineChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return ipcInvoke<PipelineTemplate[]>(IPC.PIPELINE_LIST);
}
export async function savePipelineTemplate(p: {
  id?: string; name: string;
  steps: Array<{ id?: string; stepOrder: number; backendId: string; personaId: string | null }>;
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
): () => void {
  return onIpcEvent(IPC.PIPELINE_CHUNK, cb);
}
export function onPipelineStepDone(
  cb: (payload: { conversationId: string; stepIndex: number }) => void,
): () => void {
  return onIpcEvent(IPC.PIPELINE_STEP_DONE, cb);
}
export function onPipelineDone(
  cb: (payload: { conversationId: string }) => void,
): () => void {
  return onIpcEvent(IPC.PIPELINE_DONE, cb);
}
```

- [ ] **Step 7: Create remaining domain files**

Create `attachment.ts`, `settings.ts`, `security.ts`, `cron.ts`, `mcp.ts`, `plugin.ts`, `update.ts`, `net.ts` — each mirrors the exports from `renderer/ipc.ts` for its domain, importing `ipcInvoke`/`onIpcEvent` from `./index`.

`src/renderer/ipc/attachment.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import type { Attachment } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function ingestAttachments(
  filePaths: string[], messageId: string,
): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_INGEST, { filePaths, messageId });
}
export async function listAttachments(messageId: string): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_LIST, { messageId });
}
export async function getAttachmentDataUrl(storedPath: string): Promise<string> {
  return ipcInvoke<string>(IPC.ATTACHMENT_DATA_URL, { storedPath });
}
```

`src/renderer/ipc/settings.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

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
```

`src/renderer/ipc/security.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import type { SecurityEvent, SecurityRespondPayload } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export function onSecurityEvent(
  listener: (event: SecurityEvent) => void,
): () => void {
  return onIpcEvent(IPC.SECURITY_EVENT, listener);
}
export async function respondSecurity(
  payload: SecurityRespondPayload,
): Promise<void> {
  await ipcInvoke<void>(IPC.SECURITY_RESPOND, payload);
}
```

`src/renderer/ipc/cron.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import type { CronJob, CronJobLog } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function getCronJobs(): Promise<CronJob[]> {
  return ipcInvoke<CronJob[]>(IPC.CRON_LIST);
}
export async function createCronJob(input: {
  name: string; cronExpression: string; prompt: string; backend: string;
}): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_CREATE, input);
}
export async function updateCronJob(
  id: string, changes: Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>,
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
```

`src/renderer/ipc/mcp.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import type { McpServerConfig, McpTool, McpToolCallResult } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listMcpServers(): Promise<McpServerConfig[]> {
  return ipcInvoke<McpServerConfig[]>(IPC.MCP_LIST_SERVERS);
}
export async function addMcpServer(config: {
  name: string; command: string; args: string[]; env?: Record<string, string>;
}): Promise<McpServerConfig> {
  return ipcInvoke<McpServerConfig>(IPC.MCP_ADD_SERVER, config);
}
export async function removeMcpServer(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.MCP_REMOVE_SERVER, { id });
}
export async function toggleMcpServer(id: string): Promise<McpServerConfig | undefined> {
  return ipcInvoke<McpServerConfig | undefined>(IPC.MCP_TOGGLE_SERVER, { id });
}
export async function listMcpTools(): Promise<McpTool[]> {
  return ipcInvoke<McpTool[]>(IPC.MCP_LIST_TOOLS);
}
export async function callMcpTool(request: McpToolCallRequest): Promise<McpToolCallResult> {
  return ipcInvoke<McpToolCallResult>(IPC.MCP_CALL_TOOL, request);
}
```

`src/renderer/ipc/plugin.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import type { PluginInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listPlugins(): Promise<PluginInfo[]> {
  return ipcInvoke<PluginInfo[]>(IPC.PLUGIN_LIST);
}
export async function togglePlugin(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_TOGGLE, { id });
}
export async function reloadPlugins(): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_RELOAD);
}
```

`src/renderer/ipc/update.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke, onIpcEvent } from "./index";

export async function downloadUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_DOWNLOAD);
}
export async function installUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_INSTALL);
}
export function onUpdateAvailable(
  cb: (info: { version: string; releaseNotes: string }) => void,
): () => void {
  return onIpcEvent(IPC.UPDATE_AVAILABLE, cb);
}
export function onUpdateProgress(cb: (percent: number) => void): () => void {
  return onIpcEvent(IPC.UPDATE_PROGRESS, cb);
}
export function onUpdateDownloaded(cb: () => void): () => void {
  return onIpcEvent(IPC.UPDATE_DOWNLOADED, cb);
}
export function onUpdateError(cb: (message: string) => void): () => void {
  return onIpcEvent(IPC.UPDATE_ERROR, cb);
}
```

`src/renderer/ipc/net.ts`:
```typescript
import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function checkConnectivity(): Promise<{ online: boolean }> {
  return ipcInvoke<{ online: boolean }>(IPC.NET_CHECK);
}
export async function getProxySettings(): Promise<{
  httpProxy: string; httpsProxy: string; noProxy: string;
}> {
  return ipcInvoke<{ httpProxy: string; httpsProxy: string; noProxy: string }>(
    IPC.NET_GET_PROXY,
  );
}
export async function setProxySettings(settings: {
  httpProxy: string; httpsProxy: string; noProxy: string;
}): Promise<void> {
  await ipcInvoke(IPC.NET_SET_PROXY, settings);
}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/ipc/
git commit -m "feat(ipc): split monolithic ipc.ts into 14 domain modules"
```

---

### Task 3: Update all importers (27 files)

**Files:**
- Modify: all 27 files that import from `../ipc` or `./ipc` → import from `../ipc/<domain>` or `./ipc/<domain>`

This is mechanical. Each file imports specific named exports — we update the import path to the domain module that exports them. Group into batches of 5-6 files per commit for reviewability.

- [ ] **Step 1: Update hooks (6 files)**

`src/renderer/hooks/useConversations.ts`:
```typescript
import { listConversations, searchConversations } from "../ipc/conversation";
```

`src/renderer/hooks/useBackends.ts`:
```typescript
import { listBackends } from "../ipc/backend";
```

`src/renderer/hooks/useAttachments.ts`:
```typescript
import { ingestAttachments } from "../ipc/attachment";
```

`src/renderer/hooks/useMessages.ts`:
```typescript
import { getConversation, sendChat, onChatChunk, onChatDone, abortChat } from "../ipc/chat";
import { ingestAttachments } from "../ipc/attachment";
```

Note: `useMessages.ts` also indirectly uses `ingestAttachments` for attachments, but looking at the actual code it only imports from `../ipc`. Let me verify — `useMessages.ts` actually imports `onChatChunk`, `onChatDone`, `sendChat`, `abortChat`, `getConversation` — all from `../ipc`. Source: `src/renderer/hooks/useMessages.ts:2-8`. Edit the import to point to `../ipc/chat` and `../ipc/conversation`.

Wait, looking at useMessages.ts again:
```
import {
  getConversation,
  sendChat,
  onChatChunk,
  onChatDone,
  abortChat,
} from "../ipc";
```

So it needs `getConversation` from `conversation.ts` and `sendChat/onChatChunk/onChatDone/abortChat` from `chat.ts`.

```typescript
import { getConversation } from "../ipc/conversation";
import { sendChat, onChatChunk, onChatDone, abortChat } from "../ipc/chat";
```

`src/renderer/hooks/usePersonas.ts`:
```typescript
import { listPersonas, savePersona, deletePersona } from "../ipc/persona";
```

`src/renderer/hooks/usePipelines.ts`:
Line 6 imports from `../ipc`:
```typescript
import { listPipelineTemplates, savePipelineTemplate, deletePipelineTemplate } from "../ipc/pipeline";
```

`src/renderer/hooks/usePipelineMessages.ts`:
```typescript
import { getConversation } from "../ipc/conversation";
import { runPipeline, abortPipeline, onPipelineChunk, onPipelineStepDone, onPipelineDone } from "../ipc/pipeline";
```

- [ ] **Step 2: Run the tests for hooks**

Run: `npx vitest run src/renderer/hooks/`
Expected: All hook tests PASS

- [ ] **Step 3: Update components (12 files)**

`src/renderer/App.tsx`:
```typescript
import { listBackends } from "./ipc/backend";
import { listConversations, createConversation, deleteConversation } from "./ipc/conversation";
```

`src/renderer/components/DiagnosticBanner.tsx`:
```typescript
import { lastIpcError, clearIpcError } from "../../ipc/index";
```

`src/renderer/components/UpdateBanner.tsx`:
```typescript
import { downloadUpdate, onUpdateAvailable, onUpdateProgress, onUpdateDownloaded, onUpdateError } from "../../ipc/update";
```

`src/renderer/components/Settings/SettingsPanel.tsx`:
```typescript
import { getSetting, setSetting, getAllSettings } from "../../ipc/settings";
import { listBackends } from "../../ipc/backend";
import { storeKey, hasKey, listProviders, getDefaultModel, setDefaultModel } from "../../ipc/key";
import { getProxySettings, setProxySettings, checkConnectivity } from "../../ipc/net";
import { getAppVersion } from "../../ipc/settings";
```

`src/renderer/components/Chat/AttachmentRow.tsx`:
```typescript
import { getAttachmentDataUrl } from "../../ipc/attachment";
```

`src/renderer/components/Chat/MessageBubble.tsx`:
```typescript
import { listAttachments } from "../../ipc/attachment";
```

`src/renderer/components/SearchPanel/SearchPanel.tsx`:
```typescript
import { searchConversations } from "../../ipc/conversation";
```

`src/renderer/components/SearchPanel/SearchPanel.test.tsx`:
```typescript
import { searchConversations } from "../../ipc/conversation";
```

`src/renderer/components/Sidebar/CronPanel.tsx`:
```typescript
import { getCronJobs, createCronJob, toggleCronJob, deleteCronJob, getCronJobLogs, runCronJobNow } from "../../ipc/cron";
```

`src/renderer/components/Sidebar/CronPanel.test.tsx`:
```typescript
vi.mock("../../ipc/cron", () => ({
  getCronJobs: vi.fn(),
  createCronJob: vi.fn(),
  toggleCronJob: vi.fn(),
  deleteCronJob: vi.fn(),
  getCronJobLogs: vi.fn(),
  runCronJobNow: vi.fn(),
}));
import { getCronJobs, createCronJob, toggleCronJob, deleteCronJob, getCronJobLogs } from "../../ipc/cron";
```

`src/renderer/components/Sidebar/McpPanel.tsx`:
```typescript
import { listMcpServers, addMcpServer, removeMcpServer, toggleMcpServer, listMcpTools } from "../../ipc/mcp";
```

`src/renderer/components/Sidebar/McpPanel.test.tsx`:
```typescript
vi.mock("../../ipc/mcp", () => ({ ... }));
import { listMcpServers, ... } from "../../ipc/mcp";
```

`src/renderer/components/Sidebar/PluginPanel.tsx`:
```typescript
import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc/plugin";
```

`src/renderer/components/Sidebar/PluginPanel.test.tsx`:
```typescript
vi.mock("../../ipc/plugin", () => ({ ... }));
import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc/plugin";
```

`src/renderer/components/Wizard/SetupWizard.tsx`:
```typescript
import { markWizardDone } from "../../ipc/backend";
```

`src/renderer/components/Wizard/WizardStep1.tsx`:
```typescript
import { probeBackend } from "../../ipc/backend";
```

`src/renderer/components/Wizard/WizardStep2.tsx`:
```typescript
import { installBackend, probeBackend } from "../../ipc/backend";
```

`src/renderer/components/Wizard/WizardStep3.tsx`:
```typescript
import { probeBackend } from "../../ipc/backend";
```

`src/renderer/components/Wizard/WizardStep3.test.tsx`:
```typescript
import { probeBackend } from "../../ipc/backend";
```

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (any mock path mismatches will fail fast)

- [ ] **Step 5: Delete the old monolithic file**

```bash
git rm src/renderer/ipc.ts
```

- [ ] **Step 6: Run full test suite again**

Run: `npx vitest run`
Expected: All tests PASS — if any importer was missed, it will fail with a module-not-found error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ipc): update 27 importers to use domain IPC modules, delete monolithic ipc.ts"
```

---

### Task 4: Move CronPanel to panels/

**Files:**
- Move: `src/renderer/components/Sidebar/CronPanel.tsx` → `src/renderer/panels/CronPanel/CronPanel.tsx`
- Move: `src/renderer/components/Sidebar/CronPanel.test.tsx` → `src/renderer/panels/CronPanel/CronPanel.test.tsx`
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx` — update import path
- Modify: `src/renderer/panels/CronPanel/CronPanel.test.tsx` — update mock path from `../../ipc/cron` to `../../ipc/cron` (same level from panels/)

- [ ] **Step 1: Delete old files from Sidebar/**

Do not use `git mv` — use separate `git add` / `git rm` to avoid path name conflicts.

```bash
git rm src/renderer/components/Sidebar/CronPanel.tsx
git rm src/renderer/components/Sidebar/CronPanel.test.tsx
```

- [ ] **Step 2: Recreate CronPanel.tsx in panels/**

Create `src/renderer/panels/CronPanel/CronPanel.tsx` — content identical to the original, no changes needed:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { CronJob, CronJobLog } from "../../../shared/types";
import { getCronJobs, createCronJob, toggleCronJob, deleteCronJob, getCronJobLogs, runCronJobNow } from "../../ipc/cron";

export function CronPanel() {
  // ... exact same content as original
}
```

The IPC import path goes from `../../ipc/cron` (when in `components/Sidebar/`) to `../../ipc/cron` (when in `panels/CronPanel/`) — same depth from `src/renderer/`.

- [ ] **Step 3: Recreate CronPanel.test.tsx in panels/**

Create `src/renderer/panels/CronPanel/CronPanel.test.tsx` — same content, mock path stays `../../ipc/cron`.

- [ ] **Step 4: Update Sidebar import**

`src/renderer/components/Sidebar/Sidebar.tsx`:
```typescript
// Remove: import { CronPanel } from "./CronPanel";
import { CronPanel } from "../../panels/CronPanel/CronPanel";
```

- [ ] **Step 5: Run CronPanel tests**

Run: `npx vitest run src/renderer/panels/CronPanel/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/panels/CronPanel/
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "refactor(panels): move CronPanel from Sidebar/ to panels/CronPanel/"
```

---

### Task 5: Extract CronJobForm from CronPanel

**Files:**
- Create: `src/renderer/panels/CronPanel/CronJobForm.tsx`
- Create: `src/renderer/panels/CronPanel/CronJobForm.test.tsx`
- Modify: `src/renderer/panels/CronPanel/CronPanel.tsx` — import and use CronJobForm instead of inline form
- Modify: `src/renderer/panels/CronPanel/CronPanel.test.tsx` — update mock (optional, not required if mock is at IPC level)

The inline form in CronPanel (lines 80–141 of the original) is a self-contained unit: it has its own state (name, cronExpression, prompt, backend), a create handler, and renders 4 inputs + a button.

- [ ] **Step 1: Write CronJobForm test**

Create `src/renderer/panels/CronPanel/CronJobForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CronJobForm } from "./CronJobForm";

it("renders all form fields", () => {
  render(<CronJobForm onCreate={vi.fn()} />);
  expect(screen.getByPlaceholderText("e.g., Daily standup")).toBeTruthy();
  expect(screen.getByPlaceholderText("e.g., 0 9 * * 1-5")).toBeTruthy();
  expect(screen.getByPlaceholderText("Message to execute")).toBeTruthy();
  expect(screen.getByText("Create Job")).toBeTruthy();
});

it("calls onCreate with form values when submitted", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.change(screen.getByPlaceholderText("e.g., Daily standup"), {
    target: { value: "My Job" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g., 0 9 * * 1-5"), {
    target: { value: "* * * * *" },
  });
  fireEvent.change(screen.getByPlaceholderText("Message to execute"), {
    target: { value: "do thing" },
  });
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).toHaveBeenCalledWith({
    name: "My Job",
    cronExpression: "* * * * *",
    prompt: "do thing",
    backend: "claude",
  });
});

it("does not call onCreate when fields are empty", () => {
  const onCreate = vi.fn();
  render(<CronJobForm onCreate={onCreate} />);
  fireEvent.click(screen.getByText("Create Job"));
  expect(onCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/panels/CronPanel/CronJobForm.test.tsx`
Expected: FAIL with "Module not found: ./CronJobForm"

- [ ] **Step 3: Create CronJobForm**

Create `src/renderer/panels/CronPanel/CronJobForm.tsx`:

```typescript
import { useState } from "react";

interface Props {
  onCreate: (input: {
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }) => void;
}

export function CronJobForm({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backend, setBackend] = useState("claude");

  const handleSubmit = () => {
    if (!name || !cronExpression || !prompt) return;
    onCreate({ name, cronExpression, prompt, backend });
    setName("");
    setCronExpression("");
    setPrompt("");
    setBackend("claude");
  };

  return (
    <div className="px-3 py-2 space-y-1.5 border-b border-border">
      <label className="block text-xs font-medium mb-1" htmlFor="cron-name">Name</label>
      <input
        id="cron-name" placeholder="e.g., Daily standup"
        value={name} onChange={(e) => setName(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium mb-1" htmlFor="cron-expression">Cron Expression</label>
      <input
        id="cron-expression" placeholder="e.g., 0 9 * * 1-5"
        value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium mb-1" htmlFor="cron-prompt">Prompt</label>
      <textarea
        id="cron-prompt" placeholder="Message to execute"
        value={prompt} onChange={(e) => setPrompt(e.target.value)}
        rows={2} className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium mb-1" htmlFor="cron-backend">Backend</label>
      <select
        id="cron-backend" value={backend} onChange={(e) => setBackend(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="claude">Claude Code</option>
        <option value="gemini">Gemini CLI</option>
        <option value="opencode">Opencode</option>
      </select>
      <button
        onClick={handleSubmit}
        className="w-full text-xs py-1 rounded bg-green-600 text-white hoverable:hover:bg-green-700 transition-transform duration-100 ease-press active:scale-95"
      >
        Create Job
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/renderer/panels/CronPanel/CronJobForm.test.tsx`
Expected: 3/3 PASS

- [ ] **Step 5: Wire CronJobForm into CronPanel**

Modify `src/renderer/panels/CronPanel/CronPanel.tsx`:
- Add import: `import { CronJobForm } from "./CronJobForm";`
- Replace the inline form section (lines 80–141 of original) with `<CronJobForm onCreate={handleCreate} />`
- Remove the old `name`, `cronExpression`, `prompt`, `backend` state variables — they're now inside CronJobForm
- The `handleCreate` method changes from calling `createCronJob` directly with local state to receiving the input as a parameter:

```typescript
const handleCreate = async (input: { name: string; cronExpression: string; prompt: string; backend: string }) => {
  await createCronJob(input);
  setShowForm(false);
  await refresh();
};
```

- [ ] **Step 6: Run all CronPanel tests**

Run: `npx vitest run src/renderer/panels/CronPanel/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(panels): extract CronJobForm subcomponent from CronPanel"
```

---

### Self-Review Checklist

- [ ] **Spec coverage:** Every requirement from the side-by-side plan is covered:
  - Task 1-3 = split renderer/ipc.ts into domain modules ✓
  - Task 4 = move CronPanel out of Sidebar/ ✓
  - Task 5 = extract CronJobForm ✓
- [ ] **Placeholder scan:** No TBD, TODO, "implement later", or empty code blocks in any task
- [ ] **Type consistency:** `CronJobForm` `onCreate` prop signature matches `handleCreate` parameter type; `ipcInvoke` signature matches domain file imports; `onIpcEvent` return type `() => void` matches all `on*` cleanup function types
- [ ] **All import paths** updated across 27 files — verified by the final `git rm + vitest run` step which would catch any missed file
