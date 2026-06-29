import { useEffect, useState } from "react";
import { CheckCircle, MinusCircle } from "@phosphor-icons/react";
import { probeBackend } from "../../ipc/backend";

const BACKENDS = [
  { id: "claude", label: "Claude Code" },
  { id: "claude-api", label: "Claude API" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "gemini-api", label: "Gemini API" },
  { id: "opencode", label: "Opencode" },
  { id: "ollama", label: "Ollama" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "codex", label: "Codex" },
];

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  onNext: (statuses: BackendStatus[]) => void;
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin flex-shrink-0" />
  );
}

export function WizardStep1({ onNext }: Props) {
  const [statuses, setStatuses] = useState<BackendStatus[]>(
    BACKENDS.map((b) => ({
      id: b.id,
      available: false,
      authenticated: false,
      loading: true,
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    BACKENDS.forEach(async (b) => {
      try {
        const result = await probeBackend(b.id);
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === b.id ? { ...s, ...result, loading: false } : s,
          ),
        );
      } catch (err) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === b.id
              ? { ...s, available: false, authenticated: false, loading: false }
              : s,
          ),
        );
        setErrors((prev) => ({
          ...prev,
          [b.id]: `Probe failed: ${(err as Error).message}`,
        }));
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Setting up your tools</h2>
        <p className="text-xs text-text-muted">
          Checking which AI tools are installed and ready on your system.
        </p>
      </div>
      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
        {BACKENDS.map((b) => {
          const s = statuses.find((x) => x.id === b.id)!;
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 p-3 border border-border rounded-xl"
            >
              <div className="flex-shrink-0">
                {s.loading ? (
                  <Spinner />
                ) : s.available ? (
                  <CheckCircle
                    size={20}
                    weight="fill"
                    className="text-primary"
                  />
                ) : (
                  <MinusCircle
                    size={20}
                    weight="regular"
                    className="text-text-muted"
                  />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">{b.label}</div>
                <div className="text-xs text-text-muted">
                  {s.loading
                    ? "Checking..."
                    : s.available
                      ? "Found on your system"
                      : "Not installed"}
                </div>
              </div>
              {errors[b.id] && (
                <p className="text-xs text-red-500">{errors[b.id]}</p>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onNext(statuses)}
        disabled={statuses.some((s) => s.loading)}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
