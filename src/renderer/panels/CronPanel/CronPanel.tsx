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
import { CronJobForm } from "./CronJobForm";

export function CronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [logs, setLogs] = useState<Record<string, CronJobLog[]>>({});
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setJobs(await getCronJobs());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (input: {
    name: string;
    cronExpression: string;
    prompt: string;
    backend: string;
  }) => {
    await createCronJob(input);
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

      {showForm && <CronJobForm onCreate={handleCreate} />}

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
