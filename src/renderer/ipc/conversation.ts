import { IPC } from "../../shared/ipc";
import type { Conversation, Message, SearchResult } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listConversations(
  limit = 50,
  offset = 0,
): Promise<Conversation[]> {
  return ipcInvoke<Conversation[]>(IPC.CONV_LIST, { limit, offset });
}
export async function createConversation(
  title: string,
  backend: string,
  personaId?: string,
  pipelineTemplateId?: string,
): Promise<Conversation> {
  return ipcInvoke<Conversation>(IPC.CONV_CREATE, {
    title,
    backend,
    personaId,
    pipelineTemplateId,
  });
}
export async function getConversation(
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  return ipcInvoke<any>(IPC.CONV_GET, { conversationId });
}
export async function searchConversations(
  query: string,
): Promise<SearchResult[]> {
  return ipcInvoke<SearchResult[]>(IPC.CONV_SEARCH, { query });
}
export async function deleteConversation(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_DELETE, { conversationId: id });
}
export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  await ipcInvoke<void>(IPC.CONV_RENAME, { conversationId: id, title });
}
