import { IPC } from "../../shared/ipc";
import type { SecurityEvent, SecurityRespondPayload } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export function onSecurityEvent(
  listener: (event: SecurityEvent) => void,
): () => void {
  return onIpcEvent(IPC.SECURITY_EVENT, listener);
}
export async function respondSecurity(
  payload: SecurityRespondPayload,
): Promise<void> {
  await ipcInvoke<void>(IPC.SECURITY_RESPOND, payload);
}
