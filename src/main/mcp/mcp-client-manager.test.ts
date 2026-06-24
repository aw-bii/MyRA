import { describe, it, expect, afterAll } from "vitest";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { McpClientManager, stripDangerousEnvKeys } from "./mcp-client-manager";

const ECHO_SERVER_JS = path.join(
  os.tmpdir(),
  `mcp-test-echo-${crypto.randomUUID()}.js`,
);
fs.writeFileSync(
  ECHO_SERVER_JS,
  `
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
`,
);

describe("stripDangerousEnvKeys", () => {
  it("removes PATH override", () => {
    const result = stripDangerousEnvKeys({ PATH: "/evil", MY_VAR: "ok" });
    expect(result.PATH).toBeUndefined();
    expect(result.MY_VAR).toBe("ok");
  });

  it("removes LD_PRELOAD", () => {
    const result = stripDangerousEnvKeys({ LD_PRELOAD: "/evil.so" });
    expect(result.LD_PRELOAD).toBeUndefined();
  });

  it("removes DYLD_INSERT_LIBRARIES", () => {
    const result = stripDangerousEnvKeys({
      DYLD_INSERT_LIBRARIES: "/evil.dylib",
    });
    expect(result.DYLD_INSERT_LIBRARIES).toBeUndefined();
  });

  it("removes LD_LIBRARY_PATH and NODE_OPTIONS", () => {
    const result = stripDangerousEnvKeys({
      LD_LIBRARY_PATH: "/evil",
      NODE_OPTIONS: "--inspect",
    });
    expect(result.LD_LIBRARY_PATH).toBeUndefined();
    expect(result.NODE_OPTIONS).toBeUndefined();
  });

  it("passes through safe env keys", () => {
    const result = stripDangerousEnvKeys({
      MY_TOKEN: "abc",
      API_URL: "https://x.com",
    });
    expect(result).toEqual({ MY_TOKEN: "abc", API_URL: "https://x.com" });
  });
});

describe("McpClientManager", () => {
  describe("addServer validation", () => {
    afterEach(() => {
      // clean up any servers added during these tests
      McpClientManager.getServers().forEach((s) => McpClientManager.removeServer(s.id));
    });

    it("rejects path-traversal command", () => {
      expect(() =>
        McpClientManager.addServer({
          name: "evil",
          command: "../../evil.sh",
          args: [],
        }),
      ).toThrow(/unsafe/i);
    });

    it("rejects shell-injection command", () => {
      expect(() =>
        McpClientManager.addServer({
          name: "evil2",
          command: "node;rm -rf /",
          args: [],
        }),
      ).toThrow(/unsafe/i);
    });

    it("accepts safe command names", () => {
      expect(() =>
        McpClientManager.addServer({ name: "ok", command: "npx", args: [] }),
      ).not.toThrow();
    });

    it("rejects non-string env values", () => {
      expect(() =>
        McpClientManager.addServer({
          name: "bad-env",
          command: "node",
          args: [],
          env: { KEY: 123 as unknown as string },
        }),
      ).toThrow(/env/i);
    });
  });

  afterAll(() => {
    McpClientManager.shutdownAll();
    try {
      fs.unlinkSync(ECHO_SERVER_JS);
    } catch {
      /* ok */
    }
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
    const servers2 = McpClientManager.getServers();
    await McpClientManager.connect(servers2[0].id);
    const tools = McpClientManager.getTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === "echo")).toBe(true);
  });

  it("calls a tool and gets result", async () => {
    const servers3 = McpClientManager.getServers();
    const result = await McpClientManager.callTool({
      serverId: servers3[0].id,
      toolName: "echo",
      arguments: { text: "Hello MCP" },
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain("Hello MCP");
  });

  it("removes a server", () => {
    const servers4 = McpClientManager.getServers();
    McpClientManager.removeServer(servers4[0].id);
    expect(McpClientManager.getServers().length).toBe(0);
  });

  describe("enabled check", () => {
    let serverId: string;

    beforeEach(() => {
      const cfg = McpClientManager.addServer({
        name: "disabled-server",
        command: "node",
        args: [ECHO_SERVER_JS],
      });
      serverId = cfg.id;
      // disable it via toggleServer logic (set enabled=false directly on config)
      const servers = McpClientManager.getServers();
      const s = servers.find((sv) => sv.id === serverId)!;
      s.enabled = false;
    });

    afterEach(() => {
      McpClientManager.removeServer(serverId);
    });

    it("callTool returns error for disabled server without connecting", async () => {
      const result = await McpClientManager.callTool({
        serverId,
        toolName: "echo",
        arguments: { text: "hi" },
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/disabled/i);
    });

    it("connect rejects for disabled server", async () => {
      await expect(McpClientManager.connect(serverId)).rejects.toThrow(
        /disabled/i,
      );
    });
  });
});
