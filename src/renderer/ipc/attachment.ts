import { IPC } from "../../shared/ipc";
import type { Attachment } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function ingestAttachments(
  filePaths: string[],
  messageId: string,
): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_INGEST, {
    filePaths,
    messageId,
  });
}
export async function listAttachments(
  messageId: string,
): Promise<Attachment[]> {
  return ipcInvoke<Attachment[]>(IPC.ATTACHMENT_LIST, { messageId });
}
export async function getAttachmentDataUrl(
  storedPath: string,
): Promise<string> {
  return ipcInvoke<string>(IPC.ATTACHMENT_DATA_URL, { storedPath });
}
