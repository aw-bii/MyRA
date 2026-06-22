import { describe, it, expect } from "vitest";
import type { PluginInfo } from "./types";
import { IPC } from "./ipc";

describe("Plugin types", () => {
  it("PluginInfo can be constructed", () => {
    const p: PluginInfo = {
      id: "p1",
      name: "Logger",
      path: "/plugins/logger",
      command: "node",
      enabled: true,
      hooks: ["beforePrompt", "afterResponse"],
      version: "1.0.0",
      lastLoadedAt: null,
      lastError: null,
    };
    expect(p.name).toBe("Logger");
    expect(p.hooks).toContain("beforePrompt");
  });
});

describe("Plugin IPC channels", () => {
  it("channels exist in IPC constant", () => {
    expect(IPC.PLUGIN_LIST).toBe("plugin:list");
    expect(IPC.PLUGIN_TOGGLE).toBe("plugin:toggle");
    expect(IPC.PLUGIN_RELOAD).toBe("plugin:reload");
  });
});
