import { IPC } from "../../shared/ipc";
import type { PluginInfo } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listPlugins(): Promise<PluginInfo[]> {
  return ipcInvoke<PluginInfo[]>(IPC.PLUGIN_LIST);
}
export async function togglePlugin(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_TOGGLE, { id });
}
export async function reloadPlugins(): Promise<void> {
  await ipcInvoke<void>(IPC.PLUGIN_RELOAD);
}
