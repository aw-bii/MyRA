import { IPC } from "../../shared/ipc";
import type {
  McpServerConfig,
  McpTool,
  McpToolCallResult,
} from "../../shared/types";
import { ipcInvoke } from "./index";

export async function listMcpServers(): Promise<McpServerConfig[]> {
  return ipcInvoke<McpServerConfig[]>(IPC.MCP_LIST_SERVERS);
}
export async function addMcpServer(config: {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}): Promise<McpServerConfig> {
  return ipcInvoke<McpServerConfig>(IPC.MCP_ADD_SERVER, config);
}
export async function removeMcpServer(id: string): Promise<void> {
  await ipcInvoke<void>(IPC.MCP_REMOVE_SERVER, { id });
}
export async function toggleMcpServer(
  id: string,
): Promise<McpServerConfig | undefined> {
  return ipcInvoke<McpServerConfig | undefined>(IPC.MCP_TOGGLE_SERVER, { id });
}
export async function listMcpTools(): Promise<McpTool[]> {
  return ipcInvoke<McpTool[]>(IPC.MCP_LIST_TOOLS);
}
export async function callMcpTool(request: any): Promise<McpToolCallResult> {
  return ipcInvoke<McpToolCallResult>(IPC.MCP_CALL_TOOL, request);
}
