import { useState, useEffect, useCallback } from "react";
import type { PluginInfo } from "../../../shared/types";
import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc";

export function PluginPanel() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [reloading, setReloading] = useState(false);

  const refresh = useCallback(async () => {
    setPlugins(await listPlugins());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (id: string) => {
    await togglePlugin(id);
    await refresh();
  };

  const handleReload = async () => {
    setReloading(true);
    await reloadPlugins();
    await refresh();
    setReloading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-xs font-semibold uppercase text-gray-500">
          Plugins
        </h3>
        <button
          onClick={handleReload}
          disabled={reloading}
          className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50 transition-transform duration-100 ease-press active:scale-95"
        >
          {reloading ? "Reloading\u2026" : "Reload"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {plugins.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4 px-3 leading-relaxed">
            No plugins found. Add plugins to the plugins directory and reload.
          </p>
        )}
        <ul className="space-y-1 px-1">
          {plugins.map((plugin) => (
            <li
              key={plugin.id}
              className="text-xs p-2 rounded border dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{plugin.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    v{plugin.version}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(plugin.id)}
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                    plugin.enabled
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                  }`}
                >
                  {plugin.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              {plugin.hooks.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {plugin.hooks.map((hook) => (
                    <span
                      key={hook}
                      className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-1 rounded"
                    >
                      {hook}
                    </span>
                  ))}
                </div>
              )}
              {plugin.lastError && (
                <div
                  className="mt-1 text-[10px] text-red-500 truncate"
                  title={plugin.lastError}
                >
                  Error: {plugin.lastError}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
