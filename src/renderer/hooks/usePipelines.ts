import { useState, useEffect, useCallback } from "react";
import {
  listPipelineTemplates,
  savePipelineTemplate,
  deletePipelineTemplate,
} from "../ipc/pipeline";
import type { PipelineTemplate } from "../../shared/types";

export function usePipelines() {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);

  useEffect(() => {
    listPipelineTemplates().then(setTemplates);
  }, []);

  const save = useCallback(
    async (p: {
      id?: string;
      name: string;
      steps: Array<{
        id?: string;
        stepOrder: number;
        backendId: string;
        personaId: string | null;
      }>;
    }) => {
      const saved = await savePipelineTemplate(p);
      setTemplates((prev) =>
        p.id ? prev.map((t) => (t.id === p.id ? saved : t)) : [...prev, saved],
      );
      return saved;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await deletePipelineTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, save, remove };
}
