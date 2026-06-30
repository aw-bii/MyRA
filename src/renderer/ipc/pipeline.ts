import { IPC } from "../../shared/ipc";
import type { PipelineTemplate, PipelineChunk } from "../../shared/types";
import { ipcInvoke, onIpcEvent } from "./index";

export async function listPipelineTemplates(): Promise<PipelineTemplate[]> {
  return ipcInvoke<PipelineTemplate[]>(IPC.PIPELINE_LIST);
}
export async function savePipelineTemplate(p: any): Promise<PipelineTemplate> {
  return ipcInvoke<PipelineTemplate>(IPC.PIPELINE_SAVE, p);
}
export async function deletePipelineTemplate(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_DELETE, { id });
}
export async function runPipeline(payload: {
  conversationId: string | null;
  message: string;
  templateId: string;
}): Promise<string> {
  return ipcInvoke<string>(IPC.PIPELINE_RUN, payload);
}
export async function abortPipeline(conversationId: string): Promise<void> {
  await ipcInvoke<void>(IPC.PIPELINE_ABORT, { conversationId });
}
export function onPipelineChunk(
  cb: (chunk: PipelineChunk & { conversationId: string }) => void,
): () => void {
  return onIpcEvent(IPC.PIPELINE_CHUNK, cb);
}
export function onPipelineStepDone(
  cb: (payload: { conversationId: string; stepIndex: number }) => void,
): () => void {
  return onIpcEvent(IPC.PIPELINE_STEP_DONE, cb);
}
export function onPipelineDone(
  cb: (payload: { conversationId: string }) => void,
): () => void {
  return onIpcEvent(IPC.PIPELINE_DONE, cb);
}
