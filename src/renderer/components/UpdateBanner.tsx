import { useState, useEffect } from "react";
import {
  onUpdateAvailable,
  onUpdateProgress,
  onUpdateDownloaded,
  onUpdateError,
  downloadUpdate,
  installUpdate,
} from "../ipc";

type UpdateState =
  | { phase: "available"; version: string }
  | { phase: "downloading"; progress: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const unsubs = [
      onUpdateAvailable(({ version }) =>
        setState({ phase: "available", version }),
      ),
      onUpdateProgress((progress) =>
        setState({ phase: "downloading", progress }),
      ),
      onUpdateDownloaded(() => setState({ phase: "ready" })),
      onUpdateError((message) => setState({ phase: "error", message })),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  if (!state) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm bg-blue-600 text-white">
      {state.phase === "available" && (
        <>
          <span className="flex-1">
            Update available: <strong>v{state.version}</strong>
          </span>
          <button
            onClick={() => downloadUpdate()}
            className="px-3 py-0.5 rounded bg-white text-blue-700 font-medium hover:bg-blue-50 transition-colors"
          >
            Download
          </button>
          <button
            onClick={() => setState(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </>
      )}
      {state.phase === "downloading" && (
        <>
          <span className="flex-1">
            Downloading update… {Math.round(state.progress)}%
          </span>
          <div className="w-32 h-1.5 rounded-full bg-blue-400">
            <div
              className="h-full rounded-full bg-white transition-[width]"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </>
      )}
      {state.phase === "ready" && (
        <>
          <span className="flex-1">Update ready — restart to install.</span>
          <button
            onClick={() => installUpdate()}
            className="px-3 py-0.5 rounded bg-white text-blue-700 font-medium hover:bg-blue-50 transition-colors"
          >
            Restart now
          </button>
          <button
            onClick={() => setState(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </>
      )}
      {state.phase === "error" && (
        <>
          <span className="flex-1 text-red-200">
            Update error: {state.message}
          </span>
          <button
            onClick={() => setState(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
