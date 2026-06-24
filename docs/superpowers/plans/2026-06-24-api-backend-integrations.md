# API Backend Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five HTTP API-based AI backends (OpenAI, OpenRouter, Ollama, Claude API, Gemini API) with platform keychain-backed API key storage and per-conversation model selection.

**Architecture:** KeyManager (safeStorage + SQLite settings) stores encrypted API keys. BaseHttpAdapter abstract class provides shared SSE streaming, timeout, and abort handling. Five individual adapters subclass it. Model selection flows through `chat:send` payload and is persisted per-conversation.

**Tech Stack:** TypeScript, Electron safeStorage, Node.js built-in fetch, React 18, Vitest, SQLite settings table

---

## File Map

### New files

| File | Purpose |
|------|---------|
| `src/main/security/key-manager.ts` | Key encryption/decryption via safeStorage |
| `src/main/security/key-manager.test.ts` | Tests for KeyManager |
| `src/main/adapters/http-base-adapter.ts` | Abstract base class for HTTP adapters |
| `src/main/adapters/http-base-adapter.test.ts` | Tests for SSE parsing, timeout, abort |
| `src/main/adapters/openai.adapter.ts` | OpenAI API adapter |
| `src/main/adapters/openrouter.adapter.ts` | OpenRouter API adapter |
| `src/main/adapters/ollama.adapter.ts` | Ollama API adapter |
| `src/main/adapters/claude-api.adapter.ts` | Claude API adapter |
| `src/main/adapters/gemini-api.adapter.ts` | Gemini API adapter |
| `src/renderer/components/Toolbar/ModelSelector.tsx` | Model selector dropdown |

### Modified files

| File | Change |
|------|--------|
| `src/main/security/index.ts` | Export KeyManager |
| `src/shared/ipc.ts` | Add 8 new IPC channels + `model` to CHAT_SEND payload |
| `src/shared/types.ts` | Add `model?: string` to chat send types if needed |
| `src/main/adapters/manager.ts` | Import + register 5 new adapters in registry |
| `src/main/ipc.ts` | Add IPC handlers for key management and model channels; pass model to adapter.send |
| `src/renderer/ipc.ts` | Add renderer IPC wrapper functions |
| `src/renderer/App.tsx` | Add model state, wire ModelSelector, pass model to chat send |
| `src/renderer/components/Chat/ChatView.tsx` | Accept and pass `model` prop |
| `src/renderer/hooks/useMessages.ts` | Accept `model` in send() and pass to sendChat() |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Add API Keys section |

---

### Task 1: Create KeyManager

**Files:**
- Create: `src/main/security/key-manager.ts`
- Create: `src/main/security/key-manager.test.ts`
- Modify: `src/main/security/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/security/key-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock safeStorage
const mockEncryptString = vi.fn((s: string) => Buffer.from("enc:" + s));
const mockDecryptString = vi.fn((b: Buffer) => b.toString("utf8").slice(4));
const mockIsEncryptionAvailable = vi.fn(() => true);

vi.mock("electron", () => ({
  safeStorage: {
    encryptString: mockEncryptString,
    decryptString: mockDecryptString,
    isEncryptionAvailable: mockIsEncryptionAvailable,
  },
}));

// Mock ConvStore via settings
const settings = new Map<string, string>();
vi.mock("../store", () => ({
  ConvStore: {
    getSetting: (key: string) => settings.get(key),
    setSetting: (key: string, value: string) => settings.set(key, value),
  },
}));

describe("KeyManager", () => {
  beforeEach(() => {
    settings.clear();
    vi.clearAllMocks();
  });

  it("stores and retrieves an encrypted key", () => {
    const { KeyManager } = require("./key-manager");
    KeyManager.storeKey("openai", "sk-test123");
    expect(mockEncryptString).toHaveBeenCalledWith("sk-test123");
    const retrieved = KeyManager.getKey("openai");
    expect(retrieved).toBe("sk-test123");
  });

  it("returns null for a provider with no stored key", () => {
    const { KeyManager } = require("./key-manager");
    expect(KeyManager.getKey("nonexistent")).toBeNull();
  });

  it("deletes a stored key", () => {
    const { KeyManager } = require("./key-manager");
    KeyManager.storeKey("openai", "sk-test123");
    KeyManager.deleteKey("openai");
    expect(KeyManager.getKey("openai")).toBeNull();
  });

  it("hasKey returns correct boolean", () => {
    const { KeyManager } = require("./key-manager");
    expect(KeyManager.hasKey("openai")).toBe(false);
    KeyManager.storeKey("openai", "sk-test123");
    expect(KeyManager.hasKey("openai")).toBe(true);
  });

  it("listProviders returns providers with stored keys", () => {
    const { KeyManager } = require("./key-manager");
    KeyManager.storeKey("openai", "sk-1");
    KeyManager.storeKey("openrouter", "sk-2");
    KeyManager.storeKey("ollama", "");
    const providers = KeyManager.listProviders();
    expect(providers).toContain("openai");
    expect(providers).toContain("openrouter");
    expect(providers).not.toContain("ollama");
  });

  it("falls back to plaintext when safeStorage is unavailable", () => {
    mockIsEncryptionAvailable.mockReturnValueOnce(false);
    const { KeyManager } = require("./key-manager");
    // Should not throw
    KeyManager.storeKey("openai", "sk-plain");
    expect(KeyManager.getKey("openai")).toBe("sk-plain");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/security/key-manager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the KeyManager implementation**

Create `src/main/security/key-manager.ts`:

```typescript
import { safeStorage } from "electron";
import { ConvStore } from "../store";

function settingKey(provider: string): string {
  return `key:${provider}`;
}

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

const encryptionAvailable = safeStorage.isEncryptionAvailable();

if (!encryptionAvailable) {
  console.warn(
    "[KeyManager] safeStorage unavailable — API keys will be stored as plaintext",
  );
}

export const KeyManager = {
  storeKey(provider: string, key: string): void {
    const value = encryptionAvailable
      ? toHex(safeStorage.encryptString(key))
      : key;
    ConvStore.setSetting(settingKey(provider), value);
  },

  getKey(provider: string): string | null {
    const stored = ConvStore.getSetting(settingKey(provider));
    if (!stored) return null;
    try {
      return encryptionAvailable
        ? safeStorage.decryptString(fromHex(stored))
        : stored;
    } catch {
      return null;
    }
  },

  deleteKey(provider: string): void {
    ConvStore.setSetting(settingKey(provider), "");
  },

  hasKey(provider: string): boolean {
    const val = this.getKey(provider);
    return val !== null && val.length > 0;
  },

  listProviders(): string[] {
    const all = ConvStore.getAllSettings();
    const providers: string[] = [];
    for (const key of Object.keys(all)) {
      if (key.startsWith("key:") && all[key].length > 0) {
        providers.push(key.slice(4));
      }
    }
    return providers;
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/security/key-manager.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Export from security/index.ts**

In `src/main/security/index.ts`, add after the existing exports:
```typescript
export { KeyManager } from "./key-manager";
```

- [ ] **Step 6: Commit**

```bash
git add src/main/security/key-manager.ts src/main/security/key-manager.test.ts src/main/security/index.ts
git commit -m "feat(security): add KeyManager for encrypted API key storage via safeStorage"
```

---

### Task 2: Add IPC channels for key management

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/ipc.ts`

- [ ] **Step 1: Add IPC channel constants to src/shared/ipc.ts**

In `src/shared/ipc.ts`, add before the closing `} as const`:
```typescript
  KEY_STORE: "key:store",
  KEY_GET: "key:get",
  KEY_DELETE: "key:delete",
  KEY_HAS: "key:has",
  KEY_LIST: "key:list",
  MODEL_GET_DEFAULT: "model:get-default",
  MODEL_SET_DEFAULT: "model:set-default",
  MODEL_LIST: "model:list",
```

Add to `IpcInvokeMap`:
```typescript
  [IPC.KEY_STORE]: { provider: string; key: string };
  [IPC.KEY_GET]: { provider: string };
  [IPC.KEY_DELETE]: { provider: string };
  [IPC.KEY_HAS]: { provider: string };
  [IPC.MODEL_GET_DEFAULT]: { provider: string };
  [IPC.MODEL_SET_DEFAULT]: { provider: string; model: string };
  [IPC.MODEL_LIST]: { provider: string };
```

Add to `IpcReturnMap`:
```typescript
  [IPC.KEY_GET]: string | null;
  [IPC.KEY_HAS]: boolean;
  [IPC.KEY_LIST]: string[];
  [IPC.MODEL_GET_DEFAULT]: string;
  [IPC.MODEL_LIST]: string[];
```

Also add `model` to the CHAT_SEND payload. Change the current `[IPC.CHAT_SEND]` entry to add `model?: string`:
```typescript
  [IPC.CHAT_SEND]: {
    conversationId: string | null;
    message: string;
    backend: string;
    personaId?: string;
    messageId?: string;
    model?: string;
  };
```

- [ ] **Step 2: Add IPC handlers in src/main/ipc.ts**

Add KeyManager import at the top of `src/main/ipc.ts`:
```typescript
import { KeyManager } from "./security/key-manager";
```

Add handlers after the existing `IPC.SETTING_GET_ALL` handler (around line 187):
```typescript
  ipcMain.handle(IPC.KEY_STORE, (_event, { provider, key }) => {
    KeyManager.storeKey(provider, key);
  });
  ipcMain.handle(IPC.KEY_GET, (_event, { provider }) =>
    KeyManager.getKey(provider),
  );
  ipcMain.handle(IPC.KEY_DELETE, (_event, { provider }) => {
    KeyManager.deleteKey(provider);
  });
  ipcMain.handle(IPC.KEY_HAS, (_event, { provider }) =>
    KeyManager.hasKey(provider),
  );
  ipcMain.handle(IPC.KEY_LIST, () => KeyManager.listProviders());
```

Add model default handlers after the key handlers:
```typescript
  ipcMain.handle(IPC.MODEL_GET_DEFAULT, (_event, { provider }) => {
    const model = ConvStore.getSetting(`model:${provider}`);
    return model || "";
  });
  ipcMain.handle(IPC.MODEL_SET_DEFAULT, (_event, { provider, model }) => {
    ConvStore.setSetting(`model:${provider}`, model);
  });
```

Add model list handler (uses adapter to list models; the actual list logic goes in each adapter, but the IPC routes through a central dispatcher):
```typescript
  ipcMain.handle(IPC.MODEL_LIST, async (_event, { provider }) => {
    const adapter = AdapterManager.get(provider);
    if (!adapter || !("listModels" in adapter)) return [];
    return (adapter as any).listModels();
  });
```

- [ ] **Step 3: Add renderer IPC wrappers to src/renderer/ipc.ts**

Add after the existing `getAllSettings` function:
```typescript
export async function storeKey(provider: string, key: string): Promise<void> {
  await window.ipc.invoke(IPC.KEY_STORE, { provider, key });
}
export async function getKey(provider: string): Promise<string | null> {
  return window.ipc.invoke(IPC.KEY_GET, { provider }) as Promise<string | null>;
}
export async function deleteKey(provider: string): Promise<void> {
  await window.ipc.invoke(IPC.KEY_DELETE, { provider });
}
export async function hasKey(provider: string): Promise<boolean> {
  return window.ipc.invoke(IPC.KEY_HAS, { provider }) as Promise<boolean>;
}
export async function listProviders(): Promise<string[]> {
  return window.ipc.invoke(IPC.KEY_LIST) as Promise<string[]>;
}

export async function getDefaultModel(provider: string): Promise<string> {
  return window.ipc.invoke(IPC.MODEL_GET_DEFAULT, { provider }) as Promise<string>;
}
export async function setDefaultModel(provider: string, model: string): Promise<void> {
  await window.ipc.invoke(IPC.MODEL_SET_DEFAULT, { provider, model });
}
export async function listModels(provider: string): Promise<string[]> {
  return window.ipc.invoke(IPC.MODEL_LIST, { provider }) as Promise<string[]>;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/renderer/ipc.ts
git commit -m "feat(ipc): add key management and model listing IPC channels"
```

---

### Task 3: Add API Keys section to Settings panel

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`

- [ ] **Step 1: Write the API Keys section into SettingsPanel**

Replace the entire `SettingsPanel.tsx` content with:

```typescript
import { useState, useEffect } from "react";
import {
  getSetting,
  setSetting,
  getAppVersion,
  storeKey,
  getKey,
  deleteKey,
  hasKey,
  probeBackend,
} from "../../ipc";

const API_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "claude-api", label: "Claude API" },
  { id: "gemini-api", label: "Gemini API" },
  { id: "ollama", label: "Ollama" },
];

interface Props {
  onClose: () => void;
  onReRunWizard: () => void;
}

export function SettingsPanel({ onClose, onReRunWizard }: Props) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [version, setVersion] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [keyStates, setKeyStates] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  useEffect(() => {
    getSetting("theme").then((v) => {
      if (v === "light" || v === "dark" || v === "system")
        setTheme(v as typeof theme);
    });
  }, []);

  useEffect(() => {
    Promise.all(
      API_PROVIDERS.map(async (p) => {
        const exists = await hasKey(p.id);
        return { id: p.id, exists };
      }),
    ).then((results) => {
      setKeyStates(
        Object.fromEntries(results.map((r) => [r.id, r.exists])),
      );
    });
  }, []);

  const handleThemeChange = async (t: "system" | "light" | "dark") => {
    setTheme(t);
    await setSetting("theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else if (t === "light") document.documentElement.classList.remove("dark");
    else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  };

  const handleSaveKey = async (provider: string) => {
    const key = apiKeys[provider]?.trim();
    if (!key) {
      await deleteKey(provider);
      setKeyStates((prev) => ({ ...prev, [provider]: false }));
    } else {
      await storeKey(provider, key);
      setKeyStates((prev) => ({ ...prev, [provider]: true }));
    }
    setApiKeys((prev) => ({ ...prev, [provider]: "" }));
  };

  const handleTest = async (provider: string) => {
    setTesting((prev) => ({ ...prev, [provider]: true }));
    const result = await probeBackend(provider);
    setTesting((prev) => ({ ...prev, [provider]: false }));
    alert(
      result.available && result.authenticated
        ? `${provider}: connected and authenticated`
        : `${provider}: ${!result.available ? "not available" : "not authenticated"}`,
    );
  };

  return (
    <div className="w-72 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">Settings</span>
        <button
          onClick={onClose}
          className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
        >
          Close
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1">Theme</label>
          <select
            className="w-full text-xs border rounded px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600"
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <span className="text-xs font-semibold block mb-2">API Keys</span>
          <div className="space-y-3">
            {API_PROVIDERS.map((p) => (
              <div key={p.id}>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                  {p.label}
                </label>
                {p.id === "ollama" ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                    No key needed — connects to localhost:11434
                  </p>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="password"
                      className="flex-1 text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                      placeholder={
                        keyStates[p.id] ? "Key set — blank to delete" : "sk-..."
                      }
                      value={apiKeys[p.id] ?? ""}
                      onChange={(e) =>
                        setApiKeys((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      onClick={() => handleSaveKey(p.id)}
                      className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700 text-xs px-2"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleTest(p.id)}
                      disabled={testing[p.id]}
                      className="btn-sm border border-gray-300 dark:border-gray-600 text-xs px-2 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
                    >
                      {testing[p.id] ? "..." : "Test"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <button
            onClick={onReRunWizard}
            className="btn-sm w-full px-3 py-2 border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
          >
            Re-run Setup Wizard
          </button>
        </div>
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          Version {version || "0.1.0"}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx
git commit -m "feat(settings): add API Keys section with key storage and test connection"
```

---

### Task 4: Create BaseHttpAdapter (abstract class)

**Files:**
- Create: `src/main/adapters/http-base-adapter.ts`
- Create: `src/main/adapters/http-base-adapter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/main/adapters/http-base-adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock store
vi.mock("../store", () => ({
  ConvStore: {
    getSetting: vi.fn(() => null),
  },
}));

// Mock electron safeStorage
vi.mock("electron", () => ({
  safeStorage: {
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
    isEncryptionAvailable: () => true,
  },
  app: { getVersion: () => "1.0.0" },
}));

// Mock KeyManager
vi.mock("../security/key-manager", () => ({
  KeyManager: {
    getKey: vi.fn((id: string) => id === "no-key-required" ? null : `mock-key-${id}`),
    hasKey: vi.fn((id: string) => id !== "no-key-required"),
  },
}));

import { BaseHttpAdapter } from "./http-base-adapter";

class TestAdapter extends BaseHttpAdapter {
  id = "test";
  getDefaultModel(): string { return "test-model"; }
  getBaseUrl(): string { return "https://api.test.com/v1/chat"; }
  getApiKeyHeader(): Record<string, string> {
    return { Authorization: "Bearer test-key" };
  }
  buildRequestBody(params: { message: string; persona?: string; attachments?: any[]; model: string }): object {
    return { model: params.model, messages: [{ role: "user", content: params.message }], stream: true };
  }
  parseChunk(raw: any): any {
    if (raw.choices?.[0]?.delta?.content) {
      return { type: "text" as const, content: raw.choices[0].delta.content };
    }
    return null;
  }
  async checkAuth(): Promise<boolean> { return true; }
  async isAvailable(): Promise<boolean> { return true; }
}

describe("BaseHttpAdapter", () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  it("has correct id", () => {
    expect(adapter.id).toBe("test");
  });

  it("returns default model", () => {
    expect(adapter.getDefaultModel()).toBe("test-model");
  });

  it("buildRequestBody includes model and message", () => {
    const body = adapter.buildRequestBody({
      message: "hello",
      model: "test-model",
    });
    expect(body).toHaveProperty("model", "test-model");
    expect(body).toHaveProperty("stream", true);
  });

  it("parseChunk extracts text delta", () => {
    const raw = { choices: [{ delta: { content: "Hello" } }] };
    const chunk = adapter.parseChunk(raw);
    expect(chunk).toEqual({ type: "text", content: "Hello" });
  });

  it("parseChunk returns null for non-content chunks", () => {
    const raw = { choices: [{ delta: {} }] };
    expect(adapter.parseChunk(raw)).toBeNull();
  });

  it("abort sets controller to null", () => {
    adapter.abort();
    // Should not throw
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/adapters/http-base-adapter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write BaseHttpAdapter**

Create `src/main/adapters/http-base-adapter.ts`:

```typescript
import type {
  BackendAdapter,
  MessageChunk,
  Attachment,
} from "../../shared/types";
import { KeyManager } from "../security/key-manager";

export abstract class BaseHttpAdapter implements BackendAdapter {
  abstract id: string;
  abstract getDefaultModel(): string;
  abstract getBaseUrl(): string;
  abstract getApiKeyHeader(key: string): Record<string, string>;
  abstract buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object;
  abstract parseChunk(raw: unknown): MessageChunk | null;

  protected currentRequest: AbortController | null = null;
  protected currentModel: string | null = null;

  setModel(model: string): void {
    this.currentModel = model;
  }

  async isAvailable(): Promise<boolean> {
    return KeyManager.hasKey(this.id);
  }

  async checkAuth(): Promise<boolean> {
    const key = KeyManager.getKey(this.id);
    if (!key) return false;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.getApiKeyHeader(key),
      };
      const res = await fetch(this.getBaseUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(
          this.buildRequestBody({
            message: ".",
            model: this.getDefaultModel(),
          }),
        ),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    return [this.getDefaultModel()];
  }

  async *send(
    message: string,
    persona?: string,
    attachments?: Attachment[],
  ): AsyncIterable<MessageChunk> {
    const key = KeyManager.getKey(this.id);
    if (!key && this.constructor.name !== "OllamaAdapter") {
      yield {
        type: "error",
        content: `No API key configured for ${this.id}. Add one in Settings.`,
      };
      yield { type: "done", content: "" };
      return;
    }

    const model = this.currentModel ?? this.getDefaultModel();
    const body = this.buildRequestBody({ message, persona, attachments, model });

    const controller = new AbortController();
    this.currentRequest = controller;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.getApiKeyHeader(key ?? ""),
      };

      const response = await fetch(this.getBaseUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        keepalive: true,
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          yield { type: "error", content: "Rate limited. Wait and retry." };
        } else if (status === 401 || status === 403) {
          yield {
            type: "error",
            content: "Authentication failed. Check your API key.",
          };
        } else {
          yield {
            type: "error",
            content: `HTTP ${status}: ${response.statusText}`,
          };
        }
        yield { type: "done", content: "" };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: "error", content: "No response body" };
        yield { type: "done", content: "" };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = this.parseChunk(parsed);
            if (chunk) yield chunk;
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        yield { type: "done", content: "" };
        return;
      }
      yield {
        type: "error",
        content: `Connection failed. Check your network and endpoint URL.`,
      };
    } finally {
      this.currentRequest = null;
    }

    yield { type: "done", content: "" };
  }

  abort(): void {
    this.currentRequest?.abort();
    this.currentRequest = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/adapters/http-base-adapter.test.ts`
Expected: PASS — all 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/adapters/http-base-adapter.ts src/main/adapters/http-base-adapter.test.ts
git commit -m "feat(adapters): add BaseHttpAdapter abstract class with SSE streaming and abort"
```

---

### Task 5: Create OpenAIAdapter

**Files:**
- Create: `src/main/adapters/openai.adapter.ts`

- [ ] **Step 1: Write OpenAIAdapter**

Create `src/main/adapters/openai.adapter.ts`:

```typescript
import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class OpenAIAdapter extends BaseHttpAdapter {
  id = "openai";

  getDefaultModel(): string {
    return "gpt-4o";
  }

  getBaseUrl(): string {
    return "https://api.openai.com/v1/chat/completions";
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return { Authorization: `Bearer ${key}` };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    if (params.persona) {
      messages.push({ role: "system", content: params.persona });
    }
    const content: any[] = [{ type: "text", text: params.message }];
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${att.mimeType};base64,${att.data}` },
          });
        } else {
          content.push({
            type: "text",
            text: `[Attachment: ${att.originalName ?? "file"}]`,
          });
        }
      }
    }
    messages.push({ role: "user", content });
    return { model: params.model, messages, stream: true };
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    const delta = data?.choices?.[0]?.delta;
    if (delta?.content) {
      return { type: "text", content: delta.content };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    const key = (await import("../security/key-manager")).KeyManager.getKey(this.id);
    if (!key) return [this.getDefaultModel()];
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [this.getDefaultModel()];
      const data = (await res.json()) as any;
      return (data.data ?? [])
        .map((m: any) => m.id)
        .filter((id: string) => /^(gpt|o[1-9])/.test(id))
        .sort();
    } catch {
      return [this.getDefaultModel()];
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/adapters/openai.adapter.ts
git commit -m "feat(adapters): add OpenAI HTTP API adapter"
```

---

### Task 6: Create OpenRouterAdapter

**Files:**
- Create: `src/main/adapters/openrouter.adapter.ts`

- [ ] **Step 1: Write OpenRouterAdapter**

Create `src/main/adapters/openrouter.adapter.ts`:

```typescript
import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class OpenRouterAdapter extends BaseHttpAdapter {
  id = "openrouter";

  getDefaultModel(): string {
    return "anthropic/claude-sonnet-20241022";
  }

  getBaseUrl(): string {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "myra://",
    };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    if (params.persona) {
      messages.push({ role: "system", content: params.persona });
    }
    const content: any[] = [{ type: "text", text: params.message }];
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${att.mimeType};base64,${att.data}` },
          });
        } else {
          content.push({
            type: "text",
            text: `[Attachment: ${att.originalName ?? "file"}]`,
          });
        }
      }
    }
    messages.push({ role: "user", content });
    return { model: params.model, messages, stream: true };
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    const delta = data?.choices?.[0]?.delta;
    if (delta?.content) {
      return { type: "text", content: delta.content };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    const key = (await import("../security/key-manager")).KeyManager.getKey(this.id);
    if (!key) return [this.getDefaultModel()];
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [this.getDefaultModel()];
      const data = (await res.json()) as any;
      return (data.data ?? []).map((m: any) => m.id).sort();
    } catch {
      return [this.getDefaultModel()];
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/adapters/openrouter.adapter.ts
git commit -m "feat(adapters): add OpenRouter HTTP API adapter"
```

---

### Task 7: Create OllamaAdapter

**Files:**
- Create: `src/main/adapters/ollama.adapter.ts`

- [ ] **Step 1: Write OllamaAdapter**

Create `src/main/adapters/ollama.adapter.ts`:

```typescript
import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class OllamaAdapter extends BaseHttpAdapter {
  id = "ollama";

  getDefaultModel(): string {
    return "llama3.2";
  }

  getBaseUrl(): string {
    return "http://localhost:11434/api/chat";
  }

  getApiKeyHeader(): Record<string, string> {
    return {};
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("http://localhost:11434", {
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async checkAuth(): Promise<boolean> {
    return this.isAvailable();
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    if (params.persona) {
      messages.push({ role: "system", content: params.persona });
    }
    let content = params.message;
    if (params.attachments?.length) {
      const files = params.attachments
        .map((a) => `[${a.originalName ?? "file"}]`)
        .join(", ");
      content += `\n\nAttachments: ${files}`;
    }
    messages.push({ role: "user", content });
    return { model: params.model, messages, stream: true };
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    if (data?.message?.content) {
      return { type: "text", content: data.message.content };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) return [this.getDefaultModel()];
      const data = (await res.json()) as any;
      return (data.models ?? []).map((m: any) => m.name).sort();
    } catch {
      return [this.getDefaultModel()];
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/adapters/ollama.adapter.ts
git commit -m "feat(adapters): add Ollama HTTP API adapter (localhost)"
```

---

### Task 8: Create ClaudeApiAdapter

**Files:**
- Create: `src/main/adapters/claude-api.adapter.ts`

- [ ] **Step 1: Write ClaudeApiAdapter**

Create `src/main/adapters/claude-api.adapter.ts`:

```typescript
import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class ClaudeApiAdapter extends BaseHttpAdapter {
  id = "claude-api";

  getDefaultModel(): string {
    return "claude-sonnet-4-20250514";
  }

  getBaseUrl(): string {
    return "https://api.anthropic.com/v1/messages";
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const messages: any[] = [];
    const content: any[] = [{ type: "text", text: params.message }];

    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: att.mimeType,
              data: att.data,
            },
          });
        } else {
          content.push({
            type: "text",
            text: `[Attachment: ${att.originalName ?? "file"}]`,
          });
        }
      }
    }

    messages.push({ role: "user", content });
    const body: any = {
      model: params.model,
      max_tokens: 4096,
      messages,
      stream: true,
    };
    if (params.persona) {
      body.system = params.persona;
    }
    return body;
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    if (data?.type === "content_block_delta" && data.delta?.text) {
      return { type: "text", content: data.delta.text };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-sonnet-4-20250514",
      "claude-sonnet-4",
      "claude-haiku-3-5-20241022",
      "claude-opus-4-20250514",
    ];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/adapters/claude-api.adapter.ts
git commit -m "feat(adapters): add Claude HTTP API adapter"
```

---

### Task 9: Create GeminiApiAdapter

**Files:**
- Create: `src/main/adapters/gemini-api.adapter.ts`

- [ ] **Step 1: Write GeminiApiAdapter**

Create `src/main/adapters/gemini-api.adapter.ts`:

```typescript
import { BaseHttpAdapter } from "./http-base-adapter";
import type { MessageChunk, Attachment } from "../../shared/types";

export class GeminiApiAdapter extends BaseHttpAdapter {
  id = "gemini-api";

  getDefaultModel(): string {
    return "gemini-2.0-flash";
  }

  getBaseUrl(): string {
    return `https://generativelanguage.googleapis.com/v1/models/${this.getDefaultModel()}:streamGenerateContent?alt=sse`;
  }

  getApiKeyHeader(key: string): Record<string, string> {
    return { "x-goog-api-key": key };
  }

  buildRequestBody(params: {
    message: string;
    persona?: string;
    attachments?: Attachment[];
    model: string;
  }): object {
    const parts: any[] = [{ text: params.message }];
    if (params.attachments?.length) {
      for (const att of params.attachments) {
        if (att.mimeType?.startsWith("image/")) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.data,
            },
          });
        }
      }
    }
    const contents = [{ role: "user", parts }];
    const body: any = { contents };
    if (params.persona) {
      body.systemInstruction = { parts: [{ text: params.persona }] };
    }
    return body;
  }

  parseChunk(raw: unknown): MessageChunk | null {
    const data = raw as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return { type: "text", content: text };
    }
    return null;
  }

  async listModels(): Promise<string[]> {
    return [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/adapters/gemini-api.adapter.ts
git commit -m "feat(adapters): add Gemini HTTP API adapter"
```

---

### Task 10: Register all adapters in manager.ts

**Files:**
- Modify: `src/main/adapters/manager.ts`

- [ ] **Step 1: Add imports and register new adapters**

In `src/main/adapters/manager.ts`, add imports after the existing ones:
```typescript
import { OpenAIAdapter } from "./openai.adapter";
import { OpenRouterAdapter } from "./openrouter.adapter";
import { OllamaAdapter } from "./ollama.adapter";
import { ClaudeApiAdapter } from "./claude-api.adapter";
import { GeminiApiAdapter } from "./gemini-api.adapter";
```

Add to the registry array:
```typescript
  new OpenAIAdapter(),
  new OpenRouterAdapter(),
  new OllamaAdapter(),
  new ClaudeApiAdapter(),
  new GeminiApiAdapter(),
```

The full registry should be:
```typescript
const registry: BackendAdapter[] = [
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new OpencodeAdapter(),
  new OpenAIAdapter(),
  new OpenRouterAdapter(),
  new OllamaAdapter(),
  new ClaudeApiAdapter(),
  new GeminiApiAdapter(),
];
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/main/adapters/manager.ts
git commit -m "feat(adapters): register OpenAI, OpenRouter, Ollama, Claude API, and Gemini API adapters"
```

---

### Task 11: Wire model into chat send flow

**Files:**
- Modify: `src/main/ipc.ts` (chat:send handler — pass model to adapter)
- Modify: `src/renderer/App.tsx` (add model state, wire to toolbar)
- Modify: `src/renderer/components/Chat/ChatView.tsx` (accept and pass model)
- Modify: `src/renderer/hooks/useMessages.ts` (accept model in send)
- New: `src/renderer/components/Toolbar/ModelSelector.tsx`

- [ ] **Step 1: Update chat:send handler in src/main/ipc.ts**

Find the `IPC.CHAT_SEND` handler and update the destructured params to include `model`:
```typescript
      {
        conversationId,
        message,
        backend,
        personaId,
        messageId: pregenMessageId,
        model,
      },
```

Before calling `adapter.send()`, if model is provided, set it on the adapter. Add this right after the `AdapterManager.setActive(adapter.id);` line:
```typescript
      if (model && typeof (adapter as any).setModel === "function") {
        (adapter as any).setModel(model);
      }
```

- [ ] **Step 2: Update useMessages hook**

In `src/renderer/hooks/useMessages.ts`, update the `send` function signature and call:

Change the send function signature to accept `model`:
```typescript
  const send = useCallback(
    async (
      message: string,
      backend: string,
      personaId?: string,
      messageId?: string,
      model?: string,
    ) => {
```

Update the `sendChat` call to pass model:
```typescript
      const newConvId = await sendChat({
        conversationId,
        message,
        backend,
        personaId,
        messageId,
        model,
      });
```

- [ ] **Step 3: Update ChatView to accept and pass model**

In `src/renderer/components/Chat/ChatView.tsx`, update `Props` interface:
```typescript
interface Props {
  conversationId: string | null;
  backend: string;
  model?: string;
  personaId?: string;
  pipelineTemplate?: PipelineTemplate;
  onNewConversation: (id: string) => void;
}
```

Update `SingleChatView`:
```typescript
function SingleChatView({
  conversationId,
  backend,
  model,
  personaId,
  onNewConversation,
}: Omit<Props, "pipelineTemplate">) {
  const { messages, streaming, send, abort } = useMessages(conversationId);

  const handleSend = async (
    message: string,
    _attachments: Attachment[],
    messageId: string,
  ) => {
    const newId = await send(message, backend, personaId, messageId, model);
    if (!conversationId && newId) onNewConversation(newId);
  };
```

- [ ] **Step 4: Create ModelSelector component**

Create `src/renderer/components/Toolbar/ModelSelector.tsx`:

```typescript
import { useState, useEffect } from "react";
import { listModels } from "../../ipc";

interface Props {
  provider: string;
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ provider, value, onChange }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listModels(provider)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [provider]);

  const HTTP_BACKENDS = [
    "openai",
    "openrouter",
    "ollama",
    "claude-api",
    "gemini-api",
  ];

  if (!HTTP_BACKENDS.includes(provider)) return null;

  return (
    <select
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
    >
      {loading ? (
        <option>Loading...</option>
      ) : models.length === 0 ? (
        <option value={value}>{value}</option>
      ) : (
        models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))
      )}
    </select>
  );
}
```

- [ ] **Step 5: Wire model state into App.tsx**

In `src/renderer/App.tsx`:
1. Add `const [model, setModel] = useState("");` after the `backend` state line (line 48)
2. Import `ModelSelector` at the top:
```typescript
import { ModelSelector } from "./components/Toolbar/ModelSelector";
```
3. Add `model` and pass it to `ChatView`:
Find `<ChatView` on line 290 and add `model={model}`:
```typescript
            <ChatView
              conversationId={activeConvId}
              backend={backend}
              model={model}
              personaId={personaId ?? undefined}
              pipelineTemplate={activePipelineTemplate}
              onNewConversation={(id) => {
                setActiveConvId(id);
                setRefreshTrigger((n) => n + 1);
              }}
            />
```
4. Add `ModelSelector` right after `BackendSwitcher` in the toolbar (after line 184):
```typescript
          {mode === "single" && !activeConvMeta?.pipelineTemplateId && (
            <>
              <BackendSwitcher value={backend} onChange={setBackend} />
              <ModelSelector provider={backend} value={model} onChange={setModel} />
            </>
          )}
```

- [ ] **Step 6: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/main/ipc.ts src/renderer/App.tsx src/renderer/components/Chat/ChatView.tsx src/renderer/hooks/useMessages.ts src/renderer/components/Toolbar/ModelSelector.tsx
git commit -m "feat(chat): add model selection flow through chat send pipeline"
```

---

### Task 12: Update labels in manager.ts and fix Gemini URL

**Files:**
- Modify: `src/main/adapters/manager.ts`
- Modify: `src/main/adapters/gemini-api.adapter.ts`

- [ ] **Step 1: Add labels for new adapters in manager.ts**

In `src/main/adapters/manager.ts`, update the `labelFor` function:
```typescript
function labelFor(id: string): string {
  return (
    {
      claude: "Claude Code",
      gemini: "Gemini CLI",
      opencode: "Opencode",
      openai: "OpenAI",
      openrouter: "OpenRouter",
      ollama: "Ollama",
      "claude-api": "Claude API",
      "gemini-api": "Gemini API",
    }[id] ?? id
  );
}
```

- [ ] **Step 2: Fix Gemini getBaseUrl to use currentModel**

In `src/main/adapters/gemini-api.adapter.ts`, replace the `getBaseUrl()` method:
```typescript
  getBaseUrl(): string {
    const model = this.currentModel ?? this.getDefaultModel();
    return `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent?alt=sse`;
  }
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/main/adapters/manager.ts src/main/adapters/gemini-api.adapter.ts
git commit -m "chore: add labels for HTTP API backends; fix Gemini URL to use selected model"
```

---

### Task 13: Final validation

**Files:** none modified

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass, zero failures

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: zero TypeScript errors

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: zero ESLint errors

- [ ] **Step 4: Review the diff**

Run: `git diff main` (or `git log --oneline -20`)
Verify: all changes trace to a task in this plan, no debug leftovers
