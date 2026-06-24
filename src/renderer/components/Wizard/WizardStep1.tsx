import { useEffect, useState } from "react";
import { CheckCircle, MinusCircle } from "@phosphor-icons/react";
import { probeBackend } from "../../ipc";

const BACKENDS = [
  { id: "claude", label: "Claude Code", bundled: true },
  { id: "gemini", label: "Gemini CLI", bundled: false },
  { id: "opencode", label: "Opencode", bundled: false },
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
    <div className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-blue-600 animate-spin flex-shrink-0" />
  );
}

export function WizardStep1({ onNext }: Props) {
  const [statuses, setStatuses] = useState<BackendStatus[]>(
    BACKENDS.map((b) => ({
      id: b.id,
      available: b.bundled,
      authenticated: b.bundled,
      loading: !b.bundled,
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    BACKENDS.filter((b) => !b.bundled).forEach(async (b) => {
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
            s.id === b.id ? { ...s, available: false, authenticated: false, loading: false } : s,
          ),
        );
        setErrors((prev) => ({ ...prev, [b.id]: `Probe failed: ${(err as Error).message}` }));
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Setting up your tools</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Claude Code is built in and ready. Checking if you have any additional
          AI tools installed.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {BACKENDS.map((b, i) => {
          const s = statuses[i];
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl"
            >
              <div className="flex-shrink-0">
                {s.loading ? (
                  <Spinner />
                ) : s.available ? (
                  <CheckCircle
                    size={20}
                    weight="fill"
                    className="text-blue-600"
                  />
                ) : (
                  <MinusCircle
                    size={20}
                    weight="regular"
                    className="text-gray-300 dark:text-gray-600"
                  />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">{b.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {b.bundled
                    ? "Included — always available"
                    : s.loading
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
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
