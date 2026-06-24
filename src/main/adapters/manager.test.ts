import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  app: { getVersion: () => "1.0.0" },
}));
vi.mock("../store", () => ({
  ConvStore: {
    getSetting: vi.fn(() => null),
    getAllSettings: vi.fn(() => ({})),
    setSetting: vi.fn(),
  },
}));

import { AdapterManager } from "./manager";

vi.mock("./claude.adapter", () => ({
  ClaudeAdapter: class {
    id = "claude";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./gemini.adapter", () => ({
  GeminiAdapter: class {
    id = "gemini";
    isAvailable = vi.fn().mockResolvedValue(false);
    checkAuth = vi.fn().mockResolvedValue(false);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./opencode.adapter", () => ({
  OpencodeAdapter: class {
    id = "opencode";
    isAvailable = vi.fn().mockResolvedValue(false);
    checkAuth = vi.fn().mockResolvedValue(false);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./openai.adapter", () => ({
  OpenAIAdapter: class {
    id = "openai";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./openrouter.adapter", () => ({
  OpenRouterAdapter: class {
    id = "openrouter";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./ollama.adapter", () => ({
  OllamaAdapter: class {
    id = "ollama";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./claude-api.adapter", () => ({
  ClaudeApiAdapter: class {
    id = "claude-api";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./gemini-api.adapter", () => ({
  GeminiApiAdapter: class {
    id = "gemini-api";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));
vi.mock("./test.adapter", () => ({
  TestAdapter: class {
    id = "test";
    isAvailable = vi.fn().mockResolvedValue(true);
    checkAuth = vi.fn().mockResolvedValue(true);
    send = vi.fn();
    abort = vi.fn();
  },
}));

describe("AdapterManager", () => {
  it("defaults to claude as active adapter", () => {
    expect(AdapterManager.getActive().id).toBe("claude");
  });

  it("does not include TestAdapter when E2E_TEST is not set to '1'", async () => {
    // This test asserts the isolation gate: TestAdapter must be absent in normal runs.
    // The module is loaded without E2E_TEST=1 (vitest never sets it), so the
    // registry should not contain an adapter with id === "test".
    expect(process.env.E2E_TEST).not.toBe("1");
    const infos = await AdapterManager.listAvailable();
    expect(infos.find((i) => i.id === "test")).toBeUndefined();
  });

  it("setActive switches the active adapter", () => {
    AdapterManager.setActive("gemini");
    expect(AdapterManager.getActive().id).toBe("gemini");
    AdapterManager.setActive("claude"); // reset
  });

  it("throws when setActive receives unknown id", () => {
    expect(() => AdapterManager.setActive("unknown")).toThrow();
  });

  it("listAvailable reflects isAvailable() results", async () => {
    const infos = await AdapterManager.listAvailable();
    const claude = infos.find((i) => i.id === "claude");
    expect(claude?.available).toBe(true);
    const gemini = infos.find((i) => i.id === "gemini");
    expect(gemini?.available).toBe(false);
  });
});
