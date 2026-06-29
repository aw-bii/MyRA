import { useState, useEffect, useCallback } from "react";
import type { PluginInfo } from "../../../shared/types";
import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc/plugin";

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
    <div role="region" aria-label="Plugins" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-xs font-semibold uppercase text-text-muted">
          Plugins
        </h3>
        <button
          onClick={handleReload}
          disabled={reloading}
          className="text-xs px-2 py-0.5 rounded bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50 transition-transform duration-100 ease-press active:scale-95"
        >
          {reloading ? "Reloading\u2026" : "Reload"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {plugins.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4 px-3 leading-relaxed">
            No plugins found. Add plugins to the plugins directory and reload.
          </p>
        )}
        <ul className="space-y-1 px-1">
          {plugins.map((plugin) => (
            <li
              key={plugin.id}
              className="text-xs p-2 rounded border border-border bg-surface"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{plugin.name}</div>
                  <div className="text-[10px] text-text-muted">
                    v{plugin.version}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(plugin.id)}
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                    plugin.enabled
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-bubble text-text-muted"
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
                      className="text-[10px] bg-primary-ghost text-primary px-1 rounded"
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
