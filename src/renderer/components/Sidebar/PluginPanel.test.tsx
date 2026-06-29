import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PluginPanel } from "./PluginPanel";

vi.mock("../../ipc/plugin", () => ({
  listPlugins: vi.fn(),
  togglePlugin: vi.fn(),
  reloadPlugins: vi.fn(),
}));

import { listPlugins, togglePlugin, reloadPlugins } from "../../ipc/plugin";

describe("PluginPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no plugins", async () => {
    vi.mocked(listPlugins).mockResolvedValue([]);
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No plugins found/i)).toBeTruthy();
    });
  });

  it("renders plugin list", async () => {
    vi.mocked(listPlugins).mockResolvedValue([
      {
        id: "p1",
        name: "Logger",
        path: "/p",
        command: "node",
        enabled: true,
        hooks: ["beforePrompt"],
        version: "1.0.0",
        lastLoadedAt: Date.now(),
        lastError: null,
      },
    ]);
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText("Logger")).toBeTruthy();
      expect(screen.getByText("beforePrompt")).toBeTruthy();
    });
  });

  it("toggles a plugin", async () => {
    vi.mocked(listPlugins).mockResolvedValue([
      {
        id: "p1",
        name: "Logger",
        path: "/p",
        command: "node",
        enabled: true,
        hooks: [],
        version: "1.0.0",
        lastLoadedAt: Date.now(),
        lastError: null,
      },
    ]);
    render(<PluginPanel />);
    await waitFor(() => expect(screen.getByText("Logger")).toBeTruthy());
    fireEvent.click(screen.getByText("Enabled"));
    await waitFor(() => {
      expect(togglePlugin).toHaveBeenCalledWith("p1");
    });
  });

  it("shows reload button", async () => {
    vi.mocked(listPlugins).mockResolvedValue([]);
    render(<PluginPanel />);
    await waitFor(() => {
      expect(screen.getByText("Reload")).toBeTruthy();
    });
  });

  it("calls reloadPlugins on reload click", async () => {
    vi.mocked(listPlugins).mockResolvedValue([]);
    render(<PluginPanel />);
    await waitFor(() => expect(screen.getByText("Reload")).toBeTruthy());
    fireEvent.click(screen.getByText("Reload"));
    await waitFor(() => {
      expect(reloadPlugins).toHaveBeenCalledTimes(1);
    });
  });
});
