import { useState, useEffect, useCallback } from "react";
import type { CronJob, CronJobLog } from "../../../shared/types";
import {
  getCronJobs,
  createCronJob,
  toggleCronJob,
  deleteCronJob,
  getCronJobLogs,
  runCronJobNow,
} from "../../ipc/cron";

export function CronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [prompt, setPrompt] = useState("");
  const [backend, setBackend] = useState("claude");
  const [logs, setLogs] = useState<Record<string, CronJobLog[]>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setJobs(await getCronJobs());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!name || !cronExpression || !prompt) return;
    await createCronJob({ name, cronExpression, prompt, backend });
    setName("");
    setCronExpression("");
    setPrompt("");
    setBackend("claude");
    setShowForm(false);
    await refresh();
  };

  const handleToggle = async (id: string) => {
    await toggleCronJob(id);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteCronJob(id);
    await refresh();
  };

  const handleRunNow = async (id: string) => {
    await runCronJobNow(id);
    await refresh();
  };

  const toggleLogs = async (id: string) => {
    if (expandedJob === id) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(id);
    const jobLogs = await getCronJobLogs(id);
    setLogs((prev) => ({ ...prev, [id]: jobLogs }));
  };

  return (
    <div role="region" aria-label="Cron Jobs" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-text-muted">
          Scheduled Jobs
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-0.5 rounded bg-primary text-on-primary hoverable:hover:bg-primary-dark transition-transform duration-100 ease-press active:scale-95"
        >
          {showForm ? "Cancel" : "+ New"}
        </button>
      </div>

      {showForm && (
        <div className="px-3 py-2 space-y-1.5 border-b border-border">
          <label className="block text-xs font-medium mb-1" htmlFor="cron-name">
            Name
          </label>
          <input
            id="cron-name"
            placeholder="e.g., Daily standup"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="cron-expression"
          >
            Cron Expression
          </label>
          <input
            id="cron-expression"
            placeholder="e.g., 0 9 * * 1-5"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="cron-prompt"
          >
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
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="cron-backend"
          >
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
            onClick={handleCreate}
            className="w-full text-xs py-1 rounded bg-green-600 text-white hoverable:hover:bg-green-700 transition-transform duration-100 ease-press active:scale-95"
          >
            Create Job
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {jobs.length === 0 && !showForm && (
          <p className="text-xs text-text-muted text-center py-4 px-3 leading-relaxed">
            No scheduled jobs yet. Create one to automate recurring tasks.
          </p>
        )}
        <ul className="space-y-1 px-1">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="text-xs p-2 rounded border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{job.name}</div>
                  <div className="text-[10px] text-text-muted truncate">
                    {job.cronExpression}
                  </div>
                </div>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                    job.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : job.status === "paused"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                <button
                  onClick={() => handleToggle(job.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-bubble hoverable:hover:bg-bubble-strong transition-[background-color,transform] duration-100 ease-press active:scale-95"
                >
                  {job.status === "active" ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => handleRunNow(job.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-bubble hoverable:hover:bg-bubble-strong transition-[background-color,transform] duration-100 ease-press active:scale-95"
                >
                  Run now
                </button>
                <button
                  onClick={() => toggleLogs(job.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-bubble hoverable:hover:bg-bubble-strong transition-[background-color,transform] duration-100 ease-press active:scale-95"
                >
                  Logs
                </button>
                <button
                  onClick={() => handleDelete(job.id)}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hoverable:hover:bg-red-200 dark:hoverable:hover:bg-red-800 transition-[background-color,transform] duration-100 ease-press active:scale-95 ml-auto"
                >
                  Delete
                </button>
              </div>
              {expandedJob === job.id && logs[job.id] && (
                <div className="mt-1 max-h-24 overflow-y-auto border-t border-border pt-1">
                  {logs[job.id].length === 0 && (
                    <div className="text-[10px] text-text-muted">No logs</div>
                  )}
                  {logs[job.id].map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-1 text-[10px] text-text-muted"
                    >
                      <span
                        className={
                          log.success ? "text-green-500" : "text-red-500"
                        }
                      >
                        {log.success ? "OK" : "ERR"}
                      </span>
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.error && (
                        <span className="text-red-500 truncate">
                          : {log.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
