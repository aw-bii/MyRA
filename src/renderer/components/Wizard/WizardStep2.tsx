import { useState } from "react";
import { installBackend } from "../../ipc";
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
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    const { success: ok, error } = await installBackend(id);
    off();

    setInstalling((prev) => ({ ...prev, [id]: false }));
    setDone((prev) => ({ ...prev, [id]: ok }));
    if (!ok) {
      setErrors((prev) => ({
        ...prev,
        [id]: error ?? "Installation failed. Check your internet connection.",
      }));
    }
  };

  const startOllama = () => {
    window.ipc.invoke(IPC.OLLAMA_START).catch(() => {});
  };

  if (missing.length === 0) {
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
      {missing.map((id) => (
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
                      className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
                    >
                      Start Ollama
                    </button>
                  )}
                  <button
                    onClick={() => install(id)}
                    disabled={installing[id] || done[id]}
                    className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
                  >
                    {done[id]
                      ? "Installed"
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
              {(logs[id] ?? []).length > 0 && (
                <pre className="text-xs bg-gray-900 text-gray-300 rounded-lg p-2 max-h-24 overflow-y-auto">
                  {logs[id].join("\n")}
                </pre>
              )}
              {errors[id] && (
                <p className="text-xs text-red-500">{errors[id]}</p>
              )}
            </>
          )}
        </div>
      ))}
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
