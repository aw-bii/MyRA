import { describe, it, expect } from "vitest";
import { IPC } from "./ipc";
import type { CronJob } from "./types";

describe("CronJob type", () => {
  it("can be constructed with required fields", () => {
    const job: CronJob = {
      id: "j1",
      name: "Daily Report",
      cronExpression: "0 9 * * 1-5",
      prompt: "Generate report",
      backend: "claude",
      conversationId: null,
      status: "active",
      lastRunAt: null,
      nextRunAt: null,
      createdAt: 1000,
      updatedAt: 1000,
      runCount: 0,
      lastError: null,
    };
    expect(job.name).toBe("Daily Report");
    expect(job.status).toBe("active");
  });
});

describe("IPC cron channels", () => {
  it("cron channels exist in IPC constant", () => {
    expect(IPC.CRON_LIST).toBe("cron:list");
    expect(IPC.CRON_CREATE).toBe("cron:create");
    expect(IPC.CRON_UPDATE).toBe("cron:update");
    expect(IPC.CRON_DELETE).toBe("cron:delete");
    expect(IPC.CRON_TOGGLE).toBe("cron:toggle");
    expect(IPC.CRON_LOGS).toBe("cron:logs");
    expect(IPC.CRON_RUN_NOW).toBe("cron:run-now");
  });
});
