import { useState, useEffect } from "react";
import { installBackend, probeBackend } from "../../ipc/backend";
import { relaunchApp } from "../../ipc/app";
import { IPC } from "../../../shared/ipc";

const LABELS: Record<string, string> = {
  claude: "Claude Code",
  "claude-api": "Claude API",
  gemini: "Gemini CLI",
  "gemini-api": "Gemini API",
  opencode: "Opencode",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  codex: "Codex",
};

const API_KEY_ONLY = new Set(["claude-api", "gemini-api", "openrouter"]);

interface Props {
  missing: string[];
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep2({ missing, onNext, onBack }: Props) {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [startingOllama, setStartingOllama] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filtered, setFiltered] = useState<string[]>(missing);
  const [reprobing, setReprobing] = useState(true);
  const [needsRestart, setNeedsRestart] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      missing.map(async (id) => {
        try {
          const r = await probeBackend(id);
          return r.available ? null : id;
        } catch {
          return id;
        }
      }),
    ).then((results) => {
      if (!cancelled) {
        setFiltered(results.filter((x): x is string => x !== null));
        setReprobing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [missing]);

  const install = async (id: string) => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setInstalling((prev) => ({ ...prev, [id]: true }));
    const addLine = (line: string) =>
      setLogs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), line] }));

    const off = window.ipc.on(
      "wizard:install:line",
      (evtBackend: unknown, line: unknown) => {
        if (evtBackend === id) {
          addLine(String(line));
        }
      },
    );
    const result = await installBackend(id);
    off();

    setInstalling((prev) => ({ ...prev, [id]: false }));

    if (result.success) {
      const probeResult = await probeBackend(id);
      if (probeResult.available) {
        setVerified((prev) => ({ ...prev, [id]: true }));
        setDone((prev) => ({ ...prev, [id]: true }));
        setNeedsRestart(true);
      } else {
        setErrors((prev) => ({
          ...prev,
          [id]: "Install finished but backend not detected. It may not be on PATH — try restarting the wizard.",
        }));
      }
    } else {
      setErrors((prev) => ({
        ...prev,
        [id]:
          result.error ??
          "Installation failed. Check your internet connection.",
      }));
    }
  };

  const startOllama = async () => {
    setStartingOllama(true);
    setErrors((prev) => {
      const n = { ...prev };
      delete n.ollama;
      return n;
    });
    try {
      await window.ipc.invoke(IPC.OLLAMA_START);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        ollama: `Failed to start Ollama: ${(err as Error).message ?? "unknown error"}`,
      }));
    } finally {
      setStartingOllama(false);
    }
  };

  if (reprobing) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-1">
            Checking installed tools…
          </h2>
          <p className="text-xs text-text-muted">
            Re-checking which tools are already available.
          </p>
        </div>
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 rounded-full border-2 border-border border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-1">All tools found</h2>
          <p className="text-xs text-text-muted">
            Every AI tool was detected on your system.
          </p>
        </div>
        <button
          onClick={onNext}
          className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
        >
          Next
        </button>
        <button
          onClick={onBack}
          className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Install additional tools</h2>
        <p className="text-xs text-text-muted">
          These are optional. You can skip and install them from Settings later.
        </p>
      </div>
      {filtered.map((id) => (
        <div
          key={id}
          className="flex flex-col gap-2 border border-border rounded-xl p-4"
        >
          {API_KEY_ONLY.has(id) ? (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
                <span className="text-xs text-text-muted">
                  No installation needed — configure your API key in Settings
                </span>
              </div>
              <button
                onClick={() => setDone((prev) => ({ ...prev, [id]: true }))}
                disabled={done[id]}
                className="btn-sm border border-border-strong hoverable:hover:bg-bubble disabled:opacity-30"
              >
                Skip
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
                <div className="flex gap-2">
                  {id === "ollama" && (
                    <button
                      onClick={startOllama}
                      disabled={startingOllama}
                      className="btn-sm border border-border-strong hoverable:hover:bg-bubble disabled:opacity-50"
                    >
                      {startingOllama ? "Starting..." : "Start Ollama"}
                    </button>
                  )}
                  <button
                    onClick={() => install(id)}
                    disabled={installing[id] || done[id]}
                    className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
                  >
                    {done[id]
                      ? verified[id]
                        ? "Installed ✓"
                        : "Installed"
                      : installing[id]
                        ? "Installing..."
                        : "Install"}
                  </button>
                  <button
                    onClick={() => setDone((prev) => ({ ...prev, [id]: true }))}
                    disabled={done[id]}
                    className="btn-sm border border-border-strong hoverable:hover:bg-bubble disabled:opacity-30"
                  >
                    Skip
                  </button>
                </div>
              </div>
              {installing[id] && (
                <div
                  className="flex items-center gap-2 text-xs text-text-muted"
                  data-testid={`install-spinner-${id}`}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-border border-t-primary animate-spin flex-shrink-0" />
                  <span className="truncate">
                    {logs[id]?.at(-1) ?? "Installing…"}
                  </span>
                </div>
              )}
              {!installing[id] && done[id] && verified[id] && (
                <p className="text-xs text-primary">
                  Installed and detected on PATH ✓
                </p>
              )}
              {errors[id] && (
                <p className="text-xs text-red-500">{errors[id]}</p>
              )}
            </>
          )}
        </div>
      ))}
      {needsRestart && (
        <div
          data-testid="path-restart-banner"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-bubble rounded-xl border border-border text-xs"
        >
          <span className="text-text-muted">
            Restart the app so new tools are detected on PATH.
          </span>
          <button
            onClick={() => relaunchApp()}
            className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark flex-shrink-0"
          >
            Restart now
          </button>
        </div>
      )}
      <button
        onClick={onNext}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
      >
        Continue
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
      >
        Back
      </button>
    </div>
  );
}
