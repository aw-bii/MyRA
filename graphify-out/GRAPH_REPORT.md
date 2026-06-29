# Graph Report - .  (2026-06-29)

## Corpus Check
- 128 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 970 nodes · 1129 edges · 95 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_IPC Layer & Invocation|IPC Layer & Invocation]]
- [[_COMMUNITY_Implementation Plans|Implementation Plans]]
- [[_COMMUNITY_IPC Module & UI Panels|IPC Module & UI Panels]]
- [[_COMMUNITY_App & ChatView Components|App & ChatView Components]]
- [[_COMMUNITY_Backend Adapters|Backend Adapters]]
- [[_COMMUNITY_Project Identity & Architecture|Project Identity & Architecture]]
- [[_COMMUNITY_Shared Types & Renderer|Shared Types & Renderer]]
- [[_COMMUNITY_Core Store & Services|Core Store & Services]]
- [[_COMMUNITY_Design System & UI|Design System & UI]]
- [[_COMMUNITY_Renderer IPC & Tests|Renderer IPC & Tests]]
- [[_COMMUNITY_Module Refactoring|Module Refactoring]]
- [[_COMMUNITY_Security Plans|Security Plans]]
- [[_COMMUNITY_OpenRouter Adapter|OpenRouter Adapter]]
- [[_COMMUNITY_Window & Database Init|Window & Database Init]]
- [[_COMMUNITY_Claude Adapter|Claude Adapter]]
- [[_COMMUNITY_Scheduler & Pipeline|Scheduler & Pipeline]]
- [[_COMMUNITY_Build Scripts & Icons|Build Scripts & Icons]]
- [[_COMMUNITY_Ollama Adapter|Ollama Adapter]]
- [[_COMMUNITY_Quality Polish Plans|Quality Polish Plans]]
- [[_COMMUNITY_Test Adapter|Test Adapter]]
- [[_COMMUNITY_Attachment Plans|Attachment Plans]]
- [[_COMMUNITY_API Backend Plans|API Backend Plans]]
- [[_COMMUNITY_Claude API Adapter|Claude API Adapter]]
- [[_COMMUNITY_Gemini API Adapter|Gemini API Adapter]]
- [[_COMMUNITY_OpenAI Adapter|OpenAI Adapter]]
- [[_COMMUNITY_Animation & Design|Animation & Design]]
- [[_COMMUNITY_Original Spec & Backends|Original Spec & Backends]]
- [[_COMMUNITY_API Integrations & Security|API Integrations & Security]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 162|Community 162]]
- [[_COMMUNITY_Community 163|Community 163]]
- [[_COMMUNITY_Community 164|Community 164]]
- [[_COMMUNITY_Community 165|Community 165]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 167|Community 167]]
- [[_COMMUNITY_Community 168|Community 168]]
- [[_COMMUNITY_Community 169|Community 169]]
- [[_COMMUNITY_Community 170|Community 170]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 174|Community 174]]
- [[_COMMUNITY_Community 175|Community 175]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 177|Community 177]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 187|Community 187]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 189|Community 189]]
- [[_COMMUNITY_Community 190|Community 190]]
- [[_COMMUNITY_Community 191|Community 191]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 193|Community 193]]
- [[_COMMUNITY_Community 194|Community 194]]

## God Nodes (most connected - your core abstractions)
1. `ipcInvoke()` - 39 edges
2. `MyRA` - 30 edges
3. `BII Agent Harness Implementation Plan` - 23 edges
4. `registerIpcHandlers Function` - 17 edges
5. `IPC Module` - 15 edges
6. `AdapterManager Singleton` - 12 edges
7. `on()` - 11 edges
8. `Shared types` - 11 edges
9. `The Research Notebook (Creative North Star)` - 11 edges
10. `ClaudeAdapter Class` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ipcInvoke()` --calls--> `invoke()`  [INFERRED]
  C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer\ipc.ts → C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\preload\index.ts
- `recheck()` --calls--> `probeBackend()`  [INFERRED]
  C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer\components\Wizard\WizardStep3.tsx → C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer\ipc.ts
- `handleComplete()` --calls--> `markWizardDone()`  [INFERRED]
  C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer\components\Wizard\SetupWizard.tsx → C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer\ipc.ts
- `MyRA` --conceptually_related_to--> `Graphify Knowledge Graph`  [INFERRED]
  AGENTS.md → CLAUDE.md
- `Main Process Entry Point` --calls--> `initUpdater()`  [EXTRACTED]
  src/main/index.ts → C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\main\updater.ts

## Hyperedges (group relationships)
- **Electron 3-Layer Architecture** —  [INFERRED]
- **IPC Channel Flow** —  [INFERRED]
- **Adapter Registry Pattern** —  [INFERRED]
- **Security Middleware Pattern** —  [INFERRED]
- **CSS-First Animation** —  [INFERRED]
- **Sequential SQLite Migrations** —  [INFERRED]
- **Test Colocation** —  [INFERRED]
- **TDD for Security Fixes** —  [INFERRED]
- **Empty State Pattern** —  [INFERRED]
- **Wizard Flow Pattern** —  [INFERRED]
- **Two-Step Delete Confirmation** —  [INFERRED]
- **Toolbar Three-Zone Layout** —  [INFERRED]
- **Dangerous Env Key Blocklist** —  [INFERRED]

## Communities

### Community 0 - "IPC Layer & Invocation"
Cohesion: 0.05
Nodes (89): handleCreate(), handleDelete(), handleRunNow(), handleToggle(), toggleLogs(), seedDefaults(), invoke(), on() (+81 more)

### Community 1 - "Implementation Plans"
Cohesion: 0.03
Nodes (64): AdapterManager, BackendAdapter, GitHub Actions CI/CD, Content-Security-Policy, ClaudeAdapter, ConvStore, FTS5 Full-Text Search, GeminiAdapter (+56 more)

### Community 2 - "IPC Module & UI Panels"
Cohesion: 0.05
Nodes (63): AUTH_COMMANDS Constants, ConvItem, ConvItem Tests, ConvList, ConvList Tests, CronJob types test, CronPanel, CronPanel Tests (+55 more)

### Community 3 - "App & ChatView Components"
Cohesion: 0.06
Nodes (55): Backend:Test, Component:App, Component:Backendswitcher, Component:Bottombar, Component:Chatview, Component:Convitem, Component:Convlist, Component:Errortoast (+47 more)

### Community 4 - "Backend Adapters"
Cohesion: 0.08
Nodes (47): AdapterManager Singleton, securityMiddleware Function, AttachmentService, ClaudeAdapter Class, getClaudeBinaryPath Function, parseClaudeEvent Function, ClaudeAdapter Tests, ClaudeApiAdapter Class (+39 more)

### Community 5 - "Project Identity & Architecture"
Cohesion: 0.05
Nodes (45): AdapterManager, BII Agent Harness, BackendAdapter Interface, Backend Switcher, Bertelsmann India Investment, Calm competence, Claude API, Claude Code (+37 more)

### Community 6 - "Shared Types & Renderer"
Cohesion: 0.1
Nodes (34): AttachmentChip, AttachmentRow, BackendSwitcher, ChatView, PipelineChatView, SingleChatView, StreamingAnnouncer, DiagnosticBanner (+26 more)

### Community 7 - "Core Store & Services"
Cohesion: 0.11
Nodes (24): AttachmentService, AttachmentService Tests, ConvStore, KeyManager, KeyManager Tests, McpClientManager, McpClientManager Tests, PathSecurity (+16 more)

### Community 8 - "Design System & UI"
Cohesion: 0.1
Nodes (21): Chat UI, Color-Alone Prohibition, Danger Red (#ef4444), Flat-By-Default Rule, Generous Leading Rule, Ink Blue (#2563eb), Ink Reserve Rule, Input Field (+13 more)

### Community 9 - "Renderer IPC & Tests"
Cohesion: 0.11
Nodes (20): Preload IPC Bridge, App (Renderer Root), App Test Suite, Renderer IPC Layer, Renderer Entry (main.tsx), closeDb, getDb, initDb (+12 more)

### Community 10 - "Module Refactoring"
Cohesion: 0.21
Nodes (18): Component:Cronjobform, Component:Cronpanel, Module:Ipc-Attachment, Module:Ipc-Backend, Module:Ipc-Chat, Module:Ipc-Conversation, Module:Ipc-Core, Module:Ipc-Cron (+10 more)

### Community 11 - "Security Plans"
Cohesion: 0.16
Nodes (16): DiagnosticBanner, McpClientManager, PathSecurity, PluginManager, securityMiddleware, ThreatPatterns, WriteApproval, MCP JSON-RPC Protocol (+8 more)

### Community 12 - "OpenRouter Adapter"
Cohesion: 0.2
Nodes (3): checkAuth(), send(), OpenRouterAdapter

### Community 13 - "Window & Database Init"
Cohesion: 0.21
Nodes (6): ensureTables(), getDb(), initDb(), createWindow(), loadWindowState(), saveWindowState()

### Community 14 - "Claude Adapter"
Cohesion: 0.19
Nodes (5): ChatView(), handleSend(), ClaudeAdapter, getClaudeBinaryPath(), parseClaudeEvent()

### Community 15 - "Scheduler & Pipeline"
Cohesion: 0.3
Nodes (12): AdapterManager, CronEngine, CronEngine Tests, CronStore, CronStore Tests, PipelineRunner, PipelineRunner Tests, securityMiddleware (+4 more)

### Community 16 - "Build Scripts & Icons"
Cohesion: 0.22
Nodes (3): crc32(), createPNG(), pngChunk()

### Community 17 - "Ollama Adapter"
Cohesion: 0.24
Nodes (1): OllamaAdapter

### Community 18 - "Quality Polish Plans"
Cohesion: 0.2
Nodes (10): ClaudeAdapter, GeminiAdapter, OpencodeAdapter, AdapterManager, BackendAdapter Interface, TestAdapter, Playwright E2E Tests, App Flow Audit Fixes Plan (+2 more)

### Community 19 - "Test Adapter"
Cohesion: 0.22
Nodes (1): TestAdapter

### Community 20 - "Attachment Plans"
Cohesion: 0.22
Nodes (9): Attachments Task 1: Types/IPC/Deps, Attachments Task 2: DB Migration + CRUD, Attachments Task 3: AttachmentService, Attachments Task 4: Update Adapters, Attachments Task 5: Main IPC Handlers, Attachments Task 6: Renderer IPC + useAttachments, Attachments Task 7: UI Components, AttachmentService (+1 more)

### Community 21 - "API Backend Plans"
Cohesion: 0.22
Nodes (9): ClaudeApiAdapter, GeminiApiAdapter, OllamaAdapter, OpenAIAdapter, OpenRouterAdapter, BaseHttpAdapter, KeyManager, API Key Storage (+1 more)

### Community 22 - "Claude API Adapter"
Cohesion: 0.25
Nodes (1): ClaudeApiAdapter

### Community 23 - "Gemini API Adapter"
Cohesion: 0.29
Nodes (1): GeminiApiAdapter

### Community 24 - "OpenAI Adapter"
Cohesion: 0.29
Nodes (1): OpenAIAdapter

### Community 25 - "Animation & Design"
Cohesion: 0.25
Nodes (8): Button System, Phosphor Icons, GPU-Only Animation Rule, Reduced Motion Handling, Animation Liveness Plan, Animation Review Fixes Plan, Design System Fixes Plan, UI Critique Fixes Plan

### Community 26 - "Original Spec & Backends"
Cohesion: 0.25
Nodes (8): Backend:Claude, Backend:Gemini, Backend:Opencode, Concept:Conversation-Store, Concept:Electron-Architecture, Concept:Ipc-Channels, Concept:Streaming-Path, Spec:Original-Design

### Community 27 - "API Integrations & Security"
Cohesion: 0.29
Nodes (8): Backend:Claude-Api, Backend:Gemini-Api, Backend:Ollama, Backend:Openai, Backend:Openrouter, Concept:Security-Model, Module:Keymanager, Spec:Api-Backend-Integrations

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (1): GeminiAdapter

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (1): OpencodeAdapter

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (1): TestAdapter

### Community 33 - "Community 33"
Cohesion: 0.6
Nodes (4): canSpawnNpm(), getInstallCommand(), getProxyEnv(), installBackend()

### Community 36 - "Community 36"
Cohesion: 0.6
Nodes (3): rowToConv(), rowToMsg(), rowToPersona()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (2): onKeyDown(), submit()

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (2): ConvList(), useConversations()

### Community 39 - "Community 39"
Cohesion: 0.4
Nodes (1): handleComplete()

### Community 40 - "Community 40"
Cohesion: 0.4
Nodes (5): SecurityMiddleware Test Suite, PatternDef Interface, ThreatMatch Interface, ThreatPatterns, ThreatPatterns Test Suite

### Community 41 - "Community 41"
Cohesion: 0.4
Nodes (1): handleKeyDown()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (2): registerIpcHandlers(), validatePersona()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (1): PipelineRunner

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (2): expectShellMatchesPlatform(), makeMockProcess()

### Community 48 - "Community 48"
Cohesion: 0.5
Nodes (1): useMessages()

### Community 49 - "Community 49"
Cohesion: 0.83
Nodes (3): computeSha256(), ensureDir(), main()

### Community 50 - "Community 50"
Cohesion: 0.83
Nodes (3): getElectronPath(), globalSetup(), waitForCDP()

### Community 51 - "Community 51"
Cohesion: 0.5
Nodes (4): Persona Templates, Migration 004: Persona Templates, Migration 005: Settings Table, Persona Templates Plan

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (1): mockSpawn()

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (1): Sidebar()

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (1): Spinner()

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (3): AUTH_COMMANDS constant, BackendInfo interface, useBackends hook

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): CronEngine, CronStore, Cron Scheduler Plan

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (3): SearchStore, Migration 006: Search Indexes, FTS5 Session Search Plan

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (3): useFocusTrap Hook, Audit Fixes Plan, Accessibility Hardening Plan

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (2): TDD Pattern, Open Items Plan

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (2): Module:Attachmentservice, Spec:File-Image-Attachments

### Community 138 - "Community 138"
Cohesion: 1.0
Nodes (1): Vitest Test Setup

### Community 139 - "Community 139"
Cohesion: 1.0
Nodes (1): saveWindowState Function

### Community 140 - "Community 140"
Cohesion: 1.0
Nodes (1): MAX_MESSAGE_LENGTH Constant

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (1): Adapter Registry Array

### Community 142 - "Community 142"
Cohesion: 1.0
Nodes (1): BackendSwitcher Test Suite

### Community 143 - "Community 143"
Cohesion: 1.0
Nodes (1): useFocusTrap hook

### Community 144 - "Community 144"
Cohesion: 1.0
Nodes (1): McpToolCallResult interface

### Community 145 - "Community 145"
Cohesion: 1.0
Nodes (1): Renderer index.html entry point

### Community 162 - "Community 162"
Cohesion: 1.0
Nodes (1): Wizard Progress Bar

### Community 163 - "Community 163"
Cohesion: 1.0
Nodes (1): UI Bug Fix Pass Plan

### Community 164 - "Community 164"
Cohesion: 1.0
Nodes (1): Responsive Layout Plan

### Community 165 - "Community 165"
Cohesion: 1.0
Nodes (1): CronJob Type

### Community 166 - "Community 166"
Cohesion: 1.0
Nodes (1): SecurityEvent Type

### Community 167 - "Community 167"
Cohesion: 1.0
Nodes (1): Spawn Array Argv Rule

### Community 168 - "Community 168"
Cohesion: 1.0
Nodes (1): C-01: MCP command validation

### Community 169 - "Community 169"
Cohesion: 1.0
Nodes (1): C-02: Attachment path traversal

### Community 170 - "Community 170"
Cohesion: 1.0
Nodes (1): C-03: SecurityRespondPayload type mismatch

### Community 171 - "Community 171"
Cohesion: 1.0
Nodes (1): C-04: shell.openExternal scheme allowlist

### Community 172 - "Community 172"
Cohesion: 1.0
Nodes (1): H-01: MCP env injection

### Community 173 - "Community 173"
Cohesion: 1.0
Nodes (1): H-02: Plugin command escape

### Community 174 - "Community 174"
Cohesion: 1.0
Nodes (1): H-03: Plugin symlink escape

### Community 175 - "Community 175"
Cohesion: 1.0
Nodes (1): H-05: ReactMarkdown URL filter

### Community 176 - "Community 176"
Cohesion: 1.0
Nodes (1): H-06: WriteApproval not wired

### Community 177 - "Community 177"
Cohesion: 1.0
Nodes (1): M-01: Threat pattern normalization

### Community 178 - "Community 178"
Cohesion: 1.0
Nodes (1): M-02: instruction_override category

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (1): L-04: Missing CSP directives

### Community 180 - "Community 180"
Cohesion: 1.0
Nodes (1): L-06: WriteApproval queue limit

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (1): Component:Diagnosticbanner

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (1): Component:Streamingannouncer

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (1): Module:Usebackends

### Community 184 - "Community 184"
Cohesion: 1.0
Nodes (1): Module:Usepipelines

### Community 185 - "Community 185"
Cohesion: 1.0
Nodes (1): Module:Useconversations

### Community 186 - "Community 186"
Cohesion: 1.0
Nodes (1): Module:Usefocustrap

### Community 187 - "Community 187"
Cohesion: 1.0
Nodes (1): Module:Useattachments

### Community 188 - "Community 188"
Cohesion: 1.0
Nodes (1): Module:Usepipelinemessages

### Community 189 - "Community 189"
Cohesion: 1.0
Nodes (1): Backend:Codex

### Community 190 - "Community 190"
Cohesion: 1.0
Nodes (1): MyRA App Icon

### Community 191 - "Community 191"
Cohesion: 1.0
Nodes (1): App Icon (SVG)

### Community 192 - "Community 192"
Cohesion: 1.0
Nodes (1): Chat App Icon

### Community 193 - "Community 193"
Cohesion: 1.0
Nodes (1): Blue Rounded Rectangle Background

### Community 194 - "Community 194"
Cohesion: 1.0
Nodes (1): Chevron Message Shape

## Ambiguous Edges - Review These
- `probeBackend Test Suite` → `probeBackend`  [AMBIGUOUS]
  src/main/wizard/probe.test.ts · relation: references

## Knowledge Gaps
- **167 isolated node(s):** `Vitest Test Setup`, `loadWindowState Function`, `saveWindowState Function`, `MAX_PROMPT_LENGTH Constant`, `MAX_MESSAGE_LENGTH Constant` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Ollama Adapter`** (10 nodes): `ollama.adapter.ts`, `OllamaAdapter`, `.buildRequestBody()`, `.checkAuth()`, `.getApiKeyHeader()`, `.getBaseUrl()`, `.getDefaultModel()`, `.isAvailable()`, `.listModels()`, `.parseChunk()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Adapter`** (9 nodes): `TestAdapter`, `.buildRequestBody()`, `.checkAuth()`, `.getApiKeyHeader()`, `.getBaseUrl()`, `.getDefaultModel()`, `.isAvailable()`, `.parseChunk()`, `http-base-adapter.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Claude API Adapter`** (8 nodes): `ClaudeApiAdapter`, `.buildRequestBody()`, `.getApiKeyHeader()`, `.getBaseUrl()`, `.getDefaultModel()`, `.listModels()`, `.parseChunk()`, `claude-api.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gemini API Adapter`** (8 nodes): `GeminiApiAdapter`, `.buildRequestBody()`, `.getApiKeyHeader()`, `.getBaseUrl()`, `.getDefaultModel()`, `.listModels()`, `.parseChunk()`, `gemini-api.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OpenAI Adapter`** (8 nodes): `openai.adapter.ts`, `OpenAIAdapter`, `.buildRequestBody()`, `.getApiKeyHeader()`, `.getBaseUrl()`, `.getDefaultModel()`, `.listModels()`, `.parseChunk()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (7 nodes): `GeminiAdapter`, `.abort()`, `.checkAuth()`, `.isAvailable()`, `.send()`, `parseGeminiLine()`, `gemini.adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (7 nodes): `opencode.adapter.ts`, `OpencodeAdapter`, `.abort()`, `.checkAuth()`, `.isAvailable()`, `.send()`, `parseOpencodeLine()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (6 nodes): `test.adapter.ts`, `TestAdapter`, `.abort()`, `.checkAuth()`, `.isAvailable()`, `.send()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (5 nodes): `onDragOver()`, `onFileChange()`, `onKeyDown()`, `submit()`, `InputBar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (5 nodes): `ConvList()`, `ConvList.tsx`, `useConversations.ts`, `ConvList.tsx`, `useConversations()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (5 nodes): `SetupWizard.tsx`, `handleBack()`, `handleComplete()`, `handleStep1()`, `handleStep2()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (5 nodes): `handleKeyDown()`, `handler()`, `onResize()`, `App.tsx`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (4 nodes): `registerIpcHandlers()`, `validatePersona()`, `ipc.ts`, `ipc.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (4 nodes): `runner.ts`, `PipelineRunner`, `.abort()`, `.run()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (4 nodes): `expectShellMatchesPlatform()`, `makeMockProcess()`, `install.test.ts`, `install.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `useMessages.ts`, `useMessages.ts`, `applyChunk()`, `useMessages()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (3 nodes): `mockSpawn()`, `claude.adapter.test.ts`, `claude.adapter.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (3 nodes): `Sidebar.tsx`, `Sidebar()`, `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (3 nodes): `WizardStep1.tsx`, `WizardStep1.tsx`, `Spinner()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (2 nodes): `TDD Pattern`, `Open Items Plan`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (2 nodes): `Module:Attachmentservice`, `Spec:File-Image-Attachments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 138`** (1 nodes): `Vitest Test Setup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (1 nodes): `saveWindowState Function`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (1 nodes): `MAX_MESSAGE_LENGTH Constant`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (1 nodes): `Adapter Registry Array`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 142`** (1 nodes): `BackendSwitcher Test Suite`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 143`** (1 nodes): `useFocusTrap hook`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 144`** (1 nodes): `McpToolCallResult interface`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `Renderer index.html entry point`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 162`** (1 nodes): `Wizard Progress Bar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 163`** (1 nodes): `UI Bug Fix Pass Plan`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 164`** (1 nodes): `Responsive Layout Plan`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 165`** (1 nodes): `CronJob Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 166`** (1 nodes): `SecurityEvent Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 167`** (1 nodes): `Spawn Array Argv Rule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 168`** (1 nodes): `C-01: MCP command validation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 169`** (1 nodes): `C-02: Attachment path traversal`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 170`** (1 nodes): `C-03: SecurityRespondPayload type mismatch`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 171`** (1 nodes): `C-04: shell.openExternal scheme allowlist`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 172`** (1 nodes): `H-01: MCP env injection`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 173`** (1 nodes): `H-02: Plugin command escape`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 174`** (1 nodes): `H-03: Plugin symlink escape`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 175`** (1 nodes): `H-05: ReactMarkdown URL filter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 176`** (1 nodes): `H-06: WriteApproval not wired`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 177`** (1 nodes): `M-01: Threat pattern normalization`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 178`** (1 nodes): `M-02: instruction_override category`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (1 nodes): `L-04: Missing CSP directives`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (1 nodes): `L-06: WriteApproval queue limit`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (1 nodes): `Component:Diagnosticbanner`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (1 nodes): `Component:Streamingannouncer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (1 nodes): `Module:Usebackends`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 184`** (1 nodes): `Module:Usepipelines`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 185`** (1 nodes): `Module:Useconversations`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (1 nodes): `Module:Usefocustrap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 187`** (1 nodes): `Module:Useattachments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 188`** (1 nodes): `Module:Usepipelinemessages`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 189`** (1 nodes): `Backend:Codex`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 190`** (1 nodes): `MyRA App Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 191`** (1 nodes): `App Icon (SVG)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 192`** (1 nodes): `Chat App Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 193`** (1 nodes): `Blue Rounded Rectangle Background`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 194`** (1 nodes): `Chevron Message Shape`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `probeBackend Test Suite` and `probeBackend`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `BII Agent Harness Implementation Plan` connect `Implementation Plans` to `Attachment Plans`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `Sidebar` connect `IPC Module & UI Panels` to `Shared Types & Renderer`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `SearchPanel` connect `Shared Types & Renderer` to `IPC Module & UI Panels`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `Vitest Test Setup`, `loadWindowState Function`, `saveWindowState Function` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `IPC Layer & Invocation` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Implementation Plans` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._