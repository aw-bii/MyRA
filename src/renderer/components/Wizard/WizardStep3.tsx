import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { probeBackend } from "../../ipc";

const AUTH_COMMANDS: Record<string, string> = {
  claude: "claude login",
  gemini: "gemini auth login",
  opencode: "opencode auth",
};

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
}

export function WizardStep3({ statuses: initial, onComplete }: Props) {
  const [statuses, setStatuses] = useState(initial);

  const recheck = async (id: string) => {
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, loading: true } : s)),
    );
    const result = await probeBackend(id);
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...result, loading: false } : s)),
    );
  };

  const needsAuth = statuses.filter((s) => s.available && !s.authenticated);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Sign in to your AI tools</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Open a terminal, run the command for each tool, then click Check.
        </p>
      </div>
      {needsAuth.length === 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          <CheckCircle size={16} weight="fill" className="text-blue-600 flex-shrink-0" />
          All tools are signed in
        </div>
      )}
      {needsAuth.map((s) => (
        <div
          key={s.id}
          className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
        >
          <div className="font-medium text-sm">
            {BACKEND_LABELS[s.id] ?? s.id}
          </div>
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
            {AUTH_COMMANDS[s.id]}
          </code>
          <button
            onClick={() => recheck(s.id)}
            disabled={s.loading}
            className="btn-md w-full bg-gray-200 dark:bg-gray-700 hoverable:hover:bg-gray-300 dark:hoverable:hover:bg-gray-600 disabled:opacity-50"
          >
            {s.loading ? "Checking..." : "Check"}
          </button>
        </div>
      ))}
      <button
        onClick={onComplete}
        className="btn-lg bg-blue-600 text-white hoverable:hover:bg-blue-700"
      >
        Finish Setup
      </button>
    </div>
  );
}
