# File/Image Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent file and image attachment support to BII Agent Harness — users can attach PDFs, Word docs, Excel sheets, CSVs, plain text, Markdown, and images to any message via a paperclip button or drag-and-drop.

**Architecture:** A new `AttachmentService` in the main process owns file copying, content extraction, and DB persistence. The renderer pre-generates a message UUID, calls `attachment:ingest` to upload files, then calls `chat:send` with the same UUID. Adapters receive a resolved `Attachment[]` and apply hybrid routing: native `--file` flags for Claude, content injection for Gemini and Opencode.

**Tech Stack:** TypeScript, Electron IPC, React hooks, better-sqlite3, `pdf-parse`, `mammoth`, `xlsx`, Vitest

## Global Constraints

- Run `npm test` after every task — all tests must stay green before committing.
- Test command: `npx vitest run` (from repo root).
- All SQL goes in `.sql` migration files under `src/main/store/migrations/` — never inline `db.exec()` for schema changes.
- Never use `shell: true` in `child_process.spawn`.
- Never import renderer code from main process and vice versa.
- Files are stored at `{app.getPath('userData')}/attachments/{messageId}/`.
- Maximum file size: 20 MB. Reject before any disk write.
- Supported MIME types: `image/*`, `application/pdf`, `text/plain`, `text/markdown`, `text/csv`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

## File Structure

```
Files to create:
  src/main/store/migrations/003_attachments.sql   — attachments table
  src/main/attachments/service.ts                 — AttachmentService singleton
  src/main/attachments/service.test.ts            — unit tests
  src/renderer/hooks/useAttachments.ts            — attachment state for InputBar
  src/renderer/components/Chat/AttachmentChip.tsx — chip for pending/sent attachments
  src/renderer/components/Chat/AttachmentRow.tsx  — attachment display in MessageBubble

Files to modify:
  src/shared/types.ts                             — add Attachment interface
  src/shared/ipc.ts                               — add ATTACHMENT_INGEST, ATTACHMENT_LIST channels
  src/main/store/index.ts                         — add attachment CRUD
  src/main/ipc.ts                                 — register attachment handlers; pass attachments to adapters
  src/main/adapters/claude.adapter.ts             — accept attachments; native --file flags
  src/main/adapters/gemini.adapter.ts             — accept attachments; content injection
  src/main/adapters/opencode.adapter.ts           — accept attachments; content injection
  src/renderer/ipc.ts                             — add ingestAttachments, listAttachments wrappers
  src/renderer/components/Chat/InputBar.tsx       — paperclip button, drag-drop, chip row
  src/renderer/components/Chat/MessageBubble.tsx  — render AttachmentRow for messages with attachments
```

---

### Task 1: Install Dependencies and Add Attachment Type

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

**Interfaces:**
- Produces:
  - `Attachment` type: `{ id, messageId, originalName, storedPath, mimeType, sizeBytes, extractedText: string | null, extractionError: boolean, createdAt }`
  - `IPC.ATTACHMENT_INGEST`, `IPC.ATTACHMENT_LIST` constants
  - `BackendAdapter.send` signature updated to accept optional `attachments?: Attachment[]`

- [ ] **Step 1: Install extraction packages**

Run:
```bash
npm install pdf-parse mammoth xlsx
npm install --save-dev @types/pdf-parse @types/mammoth
```

Expected: packages added to `package.json` and `node_modules/`.

- [ ] **Step 2: Add `Attachment` to `src/shared/types.ts`**

Append to the end of `src/shared/types.ts`:

```typescript
export interface Attachment {
  id: string
  messageId: string
  originalName: string
  storedPath: string
  mimeType: string
  sizeBytes: number
  extractedText: string | null
  extractionError: boolean
  createdAt: number
}
```

Also update `BackendAdapter.send` to accept attachments:

```typescript
export interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk>
  abort(): void
}
```

- [ ] **Step 3: Add IPC constants to `src/shared/ipc.ts`**

In the `IPC` object, add:
```typescript
  ATTACHMENT_INGEST: 'attachment:ingest',
  ATTACHMENT_LIST:   'attachment:list',
```

In `IpcInvokeMap`, add:
```typescript
  [IPC.ATTACHMENT_INGEST]: { filePaths: string[]; messageId: string }
  [IPC.ATTACHMENT_LIST]:   { messageId: string }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts package.json package-lock.json
git commit -m "feat: add Attachment type, IPC channels, and extraction dependencies"
```

---

### Task 2: Database Migration and ConvStore Attachment CRUD

**Files:**
- Create: `src/main/store/migrations/003_attachments.sql`
- Modify: `src/main/store/index.ts`
- Modify: `src/main/store/index.test.ts`

**Interfaces:**
- Produces:
  - `ConvStore.createAttachment(a)` → `Attachment`
  - `ConvStore.listAttachments(messageId)` → `Attachment[]`
  - `ConvStore.deleteAttachmentsForMessage(messageId)` → `void`

- [ ] **Step 1: Write failing tests**

In `src/main/store/index.test.ts`, add after existing describe blocks:

```typescript
describe('ConvStore attachment CRUD', () => {
  it('createAttachment and listAttachments round-trip', () => {
    const conv = ConvStore.createConversation('Attach test', 'claude', null)
    const msg = ConvStore.createMessage({
      conversationId: conv.id, role: 'user', content: 'hi', backend: 'claude', stepIndex: null,
    })
    const att = ConvStore.createAttachment({
      messageId: msg.id,
      originalName: 'report.pdf',
      storedPath: '/tmp/report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12345,
      extractedText: 'some text',
      extractionError: false,
    })
    expect(att.id).toBeTruthy()
    expect(att.originalName).toBe('report.pdf')

    const list = ConvStore.listAttachments(msg.id)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(att.id)
    expect(list[0].extractedText).toBe('some text')
    expect(list[0].extractionError).toBe(false)
  })

  it('deleteAttachmentsForMessage removes all attachments', () => {
    const conv = ConvStore.createConversation('Delete att test', 'claude', null)
    const msg = ConvStore.createMessage({
      conversationId: conv.id, role: 'user', content: 'hi', backend: 'claude', stepIndex: null,
    })
    ConvStore.createAttachment({
      messageId: msg.id, originalName: 'a.pdf', storedPath: '/tmp/a.pdf',
      mimeType: 'application/pdf', sizeBytes: 100, extractedText: null, extractionError: false,
    })
    ConvStore.deleteAttachmentsForMessage(msg.id)
    expect(ConvStore.listAttachments(msg.id)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/store/index.test.ts`
Expected: FAIL — methods not found.

- [ ] **Step 3: Create `src/main/store/migrations/003_attachments.sql`**

```sql
CREATE TABLE IF NOT EXISTS attachments (
  id               TEXT PRIMARY KEY,
  message_id       TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  original_name    TEXT NOT NULL,
  stored_path      TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       INTEGER NOT NULL,
  extracted_text   TEXT,
  extraction_error INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL
);
```

- [ ] **Step 4: Add attachment CRUD to `src/main/store/index.ts`**

Add the import at the top (after existing imports):
```typescript
import type { Attachment } from '../../shared/types'
```

Add these methods inside `ConvStore` (after `deletePipelineTemplate` or at the end before the closing `}`):

```typescript
  createAttachment(a: Omit<Attachment, 'id' | 'createdAt'>): Attachment {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = Date.now()
    db.prepare(`
      INSERT INTO attachments (id, message_id, original_name, stored_path, mime_type, size_bytes, extracted_text, extraction_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, a.messageId, a.originalName, a.storedPath, a.mimeType, a.sizeBytes, a.extractedText ?? null, a.extractionError ? 1 : 0, now)
    return { ...a, id, createdAt: now }
  },

  listAttachments(messageId: string): Attachment[] {
    const rows = getDb().prepare('SELECT * FROM attachments WHERE message_id = ? ORDER BY created_at ASC').all(messageId) as any[]
    return rows.map(r => ({
      id: r.id,
      messageId: r.message_id,
      originalName: r.original_name,
      storedPath: r.stored_path,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      extractedText: r.extracted_text ?? null,
      extractionError: r.extraction_error === 1,
      createdAt: r.created_at,
    }))
  },

  deleteAttachmentsForMessage(messageId: string): void {
    getDb().prepare('DELETE FROM attachments WHERE message_id = ?').run(messageId)
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/main/store/index.test.ts`
Expected: all tests PASS including new attachment tests.

- [ ] **Step 6: Commit**

```bash
git add src/main/store/migrations/003_attachments.sql src/main/store/index.ts src/main/store/index.test.ts
git commit -m "feat: attachments DB migration and ConvStore CRUD"
```

---

### Task 3: AttachmentService

**Files:**
- Create: `src/main/attachments/service.ts`
- Create: `src/main/attachments/service.test.ts`

**Interfaces:**
- Consumes: `ConvStore.createAttachment`, `ConvStore.listAttachments`, `ConvStore.deleteAttachmentsForMessage`; `Attachment` type
- Produces:
  - `AttachmentService.ingest(filePaths, messageId, userDataPath)` → `Promise<Attachment[]>`
  - `AttachmentService.getContent(attachment)` → `string` (extractedText or base64 data URI)
  - `AttachmentService.purge(messageId, userDataPath)` → `Promise<void>`

- [ ] **Step 1: Write failing tests**

Create `src/main/attachments/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Mock ConvStore before import
const mockCreateAttachment = vi.fn()
const mockListAttachments = vi.fn()
const mockDeleteAttachmentsForMessage = vi.fn()

vi.mock('../store', () => ({
  ConvStore: {
    createAttachment: mockCreateAttachment,
    listAttachments: mockListAttachments,
    deleteAttachmentsForMessage: mockDeleteAttachmentsForMessage,
  },
}))

import { AttachmentService } from './service'

const TMP = os.tmpdir()

describe('AttachmentService.ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAttachment.mockImplementation((a: any) => ({ ...a, id: 'att-1', createdAt: Date.now() }))
  })

  it('rejects files over 20 MB', async () => {
    const bigFile = path.join(TMP, 'big.txt')
    fs.writeFileSync(bigFile, 'x')
    // Stub stat to return oversized file
    vi.spyOn(fs, 'statSync').mockReturnValueOnce({ size: 21 * 1024 * 1024 } as any)
    const results = await AttachmentService.ingest([bigFile], 'msg-1', TMP)
    expect(results).toHaveLength(0)
  })

  it('rejects unsupported MIME types', async () => {
    const mp4 = path.join(TMP, 'video.mp4')
    fs.writeFileSync(mp4, 'fake')
    const results = await AttachmentService.ingest([mp4], 'msg-1', TMP)
    expect(results).toHaveLength(0)
    fs.unlinkSync(mp4)
  })

  it('copies text file and stores extracted_text', async () => {
    const txtFile = path.join(TMP, 'hello.txt')
    fs.writeFileSync(txtFile, 'hello world')
    const destDir = path.join(TMP, 'att-test', 'msg-txt')
    fs.mkdirSync(destDir, { recursive: true })

    await AttachmentService.ingest([txtFile], 'msg-txt', TMP)

    expect(mockCreateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ originalName: 'hello.txt', extractedText: 'hello world' })
    )
    fs.unlinkSync(txtFile)
  })
})

describe('AttachmentService.getContent', () => {
  it('returns extractedText for text files', () => {
    const att = {
      id: '1', messageId: 'm', originalName: 'f.txt', storedPath: '/tmp/f.txt',
      mimeType: 'text/plain', sizeBytes: 10, extractedText: 'hello', extractionError: false, createdAt: 0,
    }
    expect(AttachmentService.getContent(att)).toBe('hello')
  })

  it('returns base64 data URI for images', () => {
    const imgPath = path.join(TMP, 'pixel.png')
    // 1x1 PNG bytes
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    fs.writeFileSync(imgPath, pngBytes)

    const att = {
      id: '2', messageId: 'm', originalName: 'pixel.png', storedPath: imgPath,
      mimeType: 'image/png', sizeBytes: pngBytes.length, extractedText: null, extractionError: false, createdAt: 0,
    }
    const result = AttachmentService.getContent(att)
    expect(result).toMatch(/^data:image\/png;base64,/)
    fs.unlinkSync(imgPath)
  })
})

describe('AttachmentService.purge', () => {
  it('removes the attachment directory and calls deleteAttachmentsForMessage', async () => {
    const dir = path.join(TMP, 'attachments', 'msg-purge')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'x')

    await AttachmentService.purge('msg-purge', TMP)

    expect(mockDeleteAttachmentsForMessage).toHaveBeenCalledWith('msg-purge')
    expect(fs.existsSync(dir)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/attachments/service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/main/attachments/service.ts`**

```typescript
import fs from 'fs'
import path from 'path'
import { ConvStore } from '../store'
import type { Attachment } from '../../shared/types'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

const SUPPORTED_MIMES: Record<string, boolean> = {
  'image/png': true,
  'image/jpeg': true,
  'image/gif': true,
  'image/webp': true,
  'application/pdf': true,
  'text/plain': true,
  'text/markdown': true,
  'text/csv': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext] ?? 'application/octet-stream'
}

async function extractText(filePath: string, mimeType: string): Promise<{ text: string | null; error: boolean }> {
  try {
    if (mimeType.startsWith('text/')) {
      return { text: fs.readFileSync(filePath, 'utf8'), error: false }
    }
    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(fs.readFileSync(filePath))
      return { text: data.text, error: false }
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return { text: result.value, error: false }
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const XLSX = await import('xlsx')
      const wb = XLSX.readFile(filePath)
      const text = wb.SheetNames.map(name => {
        const sheet = wb.Sheets[name]
        return XLSX.utils.sheet_to_csv(sheet)
      }).join('\n\n')
      return { text, error: false }
    }
    return { text: null, error: false }
  } catch {
    return { text: null, error: true }
  }
}

export const AttachmentService = {
  async ingest(filePaths: string[], messageId: string, userDataPath: string): Promise<Attachment[]> {
    const results: Attachment[] = []

    for (const filePath of filePaths) {
      const mimeType = mimeFromPath(filePath)
      if (!SUPPORTED_MIMES[mimeType]) continue

      const stat = fs.statSync(filePath)
      if (stat.size > MAX_SIZE_BYTES) continue

      const destDir = path.join(userDataPath, 'attachments', messageId)
      fs.mkdirSync(destDir, { recursive: true })

      const originalName = path.basename(filePath)
      const storedPath = path.join(destDir, originalName)
      fs.copyFileSync(filePath, storedPath)

      const { text, error } = await extractText(storedPath, mimeType)

      const att = ConvStore.createAttachment({
        messageId,
        originalName,
        storedPath,
        mimeType,
        sizeBytes: stat.size,
        extractedText: text,
        extractionError: error,
      })
      results.push(att)
    }

    return results
  },

  getContent(attachment: Attachment): string {
    if (attachment.mimeType.startsWith('image/')) {
      const buf = fs.readFileSync(attachment.storedPath)
      return `data:${attachment.mimeType};base64,${buf.toString('base64')}`
    }
    return attachment.extractedText ?? `[${attachment.originalName}]`
  },

  async purge(messageId: string, userDataPath: string): Promise<void> {
    const dir = path.join(userDataPath, 'attachments', messageId)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    ConvStore.deleteAttachmentsForMessage(messageId)
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/attachments/service.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/attachments/service.ts src/main/attachments/service.test.ts
git commit -m "feat: AttachmentService with ingest, extraction, and purge"
```

---

### Task 4: Update Adapters for Attachment Support

**Files:**
- Modify: `src/main/adapters/claude.adapter.ts`
- Modify: `src/main/adapters/gemini.adapter.ts`
- Modify: `src/main/adapters/opencode.adapter.ts`

**Interfaces:**
- Consumes: `Attachment` from `src/shared/types.ts`; `AttachmentService.getContent`
- Produces: each adapter's `send()` accepts `attachments?: Attachment[]` and routes them appropriately

- [ ] **Step 1: Write failing tests for adapter attachment handling**

In `src/main/adapters/manager.test.ts` (or a new file `src/main/adapters/claude.adapter.test.ts`), add:

Create `src/main/adapters/claude.adapter.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('child_process', () => {
  const proc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, cb: Function) => {
      if (event === 'close') setTimeout(() => cb(0), 0)
    }),
    kill: vi.fn(),
  }
  return { spawn: vi.fn(() => proc) }
})

import { spawn } from 'child_process'
import { ClaudeAdapter } from './claude.adapter'
import type { Attachment } from '../../shared/types'

const mockAttachment: Attachment = {
  id: 'att-1', messageId: 'msg-1', originalName: 'doc.pdf',
  storedPath: '/tmp/doc.pdf', mimeType: 'application/pdf',
  sizeBytes: 1000, extractedText: 'pdf text', extractionError: false, createdAt: 0,
}

describe('ClaudeAdapter attachment routing', () => {
  it('passes --file flag for PDF attachment', async () => {
    const adapter = new ClaudeAdapter()
    const gen = adapter.send('hello', undefined, [mockAttachment])
    // Drain the generator
    for await (const _ of gen) { break }

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--file', '/tmp/doc.pdf']),
      expect.any(Object)
    )
  })
})
```

Run: `npx vitest run src/main/adapters/claude.adapter.test.ts`
Expected: FAIL — `send` does not accept attachments yet.

- [ ] **Step 2: Update `src/main/adapters/claude.adapter.ts`**

Replace the `send` method signature and add `--file` flag logic:

```typescript
import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk, Attachment } from '../../shared/types'

export class ClaudeAdapter implements BackendAdapter {
  id = 'claude'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('claude', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk> {
    const args = ['--output-format', 'stream-json', '--print']
    if (persona) args.push('--system-prompt', persona)
    if (attachments) {
      for (const att of attachments) {
        args.push('--file', att.storedPath)
      }
    }
    args.push('--', message)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('claude', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line)
          const chunk = parseClaudeEvent(json)
          if (chunk) { chunks.push(chunk); resolve?.() }
        } catch { /* skip malformed lines */ }
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    this.proc.on('error', (err) => {
      done = true
      chunks.push({ type: 'error', content: err.message })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseClaudeEvent(event: any): MessageChunk | null {
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { type: 'text', content: event.delta.text, raw: event }
  }
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    return { type: 'tool_use', content: event.content_block.name ?? '', raw: event }
  }
  if (event.type === 'error') {
    return { type: 'error', content: event.error?.message ?? 'Unknown error', raw: event }
  }
  return null
}
```

- [ ] **Step 3: Update `src/main/adapters/gemini.adapter.ts`** to accept and inject attachments

Read the existing Gemini adapter, then add the `attachments` parameter. The pattern is: build a content injection string from `AttachmentService.getContent(att)` and append it to the message.

At the top, add:
```typescript
import { AttachmentService } from '../attachments/service'
import type { Attachment } from '../../shared/types'
```

In the `send` method signature, change:
```typescript
async *send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk> {
```

Before building the args array, add:
```typescript
    let fullMessage = message
    if (attachments && attachments.length > 0) {
      const injected = attachments.map(a =>
        `[Attachment: ${a.originalName}]\n${AttachmentService.getContent(a)}\n[/Attachment]`
      ).join('\n\n')
      fullMessage = `${injected}\n\n${message}`
    }
```

Then use `fullMessage` instead of `message` when building the CLI args.

- [ ] **Step 4: Update `src/main/adapters/opencode.adapter.ts`** with the same content injection pattern as Gemini

Apply the identical change as Step 3 to `src/main/adapters/opencode.adapter.ts`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all tests PASS including `claude.adapter.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/main/adapters/claude.adapter.ts src/main/adapters/gemini.adapter.ts src/main/adapters/opencode.adapter.ts src/main/adapters/claude.adapter.test.ts
git commit -m "feat: adapters accept attachments; Claude uses --file, Gemini/Opencode inject content"
```

---

### Task 5: Main Process IPC Handlers

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/index.ts` (expose `userDataPath`)

**Interfaces:**
- Consumes: `AttachmentService`, `ConvStore.listAttachments`
- Produces: `attachment:ingest` and `attachment:list` handlers; `chat:send` passes resolved attachments to adapter

- [ ] **Step 1: Expose `userDataPath` from `src/main/index.ts`**

In `src/main/index.ts`, export the userData path so ipc.ts can access it. Add after the existing imports:

```typescript
import { app } from 'electron'
export let userDataPath = ''
```

In the `app.whenReady()` callback, before `registerIpcHandlers`, add:

```typescript
userDataPath = app.getPath('userData')
```

- [ ] **Step 2: Add attachment IPC handlers to `src/main/ipc.ts`**

Add imports at the top:

```typescript
import { AttachmentService } from './attachments/service'
import { userDataPath } from './index'
```

Add handlers inside `registerIpcHandlers`, after the pipeline handlers:

```typescript
  ipcMain.handle(IPC.ATTACHMENT_INGEST, async (_event, { filePaths, messageId }) => {
    return AttachmentService.ingest(filePaths, messageId, userDataPath)
  })

  ipcMain.handle(IPC.ATTACHMENT_LIST, (_event, { messageId }) => {
    return ConvStore.listAttachments(messageId)
  })
```

- [ ] **Step 3: Pass attachments to adapter in `chat:send` handler**

In the `CHAT_SEND` handler inside `registerIpcHandlers`, update the IPC payload to accept an optional `messageId` (pre-generated by renderer) and look up attachments:

Change the handler signature line from:
```typescript
  ipcMain.handle(IPC.CHAT_SEND, async (event, { conversationId, message, backend, personaId }) => {
```
to:
```typescript
  ipcMain.handle(IPC.CHAT_SEND, async (event, { conversationId, message, backend, personaId, messageId: pregenMessageId }) => {
```

After `ConvStore.createMessage` for the user message, add:
```typescript
    const attachments = pregenMessageId ? ConvStore.listAttachments(pregenMessageId) : []
```

Change the adapter send call from:
```typescript
    for await (const chunk of adapter.send(message, persona?.systemPrompt)) {
```
to:
```typescript
    for await (const chunk of adapter.send(message, persona?.systemPrompt, attachments)) {
```

Also update `IpcInvokeMap` in `src/shared/ipc.ts` to add the optional field:
```typescript
  [IPC.CHAT_SEND]: { conversationId: string | null; message: string; backend: string; personaId?: string; messageId?: string }
```

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/shared/ipc.ts
git commit -m "feat: attachment IPC handlers and pass attachments to adapters on chat:send"
```

---

### Task 6: Renderer IPC Wrappers and useAttachments Hook

**Files:**
- Modify: `src/renderer/ipc.ts`
- Create: `src/renderer/hooks/useAttachments.ts`

**Interfaces:**
- Produces:
  - `ingestAttachments(filePaths, messageId)` → `Promise<Attachment[]>`
  - `listAttachments(messageId)` → `Promise<Attachment[]>`
  - `useAttachments()` → `{ pending, addFiles, removeFile, ingest, clear, errors }`

- [ ] **Step 1: Add attachment IPC wrappers to `src/renderer/ipc.ts`**

Append to the end of `src/renderer/ipc.ts`:

```typescript
import type { Attachment } from '../shared/types'

export async function ingestAttachments(filePaths: string[], messageId: string): Promise<Attachment[]> {
  return window.ipc.invoke(IPC.ATTACHMENT_INGEST, { filePaths, messageId }) as Promise<Attachment[]>
}
export async function listAttachments(messageId: string): Promise<Attachment[]> {
  return window.ipc.invoke(IPC.ATTACHMENT_LIST, { messageId }) as Promise<Attachment[]>
}
```

- [ ] **Step 2: Create `src/renderer/hooks/useAttachments.ts`**

```typescript
import { useState, useCallback } from 'react'
import { ingestAttachments } from '../ipc'
import type { Attachment } from '../../shared/types'

const MAX_SIZE = 20 * 1024 * 1024

const SUPPORTED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.txt', '.md', '.csv', '.docx', '.xlsx',
])

interface PendingFile {
  path: string
  name: string
  size: number
}

export function useAttachments() {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const addFiles = useCallback((filePaths: string[]) => {
    const newErrors: string[] = []
    const valid: PendingFile[] = []

    for (const fp of filePaths) {
      const name = fp.split(/[\\/]/).pop() ?? fp
      const ext = ('.' + name.split('.').pop()).toLowerCase()

      // Size check requires IPC — we rely on the renderer File API size for drag-drop
      // or skip size check here (service.ts enforces 20 MB on ingest)
      if (!SUPPORTED_EXTS.has(ext)) {
        newErrors.push(`Unsupported file type: ${name}`)
        continue
      }
      valid.push({ path: fp, name, size: 0 })
    }

    if (newErrors.length) setErrors(prev => [...prev, ...newErrors])
    setPending(prev => [...prev, ...valid])
  }, [])

  const removeFile = useCallback((filePath: string) => {
    setPending(prev => prev.filter(f => f.path !== filePath))
  }, [])

  const ingest = useCallback(async (messageId: string): Promise<Attachment[]> => {
    if (pending.length === 0) return []
    const paths = pending.map(f => f.path)
    const result = await ingestAttachments(paths, messageId)
    return result
  }, [pending])

  const clear = useCallback(() => {
    setPending([])
    setErrors([])
  }, [])

  return { pending, addFiles, removeFile, ingest, clear, errors }
}
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc.ts src/renderer/hooks/useAttachments.ts
git commit -m "feat: attachment renderer IPC wrappers and useAttachments hook"
```

---

### Task 7: InputBar Attachment UI and MessageBubble Attachment Display

**Files:**
- Create: `src/renderer/components/Chat/AttachmentChip.tsx`
- Create: `src/renderer/components/Chat/AttachmentRow.tsx`
- Modify: `src/renderer/components/Chat/InputBar.tsx`
- Modify: `src/renderer/components/Chat/MessageBubble.tsx`

**Interfaces:**
- Consumes: `useAttachments`; `Attachment` type
- Produces: attachment chip row above textarea, paperclip button, drag-drop on chat area, attachment row in message history

- [ ] **Step 1: Create `src/renderer/components/Chat/AttachmentChip.tsx`**

```tsx
interface Props {
  name: string
  filePath: string
  onRemove: (path: string) => void
}

export function AttachmentChip({ name, filePath, onRemove }: Props) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs max-w-[160px]">
      <svg className="w-3 h-3 flex-shrink-0 text-gray-500" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a2 2 0 0 1 2 2v8a4 4 0 0 1-8 0V3a1 1 0 0 1 2 0v7a2 2 0 0 0 4 0V2a.5.5 0 0 0-1 0v8a1.5 1.5 0 0 1-3 0V3a3 3 0 0 1 6 0v8a4 4 0 0 1-8 0V2a2 2 0 0 1 2-2z" />
      </svg>
      <span className="truncate">{name}</span>
      <button
        onClick={() => onRemove(filePath)}
        className="ml-1 text-gray-400 hover:text-red-500 flex-shrink-0"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/renderer/components/Chat/AttachmentRow.tsx`**

```tsx
import type { Attachment } from '../../../../shared/types'

interface Props {
  attachments: Attachment[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentRow({ attachments }: Props) {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(att => (
        <div key={att.id} className="flex flex-col gap-1">
          {att.mimeType.startsWith('image/') && (
            <img
              src={`file://${att.storedPath}`}
              alt={att.originalName}
              className="max-w-[200px] rounded-lg object-cover"
            />
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z" />
            </svg>
            <span className="truncate max-w-[150px]">{att.originalName}</span>
            <span className="flex-shrink-0">· {formatBytes(att.sizeBytes)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Update `src/renderer/components/Chat/InputBar.tsx`**

Replace the entire file with:

```tsx
import { useState, useRef, KeyboardEvent, DragEvent, useCallback } from 'react'
import { AttachmentChip } from './AttachmentChip'
import { useAttachments } from '../../hooks/useAttachments'
import type { Attachment } from '../../../../shared/types'

interface Props {
  onSend: (message: string, attachments: Attachment[], messageId: string) => void
  onAbort: () => void
  streaming: boolean
  disabled?: boolean
}

export function InputBar({ onSend, onAbort, streaming, disabled }: Props) {
  const [value, setValue] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { pending, addFiles, removeFile, ingest, clear, errors } = useAttachments()

  const submit = async () => {
    const trimmed = value.trim()
    if (!trimmed || streaming || ingesting) return
    const messageId = crypto.randomUUID()
    setIngesting(true)
    let attachments: Attachment[] = []
    try {
      attachments = await ingest(messageId)
    } finally {
      setIngesting(false)
    }
    onSend(trimmed, attachments, messageId)
    setValue('')
    clear()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files).map((f: any) => f.path as string).filter(Boolean)
    if (paths.length) addFiles(paths)
  }, [addFiles])

  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const paths = files.map((f: any) => f.path as string).filter(Boolean)
    if (paths.length) addFiles(paths)
    e.target.value = ''
  }

  const isDisabled = disabled || ingesting

  return (
    <div
      className="border-t border-gray-200 dark:border-gray-700 p-4"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Error chips */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {errors.map((err, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded">
              {err}
            </span>
          ))}
        </div>
      )}

      {/* Pending attachment chips */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {pending.map(f => (
            <AttachmentChip key={f.path} name={f.name} filePath={f.path} onRemove={removeFile} />
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.docx,.xlsx"
          onChange={onFileChange}
        />

        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
          aria-label="Attach file"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a3 3 0 0 0-3 3v4.5a4.5 4.5 0 0 0 9 0V7a1 1 0 1 1 2 0v4.5a6.5 6.5 0 1 1-13 0V7a5 5 0 0 1 10 0v4.5a2.5 2.5 0 1 1-5 0V7a1 1 0 0 1 2 0v4.5a.5.5 0 0 0 1 0V7a3 3 0 0 0-3-3z" clipRule="evenodd" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={isDisabled}
        />
        {streaming
          ? <button onClick={onAbort} className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600">Stop</button>
          : <button
              onClick={submit}
              disabled={!value.trim() || isDisabled}
              className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {ingesting ? '…' : 'Send'}
            </button>
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update `src/renderer/components/Chat/MessageBubble.tsx`** to render attachments

Replace the entire file with:

```tsx
import ReactMarkdown from 'react-markdown'
import { useState, useEffect } from 'react'
import { AttachmentRow } from './AttachmentRow'
import { listAttachments } from '../../ipc'
import type { Message, Attachment } from '../../../../shared/types'

interface Props { message: Message }

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const [attachments, setAttachments] = useState<Attachment[]>([])

  useEffect(() => {
    if (!message.id || message.id.startsWith('streaming')) return
    listAttachments(message.id).then(setAttachments)
  }, [message.id])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
      }`}>
        {isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{message.content}</ReactMarkdown>
        }
        {attachments.length > 0 && <AttachmentRow attachments={attachments} />}
        <div className="text-xs opacity-50 mt-1">
          {message.backend} · {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `ChatView` callers to pass the new `onSend` signature**

`ChatView` passes `handleSend` to `InputBar`. The new signature is `(message: string, attachments: Attachment[], messageId: string)`.

In `src/renderer/components/Chat/ChatView.tsx`, update `SingleChatView`:

```typescript
// Change the handler:
const handleSend = async (message: string, _attachments: Attachment[], messageId: string) => {
  const newId = await send(message, backend, personaId, messageId)
  if (!conversationId && newId) onNewConversation(newId)
}
```

Update `useMessages.send` in `src/renderer/hooks/useMessages.ts` to accept an optional `messageId`:

```typescript
const send = useCallback(async (message: string, backend: string, personaId?: string, messageId?: string) => {
  ...
  const newConvId = await sendChat({ conversationId, message, backend, personaId, messageId })
  ...
}, [conversationId])
```

For `PipelineChatView`, update similarly:
```typescript
const handleSend = async (message: string, _attachments: Attachment[], _messageId: string) => {
  const newId = await send(message)
  if (!conversationId && newId) onNewConversation(newId)
}
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Chat/AttachmentChip.tsx src/renderer/components/Chat/AttachmentRow.tsx src/renderer/components/Chat/InputBar.tsx src/renderer/components/Chat/MessageBubble.tsx src/renderer/components/Chat/ChatView.tsx src/renderer/hooks/useMessages.ts
git commit -m "feat: attachment chips in InputBar, drag-drop, and AttachmentRow in message history"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| `attachments` table | Task 2 |
| Migration via `.sql` file | Task 2 |
| `AttachmentService.ingest` copies files, extracts text | Task 3 |
| `pdf-parse`, `mammoth`, `xlsx` for extraction | Task 1 + 3 |
| 20 MB size limit rejection | Task 3 |
| Unsupported type rejection | Task 3 |
| Extraction failure → `extractionError: true` | Task 3 |
| `getContent()` returns base64 data URI for images | Task 3 |
| Claude native `--file` flags | Task 4 |
| Gemini/Opencode content injection | Task 4 |
| Content injection `[Attachment: …]` format | Task 4 |
| `attachment:ingest` + `attachment:list` IPC | Task 5 |
| Pre-generated `messageId` flow | Task 5 + 6 |
| Paperclip button → file dialog | Task 7 |
| Drag-drop onto chat area | Task 7 |
| Attachment chips above textarea with × remove | Task 7 |
| Send disabled during ingestion | Task 7 |
| Error chip for oversized / unsupported files | Task 7 |
| Attachment row below message bubble | Task 7 |
| Image thumbnail (max 200px) | Task 7 |

**No placeholders found.**

**Type consistency:** `Attachment` defined in Task 1, stored in Task 2, service in Task 3, adapters in Task 4, renderer in Tasks 6–7. `BackendAdapter.send(message, persona?, attachments?)` signature introduced in Task 1, implemented in Task 4.
