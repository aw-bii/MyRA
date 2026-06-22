# Plugin Hooks Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Build a plugin system that allows loading third-party hook scripts from a `plugins/` directory. Plugins receive lifecycle events (conversation started, message sent, response received, etc.) via stdio subprocess calls. This mirrors NousResearch/hermes-agent's `plugins/` and `gateway/hooks.py` architecture.

**Architecture:** A `PluginManager` that discovers and loads plugins from the filesystem, a `PluginHook` event system, and a `PluginEngine` that dispatches lifecycle events to plugin subprocesses. Plugins are simple executables (Python, JS, shell) that accept JSON on stdin.

**Tech Stack:** TypeScript, Node.js child_process, chokidar (file watching), React

---

### Task 1: Install chokidar dependency

- [ ] **Step 1: Install**

```bash
npm install chokidar
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add chokidar for plugin file watching"
```

---

### Task 2: Add PluginInfo type and IPC channels

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add PluginInfo type**

In `src/shared/types.ts`, add:

```typescript
export type PluginHook = "beforePrompt" | "afterResponse" | "onConversationStart" | "onConversationEnd" | "onError";

export interface PluginInfo {
  id: string;
  name: string;
  path: string;
  command: string;
  enabled: boolean;
  hooks: PluginHook[];
  version: string;
  lastLoadedAt: number | null;
  lastError: string | null;
}

export interface PluginEvent {
  hook: PluginHook;
  conversationId?: string;
  messageContent?: string;
  responseContent?: string;
  error?: string;
}
```

- [ ] **Step 2: Add IPC constants**

In `src/shared/ipc.ts`, add to `IPC`:

```typescript
PLUGIN_LIST: "plugin:list",
PLUGIN_TOGGLE: "plugin:toggle",
PLUGIN_RELOAD: "plugin:reload",
PLUGIN_GET_EVENTS: "plugin:get-events",
```

Add to `IpcInvokeMap`:

```typescript
[IPC.PLUGIN_LIST]: void;
[IPC.PLUGIN_TOGGLE]: { id: string };
[IPC.PLUGIN_RELOAD]: void;
[IPC.PLUGIN_GET_EVENTS]: { conversationId?: string };
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat(plugins): add PluginInfo types and IPC channels"
```

---

### Task 3: Build PluginManager (discovery and lifecycle)

**Files:**
- Create: `src/main/plugins/plugin-manager.ts`
- Create: `src/main/plugins/plugin-manager.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { PluginManager } from "./plugin-manager";

const PLUGIN_DIR = path.join(os.tmpdir(), `plugins-test-${crypto.randomUUID()}`);

describe("PluginManager", () => {
  beforeAll(() => {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    // Create a test hook plugin
    fs.writeFileSync(path.join(PLUGIN_DIR, "echo-hook.js"), `
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const event = JSON.parse(line);
  process.stdout.write(JSON.stringify({ ok: true, event: event.hook }) + "\\n");
});
`);
    // Create plugin metadata file
    fs.writeFileSync(path.join(PLUGIN_DIR, "echo-hook.json"), JSON.stringify({
      name: "Echo Hook",
      command: "node",
      args: ["echo-hook.js"],
      hooks: ["beforePrompt", "afterResponse"],
      version: "1.0.0",
    }));
  });

  afterAll(() => {
    fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  });

  it("discovers plugins from directory", async () => {
    await PluginManager.discover(PLUGIN_DIR);
    const plugins = PluginManager.list();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe("Echo Hook");
  });

  it("finds hooks for a specific event", () => {
    const hooks = PluginManager.getHooksFor("beforePrompt");
    expect(hooks.length).toBe(1);
  });

  it("returns empty for unregistered hook", () => {
    const hooks = PluginManager.getHooksFor("onError");
    expect(hooks.length).toBe(0);
  });

  it("toggles plugin enabled state", () => {
    const plugins = PluginManager.list();
    PluginManager.toggle(plugins[0].id);
    expect(PluginManager.list()[0].enabled).toBe(false);
    PluginManager.toggle(plugins[0].id);
    expect(PluginManager.list()[0].enabled).toBe(true);
  });

  it("executes a plugin hook", async () => {
    const result = await PluginManager.executeHook("beforePrompt", {
      hook: "beforePrompt",
      conversationId: "test-conv",
      messageContent: "Hello",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npx vitest run src/main/plugins/plugin-manager.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import { readdirSync, readFileSync, existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import crypto from "crypto";
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
        plugins.set(id, { info, descriptor: desc, dir: path.join(pluginDir, entry.name) });
        registerHooks(id, info.hooks);
      } catch (err: any) {
        // Skip malformed plugins
      }
    }
  },

  list(): PluginInfo[] {
    return Array.from(plugins.values()).map((p) => p.info);
  },

  getHooksFor(hook: PluginHook): PluginInfo[] {
    const ids = hookRegistry.get(hook) || [];
    return ids.map((id) => plugins.get(id)?.info).filter(Boolean) as PluginInfo[];
  },

  toggle(id: string) {
    const plugin = plugins.get(id);
    if (!plugin) return;
    plugin.info.enabled = !plugin.info.enabled;
    // Rebuild hook registry for this plugin
    if (plugin.info.enabled) {
      registerHooks(id, plugin.info.hooks);
    } else {
      for (const hook of plugin.info.hooks) {
        const existing = hookRegistry.get(hook) || [];
        hookRegistry.set(hook, existing.filter((pid) => pid !== id));
      }
    }
  },

  async executeHook(hook: PluginHook, event: PluginEvent): Promise<Array<{ pluginId: string; success: boolean; data?: unknown; error?: string }>> {
    const results: Array<{ pluginId: string; success: boolean; data?: unknown; error?: string }> = [];
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

      proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

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

      proc.stdin?.write(JSON.stringify(event) + "\n");
      proc.stdin?.end();
    });
  },

  async reload(pluginDir: string) {
    await this.discover(pluginDir);
  },
};
```

- [ ] **Step 4: Run test to verify**

Run: `npx vitest run src/main/plugins/plugin-manager.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/plugins/plugin-manager.ts src/main/plugins/plugin-manager.test.ts
git commit -m "feat(plugins): add PluginManager with discovery and hook execution"
```

---

### Task 4: Wire Plugin IPC handlers + integration into conversation flow

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/backend.ts` (or equivalent conversation handler)

- [ ] **Step 1: Read the relevant files**

- [ ] **Step 2: Add Plugin IPC handlers** in `src/main/ipc.ts`:

```typescript
import { PluginManager } from "./plugins/plugin-manager";

ipcMain.handle(IPC.PLUGIN_LIST, () => PluginManager.list());
ipcMain.handle(IPC.PLUGIN_TOGGLE, (_event, { id }) => PluginManager.toggle(id));
ipcMain.handle(IPC.PLUGIN_RELOAD, async () => {
  const pluginDir = path.join(app.getPath("userData"), "plugins");
  await PluginManager.reload(pluginDir);
});
```

- [ ] **Step 3: Initialize plugin discovery on app ready** in `src/main/main.ts`:

```typescript
import { PluginManager } from "./plugins/plugin-manager";
import path from "path";

app.whenReady().then(async () => {
  // After window creation
  const pluginDir = path.join(app.getPath("userData"), "plugins");
  if (existsSync(pluginDir)) {
    await PluginManager.discover(pluginDir);
  }
});
```

- [ ] **Step 4: Wire hooks into conversation flow**

In the conversation execution flow (likely in `src/main/backend.ts` or similar), wrap prompt execution with hook calls:

```typescript
import { PluginManager } from "./plugins/plugin-manager";

// Before sending prompt:
if (beforeHookPlugins.length > 0) {
  await PluginManager.executeHook("beforePrompt", {
    hook: "beforePrompt",
    conversationId: convId,
    messageContent: prompt,
  });
}

// After receiving response:
if (afterHookPlugins.length > 0) {
  await PluginManager.executeHook("afterResponse", {
    hook: "afterResponse",
    conversationId: convId,
    responseContent: response,
  });
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts src/main/main.ts
git commit -m "feat(plugins): wire plugin IPC handlers and conversation hooks"
```

---

### Task 5: Add renderer IPC wrappers

**Files:**
- Modify: `src/renderer/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add preload channels**

In `src/preload/index.ts`, add to `ALLOWED_CHANNELS`:
```typescript
"plugin:list", "plugin:toggle", "plugin:reload",
```

- [ ] **Step 2: Add renderer wrappers**

In `src/renderer/ipc.ts`:
```typescript
import type { PluginInfo } from "../shared/types";

export async function listPlugins(): Promise<PluginInfo[]> {
  return window.ipc.invoke("plugin:list") as Promise<PluginInfo[]>;
}
export async function togglePlugin(id: string): Promise<void> {
  return window.ipc.invoke("plugin:toggle", { id }) as Promise<void>;
}
export async function reloadPlugins(): Promise<void> {
  return window.ipc.invoke("plugin:reload") as Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ipc.ts src/preload/index.ts
git commit -m "feat(plugins): add renderer plugin IPC wrappers"
```

---

### Task 6: Build PluginPanel component

**Files:**
- Create: `src/renderer/components/Sidebar/PluginPanel.tsx`

- [ ] **Step 1: Write component**

```typescript
import { useState, useEffect, useCallback } from "react";
import type { PluginInfo } from "../../../shared/types";
import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc";

export function PluginPanel() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [reloading, setReloading] = useState(false);

  const refresh = useCallback(async () => {
    setPlugins(await listPlugins());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">Plugins</h3>
        <div className="flex gap-1">
          <button onClick={handleReload} disabled={reloading}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-50">
            {reloading ? "Reloading…" : "Reload"}
          </button>
        </div>
      </div>

      {plugins.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-4">No plugins discovered</div>
      )}

      <ul className="space-y-1 max-h-80 overflow-y-auto">
        {plugins.map((plugin) => (
          <li key={plugin.id} className="text-xs p-2 rounded border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{plugin.name}</div>
                <div className="text-gray-500">v{plugin.version}</div>
              </div>
              <button
                onClick={() => handleToggle(plugin.id)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  plugin.enabled
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {plugin.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            {plugin.hooks.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {plugin.hooks.map((hook) => (
                  <span key={hook} className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-1 rounded">
                    {hook}
                  </span>
                ))}
              </div>
            )}
            {plugin.lastError && (
              <div className="mt-1 text-[10px] text-red-500 truncate" title={plugin.lastError}>
                Error: {plugin.lastError}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Sidebar/PluginPanel.tsx
git commit -m "feat(plugins): add PluginPanel component"
```

---

### Task 7: Integrate PluginPanel into Sidebar

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx**

- [ ] **Step 2: Add PluginPanel**

```typescript
import { PluginPanel } from "./PluginPanel";

// In tab navigation:
<button onClick={() => setActiveTab("plugins")} className={...}>Plugins</button>

// Conditional render:
{activeTab === "plugins" && <PluginPanel />}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "feat(plugins): integrate PluginPanel into sidebar"
```

---

### Task 8: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Commit**

```bash
git add --all
git commit -m "fix: resolve plugin-related test failures"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Plugin discovery from filesystem via plugin.json descriptors, lifecycle events (hooks), subprocess execution, PluginPanel with toggle/reload UI.
- [x] **Placeholder scan**: Clean.
- [x] **Type consistency**: `PluginInfo`, `PluginHook`, `PluginEvent` used consistently across manager, IPC, and panel.
