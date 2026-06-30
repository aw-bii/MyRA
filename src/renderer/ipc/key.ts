import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function storeKey(provider: string, key: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_STORE, { provider, key });
}
export async function getKey(provider: string): Promise<string | null> {
  return ipcInvoke<string | null>(IPC.KEY_GET, { provider });
}
export async function deleteKey(provider: string): Promise<void> {
  await ipcInvoke<void>(IPC.KEY_DELETE, { provider });
}
export async function hasKey(provider: string): Promise<boolean> {
  return ipcInvoke<boolean>(IPC.KEY_HAS, { provider });
}
export async function listProviders(): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.KEY_LIST);
}
export async function getDefaultModel(provider: string): Promise<string> {
  return ipcInvoke<string>(IPC.MODEL_GET_DEFAULT, { provider });
}
export async function setDefaultModel(
  provider: string,
  model: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.MODEL_SET_DEFAULT, { provider, model });
}
export async function listModels(provider: string): Promise<string[]> {
  return ipcInvoke<string[]>(IPC.MODEL_LIST, { provider });
}
