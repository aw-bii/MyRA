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
