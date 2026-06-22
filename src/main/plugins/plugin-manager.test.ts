import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { PluginManager } from "./plugin-manager";

const PLUGIN_DIR = path.join(
  os.tmpdir(),
  `plugins-test-${crypto.randomUUID()}`,
);

describe("PluginManager", () => {
  let pluginDir: string;

  beforeAll(() => {
    pluginDir = path.join(PLUGIN_DIR, "test-plugins");
    fs.mkdirSync(pluginDir, { recursive: true });

    const pluginSubdir = path.join(pluginDir, "echo-hook");
    fs.mkdirSync(pluginSubdir, { recursive: true });

    fs.writeFileSync(
      path.join(pluginSubdir, "plugin.json"),
      JSON.stringify({
        name: "Echo Hook",
        command: "node",
        args: ["echo-hook.js"],
        hooks: ["beforePrompt", "afterResponse"],
        version: "1.0.0",
      }),
    );

    fs.writeFileSync(
      path.join(pluginSubdir, "echo-hook.js"),
      `
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const event = JSON.parse(line);
  process.stdout.write(JSON.stringify({ ok: true, event: event.hook }) + "\\n");
});
`,
    );
  });

  afterAll(() => {
    fs.rmSync(PLUGIN_DIR, { recursive: true, force: true });
  });

  it("discovers plugins from directory", async () => {
    await PluginManager.discover(pluginDir);
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
