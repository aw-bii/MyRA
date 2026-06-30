import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { probeBackend } from "../../ipc/backend";
import { AUTH_COMMANDS } from "../../constants/auth";

const BACKEND_LABELS: Record<string, string> = {
  claude: "Claude Code",
  gemini: "Gemini CLI",
  opencode: "Opencode",
};

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  statuses: BackendStatus[];
  onComplete: () => void;
  onBack: () => void;
}

export function WizardStep3({ statuses: initial, onComplete, onBack }: Props) {
  const [statuses, setStatuses] = useState(initial);
  const [recheckFailed, setRecheckFailed] = useState<Record<string, boolean>>(
    {},
  );

  const recheck = async (id: string) => {
    setRecheckFailed((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, loading: true } : s)),
    );
    const result = await probeBackend(id);
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...result, loading: false } : s)),
    );
    if (!result.authenticated) {
      setRecheckFailed((prev) => ({ ...prev, [id]: true }));
    }
  };

  const needsAuth = statuses.filter((s) => s.available && !s.authenticated);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Sign in to your AI tools</h2>
        {needsAuth.length > 0 && (
          <p className="text-xs text-text-muted">
            Open a terminal, run the command for each tool, then click Check.
          </p>
        )}
      </div>
      {needsAuth.length === 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-text-base">
            <CheckCircle
              size={16}
              weight="fill"
              className="text-primary flex-shrink-0"
            />
            All CLI tools are signed in
          </div>
          <div className="flex flex-col gap-1 pl-6">
            {statuses
              .filter((s) => s.available)
              .map((s) => (
                <span key={s.id} className="text-xs text-text-muted">
                  {BACKEND_LABELS[s.id] ?? s.id}
                </span>
              ))}
          </div>
        </div>
      )}
      {needsAuth.map((s) => (
        <div
          key={s.id}
          className="flex flex-col gap-2 border border-border rounded-xl p-4"
        >
          <div className="font-medium text-sm">
            {BACKEND_LABELS[s.id] ?? s.id}
          </div>
          <code className="text-xs bg-bubble px-3 py-2 rounded-lg">
            {AUTH_COMMANDS[s.id]}
          </code>
          <button
            onClick={() => recheck(s.id)}
            disabled={s.loading}
            className="btn-md w-full bg-bubble-strong hoverable:hover:bg-bubble disabled:opacity-50"
          >
            {s.loading ? "Checking..." : "Check"}
          </button>
          {recheckFailed[s.id] && (
            <p className="text-xs text-red-500">
              Could not verify. Run the command again and click Check.
            </p>
          )}
        </div>
      ))}
      {needsAuth.length > 0 && (
        <p className="text-xs text-text-muted text-center">
          You can finish and sign in later from Settings.
        </p>
      )}
      <button
        onClick={onComplete}
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
