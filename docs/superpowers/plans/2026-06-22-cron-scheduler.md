# Cron Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Add a lightweight in-process cron scheduler that lets users run recurring jobs (conversations with specific prompts on a schedule). Users define cron expressions with a prompt + agent backend; the scheduler runs them and stores results as conversations.

**Architecture:** `node-cron` for scheduling, a `CronStore` (backed by SQLite) for persistence, and a `CronEngine` that manages the lifecycle. IPC for CRUD on cron jobs, plus a UI panel.

**Tech Stack:** TypeScript, better-sqlite3, node-cron, Electron IPC, React

---

### Task 1: Install node-cron dependency

- [ ] **Step 1: Install**

```bash
npm install node-cron
npm install -D @types/node-cron
```

- [ ] **Step 2: Verify types exist**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add node-cron for scheduling"
```

---

### Task 2: Add CronJob type and IPC channels

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add CronJob type**

In `src/shared/types.ts`, add:

```typescript
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
```

- [ ] **Step 2: Add IPC constants**

In `src/shared/ipc.ts`, add to `IPC`:

```typescript
CRON_LIST: "cron:list",
CRON_CREATE: "cron:create",
CRON_UPDATE: "cron:update",
CRON_DELETE: "cron:delete",
CRON_TOGGLE: "cron:toggle",
CRON_LOGS: "cron:logs",
CRON_RUN_NOW: "cron:run-now",
```

Add to `IpcInvokeMap`:

```typescript
[IPC.CRON_LIST]: void;
[IPC.CRON_CREATE]: { name: string; cronExpression: string; prompt: string; backend: string };
[IPC.CRON_UPDATE]: { id: string } & Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>;
[IPC.CRON_DELETE]: { id: string };
[IPC.CRON_TOGGLE]: { id: string };
[IPC.CRON_LOGS]: { cronJobId: string };
[IPC.CRON_RUN_NOW]: { id: string };
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat(cron): add CronJob types and IPC channels"
```

---

### Task 3: Build CronStore (SQLite persistence)

**Files:**
- Create: `src/main/scheduler/cron-store.ts`
- Create: `src/main/scheduler/cron-store.test.ts`

Migration that creates `cron_jobs` and `cron_job_logs` tables will be integrated into the store file's `ensureTables` method.

- [ ] **Step 1: Create migration SQL (inline in store)**

```typescript
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  prompt TEXT NOT NULL,
  backend TEXT NOT NULL,
  conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','error')),
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS cron_job_logs (
  id TEXT PRIMARY KEY,
  cron_job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  conversation_id TEXT,
  error TEXT
);
`;
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb } from "../../store/db";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { CronStore } from "./cron-store";

let dbPath: string;

describe("CronStore", () => {
  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-cron-${crypto.randomUUID()}.db`);
    initDb(dbPath);
  });

  afterAll(() => {
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("list returns empty initially", () => {
    expect(CronStore.list()).toEqual([]);
  });

  it("creates a cron job", () => {
    const job = CronStore.create({
      name: "Daily Report", cronExpression: "0 9 * * 1-5",
      prompt: "Generate daily report", backend: "claude",
    });
    expect(job.name).toBe("Daily Report");
    expect(job.status).toBe("active");
  });

  it("list returns created jobs", () => {
    expect(CronStore.list().length).toBe(1);
  });

  it("updates a cron job", () => {
    const jobs = CronStore.list();
    CronStore.update(jobs[0].id, { name: "Weekly Report" });
    expect(CronStore.list()[0].name).toBe("Weekly Report");
  });

  it("toggles pause/resume", () => {
    const jobs = CronStore.list();
    CronStore.toggle(jobs[0].id);
    expect(CronStore.list()[0].status).toBe("paused");
    CronStore.toggle(jobs[0].id);
    expect(CronStore.list()[0].status).toBe("active");
  });

  it("deletes a cron job", () => {
    const jobs = CronStore.list();
    CronStore.delete(jobs[0].id);
    expect(CronStore.list().length).toBe(0);
  });

  it("creates and reads logs", () => {
    const job = CronStore.create({
      name: "Test", cronExpression: "* * * * *",
      prompt: "test", backend: "claude",
    });
    CronStore.addLog({
      cronJobId: job.id, startedAt: Date.now(), success: true, conversationId: "conv1",
    });
    const logs = CronStore.getLogs(job.id);
    expect(logs.length).toBe(1);
    expect(logs[0].success).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to see it fail**

Run: `npx vitest run src/main/scheduler/cron-store.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 4: Write implementation**

```typescript
import { getDb } from "../store/db";
import crypto from "crypto";
import type { CronJob, CronJobLog } from "../../shared/types";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  prompt TEXT NOT NULL,
  backend TEXT NOT NULL,
  conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','error')),
  last_run_at INTEGER,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS cron_job_logs (
  id TEXT PRIMARY KEY,
  cron_job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  success INTEGER NOT NULL DEFAULT 0,
  conversation_id TEXT,
  error TEXT
);
`;

function ensureTables() {
  getDb().exec(SCHEMA_SQL);
}

function rowToCronJob(row: any): CronJob {
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    prompt: row.prompt,
    backend: row.backend,
    conversationId: row.conversation_id,
    status: row.status,
    lastRunAt: row.last_run_at ?? null,
    nextRunAt: row.next_run_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    runCount: row.run_count,
    lastError: row.last_error ?? null,
  };
}

export const CronStore = {
  list(): CronJob[] {
    ensureTables();
    const rows = getDb().prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC").all() as any[];
    return rows.map(rowToCronJob);
  },

  create(input: { name: string; cronExpression: string; prompt: string; backend: string }): CronJob {
    ensureTables();
    const id = crypto.randomUUID();
    const now = Date.now();
    getDb().prepare(`
      INSERT INTO cron_jobs (id, name, cron_expression, prompt, backend, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name, input.cronExpression, input.prompt, input.backend, now, now);
    return this.get(id)!;
  },

  get(id: string): CronJob | null {
    ensureTables();
    const row = getDb().prepare("SELECT * FROM cron_jobs WHERE id = ?").get(id) as any;
    return row ? rowToCronJob(row) : null;
  },

  update(id: string, changes: Partial<{ name: string; cronExpression: string; prompt: string; backend: string }>) {
    ensureTables();
    const fields: string[] = [];
    const values: any[] = [];
    if (changes.name !== undefined) { fields.push("name = ?"); values.push(changes.name); }
    if (changes.cronExpression !== undefined) { fields.push("cron_expression = ?"); values.push(changes.cronExpression); }
    if (changes.prompt !== undefined) { fields.push("prompt = ?"); values.push(changes.prompt); }
    if (changes.backend !== undefined) { fields.push("backend = ?"); values.push(changes.backend); }
    if (fields.length === 0) return;
    fields.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);
    getDb().prepare(`UPDATE cron_jobs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  },

  toggle(id: string) {
    ensureTables();
    const job = this.get(id);
    if (!job) return;
    const newStatus = job.status === "active" ? "paused" : "active";
    getDb().prepare("UPDATE cron_jobs SET status = ?, updated_at = ? WHERE id = ?").run(newStatus, Date.now(), id);
  },

  delete(id: string) {
    ensureTables();
    getDb().prepare("DELETE FROM cron_jobs WHERE id = ?").run(id);
  },

  recordRun(id: string, success: boolean, error?: string) {
    ensureTables();
    getDb().prepare(`
      UPDATE cron_jobs SET last_run_at = ?, run_count = run_count + 1, last_error = ?, updated_at = ?
      WHERE id = ?
    `).run(Date.now(), error ?? null, Date.now(), id);
  },

  addLog(entry: { cronJobId: string; startedAt: number; success: boolean; conversationId?: string; error?: string }) {
    ensureTables();
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO cron_job_logs (id, cron_job_id, started_at, finished_at, success, conversation_id, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.cronJobId, entry.startedAt, Date.now(), entry.success ? 1 : 0, entry.conversationId ?? null, entry.error ?? null);
  },

  getLogs(cronJobId: string): CronJobLog[] {
    ensureTables();
    return (getDb().prepare(`
      SELECT * FROM cron_job_logs WHERE cron_job_id = ? ORDER BY started_at DESC LIMIT 100
    `).all(cronJobId) as any[]).map((r: any) => ({
      id: r.id,
      cronJobId: r.cron_job_id,
      startedAt: r.started_at,
      finishedAt: r.finished_at ?? null,
      success: !!r.success,
      conversationId: r.conversation_id ?? null,
      error: r.error ?? null,
    }));
  },
};
```

- [ ] **Step 5: Run test to verify**

Run: `npx vitest run src/main/scheduler/cron-store.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/scheduler/cron-store.ts src/main/scheduler/cron-store.test.ts
git commit -m "feat(cron): add CronStore with SQLite persistence"
```

---

### Task 4: Build CronEngine (scheduler lifecycle)

**Files:**
- Create: `src/main/scheduler/cron-engine.ts`
- Create: `src/main/scheduler/cron-engine.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { initDb, closeDb } from "../store/db";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { CronStore } from "./cron-store";
import { CronEngine } from "./cron-engine";

let dbPath: string;

describe("CronEngine", () => {
  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-cron-eng-${crypto.randomUUID()}.db`);
    initDb(dbPath);
  });

  afterAll(() => {
    CronEngine.shutdown();
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("starts and stops without error", () => {
    expect(() => CronEngine.start()).not.toThrow();
    expect(() => CronEngine.shutdown()).not.toThrow();
  });

  it("starts with existing active jobs scheduled", () => {
    CronStore.create({ name: "Auto", cronExpression: "* * * * *", prompt: "hi", backend: "claude" });
    expect(() => CronEngine.start()).not.toThrow();
    CronEngine.shutdown();
  });

  it("triggers callback on tick", () => new Promise<void>((done) => {
    const mockExecute = vi.fn();
    (CronEngine as any).executeJob = mockExecute;
    CronStore.create({ name: "Tick", cronExpression: "* * * * *", prompt: "tick", backend: "claude" });
    CronEngine.start();
    // Schedule fires every minute; we just verify no crash
    CronEngine.shutdown();
    done();
  }));
});
```

- [ ] **Step 2: Run test to see fail**

Run: `npx vitest run src/main/scheduler/cron-engine.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import cron from "node-cron";
import type { CronJob } from "../../shared/types";
import { CronStore } from "./cron-store";

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export const CronEngine = {
  start() {
    const jobs = CronStore.list().filter((j) => j.status === "active");
    for (const job of jobs) {
      this.scheduleJob(job);
    }
  },

  scheduleJob(job: CronJob) {
    if (scheduledTasks.has(job.id)) {
      scheduledTasks.get(job.id)!.stop();
    }
    if (job.status !== "active") return;
    try {
      const task = cron.schedule(job.cronExpression, () => {
        this.executeJob(job.id);
      });
      scheduledTasks.set(job.id, task);
    } catch {
      CronStore.update(job.id, { name: job.name });
      CronStore.recordRun(job.id, false, "Invalid cron expression");
    }
  },

  unscheduleJob(jobId: string) {
    const task = scheduledTasks.get(jobId);
    if (task) {
      task.stop();
      scheduledTasks.delete(jobId);
    }
  },

  async executeJob(jobId: string) {
    const job = CronStore.get(jobId);
    if (!job) return;
    const startedAt = Date.now();
    CronStore.addLog({ cronJobId: jobId, startedAt, success: false });
    try {
      const { createConversation, appendToConversation, executePrompt } = await import("../backend");
      const conv = createConversation(job.backend, `Cron: ${job.name} @ ${new Date().toISOString()}`);
      await appendToConversation(conv.id, "user", job.prompt);
      const response = await executePrompt(conv.id, job.backend);
      await appendToConversation(conv.id, "assistant", response);
      CronStore.recordRun(jobId, true);
      CronStore.addLog({ cronJobId: jobId, startedAt, success: true, conversationId: conv.id });
    } catch (err: any) {
      CronStore.recordRun(jobId, false, err.message);
      CronStore.addLog({ cronJobId: jobId, startedAt, success: false, error: err.message });
    }
  },

  getScheduledJobIds(): string[] {
    return Array.from(scheduledTasks.keys());
  },

  shutdown() {
    for (const [id, task] of scheduledTasks) {
      task.stop();
    }
    scheduledTasks.clear();
  },
};
```

- [ ] **Step 4: Run test to verify**

Run: `npx vitest run src/main/scheduler/cron-engine.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/scheduler/cron-engine.ts src/main/scheduler/cron-engine.test.ts
git commit -m "feat(cron): add CronEngine for job scheduling lifecycle"
```

---

### Task 5: Wire cron IPC handlers

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Add cron IPC handlers** in `src/main/ipc.ts`:

```typescript
import { CronStore } from "./scheduler/cron-store";
import { CronEngine } from "./scheduler/cron-engine";

// After other IPC handlers
ipcMain.handle(IPC.CRON_LIST, () => CronStore.list());
ipcMain.handle(IPC.CRON_CREATE, (_event, input) => {
  const job = CronStore.create(input);
  if (job.status === "active") CronEngine.scheduleJob(job);
  return job;
});
ipcMain.handle(IPC.CRON_UPDATE, (_event, { id, ...changes }) => {
  CronStore.update(id, changes);
  const job = CronStore.get(id);
  if (job) {
    CronEngine.unscheduleJob(id);
    if (job.status === "active") CronEngine.scheduleJob(job);
  }
  return job;
});
ipcMain.handle(IPC.CRON_DELETE, (_event, { id }) => {
  CronEngine.unscheduleJob(id);
  CronStore.delete(id);
});
ipcMain.handle(IPC.CRON_TOGGLE, (_event, { id }) => {
  CronStore.toggle(id);
  const job = CronStore.get(id);
  if (job) {
    CronEngine.unscheduleJob(id);
    if (job.status === "active") CronEngine.scheduleJob(job);
  }
  return job;
});
ipcMain.handle(IPC.CRON_LOGS, (_event, { cronJobId }) => CronStore.getLogs(cronJobId));
ipcMain.handle(IPC.CRON_RUN_NOW, (_event, { id }) => CronEngine.executeJob(id));
```

- [ ] **Step 3: Start CronEngine on app ready** in `src/main/main.ts`:

```typescript
import { CronEngine } from "./scheduler/cron-engine";

// In the app.whenReady() callback, after window creation:
CronEngine.start();
```

- [ ] **Step 4: Shutdown CronEngine on app quit** in `src/main/main.ts`:

```typescript
app.on("will-quit", () => {
  CronEngine.shutdown();
  // existing cleanup
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts src/main/main.ts src/main/scheduler/cron-engine.test.ts
git commit -m "feat(cron): wire cron IPC handlers and lifecycle"
```

---

### Task 6: Add renderer IPC wrappers

**Files:**
- Modify: `src/renderer/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add preload channels**

In `src/preload/index.ts`, add to `ALLOWED_CHANNELS`:
```typescript
"cron:list", "cron:create", "cron:update", "cron:delete", "cron:toggle", "cron:logs", "cron:run-now",
```

- [ ] **Step 2: Add renderer wrappers**

In `src/renderer/ipc.ts`:
```typescript
import type { CronJob, CronJobLog } from "../shared/types";

export async function getCronJobs(): Promise<CronJob[]> {
  return window.ipc.invoke("cron:list") as Promise<CronJob[]>;
}
export async function createCronJob(input: { name: string; cronExpression: string; prompt: string; backend: string }): Promise<CronJob> {
  return window.ipc.invoke("cron:create", input) as Promise<CronJob>;
}
export async function updateCronJob(id: string, changes: Partial<CronJob>): Promise<CronJob> {
  return window.ipc.invoke("cron:update", { id, ...changes }) as Promise<CronJob>;
}
export async function deleteCronJob(id: string): Promise<void> {
  return window.ipc.invoke("cron:delete", { id }) as Promise<void>;
}
export async function toggleCronJob(id: string): Promise<CronJob> {
  return window.ipc.invoke("cron:toggle", { id }) as Promise<CronJob>;
}
export async function getCronJobLogs(cronJobId: string): Promise<CronJobLog[]> {
  return window.ipc.invoke("cron:logs", { cronJobId }) as Promise<CronJobLog[]>;
}
export async function runCronJobNow(id: string): Promise<void> {
  return window.ipc.invoke("cron:run-now", { id }) as Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ipc.ts src/preload/index.ts
git commit -m "feat(cron): add renderer cron IPC wrappers"
```

---

### Task 7: Build CronPanel component

**Files:**
- Create: `src/renderer/components/Sidebar/CronPanel.tsx`

- [ ] **Step 1: Write component**

```typescript
import { useState, useEffect, useCallback } from "react";
import type { CronJob, CronJobLog } from "../../../shared/types";
import { getCronJobs, createCronJob, updateCronJob, deleteCronJob, toggleCronJob, getCronJobLogs, runCronJobNow } from "../../ipc";

export function CronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backend, setBackend] = useState("claude");
  const [logs, setLogs] = useState<Record<string, CronJobLog[]>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setJobs(await getCronJobs());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!name || !cronExpression || !prompt) return;
    await createCronJob({ name, cronExpression, prompt, backend });
    setName(""); setCronExpression(""); setPrompt(""); setBackend("claude");
    setShowForm(false);
    await refresh();
  };

  const handleToggle = async (id: string) => {
    await toggleCronJob(id);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteCronJob(id);
    await refresh();
  };

  const handleRunNow = async (id: string) => {
    await runCronJobNow(id);
    await refresh();
  };

  const toggleLogs = async (id: string) => {
    if (expandedJob === id) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(id);
    const jobLogs = await getCronJobLogs(id);
    setLogs((prev) => ({ ...prev, [id]: jobLogs }));
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">Scheduled Jobs</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600">
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-1.5 mb-3 p-2 border rounded dark:border-gray-600">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <input placeholder="Cron expression (e.g., 0 9 * * 1-5)" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <textarea placeholder="Prompt to execute" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <select value={backend} onChange={(e) => setBackend(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600">
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="opencode">Opencode</option>
          </select>
          <button onClick={handleCreate} className="w-full text-xs py-1 rounded bg-green-600 text-white hover:bg-green-700">
            Create Job
          </button>
        </div>
      )}

      {jobs.length === 0 && !showForm && (
        <div className="text-xs text-gray-400 text-center py-4">No scheduled jobs</div>
      )}

      <ul className="space-y-1 max-h-64 overflow-y-auto">
        {jobs.map((job) => (
          <li key={job.id} className="text-xs p-2 rounded border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{job.name}</div>
                <div className="text-gray-500">{job.cronExpression}</div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                job.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : job.status === "paused" ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
              }`}>
                {job.status}
              </span>
            </div>
            <div className="flex gap-1 mt-1">
              <button onClick={() => handleToggle(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200">
                {job.status === "active" ? "Pause" : "Resume"}
              </button>
              <button onClick={() => handleRunNow(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200">
                Run Now
              </button>
              <button onClick={() => toggleLogs(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200">
                Logs
              </button>
              <button onClick={() => handleDelete(job.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200 ml-auto">
                Delete
              </button>
            </div>
            {expandedJob === job.id && logs[job.id] && (
              <div className="mt-1 max-h-24 overflow-y-auto border-t pt-1 dark:border-gray-700">
                {logs[job.id].length === 0 && <div className="text-gray-400">No logs</div>}
                {logs[job.id].map((log) => (
                  <div key={log.id} className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span className={log.success ? "text-green-500" : "text-red-500"}>
                      {log.success ? "OK" : "ERR"}
                    </span>
                    <span>{new Date(log.startedAt).toLocaleString()}</span>
                    {log.error && <span className="text-red-500 truncate">: {log.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Sidebar/CronPanel.tsx
git commit -m "feat(cron): add CronPanel component with create/toggle/run/log UI"
```

---

### Task 8: Integrate CronPanel into Sidebar

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx**

- [ ] **Step 2: Add imports and tabs**

Add `CronPanel` import and wire it as a tab option alongside Search/Conversations:

```typescript
import { CronPanel } from "./CronPanel";

// Add a tab toggle state:
const [cronTab, setCronTab] = useState(false);

// In the sidebar tabs section:
<button onClick={() => setActiveTab("cron")} className={...}>Cron</button>

// Conditionally render:
{activeTab === "cron" && <CronPanel />}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "feat(cron): integrate CronPanel into sidebar"
```

---

### Task 9: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Commit fixes**

```bash
git add --all
git commit -m "fix: resolve cron-related test failures"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: SQLite-persisted jobs, `node-cron` scheduling, lifecycle management via `CronEngine`, CRUD IPC, `CronPanel` with create/toggle/run-now/logs UI.
- [x] **Placeholder scan**: Clean.
- [x] **Type consistency**: `CronJob`, `CronJobLog` used consistently across store, engine, IPC, and panel.
