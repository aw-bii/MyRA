import { useState } from "react";

interface Props {
  onCreate: (input: {
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }) => void;
}

export function CronJobForm({ onCreate }: Props) {
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backend, setBackend] = useState("claude");

  const handleSubmit = () => {
    if (!name || !cronExpression || !prompt) return;
    onCreate({ name, cronExpression, prompt, backend });
    setName("");
    setCronExpression("");
    setPrompt("");
    setBackend("claude");
  };

  return (
    <div className="px-3 py-2 space-y-1.5 border-b border-border">
      <label className="block text-xs font-medium" htmlFor="cron-name">
        Name
      </label>
      <input
        id="cron-name"
        placeholder="e.g., Daily standup"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium" htmlFor="cron-expr">
        Cron Expression
      </label>
      <input
        id="cron-expr"
        placeholder="e.g., 0 9 * * 1-5"
        value={cronExpression}
        onChange={(e) => setCronExpression(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium" htmlFor="cron-prompt">
        Prompt
      </label>
      <textarea
        id="cron-prompt"
        placeholder="Message to execute"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <label className="block text-xs font-medium" htmlFor="cron-backend">
        Backend
      </label>
      <select
        id="cron-backend"
        value={backend}
        onChange={(e) => setBackend(e.target.value)}
        className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="claude">Claude Code</option>
        <option value="gemini">Gemini CLI</option>
        <option value="opencode">Opencode</option>
      </select>
      <button
        onClick={handleSubmit}
        className="w-full text-xs py-1 rounded bg-green-600 text-white hoverable:hover:bg-green-700 active:scale-95 transition-transform duration-100 ease-press"
      >
        Create Job
      </button>
    </div>
  );
}
