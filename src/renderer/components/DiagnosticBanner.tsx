import { useState, useEffect } from "react";
import { lastIpcError, clearIpcError } from "../ipc/index";

export function DiagnosticBanner() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const e = lastIpcError;
      if (e && e !== error) {
        setError(e);
        clearIpcError();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [error]);

  if (!error) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-100 dark:bg-yellow-900 border-b border-yellow-300 dark:border-yellow-700 px-4 py-2 text-sm text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
      <span className="font-medium">⚠ IPC Error:</span>
      <span className="truncate">{error.message}</span>
      <button
        onClick={() => setError(null)}
        className="ml-auto text-xs px-2 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 hoverable:hover:bg-yellow-300 dark:hoverable:hover:bg-yellow-700"
      >
        Dismiss
      </button>
    </div>
  );
}
