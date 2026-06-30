import { IPC } from "../../shared/ipc";
import type { MessageChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export async function sendChat(payload: any): Promise<string> {
  return ipcInvoke<string>(IPC.CHAT_SEND, payload);
}
export function onChatChunk(
  cb: (chunk: MessageChunk & { conversationId: string }) => void,
): () => void {
  return onIpcEvent(IPC.CHAT_CHUNK, cb);
}
export function onChatDone(
  cb: (payload: { conversationId: string; messageId: string }) => void,
): () => void {
  return onIpcEvent(IPC.CHAT_DONE, cb);
}
export async function abortChat(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.CHAT_ABORT, { conversationId });
}
