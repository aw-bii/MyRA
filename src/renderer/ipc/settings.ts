import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function getAppVersion(): Promise<string> {
  return ipcInvoke<string>(IPC.APP_VERSION);
}
export async function getSetting(key: string): Promise<string | undefined> {
  return ipcInvoke<string | undefined>(IPC.SETTING_GET, { key });
}
export async function setSetting(key: string, value: string): Promise<void> {
  await ipcInvoke<void>(IPC.SETTING_SET, { key, value });
}
export async function getAllSettings(): Promise<Record<string, string>> {
  return ipcInvoke<Record<string, string>>(IPC.SETTING_GET_ALL);
}
