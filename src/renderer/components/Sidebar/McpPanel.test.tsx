import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { McpPanel } from "./McpPanel";

vi.mock("../../ipc/mcp", () => ({
  listMcpServers: vi.fn(),
  addMcpServer: vi.fn(),
  removeMcpServer: vi.fn(),
  toggleMcpServer: vi.fn(),
  listMcpTools: vi.fn(),
}));

import {
  listMcpServers,
  addMcpServer,
  removeMcpServer,
  toggleMcpServer,
  listMcpTools,
} from "../../ipc/mcp";

describe("McpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no servers", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No servers configured/i)).toBeTruthy();
    });
  });

  it("renders server list", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([
      {
        id: "fs",
        name: "Filesystem",
        command: "npx",
        args: ["-y", "server-fs", "/tmp"],
        enabled: true,
        tools: [],
        lastSeen: null,
      },
    ]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    await waitFor(() => {
      expect(screen.getByText("Filesystem")).toBeTruthy();
    });
  });

  it("shows add form when + Add clicked", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    await waitFor(() => {
      expect(screen.getByText("+ Add")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("+ Add"));
    expect(screen.getByPlaceholderText("e.g., my-fileserver")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g., npx")).toBeTruthy();
  });

  it("adds a server via IPC", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    vi.mocked(addMcpServer).mockResolvedValue({
      id: "test",
      name: "Test Server",
      command: "node",
      args: ["server.js"],
      enabled: true,
      tools: [],
      lastSeen: null,
    });
    render(<McpPanel />);
    await waitFor(() => expect(screen.getByText("+ Add")).toBeTruthy());
    fireEvent.click(screen.getByText("+ Add"));
    fireEvent.change(screen.getByPlaceholderText("e.g., my-fileserver"), {
      target: { value: "Test Server" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., npx"), {
      target: { value: "node" },
    });
    fireEvent.change(screen.getByLabelText("Arguments"), {
      target: { value: "server.js" },
    });
    fireEvent.click(screen.getByText("Add Server"));
    await waitFor(() => {
      expect(addMcpServer).toHaveBeenCalledWith({
        name: "Test Server",
        command: "node",
        args: ["server.js"],
        env: {},
      });
    });
  });

  it("removes a server", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([
      {
        id: "s1",
        name: "Server",
        command: "node",
        args: ["s.js"],
        enabled: true,
        tools: [],
        lastSeen: null,
      },
    ]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    await waitFor(() => expect(screen.getByText("Remove")).toBeTruthy());
    fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => {
      expect(removeMcpServer).toHaveBeenCalledWith("s1");
    });
  });

  it("toggles a server", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([
      {
        id: "s1",
        name: "Server",
        command: "node",
        args: ["s.js"],
        enabled: true,
        tools: [],
        lastSeen: null,
      },
    ]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    await waitFor(() => expect(screen.getByText("Disable")).toBeTruthy());
    fireEvent.click(screen.getByText("Disable"));
    await waitFor(() => {
      expect(toggleMcpServer).toHaveBeenCalledWith("s1");
    });
  });

  it("shows backend badge when server has backendId", async () => {
    vi.mocked(listMcpServers).mockResolvedValue([
      {
        id: "srv1",
        name: "filesystem",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        enabled: true,
        tools: [],
        lastSeen: null,
        backendId: "claude",
      },
    ]);
    vi.mocked(listMcpTools).mockResolvedValue([]);
    render(<McpPanel />);
    expect(await screen.findByText("claude")).toBeInTheDocument();
  });
});
