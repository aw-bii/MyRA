import { useState, useEffect, useCallback } from "react";
import type { McpServerConfig, McpTool } from "../../../shared/types";
import {
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  toggleMcpServer,
  listMcpTools,
} from "../../ipc";

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase text-gray-500">
          MCP Servers
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <div className="px-3 py-2 space-y-1.5 border-b border-gray-200 dark:border-gray-700">
          <input
            placeholder="Server name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            placeholder="Command (e.g., npx)"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            placeholder="Arguments (e.g., -y @server/filesystem /tmp)"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            placeholder="Env vars (KEY=VALUE per line)"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            rows={2}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <p className="text-xs text-gray-400 text-center py-4 px-3 leading-relaxed">
            No servers configured. Add one to extend the AI with external tools.
          </p>
        )}

        {servers.map((s) => (
          <div
            key={s.id}
            className="mx-1 mb-2 p-2 rounded border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{s.name}</span>
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                  s.enabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                }`}
              >
                {s.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {s.command} {s.args.join(" ")}
            </div>
            <div className="flex gap-1 mt-1.5">
              <button
                onClick={() => handleToggle(s.id)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hoverable:hover:bg-gray-200 dark:hoverable:hover:bg-gray-600 transition-colors"
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
                <summary className="text-gray-500 dark:text-gray-400 cursor-pointer text-[10px]">
                  Tools ({s.tools.length})
                </summary>
                <ul className="mt-0.5 space-y-0.5">
                  {s.tools.map((t) => (
                    <li
                      key={t.name}
                      className="text-[10px] text-gray-500 dark:text-gray-400"
                    >
                      <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        {t.name}
                      </code>{" "}
                      {t.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        <div className="mx-1 mt-auto pt-2 px-2 pb-2 border-t dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {tools.length} tool{tools.length !== 1 ? "s" : ""} available
          </div>
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tools.map((t) => (
                <span
                  key={`${t.serverId}-${t.name}`}
                  className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded cursor-default"
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
