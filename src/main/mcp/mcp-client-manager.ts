import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import type {
  McpServerConfig,
  McpTool,
  McpToolCallRequest,
  McpToolCallResult,
} from "../../shared/types";

// Allowlist: command must be a plain executable name, no path separators or shell metacharacters.
const SAFE_COMMAND_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_./-]*$/;

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ServerEntry {
  config: McpServerConfig;
  process: ChildProcess | null;
  tools: McpTool[];
  pending: Map<
    string | number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >;
  buffer: string;
  nextId: number;
}

const servers = new Map<string, ServerEntry>();

const BLOCKED_ENV_KEYS = new Set([
  "PATH",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "NODE_OPTIONS",
  "NODE_PATH",
]);

export function stripDangerousEnvKeys(
  env: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => !BLOCKED_ENV_KEYS.has(k)),
  );
}

function createServerId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || randomUUID()
  );
}

function sendMessage(
  serverId: string,
  msg: Omit<JsonRpcMessage, "jsonrpc"> & { id: string | number },
) {
  const server = servers.get(serverId);
  if (!server?.process?.stdin)
    throw new Error(`Server ${serverId} not connected`);
  const full: JsonRpcMessage = { jsonrpc: "2.0", ...msg };
  server.process.stdin.write(JSON.stringify(full) + "\n");
}

function waitForResponse(
  serverId: string,
  id: string | number,
): Promise<unknown> {
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
  } catch {
    /* malformed */
  }
}

export const McpClientManager = {
  getServers(): McpServerConfig[] {
    return Array.from(servers.values()).map((s) => s.config);
  },

  addServer(config: {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  }): McpServerConfig {
    if (!SAFE_COMMAND_RE.test(config.command)) {
      throw new Error(`MCP command contains unsafe characters: ${config.command}`);
    }
    if (config.env) {
      for (const [k, v] of Object.entries(config.env)) {
        if (typeof k !== "string" || typeof v !== "string") {
          throw new Error(`MCP env keys and values must be strings`);
        }
      }
    }
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
    servers.set(serverConfig.id, {
      config: serverConfig,
      process: null,
      tools: [],
      pending: new Map(),
      buffer: "",
      nextId: 1,
    });
    return serverConfig;
  },

  removeServer(id: string) {
    this.disconnect(id);
    servers.delete(id);
  },

  connect(id: string) {
    const server = servers.get(id);
    if (!server) throw new Error(`Server ${id} not found`);
    if (!server.config.enabled) return Promise.reject(new Error(`Server ${id} is disabled`));
    if (server.process) return;

    return new Promise<void>((resolve, reject) => {
      const safeEnv = server.config.env
        ? stripDangerousEnvKeys(server.config.env)
        : {};
      const proc = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...safeEnv },
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
            if (msg.id === "init" && msg.result) {
              initResolved = true;
              resolve();
            }
            handleMessage(id, trimmed);
          } catch {
            /* buffer more */
          }
        }
      });

      proc.stderr?.on("data", () => {});

      proc.on("error", (err) => {
        if (!initResolved) reject(err);
      });

      proc.on("exit", (code) => {
        server.process = null;
        if (!initResolved)
          reject(new Error(`Process exited with code ${code}`));
      });

      sendMessage(id, {
        id: "init",
        method: "initialize",
        params: { protocolVersion: "0.1.0", capabilities: {} },
      });

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
    const result = (await waitForResponse(id, msgId)) as {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }>;
    };
    server.tools = result.tools.map((t) => ({ ...t, serverId: id }));
    server.config.tools = server.tools;
    return server.tools;
  },

  getTools(): McpTool[] {
    const all: McpTool[] = [];
    for (const [_serverId, server] of servers) {
      if (server.config.enabled) all.push(...server.tools);
    }
    return all;
  },

  async callTool(request: McpToolCallRequest): Promise<McpToolCallResult> {
    const server = servers.get(request.serverId);
    if (!server)
      return {
        success: false,
        content: "",
        error: `Server ${request.serverId} not found`,
      };
    if (!server.config.enabled)
      return {
        success: false,
        content: "",
        error: `Server ${request.serverId} is disabled`,
      };
    if (!server.process) {
      try {
        await this.connect(request.serverId);
      } catch (err: any) {
        return {
          success: false,
          content: "",
          error: `Failed to connect: ${err.message}`,
        };
      }
    }
    const msgId = server.nextId++;
    try {
      sendMessage(request.serverId, {
        id: msgId,
        method: "tools/call",
        params: { name: request.toolName, arguments: request.arguments },
      });
      const result = (await waitForResponse(request.serverId, msgId)) as {
        content: Array<{ type: string; text?: string }>;
      };
      const text = (result.content || [])
        .map((c: any) => c.text || "")
        .join("\n");
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
