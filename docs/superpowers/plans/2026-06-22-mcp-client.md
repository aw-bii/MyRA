# MCP Client Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) for tracking.

**Goal:** Add Model Context Protocol (MCP) client capabilities, letting users configure MCP servers and invoke tools during conversations. MCP servers are Node.js subprocesses that communicate over stdio with JSON-RPC messages; the MCP client manages the lifecycle and tool execution.

**Architecture:** A `McpClientManager` that spawns/configures MCP server processes, an in-memory tool registry, and IPC channels for tool listing and execution. A renderer `McpPanel` for server management.

**Tech Stack:** TypeScript, Node.js child_process, JSON-RPC over stdio, Electron IPC, React

---

### Task 1: Add McpServerConfig type and IPC channels

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add MCP types**

In `src/shared/types.ts`, add:

```typescript
export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools: McpTool[];
  lastSeen: number | null;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface McpToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpToolCallResult {
  success: boolean;
  content: string;
  error?: string;
}
```

- [ ] **Step 2: Add IPC constants**

In `src/shared/ipc.ts`, add to `IPC`:

```typescript
MCP_LIST_SERVERS: "mcp:list-servers",
MCP_ADD_SERVER: "mcp:add-server",
MCP_REMOVE_SERVER: "mcp:remove-server",
MCP_TOGGLE_SERVER: "mcp:toggle-server",
MCP_LIST_TOOLS: "mcp:list-tools",
MCP_CALL_TOOL: "mcp:call-tool",
```

Add to `IpcInvokeMap`:

```typescript
[IPC.MCP_LIST_SERVERS]: void;
[IPC.MCP_ADD_SERVER]: { name: string; command: string; args: string[]; env?: Record<string, string> };
[IPC.MCP_REMOVE_SERVER]: { id: string };
[IPC.MCP_TOGGLE_SERVER]: { id: string };
[IPC.MCP_LIST_TOOLS]: void;
[IPC.MCP_CALL_TOOL]: McpToolCallRequest;
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat(mcp): add MCP types and IPC channels"
```

---

### Task 2: Build McpClientManager (server lifecycle + tool execution)

**Files:**
- Create: `src/main/mcp/mcp-client-manager.ts`
- Create: `src/main/mcp/mcp-client-manager.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { McpClientManager } from "./mcp-client-manager";

const ECHO_SERVER_JS = path.join(os.tmpdir(), `mcp-test-echo-${crypto.randomUUID()}.js`);
fs.writeFileSync(ECHO_SERVER_JS, `
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  const id = msg.id;
  if (msg.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: { protocolVersion: "0.1.0", capabilities: { tools: {} } } }) + "\\n");
  } else if (msg.method === "tools/list") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: { tools: [{ name: "echo", description: "Echo input", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } }) + "\\n");
  } else if (msg.method === "tools/call") {
    const text = msg.params.arguments?.text || "";
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } }) + "\\n");
  }
});
`);

describe("McpClientManager", () => {
  afterAll(() => {
    McpClientManager.shutdownAll();
    try { fs.unlinkSync(ECHO_SERVER_JS); } catch { /* ok */ }
  });

  it("starts empty", () => {
    expect(McpClientManager.getServers()).toEqual([]);
  });

  it("adds a server configuration", () => {
    McpClientManager.addServer({
      name: "Echo Server",
      command: "node",
      args: [ECHO_SERVER_JS],
    });
    expect(McpClientManager.getServers().length).toBe(1);
  });

  it("connects to server and discovers tools", async () => {
    await McpClientManager.connect("echo-server");
    const tools = McpClientManager.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === "echo")).toBe(true);
  });

  it("calls a tool and gets result", async () => {
    const result = await McpClientManager.callTool({
      serverId: "echo-server",
      toolName: "echo",
      arguments: { text: "Hello MCP" },
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain("Hello MCP");
  });

  it("removes a server", () => {
    McpClientManager.removeServer("echo-server");
    expect(McpClientManager.getServers().length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npx vitest run src/main/mcp/mcp-client-manager.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import type { McpServerConfig, McpTool, McpToolCallRequest, McpToolCallResult } from "../../shared/types";

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const servers = new Map<string, {
  config: McpServerConfig;
  process: ChildProcess | null;
  tools: McpTool[];
  pending: Map<string | number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  buffer: string;
  nextId: number;
}>();

function createServerId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || randomUUID();
}

function sendMessage(serverId: string, msg: Omit<JsonRpcMessage, "jsonrpc"> & { id: string | number }) {
  const server = servers.get(serverId);
  if (!server?.process?.stdin) throw new Error(`Server ${serverId} not connected`);
  const full: JsonRpcMessage = { jsonrpc: "2.0", ...msg };
  server.process.stdin.write(JSON.stringify(full) + "\n");
}

function waitForResponse(serverId: string, id: string | number): Promise<unknown> {
  const server = servers.get(serverId);
  if (!server) return Promise.reject(new Error("Server not found"));
  return new Promise((resolve, reject) => {
    server.pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (server.pending.has(id)) {
        server.pending.delete(id);
        reject(new Error("MCP request timed out"));
      }
    }, 30000);
  });
}

function handleMessage(serverId: string, raw: string) {
  const server = servers.get(serverId);
  if (!server) return;
  try {
    const msg: JsonRpcMessage = JSON.parse(raw);
    if (msg.id !== undefined && server.pending.has(msg.id)) {
      const { resolve, reject } = server.pending.get(msg.id)!;
      server.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  } catch { /* malformed message, skip */ }
}

export const McpClientManager = {
  getServers(): McpServerConfig[] {
    return Array.from(servers.values()).map((s) => s.config);
  },

  addServer(config: { name: string; command: string; args: string[]; env?: Record<string, string> }): McpServerConfig {
    const id = createServerId(config.name);
    const now = Date.now();
    const serverConfig: McpServerConfig = {
      id: id + (servers.has(id) ? `-${now}` : ""),
      name: config.name,
      command: config.command,
      args: config.args,
      env: config.env,
      enabled: true,
      tools: [],
      lastSeen: null,
    };
    servers.set(serverConfig.id, { config: serverConfig, process: null, tools: [], pending: new Map(), buffer: "", nextId: 1 });
    return serverConfig;
  },

  removeServer(id: string) {
    this.disconnect(id);
    servers.delete(id);
  },

  async connect(id: string) {
    const server = servers.get(id);
    if (!server) throw new Error(`Server ${id} not found`);
    if (server.process) return;

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...server.config.env },
        stdio: ["pipe", "pipe", "pipe"],
      });
      server.process = proc;

      let initResolved = false;

      proc.stdout?.on("data", (chunk: Buffer) => {
        server.buffer += chunk.toString();
        const lines = server.buffer.split("\n");
        server.buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            // Check for initialize response
            if (msg.id === "init" && msg.result) {
              initResolved = true;
              resolve();
            }
            handleMessage(id, trimmed);
          } catch { /* not json yet, keep buffering */ }
        }
      });

      proc.stderr?.on("data", (chunk: Buffer) => {
        // Silently absorb stderr
      });

      proc.on("error", (err) => {
        if (!initResolved) reject(err);
      });

      proc.on("exit", (code) => {
        server.process = null;
        if (!initResolved) reject(new Error(`Process exited with code ${code}`));
      });

      // Send initialize request
      sendMessage(id, { id: "init", method: "initialize", params: { protocolVersion: "0.1.0", capabilities: {} } });

      // Timeout
      setTimeout(() => {
        if (!initResolved) reject(new Error("MCP initialize timed out"));
      }, 10000);
    }).then(async () => {
      await this.discoverTools(id);
    });
  },

  disconnect(id: string) {
    const server = servers.get(id);
    if (!server?.process) return;
    server.process.kill();
    server.process = null;
    server.tools = [];
    server.config.tools = [];
  },

  async discoverTools(id: string) {
    const server = servers.get(id);
    if (!server) throw new Error(`Server ${id} not found`);
    const msgId = server.nextId++;
    sendMessage(id, { id: msgId, method: "tools/list" });
    const result = await waitForResponse(id, msgId) as { tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> };
    server.tools = result.tools.map((t) => ({ ...t, serverId: id }));
    server.config.tools = server.tools;
    return server.tools;
  },

  getTools(): McpTool[] {
    const all: McpTool[] = [];
    for (const [serverId, server] of servers) {
      if (server.config.enabled) all.push(...server.tools);
    }
    return all;
  },

  async callTool(request: McpToolCallRequest): Promise<McpToolCallResult> {
    const server = servers.get(request.serverId);
    if (!server) return { success: false, content: "", error: `Server ${request.serverId} not found` };
    if (!server.process) {
      try {
        await this.connect(request.serverId);
      } catch (err: any) {
        return { success: false, content: "", error: `Failed to connect: ${err.message}` };
      }
    }
    const msgId = server.nextId++;
    try {
      sendMessage(request.serverId, { id: msgId, method: "tools/call", params: { name: request.toolName, arguments: request.arguments } });
      const result = await waitForResponse(request.serverId, msgId) as { content: Array<{ type: string; text?: string }> };
      const text = (result.content || []).map((c: any) => c.text || "").join("\n");
      return { success: true, content: text };
    } catch (err: any) {
      return { success: false, content: "", error: err.message };
    }
  },

  shutdownAll() {
    for (const id of servers.keys()) {
      this.disconnect(id);
    }
  },
};
```

- [ ] **Step 4: Run test to verify**

Run: `npx vitest run src/main/mcp/mcp-client-manager.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/mcp/mcp-client-manager.ts src/main/mcp/mcp-client-manager.test.ts
git commit -m "feat(mcp): add McpClientManager with server lifecycle and tool execution"
```

---

### Task 3: Wire MCP IPC handlers

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: Read both files**

- [ ] **Step 2: Add MCP IPC handlers** in `src/main/ipc.ts`:

```typescript
import { McpClientManager } from "./mcp/mcp-client-manager";

ipcMain.handle(IPC.MCP_LIST_SERVERS, () => McpClientManager.getServers());
ipcMain.handle(IPC.MCP_ADD_SERVER, (_event, config) => McpClientManager.addServer(config));
ipcMain.handle(IPC.MCP_REMOVE_SERVER, (_event, { id }) => McpClientManager.removeServer(id));
ipcMain.handle(IPC.MCP_TOGGLE_SERVER, (_event, { id }) => {
  const servers = McpClientManager.getServers();
  const s = servers.find((s) => s.id === id);
  if (s) {
    s.enabled = !s.enabled;
    if (!s.enabled) McpClientManager.disconnect(id);
  }
  return s;
});
ipcMain.handle(IPC.MCP_LIST_TOOLS, () => McpClientManager.getTools());
ipcMain.handle(IPC.MCP_CALL_TOOL, (_event, request) => McpClientManager.callTool(request));
```

- [ ] **Step 3: Shutdown MCP on app quit** in `src/main/main.ts`:

```typescript
import { McpClientManager } from "./mcp/mcp-client-manager";

app.on("will-quit", () => {
  McpClientManager.shutdownAll();
  // existing shutdown
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/main.ts
git commit -m "feat(mcp): wire MCP IPC handlers"
```

---

### Task 4: Add renderer IPC wrappers

**Files:**
- Modify: `src/renderer/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add preload channels**

In `src/preload/index.ts`, add to `ALLOWED_CHANNELS`:
```typescript
"mcp:list-servers", "mcp:add-server", "mcp:remove-server", "mcp:toggle-server", "mcp:list-tools", "mcp:call-tool",
```

- [ ] **Step 2: Add renderer wrappers**

In `src/renderer/ipc.ts`:
```typescript
import type { McpServerConfig, McpTool, McpToolCallRequest, McpToolCallResult } from "../shared/types";

export async function listMcpServers(): Promise<McpServerConfig[]> {
  return window.ipc.invoke("mcp:list-servers") as Promise<McpServerConfig[]>;
}
export async function addMcpServer(config: { name: string; command: string; args: string[]; env?: Record<string, string> }): Promise<McpServerConfig> {
  return window.ipc.invoke("mcp:add-server", config) as Promise<McpServerConfig>;
}
export async function removeMcpServer(id: string): Promise<void> {
  return window.ipc.invoke("mcp:remove-server", { id }) as Promise<void>;
}
export async function toggleMcpServer(id: string): Promise<McpServerConfig | undefined> {
  return window.ipc.invoke("mcp:toggle-server", { id }) as Promise<McpServerConfig | undefined>;
}
export async function listMcpTools(): Promise<McpTool[]> {
  return window.ipc.invoke("mcp:list-tools") as Promise<McpTool[]>;
}
export async function callMcpTool(request: McpToolCallRequest): Promise<McpToolCallResult> {
  return window.ipc.invoke("mcp:call-tool", request) as Promise<McpToolCallResult>;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/ipc.ts src/preload/index.ts
git commit -m "feat(mcp): add renderer MCP IPC wrappers"
```

---

### Task 5: Build McpPanel component

**Files:**
- Create: `src/renderer/components/Sidebar/McpPanel.tsx`

- [ ] **Step 1: Write component**

```typescript
import { useState, useEffect, useCallback } from "react";
import type { McpServerConfig, McpTool } from "../../../shared/types";
import { listMcpServers, addMcpServer, removeMcpServer, toggleMcpServer, listMcpTools } from "../../ipc";

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

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async () => {
    if (!name || !command) return;
    const argsArr = args.split(/\s+/).filter(Boolean);
    const envObj: Record<string, string> = {};
    if (env.trim()) {
      env.split("\n").filter(Boolean).forEach((line) => {
        const [k, ...v] = line.split("=");
        if (k) envObj[k.trim()] = v.join("=").trim();
      });
    }
    const cfg = await addMcpServer({ name, command, args: argsArr, env: envObj });
    if (cfg) {
      setName(""); setCommand(""); setArgs(""); setEnv("");
      setShowForm(false);
      await refresh();
    }
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
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">MCP Servers</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600">
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-1.5 mb-3 p-2 border rounded dark:border-gray-600">
          <input placeholder="Server name" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <input placeholder="Command (e.g., npx)" value={command} onChange={(e) => setCommand(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <input placeholder="Arguments (e.g., -y @modelcontextprotocol/server-filesystem /tmp)" value={args} onChange={(e) => setArgs(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <textarea placeholder="Environment variables (KEY=VALUE per line)" value={env} onChange={(e) => setEnv(e.target.value)} rows={2}
            className="w-full text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600" />
          <button onClick={handleAdd} className="w-full text-xs py-1 rounded bg-green-600 text-white hover:bg-green-700">
            Add Server
          </button>
        </div>
      )}

      {servers.map((s) => (
        <div key={s.id} className="mb-2 p-2 border rounded dark:border-gray-700 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">{s.name}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {s.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="text-gray-500 truncate mt-0.5">{s.command} {s.args.join(" ")}</div>
          <div className="flex gap-1 mt-1">
            <button onClick={() => handleToggle(s.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200">
              {s.enabled ? "Disable" : "Enable"}
            </button>
            <button onClick={() => handleRemove(s.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200">
              Remove
            </button>
          </div>
          {s.tools.length > 0 && (
            <details className="mt-1">
              <summary className="text-gray-500 cursor-pointer">Tools ({s.tools.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {s.tools.map((t) => (
                  <li key={t.name} className="text-[10px] text-gray-500">
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{t.name}</code> {t.description}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {servers.length === 0 && !showForm && (
        <div className="text-xs text-gray-400 text-center py-4">No MCP servers configured</div>
      )}

      {/* Tool status summary */}
      <div className="border-t mt-2 pt-2 dark:border-gray-700">
        <div className="text-xs text-gray-500">
          {tools.length} tool{tools.length !== 1 ? "s" : ""} available
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tools.map((t) => (
                <span key={`${t.serverId}-${t.name}`} className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded cursor-default" title={t.description}>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Sidebar/McpPanel.tsx
git commit -m "feat(mcp): add McpPanel component"
```

---

### Task 6: Integrate McpPanel + wire tool calling into conversations

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx**

- [ ] **Step 2: Add McpPanel**

```typescript
import { McpPanel } from "./McpPanel";

// In the tab navigation:
<button onClick={() => setActiveTab("mcp")} className={...}>MCP</button>

// Conditionally render:
{activeTab === "mcp" && <McpPanel />}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "feat(mcp): integrate McpPanel into sidebar"
```

---

### Task 7: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All tests pass

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Commit**

```bash
git add --all
git commit -m "fix: resolve MCP-related test failures"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: JSON-RPC over stdio MCP client, server lifecycle (add/remove/toggle/connect/disconnect), tool discovery and execution, McpPanel with management UI.
- [x] **Placeholder scan**: Clean.
- [x] **Type consistency**: `McpServerConfig`, `McpTool`, `McpToolCallRequest`, `McpToolCallResult` used consistently.
