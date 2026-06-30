import { IPC } from "../../shared/ipc";
import type { CronJob, CronJobLog } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function getCronJobs(): Promise<CronJob[]> {
  return ipcInvoke<CronJob[]>(IPC.CRON_LIST);
}
export async function createCronJob(input: {
  name: string;
  cronExpression: string;
  prompt: string;
  backend: string;
}): Promise<CronJob> {
  return ipcInvoke<CronJob>(IPC.CRON_CREATE, input);
}
export async function updateCronJob(
  id: string,
  changes: Partial<{
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }>,
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
