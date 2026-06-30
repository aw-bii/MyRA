import { IPC } from "../../shared/ipc";
import type { Persona } from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listPersonas(): Promise<Persona[]> {
  return ipcInvoke<Persona[]>(IPC.PERSONA_LIST);
}
export async function savePersona(
  p: Omit<Persona, "id"> & { id?: string },
): Promise<Persona> {
  return ipcInvoke<Persona>(IPC.PERSONA_SAVE, p);
}
export async function deletePersona(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.PERSONA_DELETE, { id });
}
