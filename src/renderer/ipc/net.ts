import { IPC } from "../../shared/ipc";
import { ipcInvoke } from "./index";

export async function checkConnectivity(): Promise<{ online: boolean }> {
  return ipcInvoke<{ online: boolean }>(IPC.NET_CHECK);
}
export async function getProxySettings(): Promise<{
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
}> {
  return ipcInvoke<{ httpProxy: string; httpsProxy: string; noProxy: string }>(
    IPC.NET_GET_PROXY,
  );
}
export async function setProxySettings(settings: {
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
}): Promise<void> {
  await ipcInvoke(IPC.NET_SET_PROXY, settings);
}
export async function openExternal(url: string): Promise<void> {
  await ipcInvoke<void>(IPC.NET_OPEN_EXTERNAL, { url });
}
