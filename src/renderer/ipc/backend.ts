import { IPC } from "../../shared/ipc";
import type { BackendInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listBackends(): Promise<BackendInfo[]> {
  return ipcInvoke<BackendInfo[]>(IPC.BACKEND_LIST);
}
export async function probeBackend(
  backend: string,
): Promise<{ available: boolean; authenticated: boolean }> {
  return ipcInvoke<{ available: boolean; authenticated: boolean }>(
    IPC.WIZARD_PROBE,
    { backend },
  );
}
export async function installBackend(
  backend: string,
): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke<{ success: boolean; error?: string }>(IPC.WIZARD_INSTALL, {
    backend,
  });
}
export async function markWizardDone(): Promise<void> {
  await ipcInvoke<void>(IPC.WIZARD_DONE);
}
export { listBackends as listAvailableBackends };
