import { useState, useEffect, useCallback } from "react";
import type { McpServerConfig, McpTool } from "../../../shared/types";
import {
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  toggleMcpServer,
  listMcpTools,
} from "../../ipc/mcp";

export function McpPanel() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [env, setEnv] = useState("");

  const refresh = useCallback(async () => {
    setServers(await listMcpServers());
    setTools(await listMcpTools());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!name || !command) return;
    const argsArr = args.split(/\s+/).filter(Boolean);
    const envObj: Record<string, string> = {};
    if (env.trim()) {
      env
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          const [k, ...v] = line.split("=");
          if (k) envObj[k.trim()] = v.join("=").trim();
        });
    }
    await addMcpServer({ name, command, args: argsArr, env: envObj });
    setName("");
    setCommand("");
    setArgs("");
    setEnv("");
    setShowForm(false);
    await refresh();
  };

  const handleRemove = async (id: string) => {
    await removeMcpServer(id);
    await refresh();
  };

  const handleToggle = async (id: string) => {
    await toggleMcpServer(id);
    await refresh();
  };

  return (
    <div
      role="region"
      aria-label="MCP Servers"
      className="flex flex-col h-full"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-text-muted">
          MCP Servers
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-0.5 rounded bg-primary text-on-primary hoverable:hover:bg-primary-dark transition-transform duration-100 ease-press active:scale-95"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <div className="px-3 py-2 space-y-1.5 border-b border-border">
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="mcp-server-name"
          >
            Server Name
          </label>
          <input
            id="mcp-server-name"
            placeholder="e.g., my-fileserver"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label
            className="block text-xs font-medium mb-1"
            htmlFor="mcp-command"
          >
            Command
          </label>
          <input
            id="mcp-command"
            placeholder="e.g., npx"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label className="block text-xs font-medium mb-1" htmlFor="mcp-args">
            Arguments
          </label>
          <input
            id="mcp-args"
            placeholder="e.g., -y @server/filesystem /tmp"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label className="block text-xs font-medium mb-1" htmlFor="mcp-env">
            Env Vars
          </label>
          <textarea
            id="mcp-env"
            placeholder="KEY=VALUE per line"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            rows={2}
            className="w-full text-xs border border-border-strong rounded px-2 py-1 bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleAdd}
            className="w-full text-xs py-1 rounded bg-green-600 text-white hoverable:hover:bg-green-700 transition-transform duration-100 ease-press active:scale-95"
          >
            Add Server
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {servers.length === 0 && !showForm && (
          <p className="text-xs text-text-muted text-center py-4 px-3 leading-relaxed">
            No servers configured. Add one to extend the AI with external tools.
          </p>
        )}

        {servers.map((s) => (
          <div
            key={s.id}
            className="mx-1 mb-2 p-2 rounded border border-border bg-surface text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="font-medium truncate">{s.name}</span>
                {s.backendId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bubble text-text-muted font-mono leading-none">
                    {s.backendId}
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                  s.enabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-bubble text-text-muted"
                }`}
              >
                {s.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="text-text-muted truncate mt-0.5">
              {s.command} {s.args.join(" ")}
            </div>
            <div className="flex gap-1 mt-1.5">
              <button
                onClick={() => handleToggle(s.id)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-bubble hoverable:hover:bg-bubble-strong transition-colors"
              >
                {s.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => handleRemove(s.id)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hoverable:hover:bg-red-200 dark:hoverable:hover:bg-red-800 transition-colors ml-auto"
              >
                Remove
              </button>
            </div>
            {s.tools.length > 0 && (
              <details className="mt-1">
                <summary className="text-text-muted cursor-pointer text-[10px]">
                  Tools ({s.tools.length})
                </summary>
                <ul className="mt-0.5 space-y-0.5">
                  {s.tools.map((t) => (
                    <li key={t.name} className="text-[10px] text-text-muted">
                      <code className="bg-bubble px-1 rounded">{t.name}</code>{" "}
                      {t.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        <div className="mx-1 mt-auto pt-2 px-2 pb-2 border-t border-border">
          <div className="text-xs text-text-muted">
            {tools.length} tool{tools.length !== 1 ? "s" : ""} available
          </div>
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tools.map((t) => (
                <span
                  key={`${t.serverId}-${t.name}`}
                  className="text-[10px] bg-bubble px-1.5 py-0.5 rounded cursor-default"
                  title={t.description}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
