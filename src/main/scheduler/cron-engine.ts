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
      const { ConvStore } = require("../store");
      const adapterManager = require("../adapters/manager").AdapterManager;
      const securityMiddlewareFn = require("../adapters/manager").securityMiddleware;
      const { BrowserWindow } = require("electron");
      const { IPC } = require("../../shared/ipc");
      const adapter =
        adapterManager.get(job.backend) ?? adapterManager.getActive();

      const conv = ConvStore.createConversation(
        `Cron: ${job.name} @ ${new Date().toISOString()}`,
        adapter ? adapter.id : job.backend,
        null,
      );

      ConvStore.createMessage({
        conversationId: conv.id,
        role: "user",
        content: job.prompt,
        backend: adapter ? adapter.id : job.backend,
        stepIndex: null,
      });

      let response = "";
      if (adapter) {
        const win = BrowserWindow.getAllWindows()[0] ?? null;
        for await (const chunk of securityMiddlewareFn(
          adapter.send(job.prompt),
          adapter.id,
          (evt: import("../../shared/types").SecurityEvent) => {
            win?.webContents.send(IPC.SECURITY_EVENT, evt);
          },
        )) {
          if (chunk.type === "text") response += chunk.content;
        }
      }
      ConvStore.createMessage({
        conversationId: conv.id,
        role: "assistant",
        content: response || "(no response)",
        backend: adapter ? adapter.id : job.backend,
        stepIndex: null,
      });

      CronStore.recordRun(jobId, true);
      CronStore.addLog({
        cronJobId: jobId,
        startedAt,
        success: true,
        conversationId: conv.id,
      });
    } catch (err: any) {
      CronStore.recordRun(jobId, false, err.message);
      CronStore.addLog({
        cronJobId: jobId,
        startedAt,
        success: false,
        error: err.message,
      });
    }
  },

  getScheduledJobIds(): string[] {
    return Array.from(scheduledTasks.keys());
  },

  shutdown() {
    for (const [_id, task] of scheduledTasks) {
      task.stop();
    }
    scheduledTasks.clear();
  },
};
