import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so variables are available when vi.mock factory runs
const { mockEncryptString, mockDecryptString, mockIsEncryptionAvailable, settings } =
  vi.hoisted(() => {
    const mockEncryptString = vi.fn((s: string) => {
      if (s.length === 0) return Buffer.from("");
      return Buffer.from("enc:" + s);
    });
    const mockDecryptString = vi.fn((b: Buffer) => {
      const str = b.toString("utf8");
      if (str === "") return "";
      return str.slice(4);
    });
    const mockIsEncryptionAvailable = vi.fn(() => true);
    const settings = new Map<string, string>();
    return { mockEncryptString, mockDecryptString, mockIsEncryptionAvailable, settings };
  });

vi.mock("electron", () => ({
  safeStorage: {
    encryptString: mockEncryptString,
    decryptString: mockDecryptString,
    isEncryptionAvailable: mockIsEncryptionAvailable,
  },
}));

vi.mock("../store", () => ({
  ConvStore: {
    getSetting: (key: string) => settings.get(key),
    setSetting: (key: string, value: string) => settings.set(key, value),
    getAllSettings: () => Object.fromEntries(settings),
  },
}));

import { KeyManager } from "./key-manager";

describe("KeyManager", () => {
  beforeEach(() => {
    settings.clear();
    vi.clearAllMocks();
    mockIsEncryptionAvailable.mockReturnValue(true);
  });

  it("stores and retrieves an encrypted key", () => {
    KeyManager.storeKey("openai", "sk-test123");
    expect(mockEncryptString).toHaveBeenCalledWith("sk-test123");
    const retrieved = KeyManager.getKey("openai");
    expect(retrieved).toBe("sk-test123");
  });

  it("returns null for a provider with no stored key", () => {
    expect(KeyManager.getKey("nonexistent")).toBeNull();
  });

  it("deletes a stored key", () => {
    KeyManager.storeKey("openai", "sk-test123");
    KeyManager.deleteKey("openai");
    expect(KeyManager.getKey("openai")).toBeNull();
  });

  it("hasKey returns correct boolean", () => {
    expect(KeyManager.hasKey("openai")).toBe(false);
    KeyManager.storeKey("openai", "sk-test123");
    expect(KeyManager.hasKey("openai")).toBe(true);
  });

  it("listProviders returns providers with stored keys", () => {
    KeyManager.storeKey("openai", "sk-1");
    KeyManager.storeKey("openrouter", "sk-2");
    KeyManager.storeKey("ollama", "");
    const providers = KeyManager.listProviders();
    expect(providers).toContain("openai");
    expect(providers).toContain("openrouter");
    expect(providers).not.toContain("ollama");
  });

  it("falls back to plaintext when safeStorage is unavailable", () => {
    mockIsEncryptionAvailable.mockReturnValue(false);
    KeyManager.storeKey("openai", "sk-plain");
    expect(KeyManager.getKey("openai")).toBe("sk-plain");
  });
});
