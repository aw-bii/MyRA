import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

  it("getScheduledJobIds returns active job IDs", () => {
    CronEngine.start();
    const ids = CronEngine.getScheduledJobIds();
    expect(Array.isArray(ids)).toBe(true);
    CronEngine.shutdown();
  });
});
