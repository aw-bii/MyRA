# Multi-Agent Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named pipeline templates to BII Agent Harness — an ordered list of (backend, persona) steps that run sequentially, each step receiving the prior step's accumulated output as its input.

**Architecture:** A new `PipelineRunner` singleton in the main process owns step sequencing. It calls adapters in order and emits tagged chunks to the renderer via new IPC channels. The renderer's new `usePipelineMessages` hook handles streaming state; `ChatView` renders step tabs when a pipeline template is active. Existing single-backend conversations and all their code paths are completely untouched.

**Tech Stack:** TypeScript, Electron IPC, React hooks, better-sqlite3, Vitest

## Global Constraints

- Run `npm test` after every task — all tests must stay green before committing.
- Test command: `npx vitest run` (from repo root).
- All SQL goes in `.sql` migration files under `src/main/store/migrations/` — never inline `db.exec()` for schema changes.
- Never use `shell: true` in `child_process.spawn`. Pass args as arrays.
- Never import renderer code from main process and vice versa.
- `src/shared/` is the only code shared between main and renderer.
- Pipeline conversations must not break existing single-backend conversations — keep code paths separate.

---

## File Structure

```
Files to create:
  src/main/store/migrations/002_pipeline.sql     — pipeline tables + ALTER TABLE columns
  src/main/pipeline/runner.ts                    — PipelineRunner singleton
  src/main/pipeline/runner.test.ts               — PipelineRunner unit tests
  src/renderer/hooks/usePipelines.ts             — React hook: pipeline template CRUD
  src/renderer/hooks/usePipelineMessages.ts      — React hook: pipeline streaming state
  src/renderer/components/Pipelines/PipelinePanel.tsx  — template management UI

Files to modify:
  src/shared/types.ts                            — add PipelineTemplate, PipelineStep, PipelineChunk; extend Conversation + Message
  src/shared/ipc.ts                              — add 8 PIPELINE_* channel constants + payload types
  src/main/store/index.ts                        — add pipeline CRUD; update row mappers for new columns
  src/main/ipc.ts                                — register pipeline IPC handlers; import pipelineRunner
  src/renderer/ipc.ts                            — add pipeline IPC wrapper functions + event listeners
  src/renderer/App.tsx                           — pipeline mode toggle, template picker, PipelinePanel slot
  src/renderer/components/Chat/ChatView.tsx      — accept pipelineTemplate prop; render step tabs
  src/renderer/components/Sidebar/ConvItem.tsx   — chain icon for pipeline conversations
```

---

### Task 1: Shared Types and IPC Constants

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

**Interfaces:**
- Produces:
  - `PipelineStep` — `{ id, templateId, stepOrder, backendId, personaId: string | null }`
  - `PipelineTemplate` — `{ id, name, steps: PipelineStep[], createdAt }`
  - `PipelineChunk` — `MessageChunk & { stepIndex: number }`
  - `Conversation.pipelineTemplateId: string | null` (new field)
  - `Message.stepIndex: number | null` (new field)
  - `IPC.PIPELINE_LIST`, `IPC.PIPELINE_SAVE`, `IPC.PIPELINE_DELETE`, `IPC.PIPELINE_RUN`, `IPC.PIPELINE_CHUNK`, `IPC.PIPELINE_STEP_DONE`, `IPC.PIPELINE_DONE`, `IPC.PIPELINE_ABORT`

- [ ] **Step 1: Update `src/shared/types.ts`**

Replace the entire file with:

```typescript
export interface Conversation {
  id: string
  title: string
  backend: string
  personaId: string | null
  pipelineTemplateId: string | null
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  backend: string
  stepIndex: number | null
  createdAt: number
}

export interface Persona {
  id: string
  name: string
  systemPrompt: string
  isDefault: boolean
}

export interface BackendInfo {
  id: string
  label: string
  available: boolean
  authenticated: boolean
}

export interface MessageChunk {
  type: 'text' | 'tool_use' | 'error' | 'done'
  content: string
  raw?: unknown
}

export interface PipelineStep {
  id: string
  templateId: string
  stepOrder: number
  backendId: string
  personaId: string | null
}

export interface PipelineTemplate {
  id: string
  name: string
  steps: PipelineStep[]
  createdAt: number
}

export interface PipelineChunk extends MessageChunk {
  stepIndex: number
}

export interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string): AsyncIterable<MessageChunk>
  abort(): void
}
```

- [ ] **Step 2: Update `src/shared/ipc.ts`**

Replace the entire file with:

```typescript
export const IPC = {
  CHAT_SEND:           'chat:send',
  CHAT_CHUNK:          'chat:chunk',
  CHAT_DONE:           'chat:done',
  CHAT_ABORT:          'chat:abort',
  CONV_LIST:           'conv:list',
  CONV_GET:            'conv:get',
  CONV_SEARCH:         'conv:search',
  PERSONA_LIST:        'persona:list',
  PERSONA_SAVE:        'persona:save',
  PERSONA_DELETE:      'persona:delete',
  BACKEND_LIST:        'backend:list',
  WIZARD_PROBE:        'wizard:probe',
  WIZARD_INSTALL:      'wizard:install',
  WIZARD_DONE:         'wizard:done',
  PIPELINE_LIST:       'pipeline:list',
  PIPELINE_SAVE:       'pipeline:save',
  PIPELINE_DELETE:     'pipeline:delete',
  PIPELINE_RUN:        'pipeline:run',
  PIPELINE_CHUNK:      'pipeline:chunk',
  PIPELINE_STEP_DONE:  'pipeline:step-done',
  PIPELINE_DONE:       'pipeline:done',
  PIPELINE_ABORT:      'pipeline:abort',
} as const

export type IpcChannels = typeof IPC

export interface IpcInvokeMap {
  [IPC.CHAT_SEND]:         { conversationId: string | null; message: string; backend: string; personaId?: string }
  [IPC.CHAT_ABORT]:        { conversationId: string }
  [IPC.CONV_LIST]:         { limit: number; offset: number }
  [IPC.CONV_GET]:          { conversationId: string }
  [IPC.CONV_SEARCH]:       { query: string }
  [IPC.PERSONA_LIST]:      void
  [IPC.PERSONA_SAVE]:      { id?: string; name: string; systemPrompt: string; isDefault: boolean }
  [IPC.PERSONA_DELETE]:    { id: string }
  [IPC.BACKEND_LIST]:      void
  [IPC.WIZARD_PROBE]:      { backend: string }
  [IPC.WIZARD_INSTALL]:    { backend: string }
  [IPC.WIZARD_DONE]:       void
  [IPC.PIPELINE_LIST]:     void
  [IPC.PIPELINE_SAVE]:     { id?: string; name: string; steps: Array<{ id?: string; stepOrder: number; backendId: string; personaId: string | null }> }
  [IPC.PIPELINE_DELETE]:   { id: string }
  [IPC.PIPELINE_RUN]:      { conversationId: string | null; message: string; templateId: string }
  [IPC.PIPELINE_ABORT]:    { conversationId: string }
}

export interface IpcPushMap {
  [IPC.CHAT_CHUNK]:         import('./types').MessageChunk & { conversationId: string }
  [IPC.CHAT_DONE]:          { conversationId: string; messageId: string }
  [IPC.PIPELINE_CHUNK]:     import('./types').PipelineChunk & { conversationId: string }
  [IPC.PIPELINE_STEP_DONE]: { conversationId: string; stepIndex: number }
  [IPC.PIPELINE_DONE]:      { conversationId: string }
}
```

- [ ] **Step 3: Fix TypeScript errors from new `Message.stepIndex` field**

`src/main/ipc.ts` calls `ConvStore.createMessage(...)` without `stepIndex`. Add `stepIndex: null` to the two `createMessage` calls:

In `src/main/ipc.ts`, change:
```typescript
ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: message, backend: adapter.id })
```
to:
```typescript
ConvStore.createMessage({ conversationId: conv.id, role: 'user', content: message, backend: adapter.id, stepIndex: null })
```

And change:
```typescript
const saved = ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: fullContent, backend: adapter.id })
```
to:
```typescript
const saved = ConvStore.createMessage({ conversationId: conv.id, role: 'assistant', content: fullContent, backend: adapter.id, stepIndex: null })
```

- [ ] **Step 4: Fix `Message` placeholder in `src/renderer/hooks/useMessages.ts`**

In `src/renderer/hooks/useMessages.ts`, add `stepIndex: null` to both message literals:

```typescript
const userMsg: Message = {
  id: crypto.randomUUID(),
  conversationId: conversationId ?? '',
  role: 'user', content: message, backend, stepIndex: null, createdAt: Date.now(),
}
const assistantPlaceholder: Message = {
  id: crypto.randomUUID(),
  conversationId: conversationId ?? '',
  role: 'assistant', content: '', backend, stepIndex: null, createdAt: Date.now(),
}
```

- [ ] **Step 5: Run tests to verify no regressions**

Run: `npx vitest run`
Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts src/main/ipc.ts src/renderer/hooks/useMessages.ts
git commit -m "feat: add pipeline types, IPC channels, and Message.stepIndex field"
```

---

### Task 2: Database Migration and ConvStore Pipeline CRUD

**Files:**
- Create: `src/main/store/migrations/002_pipeline.sql`
- Modify: `src/main/store/index.ts`
- Modify: `src/main/store/index.test.ts`

**Interfaces:**
- Consumes: `PipelineTemplate`, `PipelineStep` from `src/shared/types.ts`
- Produces:
  - `ConvStore.createPipelineTemplate(name, steps)` → `PipelineTemplate`
  - `ConvStore.listPipelineTemplates()` → `PipelineTemplate[]`
  - `ConvStore.updatePipelineTemplate(id, name, steps)` → `PipelineTemplate`
  - `ConvStore.deletePipelineTemplate(id)` → `void`
  - `ConvStore.getPipelineTemplate(id)` → `PipelineTemplate | undefined`
  - `ConvStore.createPipelineConversation(title, pipelineTemplateId)` → `Conversation`
  - Updated `rowToConv` includes `pipelineTemplateId`
  - Updated `rowToMsg` includes `stepIndex`
  - Updated `createMessage` accepts `stepIndex: number | null`

- [ ] **Step 1: Write failing tests for pipeline CRUD**

In `src/main/store/index.test.ts`, add a new describe block after the existing tests:

```typescript
describe('ConvStore pipeline CRUD', () => {
  it('createPipelineTemplate round-trips name and steps', () => {
    const t = ConvStore.createPipelineTemplate('Draft+Critique', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'gemini', personaId: null },
    ])
    expect(t.name).toBe('Draft+Critique')
    expect(t.steps).toHaveLength(2)
    expect(t.steps[0].backendId).toBe('claude')
    expect(t.steps[1].backendId).toBe('gemini')
    expect(t.steps[0].stepOrder).toBe(0)
  })

  it('listPipelineTemplates returns created templates', () => {
    const t = ConvStore.createPipelineTemplate('Test', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'opencode', personaId: null },
    ])
    const list = ConvStore.listPipelineTemplates()
    expect(list.some(x => x.id === t.id)).toBe(true)
  })

  it('getPipelineTemplate returns template with steps', () => {
    const t = ConvStore.createPipelineTemplate('Get test', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'gemini', personaId: null },
    ])
    const found = ConvStore.getPipelineTemplate(t.id)
    expect(found).toBeDefined()
    expect(found!.steps).toHaveLength(2)
  })

  it('updatePipelineTemplate replaces steps', () => {
    const t = ConvStore.createPipelineTemplate('Update test', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'gemini', personaId: null },
    ])
    const updated = ConvStore.updatePipelineTemplate(t.id, 'Renamed', [
      { stepOrder: 0, backendId: 'opencode', personaId: null },
      { stepOrder: 1, backendId: 'claude', personaId: null },
    ])
    expect(updated.name).toBe('Renamed')
    expect(updated.steps[0].backendId).toBe('opencode')
  })

  it('deletePipelineTemplate removes template and steps', () => {
    const t = ConvStore.createPipelineTemplate('Delete test', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'gemini', personaId: null },
    ])
    ConvStore.deletePipelineTemplate(t.id)
    expect(ConvStore.getPipelineTemplate(t.id)).toBeUndefined()
  })

  it('createPipelineConversation sets pipelineTemplateId', () => {
    const t = ConvStore.createPipelineTemplate('Conv test', [
      { stepOrder: 0, backendId: 'claude', personaId: null },
      { stepOrder: 1, backendId: 'gemini', personaId: null },
    ])
    const conv = ConvStore.createPipelineConversation('Test query', t.id)
    expect(conv.pipelineTemplateId).toBe(t.id)
    expect(conv.backend).toBe('pipeline')
  })

  it('createMessage stores and retrieves stepIndex', () => {
    const conv = ConvStore.createConversation('Test', 'claude', null)
    const msg = ConvStore.createMessage({
      conversationId: conv.id,
      role: 'assistant',
      content: 'step result',
      backend: 'claude',
      stepIndex: 1,
    })
    const msgs = ConvStore.getMessages(conv.id)
    expect(msgs.find(m => m.id === msg.id)?.stepIndex).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/store/index.test.ts`
Expected: FAIL — methods not yet defined.

- [ ] **Step 3: Create `src/main/store/migrations/002_pipeline.sql`**

```sql
CREATE TABLE IF NOT EXISTS pipeline_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pipeline_steps (
  id           TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  backend_id   TEXT NOT NULL,
  persona_id   TEXT REFERENCES personas(id) ON DELETE SET NULL
);

ALTER TABLE conversations ADD COLUMN pipeline_template_id TEXT REFERENCES pipeline_templates(id);

ALTER TABLE messages ADD COLUMN step_index INTEGER;
```

- [ ] **Step 4: Add pipeline methods to `src/main/store/index.ts`**

Add these imports at the top (after existing imports):

```typescript
import type { PipelineTemplate, PipelineStep } from '../../shared/types'
```

Update `rowToConv` to include the new column:

```typescript
function rowToConv(r: any): Conversation {
  return {
    id: r.id,
    title: r.title,
    backend: r.backend,
    personaId: r.persona_id,
    pipelineTemplateId: r.pipeline_template_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
```

Update `rowToMsg` to include the new column:

```typescript
function rowToMsg(r: any): Message {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    backend: r.backend,
    stepIndex: r.step_index ?? null,
    createdAt: r.created_at,
  }
}
```

Update `createMessage` to include `step_index` in the INSERT:

```typescript
createMessage(msg: Omit<Message, 'id' | 'createdAt'>): Message {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = Date.now()
  db.prepare(`INSERT INTO messages (id, conversation_id, role, content, backend, step_index, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, msg.conversationId, msg.role, msg.content, msg.backend, msg.stepIndex ?? null, now)
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, msg.conversationId)
  return { ...msg, id, createdAt: now }
},
```

Add pipeline CRUD methods inside `ConvStore` (after `getDefaultPersona`):

```typescript
  createPipelineConversation(title: string, pipelineTemplateId: string): Conversation {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`INSERT INTO conversations (id, title, backend, persona_id, pipeline_template_id, created_at, updated_at)
                VALUES (?, ?, 'pipeline', NULL, ?, ?, ?)`)
      .run(id, title, pipelineTemplateId, now, now)
    return { id, title, backend: 'pipeline', personaId: null, pipelineTemplateId, createdAt: now, updatedAt: now }
  },

  createPipelineTemplate(
    name: string,
    steps: Array<{ stepOrder: number; backendId: string; personaId: string | null }>
  ): PipelineTemplate {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare('INSERT INTO pipeline_templates (id, name, created_at) VALUES (?, ?, ?)').run(id, name, now)
    const savedSteps: PipelineStep[] = steps.map(s => {
      const stepId = crypto.randomUUID()
      db.prepare(`INSERT INTO pipeline_steps (id, template_id, step_order, backend_id, persona_id)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(stepId, id, s.stepOrder, s.backendId, s.personaId ?? null)
      return { id: stepId, templateId: id, stepOrder: s.stepOrder, backendId: s.backendId, personaId: s.personaId }
    })
    return { id, name, steps: savedSteps, createdAt: now }
  },

  listPipelineTemplates(): PipelineTemplate[] {
    const db = getDb()
    const templates = db.prepare('SELECT * FROM pipeline_templates ORDER BY created_at DESC').all() as any[]
    return templates.map(t => {
      const steps = db.prepare('SELECT * FROM pipeline_steps WHERE template_id = ? ORDER BY step_order ASC').all(t.id) as any[]
      return {
        id: t.id,
        name: t.name,
        createdAt: t.created_at,
        steps: steps.map(s => ({ id: s.id, templateId: s.template_id, stepOrder: s.step_order, backendId: s.backend_id, personaId: s.persona_id ?? null })),
      }
    })
  },

  getPipelineTemplate(id: string): PipelineTemplate | undefined {
    const db = getDb()
    const t = db.prepare('SELECT * FROM pipeline_templates WHERE id = ?').get(id) as any
    if (!t) return undefined
    const steps = db.prepare('SELECT * FROM pipeline_steps WHERE template_id = ? ORDER BY step_order ASC').all(id) as any[]
    return {
      id: t.id,
      name: t.name,
      createdAt: t.created_at,
      steps: steps.map(s => ({ id: s.id, templateId: s.template_id, stepOrder: s.step_order, backendId: s.backend_id, personaId: s.persona_id ?? null })),
    }
  },

  updatePipelineTemplate(
    id: string,
    name: string,
    steps: Array<{ stepOrder: number; backendId: string; personaId: string | null }>
  ): PipelineTemplate {
    const db = getDb()
    db.prepare('UPDATE pipeline_templates SET name = ? WHERE id = ?').run(name, id)
    db.prepare('DELETE FROM pipeline_steps WHERE template_id = ?').run(id)
    const savedSteps: PipelineStep[] = steps.map(s => {
      const stepId = crypto.randomUUID()
      db.prepare(`INSERT INTO pipeline_steps (id, template_id, step_order, backend_id, persona_id)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(stepId, id, s.stepOrder, s.backendId, s.personaId ?? null)
      return { id: stepId, templateId: id, stepOrder: s.stepOrder, backendId: s.backendId, personaId: s.personaId }
    })
    const t = db.prepare('SELECT * FROM pipeline_templates WHERE id = ?').get(id) as any
    return { id: t.id, name: t.name, createdAt: t.created_at, steps: savedSteps }
  },

  deletePipelineTemplate(id: string): void {
    getDb().prepare('DELETE FROM pipeline_templates WHERE id = ?').run(id)
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/store/index.test.ts`
Expected: all tests PASS including new pipeline tests.

- [ ] **Step 6: Commit**

```bash
git add src/main/store/migrations/002_pipeline.sql src/main/store/index.ts src/main/store/index.test.ts
git commit -m "feat: pipeline DB migration and ConvStore CRUD methods"
```

---

### Task 3: PipelineRunner Service

**Files:**
- Create: `src/main/pipeline/runner.ts`
- Create: `src/main/pipeline/runner.test.ts`

**Interfaces:**
- Consumes: `AdapterManager` from `src/main/adapters/manager.ts`; `PipelineChunk` from `src/shared/types.ts`
- Produces:
  - `pipelineRunner` singleton — `PipelineRunner` instance
  - `pipelineRunner.run({ conversationId, userMessage, steps, onChunk, onStepDone })` → `Promise<void>`
  - `pipelineRunner.abort(conversationId)` → `void`

- [ ] **Step 1: Write failing tests**

Create `src/main/pipeline/runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AdapterManager before importing runner
const mockSend = vi.fn()
const mockAbort = vi.fn()
const mockGet = vi.fn()

vi.mock('../adapters/manager', () => ({
  AdapterManager: {
    get: mockGet,
  },
}))

import { pipelineRunner } from './runner'

function makeAdapter(chunks: Array<{ type: string; content: string }>) {
  return {
    id: 'mock',
    abort: mockAbort,
    send: async function* () {
      for (const c of chunks) yield c
    },
  }
}

describe('PipelineRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes user message to step 0 and accumulated output to step 1', async () => {
    const capturedInputs: string[] = []
    mockGet.mockImplementation(() => ({
      id: 'mock',
      abort: mockAbort,
      send: async function* (msg: string) {
        capturedInputs.push(msg)
        yield { type: 'text', content: 'out-' + capturedInputs.length }
        yield { type: 'done', content: '' }
      },
    }))

    await pipelineRunner.run({
      conversationId: 'conv-1',
      userMessage: 'hello',
      steps: [
        { adapterId: 'claude', persona: undefined },
        { adapterId: 'gemini', persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    })

    expect(capturedInputs[0]).toBe('hello')
    expect(capturedInputs[1]).toBe('out-1')
  })

  it('tags chunks with the correct stepIndex', async () => {
    mockGet.mockImplementation((id: string) => ({
      id,
      abort: mockAbort,
      send: async function* () {
        yield { type: 'text', content: 'text' }
        yield { type: 'done', content: '' }
      },
    }))

    const chunks: Array<{ stepIndex: number }> = []
    await pipelineRunner.run({
      conversationId: 'conv-2',
      userMessage: 'test',
      steps: [
        { adapterId: 'claude', persona: undefined },
        { adapterId: 'gemini', persona: undefined },
      ],
      onChunk: (c) => chunks.push(c),
      onStepDone: vi.fn(),
    })

    expect(chunks.filter(c => c.stepIndex === 0).length).toBeGreaterThan(0)
    expect(chunks.filter(c => c.stepIndex === 1).length).toBeGreaterThan(0)
  })

  it('calls onStepDone with the correct index after each step', async () => {
    mockGet.mockImplementation(() => ({
      id: 'mock',
      abort: mockAbort,
      send: async function* () {
        yield { type: 'text', content: 'result' }
        yield { type: 'done', content: '' }
      },
    }))

    const doneIndices: number[] = []
    await pipelineRunner.run({
      conversationId: 'conv-3',
      userMessage: 'test',
      steps: [
        { adapterId: 'claude', persona: undefined },
        { adapterId: 'gemini', persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: (i) => doneIndices.push(i),
    })

    expect(doneIndices).toEqual([0, 1])
  })

  it('abort stops execution before the next step', async () => {
    let stepCount = 0
    mockGet.mockImplementation(() => ({
      id: 'mock',
      abort: mockAbort,
      send: async function* () {
        stepCount++
        yield { type: 'text', content: 'result' }
        yield { type: 'done', content: '' }
      },
    }))

    const runPromise = pipelineRunner.run({
      conversationId: 'conv-4',
      userMessage: 'test',
      steps: [
        { adapterId: 'claude', persona: undefined },
        { adapterId: 'gemini', persona: undefined },
        { adapterId: 'opencode', persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: (i) => {
        if (i === 0) pipelineRunner.abort('conv-4')
      },
    })

    await runPromise
    expect(stepCount).toBe(1)
  })

  it('throws if adapter not found', async () => {
    mockGet.mockReturnValue(undefined)
    await expect(pipelineRunner.run({
      conversationId: 'conv-5',
      userMessage: 'test',
      steps: [{ adapterId: 'nonexistent', persona: undefined }],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    })).rejects.toThrow('Adapter not found: nonexistent')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/pipeline/runner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/pipeline/runner.ts`**

```typescript
import { AdapterManager } from '../adapters/manager'
import type { PipelineChunk } from '../../shared/types'

interface ResolvedStep {
  adapterId: string
  persona?: string
}

export class PipelineRunner {
  private abortMap = new Map<string, () => void>()

  async run(params: {
    conversationId: string
    userMessage: string
    steps: ResolvedStep[]
    onChunk: (chunk: PipelineChunk) => void
    onStepDone: (stepIndex: number) => void
  }): Promise<void> {
    let aborted = false
    this.abortMap.set(params.conversationId, () => { aborted = true })

    let currentInput = params.userMessage

    try {
      for (let i = 0; i < params.steps.length; i++) {
        if (aborted) break
        const step = params.steps[i]
        const adapter = AdapterManager.get(step.adapterId)
        if (!adapter) throw new Error(`Adapter not found: ${step.adapterId}`)

        let accumulated = ''
        let stepCompleted = false

        for await (const chunk of adapter.send(currentInput, step.persona)) {
          if (aborted) {
            adapter.abort()
            break
          }
          params.onChunk({ ...chunk, stepIndex: i })
          if (chunk.type === 'text') accumulated += chunk.content
          if (chunk.type === 'done') { stepCompleted = true; break }
        }

        if (!aborted && stepCompleted) {
          params.onStepDone(i)
          currentInput = accumulated
        }
      }
    } finally {
      this.abortMap.delete(params.conversationId)
    }
  }

  abort(conversationId: string): void {
    const fn = this.abortMap.get(conversationId)
    if (fn) fn()
  }
}

export const pipelineRunner = new PipelineRunner()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/pipeline/runner.test.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/pipeline/runner.ts src/main/pipeline/runner.test.ts
git commit -m "feat: PipelineRunner service with step sequencing and abort"
```

---

### Task 4: Main Process IPC Handlers

**Files:**
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `pipelineRunner` from `src/main/pipeline/runner.ts`; `ConvStore.createPipelineTemplate`, `ConvStore.listPipelineTemplates`, `ConvStore.getPipelineTemplate`, `ConvStore.updatePipelineTemplate`, `ConvStore.deletePipelineTemplate`, `ConvStore.createPipelineConversation`, `ConvStore.createMessage`
- Produces: `pipeline:list`, `pipeline:save`, `pipeline:delete`, `pipeline:run`, `pipeline:abort` handlers registered

- [ ] **Step 1: Add pipeline handler imports and registrations to `src/main/ipc.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { pipelineRunner } from './pipeline/runner'
```

Add the following handlers inside `registerIpcHandlers`, after the existing `WIZARD_DONE` handler:

```typescript
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
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: register pipeline IPC handlers in main process"
```

---

### Task 5: Renderer IPC Client and usePipelines Hook

**Files:**
- Modify: `src/renderer/ipc.ts`
- Create: `src/renderer/hooks/usePipelines.ts`

**Interfaces:**
- Consumes: `IPC.PIPELINE_*` constants; `PipelineTemplate`, `PipelineChunk` types
- Produces:
  - `listPipelineTemplates()` → `Promise<PipelineTemplate[]>`
  - `savePipelineTemplate(...)` → `Promise<PipelineTemplate>`
  - `deletePipelineTemplate(id)` → `Promise<void>`
  - `runPipeline(payload)` → `Promise<string>` (returns conversationId)
  - `abortPipeline(conversationId)` → `Promise<void>`
  - `onPipelineChunk(cb)` → cleanup function
  - `onPipelineStepDone(cb)` → cleanup function
  - `onPipelineDone(cb)` → cleanup function
  - `usePipelines()` hook → `{ templates, save, remove }`

- [ ] **Step 1: Add pipeline functions to `src/renderer/ipc.ts`**

Append to the end of `src/renderer/ipc.ts`:

```typescript
import type { PipelineTemplate, PipelineChunk } from '../shared/types'

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
```

- [ ] **Step 2: Create `src/renderer/hooks/usePipelines.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { listPipelineTemplates, savePipelineTemplate, deletePipelineTemplate } from '../ipc'
import type { PipelineTemplate } from '../../shared/types'

export function usePipelines() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])

  useEffect(() => {
    listPipelineTemplates().then(setTemplates)
  }, [])

  const save = useCallback(async (p: {
    id?: string
    name: string
    steps: Array<{ id?: string; stepOrder: number; backendId: string; personaId: string | null }>
  }) => {
    const saved = await savePipelineTemplate(p)
    setTemplates(prev =>
      p.id
        ? prev.map(t => t.id === p.id ? saved : t)
        : [...prev, saved]
    )
    return saved
  }, [])

  const remove = useCallback(async (id: string) => {
    await deletePipelineTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  return { templates, save, remove }
}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc.ts src/renderer/hooks/usePipelines.ts
git commit -m "feat: pipeline renderer IPC client and usePipelines hook"
```

---

### Task 6: PipelinePanel UI Component

**Files:**
- Create: `src/renderer/components/Pipelines/PipelinePanel.tsx`

**Interfaces:**
- Consumes: `usePipelines`, `BackendInfo` (for backend picker), `Persona` (for persona picker)
- Produces: `PipelinePanel` component — `{ onSelect: (template: PipelineTemplate) => void, activeTemplateId: string | null }`

- [ ] **Step 1: Create `src/renderer/components/Pipelines/PipelinePanel.tsx`**

```tsx
import { useState } from 'react'
import { usePipelines } from '../../hooks/usePipelines'
import { usePersonas } from '../../hooks/usePersonas'
import { useBackends } from '../../hooks/useBackends'
import type { PipelineTemplate, PipelineStep } from '../../../../shared/types'

interface EditingStep {
  stepOrder: number
  backendId: string
  personaId: string | null
}

interface EditingTemplate {
  id?: string
  name: string
  steps: EditingStep[]
}

interface Props {
  activeTemplateId: string | null
  onSelect: (template: PipelineTemplate) => void
}

export function PipelinePanel({ activeTemplateId, onSelect }: Props) {
  const { templates, save, remove } = usePipelines()
  const { personas } = usePersonas()
  const { backends } = useBackends()
  const [editing, setEditing] = useState<EditingTemplate | null>(null)

  const startNew = () =>
    setEditing({
      name: '',
      steps: [
        { stepOrder: 0, backendId: backends[0]?.id ?? 'claude', personaId: null },
        { stepOrder: 1, backendId: backends[0]?.id ?? 'claude', personaId: null },
      ],
    })

  const cancel = () => setEditing(null)

  const submit = async () => {
    if (!editing?.name || editing.steps.length < 2) return
    await save({ id: editing.id, name: editing.name, steps: editing.steps })
    setEditing(null)
  }

  const addStep = () => {
    if (!editing) return
    setEditing(prev => prev ? {
      ...prev,
      steps: [...prev.steps, { stepOrder: prev.steps.length, backendId: backends[0]?.id ?? 'claude', personaId: null }],
    } : null)
  }

  const removeStep = (idx: number) => {
    if (!editing || editing.steps.length <= 2) return
    setEditing(prev => prev ? {
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i })),
    } : null)
  }

  const moveStep = (idx: number, dir: -1 | 1) => {
    if (!editing) return
    const steps = [...editing.steps]
    const target = idx + dir
    if (target < 0 || target >= steps.length) return
    ;[steps[idx], steps[target]] = [steps[target], steps[idx]]
    setEditing({ ...editing, steps: steps.map((s, i) => ({ ...s, stepOrder: i })) })
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Pipelines</h3>
        <button
          onClick={startNew}
          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      {templates.map(t => (
        <div
          key={t.id}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${
            activeTemplateId === t.id
              ? 'bg-blue-100 dark:bg-blue-900'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          onClick={() => onSelect(t)}
        >
          <div>
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-gray-400">{t.steps.length} steps</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={e => { e.stopPropagation(); setEditing({ id: t.id, name: t.name, steps: t.steps.map(s => ({ stepOrder: s.stepOrder, backendId: s.backendId, personaId: s.personaId })) }) }}
              className="text-xs text-gray-400 hover:text-gray-700 px-1"
            >
              Edit
            </button>
            <button
              onClick={e => { e.stopPropagation(); remove(t.id) }}
              className="text-xs text-red-400 hover:text-red-600 px-1"
            >
              Del
            </button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <input
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Template name"
            value={editing.name}
            onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : null)}
          />

          <div className="flex flex-col gap-1">
            {editing.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                <select
                  className="text-xs border rounded px-1 py-1 dark:bg-gray-800 dark:border-gray-600 flex-1"
                  value={step.backendId}
                  onChange={e => setEditing(prev => {
                    if (!prev) return null
                    const steps = [...prev.steps]
                    steps[idx] = { ...steps[idx], backendId: e.target.value }
                    return { ...prev, steps }
                  })}
                >
                  {backends.map(b => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
                <select
                  className="text-xs border rounded px-1 py-1 dark:bg-gray-800 dark:border-gray-600 flex-1"
                  value={step.personaId ?? ''}
                  onChange={e => setEditing(prev => {
                    if (!prev) return null
                    const steps = [...prev.steps]
                    steps[idx] = { ...steps[idx], personaId: e.target.value || null }
                    return { ...prev, steps }
                  })}
                >
                  <option value="">No persona</option>
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={() => moveStep(idx, -1)} className="text-xs text-gray-400 hover:text-gray-600 px-1">↑</button>
                <button onClick={() => moveStep(idx, 1)} className="text-xs text-gray-400 hover:text-gray-600 px-1">↓</button>
                <button
                  onClick={() => removeStep(idx)}
                  disabled={editing.steps.length <= 2}
                  className="text-xs text-red-400 hover:text-red-600 px-1 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addStep}
            className="text-xs text-blue-500 hover:text-blue-700 text-left"
          >
            + Add step
          </button>

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!editing.name || editing.steps.length < 2}
              className="flex-1 text-sm py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={cancel}
              className="flex-1 text-sm py-1 rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Pipelines/PipelinePanel.tsx
git commit -m "feat: PipelinePanel UI for template management"
```

---

### Task 7: usePipelineMessages Hook and ChatView Step Tabs

**Files:**
- Create: `src/renderer/hooks/usePipelineMessages.ts`
- Modify: `src/renderer/components/Chat/ChatView.tsx`

**Interfaces:**
- Consumes: `runPipeline`, `abortPipeline`, `onPipelineChunk`, `onPipelineStepDone`, `onPipelineDone` from renderer IPC; `PipelineTemplate`, `Message` types
- Produces:
  - `usePipelineMessages(conversationId, template)` → `{ stepMessages, streamingStepIndex, activeTabIndex, setActiveTabIndex, send, abort }`
  - `ChatView` — accepts optional `pipelineTemplate?: PipelineTemplate` prop; renders step tabs when set

- [ ] **Step 1: Create `src/renderer/hooks/usePipelineMessages.ts`**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getConversation,
  runPipeline,
  abortPipeline,
  onPipelineChunk,
  onPipelineStepDone,
  onPipelineDone,
} from '../ipc'
import type { Message, PipelineTemplate } from '../../shared/types'

export function usePipelineMessages(conversationId: string | null, template: PipelineTemplate) {
  const [stepMessages, setStepMessages] = useState<Record<number, Message[]>>({})
  const [streamingStepIndex, setStreamingStepIndex] = useState<number | null>(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const streamingContent = useRef<Record<number, string>>({})
  const currentConvId = useRef<string | null>(null)

  // Load history when conversation changes
  useEffect(() => {
    if (!conversationId) { setStepMessages({}); return }
    getConversation(conversationId).then(({ messages }) => {
      const grouped: Record<number, Message[]> = {}
      for (const m of messages) {
        if (m.role === 'user') continue
        const idx = m.stepIndex ?? 0
        if (!grouped[idx]) grouped[idx] = []
        grouped[idx].push(m)
      }
      setStepMessages(grouped)
    })
  }, [conversationId])

  // Listen for pipeline streaming events
  useEffect(() => {
    const offChunk = onPipelineChunk(({ stepIndex, type, content, conversationId: cid }) => {
      if (type !== 'text') return
      if (!streamingContent.current[stepIndex]) streamingContent.current[stepIndex] = ''
      streamingContent.current[stepIndex] += content
      const accumulated = streamingContent.current[stepIndex]
      setStepMessages(prev => ({
        ...prev,
        [stepIndex]: [
          ...(prev[stepIndex]?.filter(m => m.id !== `streaming-${stepIndex}`) ?? []),
          {
            id: `streaming-${stepIndex}`,
            conversationId: cid,
            role: 'assistant',
            content: accumulated,
            backend: template.steps[stepIndex]?.backendId ?? '',
            stepIndex,
            createdAt: Date.now(),
          } as Message,
        ],
      }))
    })

    const offStepDone = onPipelineStepDone(({ stepIndex }) => {
      setStreamingStepIndex(stepIndex + 1 < template.steps.length ? stepIndex + 1 : null)
      setActiveTabIndex(stepIndex + 1 < template.steps.length ? stepIndex + 1 : stepIndex)
      streamingContent.current[stepIndex] = ''
    })

    const offDone = onPipelineDone(() => {
      setStreamingStepIndex(null)
      streamingContent.current = {}
    })

    return () => { offChunk(); offStepDone(); offDone() }
  }, [template])

  const send = useCallback(async (message: string) => {
    setStreamingStepIndex(0)
    setActiveTabIndex(0)
    streamingContent.current = {}
    // Initialize empty placeholders for all steps
    const initial: Record<number, Message[]> = {}
    template.steps.forEach((_, i) => { initial[i] = [] })
    setStepMessages(initial)

    const newConvId = await runPipeline({
      conversationId,
      message,
      templateId: template.id,
    })
    currentConvId.current = newConvId
    return newConvId
  }, [conversationId, template])

  const abort = useCallback(() => {
    if (currentConvId.current) abortPipeline(currentConvId.current)
    setStreamingStepIndex(null)
  }, [])

  return { stepMessages, streamingStepIndex, activeTabIndex, setActiveTabIndex, send, abort }
}
```

- [ ] **Step 2: Update `src/renderer/components/Chat/ChatView.tsx`**

Replace the entire file with:

```tsx
import { useMessages } from '../../hooks/useMessages'
import { usePipelineMessages } from '../../hooks/usePipelineMessages'
import { MessageList } from './MessageList'
import { InputBar } from './InputBar'
import type { PipelineTemplate } from '../../../../shared/types'

interface Props {
  conversationId: string | null
  backend: string
  personaId?: string
  pipelineTemplate?: PipelineTemplate
  onNewConversation: (id: string) => void
}

export function ChatView({ conversationId, backend, personaId, pipelineTemplate, onNewConversation }: Props) {
  if (pipelineTemplate) {
    return (
      <PipelineChatView
        conversationId={conversationId}
        template={pipelineTemplate}
        onNewConversation={onNewConversation}
      />
    )
  }
  return (
    <SingleChatView
      conversationId={conversationId}
      backend={backend}
      personaId={personaId}
      onNewConversation={onNewConversation}
    />
  )
}

function SingleChatView({ conversationId, backend, personaId, onNewConversation }: Omit<Props, 'pipelineTemplate'>) {
  const { messages, streaming, send, abort } = useMessages(conversationId)

  const handleSend = async (message: string) => {
    const newId = await send(message, backend, personaId)
    if (!conversationId && newId) onNewConversation(newId)
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Start a conversation
        </div>
      )}
      {(messages.length > 0 || streaming) && (
        <MessageList messages={messages} streaming={streaming} />
      )}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  )
}

function PipelineChatView({ conversationId, template, onNewConversation }: {
  conversationId: string | null
  template: PipelineTemplate
  onNewConversation: (id: string) => void
}) {
  const { stepMessages, streamingStepIndex, activeTabIndex, setActiveTabIndex, send, abort } = usePipelineMessages(conversationId, template)
  const streaming = streamingStepIndex !== null

  const handleSend = async (message: string) => {
    const newId = await send(message)
    if (!conversationId && newId) onNewConversation(newId)
  }

  const activeMessages = stepMessages[activeTabIndex] ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Step tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {template.steps.map((step, i) => (
          <button
            key={i}
            onClick={() => !streaming && setActiveTabIndex(i)}
            className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
              activeTabIndex === i
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            } ${streaming && streamingStepIndex !== i ? 'opacity-50' : ''}`}
          >
            {step.backendId}
            {streamingStepIndex === i && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Messages for active tab */}
      {activeMessages.length === 0 && !streaming && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          {Object.keys(stepMessages).length === 0 ? 'Start a pipeline run' : 'No output for this step yet'}
        </div>
      )}
      {activeMessages.length > 0 && (
        <MessageList messages={activeMessages} streaming={streaming && streamingStepIndex === activeTabIndex} />
      )}

      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/hooks/usePipelineMessages.ts src/renderer/components/Chat/ChatView.tsx
git commit -m "feat: usePipelineMessages hook and ChatView step tabs"
```

---

### Task 8: App Root Integration

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx`

**Interfaces:**
- Consumes: `PipelinePanel`, `usePipelines`, `PipelineTemplate`, `getConversation`
- Produces: complete pipeline UX — mode toggle, template picker, PipelinePanel, chain icon in sidebar

- [ ] **Step 1: Update `src/renderer/components/Sidebar/ConvItem.tsx`**

Replace the entire file with:

```tsx
import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

export function ConvItem({ conversation, active, onClick }: Props) {
  const isPipeline = conversation.pipelineTemplateId !== null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700' : ''
      }`}
    >
      <div className="font-medium truncate flex items-center gap-1">
        {isPipeline && (
          <svg className="w-3 h-3 flex-shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-5-1h2v2H7V7zm0-4h2v2H7V3z" />
          </svg>
        )}
        <span className="truncate">{conversation.title}</span>
      </div>
      <div className="text-xs text-gray-400 flex gap-2">
        <span>{isPipeline ? 'pipeline' : conversation.backend}</span>
        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Update `src/renderer/App.tsx`**

Replace the entire file with:

```tsx
import { useState, useEffect } from 'react'
import { SetupWizard } from './components/Wizard/SetupWizard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { PersonaPanel } from './components/Personas/PersonaPanel'
import { PipelinePanel } from './components/Pipelines/PipelinePanel'
import { BackendSwitcher } from './components/BackendSwitcher'
import { usePipelines } from './hooks/usePipelines'
import { getConversation } from './ipc'
import type { PipelineTemplate, Conversation } from '../shared/types'

function App() {
  const [wizardDone, setWizardDone] = useState(() => localStorage.getItem('wizardDone') === '1')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvMeta, setActiveConvMeta] = useState<Conversation | null>(null)
  const [mode, setMode] = useState<'single' | 'pipeline'>('single')
  const [backend, setBackend] = useState('claude')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null)
  const [showPersonas, setShowPersonas] = useState(false)
  const [showPipelines, setShowPipelines] = useState(false)
  const { templates } = usePipelines()

  // Load metadata for active conversation to detect pipeline mode
  useEffect(() => {
    if (!activeConvId) { setActiveConvMeta(null); return }
    getConversation(activeConvId).then(({ conversation }) => setActiveConvMeta(conversation))
  }, [activeConvId])

  // Derive the active pipeline template from loaded conversation meta or toolbar selection
  const activePipelineTemplate: PipelineTemplate | undefined = (() => {
    const templateId = activeConvMeta?.pipelineTemplateId ?? (mode === 'pipeline' ? selectedTemplate?.id : null)
    if (!templateId) return undefined
    return templates.find(t => t.id === templateId) ?? selectedTemplate ?? undefined
  })()

  const handleNew = () => {
    setActiveConvId(null)
    setActiveConvMeta(null)
  }

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={id => setActiveConvId(id)}
        onNew={handleNew}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              onClick={() => { setMode('single'); setSelectedTemplate(null) }}
              className={`px-3 py-1 ${mode === 'single' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Single
            </button>
            <button
              onClick={() => setMode('pipeline')}
              className={`px-3 py-1 ${mode === 'pipeline' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Pipeline
            </button>
          </div>

          {mode === 'single' && !activeConvMeta?.pipelineTemplateId && (
            <BackendSwitcher value={backend} onChange={setBackend} />
          )}

          {(mode === 'pipeline' || activeConvMeta?.pipelineTemplateId) && (
            <select
              className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
              value={activePipelineTemplate?.id ?? ''}
              onChange={e => {
                const t = templates.find(x => x.id === e.target.value)
                setSelectedTemplate(t ?? null)
              }}
              disabled={!!activeConvMeta?.pipelineTemplateId}
            >
              <option value="">Select pipeline…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => { setShowPersonas(v => !v); setShowPipelines(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 ml-auto"
          >
            Personas
          </button>
          <button
            onClick={() => { setShowPipelines(v => !v); setShowPersonas(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Pipelines
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <ChatView
            conversationId={activeConvId}
            backend={backend}
            personaId={personaId ?? undefined}
            pipelineTemplate={activePipelineTemplate}
            onNewConversation={id => setActiveConvId(id)}
          />
          {showPersonas && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PersonaPanel activePersonaId={personaId} onSelect={setPersonaId} />
            </div>
          )}
          {showPipelines && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={t => { setSelectedTemplate(t); setMode('pipeline') }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/Sidebar/ConvItem.tsx
git commit -m "feat: pipeline mode toggle, template picker, PipelinePanel, and chain icon"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| `pipeline_templates` + `pipeline_steps` tables | Task 2 |
| `conversations.pipeline_template_id` column | Task 2 |
| `messages.step_index` column | Task 2 |
| Migration via `.sql` file | Task 2 |
| `PipelineRunner` with step sequencing | Task 3 |
| Accumulated text passed to next step | Task 3 |
| Abort stops at current step | Task 3 |
| Error handling: adapter failure stops pipeline | Task 3 |
| 8 new IPC channels | Task 1 + Task 4 |
| IPC handler resolves templateId → steps | Task 4 |
| Minimum 2-step validation (backend) | Task 4 |
| `pipeline:list/save/delete` handlers | Task 4 |
| Renderer IPC wrappers | Task 5 |
| `usePipelines` hook | Task 5 |
| `PipelinePanel` with inline edit form, step reorder, min-2 UI | Task 6 |
| Step tabs above message list | Task 7 |
| Active step streaming indicator | Task 7 |
| Input locked during pipeline run | Task 7 (streaming prop on InputBar) |
| Chain icon in sidebar | Task 8 |
| Mode toggle (Single / Pipeline) in toolbar | Task 8 |
| Template picker in toolbar | Task 8 |

**No placeholders found.**

**Type consistency:** `PipelineChunk` defined in Task 1 and consumed in Tasks 3, 4, 5, 7. `PipelineTemplate.steps` uses `PipelineStep[]` consistently. `Message.stepIndex: number | null` introduced in Task 1, stored in Task 2, used in Tasks 7.
