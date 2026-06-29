import { useState, useCallback } from "react";
import { ingestAttachments } from "../ipc/attachment";
import type { Attachment } from "../../shared/types";

export function useAttachments() {
  const [pending, setPending] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [ingesting, setIngesting] = useState(false);

  // addFiles: validates files by MIME type and size (using fs.stat via electron dialog result),
  // calls ingestAttachments for valid files, updates pending state with returned Attachment[],
  // adds error messages for invalid files.
  // NOTE: file size and MIME type are available via the File API in the renderer —
  // but we only have filePaths (strings), not File objects.
  // Use a simple heuristic: accept all files and let the service reject them.
  // Instead, validate using the path extension to infer MIME and skip size check
  // (the service enforces both — this is a UX pre-filter only).
  const addFiles = useCallback(
    async (filePaths: string[], messageId: string): Promise<Attachment[]> => {
      const validPaths: string[] = [];
      const newErrors: string[] = [];

      for (const fp of filePaths) {
        const name = fp.split(/[\\/]/).pop() ?? fp;
        const ext = name.split(".").pop()?.toLowerCase() ?? "";
        const mimeGuess = extToMime(ext);
        if (!mimeGuess) {
          newErrors.push(`${name}: Unsupported file type`);
          continue;
        }
        validPaths.push(fp);
      }

      if (newErrors.length) setErrors((prev) => [...prev, ...newErrors]);
      if (!validPaths.length) return [];

      setIngesting(true);
      try {
        const ingested = await ingestAttachments(validPaths, messageId);
        setPending((prev) => [...prev, ...ingested]);
        return ingested;
      } finally {
        setIngesting(false);
      }
    },
    [],
  );

  const removeFile = useCallback((id: string) => {
    setPending((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clear = useCallback(() => {
    setPending([]);
    setErrors([]);
  }, []);

  return { pending, errors, ingesting, addFiles, removeFile, clear };
}

function extToMime(ext: string): string | null {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] ?? null;
}
