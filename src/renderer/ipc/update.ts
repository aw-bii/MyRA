import { IPC } from "../../shared/ipc";
import { ipcInvoke, onIpcEvent } from "./index";

export async function downloadUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_DOWNLOAD);
}
export async function installUpdate(): Promise<void> {
  await ipcInvoke<void>(IPC.UPDATE_INSTALL);
}
export function onUpdateAvailable(
  cb: (info: { version: string; releaseNotes: string }) => void,
): () => void {
  return onIpcEvent(IPC.UPDATE_AVAILABLE, cb);
}
export function onUpdateProgress(cb: (percent: number) => void): () => void {
  return onIpcEvent(IPC.UPDATE_PROGRESS, cb);
}
export function onUpdateDownloaded(cb: () => void): () => void {
  return onIpcEvent(IPC.UPDATE_DOWNLOADED, cb);
}
export function onUpdateError(cb: (message: string) => void): () => void {
  return onIpcEvent(IPC.UPDATE_ERROR, cb);
}
