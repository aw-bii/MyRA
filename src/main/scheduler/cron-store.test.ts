import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb } from "../store/db";
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
