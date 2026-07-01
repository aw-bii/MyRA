import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function relaunchApp(): Promise<void> {
  await ipcInvoke<void>(IPC.APP_RELAUNCH);
}

export async function uninstallApp(): Promise<void> {
  await ipcInvoke<void>(IPC.APP_UNINSTALL);
}
