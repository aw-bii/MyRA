import { readdirSync, readFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import type { PluginInfo, PluginHook, PluginEvent } from "../../shared/types";

interface PluginDescriptor {
  name: string;
  command: string;
  args: string[];
  hooks: PluginHook[];
  version: string;
}

interface PluginInstance {
  info: PluginInfo;
  descriptor: PluginDescriptor;
  dir: string;
}

const plugins = new Map<string, PluginInstance>();
const hookRegistry = new Map<PluginHook, string[]>();

function registerHooks(pluginId: string, hooks: PluginHook[]) {
  for (const hook of hooks) {
    const existing = hookRegistry.get(hook) || [];
    if (!existing.includes(pluginId)) {
      hookRegistry.set(hook, [...existing, pluginId]);
    }
  }
}

export const PluginManager = {
  async discover(pluginDir: string) {
    plugins.clear();
    hookRegistry.clear();

    if (!existsSync(pluginDir)) return;

    const entries = readdirSync(pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const jsonPath = path.join(pluginDir, entry.name, "plugin.json");
      if (!existsSync(jsonPath)) continue;

      try {
        const raw = readFileSync(jsonPath, "utf-8");
        const desc: PluginDescriptor = JSON.parse(raw);
        const id = entry.name;
        if (!desc.name || !desc.command) continue;
        const info: PluginInfo = {
          id,
          name: desc.name,
          path: path.join(pluginDir, entry.name),
          command: desc.command,
          enabled: true,
          hooks: desc.hooks || [],
          version: desc.version || "0.0.0",
          lastLoadedAt: Date.now(),
          lastError: null,
        };
        plugins.set(id, {
          info,
          descriptor: desc,
          dir: path.join(pluginDir, entry.name),
        });
        registerHooks(id, info.hooks);
      } catch {
        // Skip malformed plugins
      }
    }
  },

  list(): PluginInfo[] {
    return Array.from(plugins.values()).map((p) => p.info);
  },

  getHooksFor(hook: PluginHook): PluginInfo[] {
    const ids = hookRegistry.get(hook) || [];
    return ids
      .map((id) => plugins.get(id)?.info)
      .filter(Boolean) as PluginInfo[];
  },

  toggle(id: string) {
    const plugin = plugins.get(id);
    if (!plugin) return;
    plugin.info.enabled = !plugin.info.enabled;
    if (plugin.info.enabled) {
      registerHooks(id, plugin.info.hooks);
    } else {
      for (const hook of plugin.info.hooks) {
        const existing = hookRegistry.get(hook) || [];
        hookRegistry.set(
          hook,
          existing.filter((pid) => pid !== id),
        );
      }
    }
  },

  async executeHook(
    hook: PluginHook,
    event: PluginEvent,
  ): Promise<
    Array<{
      pluginId: string;
      success: boolean;
      data?: unknown;
      error?: string;
    }>
  > {
    const results: Array<{
      pluginId: string;
      success: boolean;
      data?: unknown;
      error?: string;
    }> = [];
    const ids = hookRegistry.get(hook) || [];
    for (const pluginId of ids) {
      const plugin = plugins.get(pluginId);
      if (!plugin || !plugin.info.enabled) continue;
      try {
        const result = await this.runPlugin(plugin, event);
        results.push({ pluginId, success: true, data: result });
      } catch (err: any) {
        plugin.info.lastError = err.message;
        results.push({ pluginId, success: false, error: err.message });
      }
    }
    return results;
  },

  runPlugin(plugin: PluginInstance, event: PluginEvent): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const proc = spawn(plugin.descriptor.command, plugin.descriptor.args, {
        cwd: plugin.dir,
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10000,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ raw: stdout });
          }
        } else {
          reject(new Error(stderr || `Exited with code ${code}`));
        }
      });

      proc.on("error", reject);

      if (proc.stdin) {
        proc.stdin.write(JSON.stringify(event) + "\n");
        proc.stdin.end();
      }
    });
  },

  async reload(pluginDir: string) {
    await this.discover(pluginDir);
  },
};
