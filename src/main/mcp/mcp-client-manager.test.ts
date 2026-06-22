import { describe, it, expect, afterAll } from "vitest";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { McpClientManager } from "./mcp-client-manager";

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

describe("McpClientManager", () => {
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
});
