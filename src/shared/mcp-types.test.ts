import { describe, it, expect } from "vitest";
import { IPC } from "./ipc";
import type { McpServerConfig, McpTool, McpToolCallRequest, McpToolCallResult } from "./types";

describe("MCP types", () => {
  it("McpServerConfig can be constructed", () => {
    const cfg: McpServerConfig = {
      id: "s1", name: "Filesystem", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      enabled: true, tools: [], lastSeen: null,
    };
    expect(cfg.name).toBe("Filesystem");
    expect(cfg.enabled).toBe(true);
  });

  it("McpTool can be constructed", () => {
    const tool: McpTool = {
      name: "read_file", description: "Read a file", inputSchema: {}, serverId: "s1",
    };
    expect(tool.name).toBe("read_file");
  });
});

describe("MCP IPC channels", () => {
  it("channels exist in IPC constant", () => {
    expect(IPC.MCP_LIST_SERVERS).toBe("mcp:list-servers");
    expect(IPC.MCP_ADD_SERVER).toBe("mcp:add-server");
    expect(IPC.MCP_REMOVE_SERVER).toBe("mcp:remove-server");
    expect(IPC.MCP_TOGGLE_SERVER).toBe("mcp:toggle-server");
    expect(IPC.MCP_LIST_TOOLS).toBe("mcp:list-tools");
    expect(IPC.MCP_CALL_TOOL).toBe("mcp:call-tool");
  });
});
