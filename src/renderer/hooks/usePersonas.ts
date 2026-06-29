import { useState, useEffect, useCallback } from "react";
import { listPersonas, savePersona, deletePersona } from "../ipc/persona";
import type { Persona } from "../../shared/types";

export function usePersonas() {
  const [personas, setPersonas] = useState<Persona[]>([]);

  const refresh = useCallback(async () => {
    setPersonas(await listPersonas());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (p: Omit<Persona, "id"> & { id?: string }) => {
      await savePersona(p);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await deletePersona(id);
      await refresh();
    },
    [refresh],
  );

  return { personas, save, remove, refresh };
}
