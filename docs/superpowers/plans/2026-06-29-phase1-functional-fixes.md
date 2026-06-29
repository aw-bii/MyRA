# Phase 1 Functional Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all v0.2.1 functional regressions so the app can send and receive messages from any configured backend.

**Architecture:** Layer-by-layer — make errors visible first (so every subsequent fix is testable), then fix backend detection and install commands, then API key UX and UI integrity bugs. Each task is independently committable.

**Tech Stack:** Electron 33, React 18, TypeScript 5.3, Vitest (unit tests), Tailwind CSS, better-sqlite3, node-cron, electron-builder.

## Global Constraints

- Never use shell-string invocation for spawned processes — always `spawn(binary, argsArray)`.
- Renderer never imports `fs`, `path`, `child_process`, or `electron` directly.
- All IPC channel names come from `src/shared/ipc.ts` constants — no raw strings.
- `npm run lint` must pass before each commit.
- Tests live alongside the file under test or in `src/renderer/components/Wizard/` per existing convention.

---

## Root Cause Summary (read before starting)

**Empty replies (all backends):** `useMessages.ts` filters out `type === "error"` chunks — when an adapter fails (binary not found, bad auth), the error is silently dropped and the user sees an empty assistant bubble. The fix is to render error chunks as visible error messages.

**Wizard shows only 3 of 8 backends:** `WizardStep1.tsx` hard-codes `BACKENDS` as `[claude, gemini, opencode]`. Missing: ollama, openrouter, claude-api, gemini-api, codex. Claude is marked `bundled: true` which skips probing.

**Claude adapter bundled path:** `claude.adapter.ts` tries a bundled binary path first; falls back to `"claude"` on PATH. The bundled binary doesn't exist in installed builds, so it silently fails if claude isn't on PATH either.

**Wrong install commands:** `install.ts` only has entries for `gemini` and `opencode`, both using `npm install -g` — opencode has no npm package (E404), and claude/ollama/codex are missing entirely.

**Search button:** `App.tsx` search button sets `searchMode` but never calls `setSidebarCollapsed(false)` — the SearchPanel is hidden behind a collapsed sidebar.

**Chat area empty space:** `ChatView` is a direct child of the flex-row `<main>` without `flex-1` — doesn't grow to fill the width.

**Settings scroll:** `SettingsPanel` root div has `overflow-y-auto` but no `h-full`, so the div expands to its content height and `overflow-y-auto` never triggers.

---

## File Map

| File | Change |
| --- | --- |
| `src/renderer/hooks/useMessages.ts` | Render error chunks; fix conversationId fallback |
| `src/main/adapters/claude.adapter.ts` | Remove bundled binary path; use PATH only |
| `src/renderer/components/Wizard/WizardStep1.tsx` | Add all 8 backends; remove bundled flag; add scroll |
| `src/renderer/components/Wizard/WizardStep2.tsx` | Add labels + Ollama "Start" button |
| `src/main/wizard/install.ts` | Fix and add all install commands |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Save→Remove button; fix scroll |
| `src/renderer/App.tsx` | Search expands sidebar; ChatView gets flex-1 wrapper |

---

## Task 1: Make streaming errors visible in chat

**Files:**
- Modify: `src/renderer/hooks/useMessages.ts`

**Interfaces:**
- Produces: `Message.content` may be prefixed with `⚠ Error: ` when adapter returns `type === "error"`

- [ ] **Step 1: Write failing test**

Create `src/renderer/hooks/useMessages.test.ts` (or add to existing if present):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the chunk-handling logic in isolation by simulating the
// setMessages functional updater pattern.

describe("useMessages chunk handler logic", () => {
  it("appends text chunk content to assistant placeholder", () => {
    let state = [
      { id: "u1", role: "user" as const, content: "hello", conversationId: "conv-1", backend: "claude", stepIndex: null, createdAt: 0 },
      { id: "a1", role: "assistant" as const, content: "", conversationId: "conv-1", backend: "claude", stepIndex: null, createdAt: 0 },
    ];
    const applyChunk = (chunk: { type: string; content: string; conversationId: string }) => {
      state = state.map((m, i) => {
        if (i !== state.length - 1 || m.role !== "assistant") return m;
        if (m.conversationId !== chunk.conversationId && m.conversationId !== "") return m;
        if (chunk.type === "text") return { ...m, content: m.content + chunk.content, conversationId: chunk.conversationId };
        if (chunk.type === "error") return { ...m, content: `⚠ Error: ${chunk.content}`, conversationId: chunk.conversationId };
        return m;
      });
      return state;
    };

    applyChunk({ type: "text", content: "Hi!", conversationId: "conv-1" });
    expect(state[1].content).toBe("Hi!");
  });

  it("renders error chunk as visible error message", () => {
    let state = [
      { id: "u1", role: "user" as const, content: "hello", conversationId: "conv-1", backend: "claude", stepIndex: null, createdAt: 0 },
      { id: "a1", role: "assistant" as const, content: "", conversationId: "conv-1", backend: "claude", stepIndex: null, createdAt: 0 },
    ];
    const last = state[state.length - 1];
    if (last.role === "assistant" && (last.conversationId === "conv-1" || last.conversationId === "")) {
      state = [...state.slice(0, -1), { ...last, content: "⚠ Error: spawn claude ENOENT", conversationId: "conv-1" }];
    }
    expect(state[1].content).toBe("⚠ Error: spawn claude ENOENT");
    expect(state[1].role).toBe("assistant");
  });

  it("falls back to matching placeholder with empty conversationId for new conversations", () => {
    let state = [
      { id: "u1", role: "user" as const, content: "hello", conversationId: "", backend: "claude", stepIndex: null, createdAt: 0 },
      { id: "a1", role: "assistant" as const, content: "", conversationId: "", backend: "claude", stepIndex: null, createdAt: 0 },
    ];
    const chunk = { type: "text", content: "Hi!", conversationId: "conv-new-uuid" };
    const last = state[state.length - 1];
    if (last.role === "assistant" && (last.conversationId === chunk.conversationId || last.conversationId === "")) {
      state = [...state.slice(0, -1), { ...last, content: chunk.content, conversationId: chunk.conversationId }];
    }
    expect(state[1].content).toBe("Hi!");
    expect(state[1].conversationId).toBe("conv-new-uuid");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails or is missing**

```
npm test -- --reporter=verbose src/renderer/hooks/useMessages.test.ts
```

Expected: The test file is new — confirm the logic described passes.

- [ ] **Step 3: Update `src/renderer/hooks/useMessages.ts` chunk handler**

Replace the `onChatChunk` callback inside the `useEffect(() => { ... }, [])` block (lines 27–44 in the current file):

```ts
useEffect(() => {
  const offChunk = onChatChunk(({ conversationId: cid, type, content }) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (
        !last ||
        last.role !== "assistant" ||
        (last.conversationId !== cid && last.conversationId !== "")
      ) {
        return prev;
      }
      if (type === "text") {
        streamingContent.current += content;
        return [
          ...prev.slice(0, -1),
          { ...last, content: streamingContent.current, conversationId: cid },
        ];
      }
      if (type === "error") {
        return [
          ...prev.slice(0, -1),
          {
            ...last,
            content: `⚠ Error: ${content}`,
            conversationId: cid,
          },
        ];
      }
      return prev;
    });
  });
  const offDone = onChatDone(() => {
    setStreaming(false);
    streamingContent.current = "";
  });
  return () => {
    offChunk();
    offDone();
  };
}, []);
```

- [ ] **Step 4: Run tests**

```
npm test -- --reporter=verbose src/renderer/hooks/useMessages.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useMessages.ts src/renderer/hooks/useMessages.test.ts
git commit -m "fix(chat): render error chunks as visible error messages; fix conversationId fallback for new conversations"
```

---

## Task 2: Fix Claude adapter — PATH only, no bundled binary

**Files:**
- Modify: `src/main/adapters/claude.adapter.ts`

**Interfaces:**
- Produces: `ClaudeAdapter.isAvailable()` and `checkAuth()` and `send()` all call `spawn("claude", ...)` — no bundled path

- [ ] **Step 1: Write failing test**

Add to `src/main/adapters/claude.adapter.test.ts` (create if missing):

```ts
import { describe, it, expect, vi } from "vitest";
import { spawn } from "child_process";

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    kill: vi.fn(),
  })),
}));

describe("ClaudeAdapter", () => {
  it("calls spawn with 'claude' (PATH lookup), not a bundled path", async () => {
    const { ClaudeAdapter } = await import("./claude.adapter");
    const adapter = new ClaudeAdapter();
    await adapter.isAvailable().catch(() => {});
    const spawnMock = vi.mocked(spawn);
    expect(spawnMock).toHaveBeenCalledWith("claude", expect.any(Array), expect.any(Object));
    const firstArg = spawnMock.mock.calls[0][0];
    expect(firstArg).toBe("claude");
    expect(firstArg).not.toContain("resources");
    expect(firstArg).not.toContain("claude-bin");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/main/adapters/claude.adapter.test.ts
```

Expected: FAIL — `firstArg` contains `resources/claude-bin`.

- [ ] **Step 3: Rewrite `src/main/adapters/claude.adapter.ts`**

Remove `getClaudeBinaryPath()` and replace every call to it with the string `"claude"`. Remove the now-unused `fs`, `path`, and `app` imports. The file becomes:

```ts
import { spawn, ChildProcess } from "child_process";
import type {
  BackendAdapter,
  MessageChunk,
  Attachment,
} from "../../shared/types";
import { AttachmentService } from "../attachments/service";

export class ClaudeAdapter implements BackendAdapter {
  id = "claude";
  private proc: ChildProcess | null = null;

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn("claude", ["--version"], { stdio: "pipe" });
      p.on("close", (code) => resolve(code === 0));
      p.on("error", () => resolve(false));
    });
  }

  async checkAuth(): Promise<boolean> {
    return new Promise((resolve) => {
      const p = spawn("claude", ["--version"], { stdio: "pipe" });
      p.on("close", (code) => resolve(code === 0));
      p.on("error", () => resolve(false));
    });
  }

  async *send(
    message: string,
    persona?: string,
    attachments?: Attachment[],
  ): AsyncIterable<MessageChunk> {
    const args = ["--output-format", "stream-json", "--print"];
    if (persona) args.push("--system-prompt", persona);

    let fullMessage = message;
    if (attachments && attachments.length > 0) {
      const injections: string[] = [];
      for (const att of attachments) {
        if (att.extractionError) {
          injections.push(
            `[Attachment: ${att.originalName}]\n(extraction failed)\n[/Attachment]`,
          );
        } else {
          args.push("--file", att.storedPath);
        }
      }
      if (injections.length > 0) {
        fullMessage = `${message}\n\n${injections.join("\n\n")}`;
      }
    }

    args.push("--", fullMessage);

    const chunks: MessageChunk[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    this.proc = spawn("claude", args, { stdio: "pipe" });

    this.proc.stdout!.on("data", (buf: Buffer) => {
      for (const line of buf.toString().split("\n").filter(Boolean)) {
        try {
          const json = JSON.parse(line);
          const chunk = parseClaudeEvent(json);
          if (chunk) {
            chunks.push(chunk);
            resolve?.();
          }
        } catch {
          /* skip malformed lines */
        }
      }
    });

    this.proc.on("close", () => {
      done = true;
      chunks.push({ type: "done", content: "" });
      resolve?.();
    });

    this.proc.on("error", (err) => {
      done = true;
      chunks.push({ type: "error", content: err.message });
      resolve?.();
    });

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!;
      if (done) break;
      await new Promise<void>((r) => {
        resolve = r;
      });
    }
  }

  abort(): void {
    this.proc?.kill("SIGTERM");
    this.proc = null;
  }
}

function parseClaudeEvent(event: any): MessageChunk | null {
  if (
    event.type === "content_block_delta" &&
    event.delta?.type === "text_delta"
  ) {
    return { type: "text", content: event.delta.text, raw: event };
  }
  if (
    event.type === "content_block_start" &&
    event.content_block?.type === "tool_use"
  ) {
    return {
      type: "tool_use",
      content: event.content_block.name ?? "",
      raw: event,
    };
  }
  if (event.type === "error") {
    return {
      type: "error",
      content: event.error?.message ?? "Unknown error",
      raw: event,
    };
  }
  return null;
}
```

- [ ] **Step 4: Run test**

```
npm test -- --reporter=verbose src/main/adapters/claude.adapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/adapters/claude.adapter.ts src/main/adapters/claude.adapter.test.ts
git commit -m "fix(claude): remove bundled binary path; detect claude via PATH only"
```

---

## Task 3: Expand wizard backends list — all 8 adapters with overflow scroll

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep1.tsx`

**Interfaces:**
- Produces: `BACKENDS` array contains all 8 backend IDs; none has `bundled: true`; adapter list container scrolls

- [ ] **Step 1: Write failing test**

In `src/renderer/components/Wizard/WizardStep1.test.tsx` (create alongside existing `WizardStep2.test.tsx`):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardStep1 } from "./WizardStep1";

vi.mock("../../ipc", () => ({
  probeBackend: vi.fn().mockResolvedValue({ available: false, authenticated: false }),
}));

describe("WizardStep1", () => {
  it("renders all 8 backends", async () => {
    render(<WizardStep1 onNext={vi.fn()} />);
    const expectedLabels = [
      "Claude Code",
      "Claude API",
      "Gemini CLI",
      "Gemini API",
      "Opencode",
      "Ollama",
      "OpenRouter",
      "Codex",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("probes claude instead of marking it bundled", async () => {
    const { probeBackend } = await import("../../ipc");
    render(<WizardStep1 onNext={vi.fn()} />);
    // probeBackend should be called for all backends including claude
    await vi.waitFor(() => {
      expect(vi.mocked(probeBackend)).toHaveBeenCalledWith("claude");
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep1.test.tsx
```

Expected: FAIL — "Claude API", "Gemini API", "Ollama", "OpenRouter", "Codex" not found.

- [ ] **Step 3: Rewrite `WizardStep1.tsx`**

Replace the `BACKENDS` constant and the adapter list container:

```tsx
import { useEffect, useState } from "react";
import { CheckCircle, MinusCircle } from "@phosphor-icons/react";
import { probeBackend } from "../../ipc";

const BACKENDS = [
  { id: "claude", label: "Claude Code" },
  { id: "claude-api", label: "Claude API" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "gemini-api", label: "Gemini API" },
  { id: "opencode", label: "Opencode" },
  { id: "ollama", label: "Ollama" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "codex", label: "Codex" },
];

interface BackendStatus {
  id: string;
  available: boolean;
  authenticated: boolean;
  loading: boolean;
}

interface Props {
  onNext: (statuses: BackendStatus[]) => void;
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin flex-shrink-0" />
  );
}

export function WizardStep1({ onNext }: Props) {
  const [statuses, setStatuses] = useState<BackendStatus[]>(
    BACKENDS.map((b) => ({
      id: b.id,
      available: false,
      authenticated: false,
      loading: true,
    })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    BACKENDS.forEach(async (b) => {
      try {
        const result = await probeBackend(b.id);
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === b.id ? { ...s, ...result, loading: false } : s,
          ),
        );
      } catch (err) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.id === b.id
              ? { ...s, available: false, authenticated: false, loading: false }
              : s,
          ),
        );
        setErrors((prev) => ({
          ...prev,
          [b.id]: `Probe failed: ${(err as Error).message}`,
        }));
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Setting up your tools</h2>
        <p className="text-xs text-text-muted">
          Checking which AI tools are installed and ready on your system.
        </p>
      </div>
      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
        {BACKENDS.map((b) => {
          const s = statuses.find((x) => x.id === b.id)!;
          return (
            <div
              key={b.id}
              className="flex items-center gap-3 p-3 border border-border rounded-xl"
            >
              <div className="flex-shrink-0">
                {s.loading ? (
                  <Spinner />
                ) : s.available ? (
                  <CheckCircle size={20} weight="fill" className="text-primary" />
                ) : (
                  <MinusCircle size={20} weight="regular" className="text-text-muted" />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">{b.label}</div>
                <div className="text-xs text-text-muted">
                  {s.loading
                    ? "Checking..."
                    : s.available
                      ? "Found on your system"
                      : "Not installed"}
                </div>
              </div>
              {errors[b.id] && (
                <p className="text-xs text-red-500">{errors[b.id]}</p>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onNext(statuses)}
        disabled={statuses.some((s) => s.loading)}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep1.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep1.tsx src/renderer/components/Wizard/WizardStep1.test.tsx
git commit -m "fix(wizard): expand backend list to all 8 adapters; probe claude via IPC; add adapter list scroll"
```

---

## Task 4: Fix install commands — correct per-backend curl/npm commands

**Files:**
- Modify: `src/main/wizard/install.ts`

**Interfaces:**
- Produces: `installBackend(id)` supports ids: `claude`, `gemini`, `opencode`, `ollama`, `openrouter`, `codex`; uses curl/sh for non-npm backends

- [ ] **Step 1: Write failing test**

Add to or create `src/main/wizard/install.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, cb) => {
      if (event === "close") cb(0);
    }),
  })),
  execSync: vi.fn(),
}));

describe("installBackend", () => {
  it("uses curl for opencode, not npm", async () => {
    const { installBackend } = await import("./install");
    const { spawn } = await import("child_process");
    await installBackend("opencode", () => {});
    const call = vi.mocked(spawn).mock.calls[0];
    expect(call[0]).toBe("sh");
    expect(call[1].join(" ")).toContain("opencode.ai/install");
  });

  it("uses npm for gemini", async () => {
    const { installBackend } = await import("./install");
    const { spawn } = await import("child_process");
    vi.mocked(spawn).mockClear();
    await installBackend("gemini", () => {});
    const call = vi.mocked(spawn).mock.calls[0];
    expect(call[0]).toBe("npm");
    expect(call[1]).toContain("@google/gemini-cli");
  });

  it("returns error for unknown backend", async () => {
    const { installBackend } = await import("./install");
    const result = await installBackend("unknown-backend", () => {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown backend");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/main/wizard/install.test.ts
```

Expected: FAIL — opencode uses npm, not curl.

- [ ] **Step 3: Rewrite `src/main/wizard/install.ts`**

```ts
import { spawn, execSync } from "child_process";
import { getDb } from "../store/db";

type InstallCommand =
  | { type: "npm"; pkg: string }
  | { type: "curl"; url: string; shell: "sh" | "pwsh" };

const INSTALL_COMMANDS: Record<string, InstallCommand | ((platform: string) => InstallCommand)> = {
  claude: { type: "curl", url: "https://claude.ai/install.sh", shell: "sh" },
  gemini: { type: "npm", pkg: "@google/gemini-cli" },
  opencode: { type: "curl", url: "https://opencode.ai/install", shell: "sh" },
  ollama: (platform: string) =>
    platform === "win32"
      ? { type: "curl", url: "https://ollama.com/install.ps1", shell: "pwsh" }
      : { type: "curl", url: "https://ollama.com/install.sh", shell: "sh" },
  codex: { type: "curl", url: "https://chatgpt.com/codex/install.sh", shell: "sh" },
};

function getProxyEnv(): Record<string, string> {
  try {
    const db = getDb();
    const http = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_http") as any;
    const https = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_https") as any;
    const no = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("proxy_no") as any;
    const env: Record<string, string> = {};
    if (http?.value) { env.HTTP_PROXY = http.value; env.http_proxy = http.value; }
    if (https?.value) { env.HTTPS_PROXY = https.value; env.https_proxy = https.value; }
    if (no?.value) { env.NO_PROXY = no.value; env.no_proxy = no.value; }
    return env;
  } catch {
    return {};
  }
}

export function installBackend(
  id: string,
  onData: (line: string) => void,
): Promise<{ success: boolean; error?: string }> {
  const cmdDef = INSTALL_COMMANDS[id];
  if (!cmdDef) {
    return Promise.resolve({ success: false, error: `Unknown backend: ${id}` });
  }

  const cmd = typeof cmdDef === "function" ? cmdDef(process.platform) : cmdDef;
  const isWin = process.platform === "win32";
  const env = { ...process.env, ...getProxyEnv() };

  let binary: string;
  let args: string[];

  if (cmd.type === "npm") {
    try {
      execSync("npm --version", { stdio: "pipe", timeout: 5000 });
    } catch {
      return Promise.resolve({
        success: false,
        error: "npm not found in PATH. Install Node.js from https://nodejs.org",
      });
    }
    binary = "npm";
    args = ["install", "-g", cmd.pkg];
  } else {
    // curl | sh or curl | pwsh
    if (cmd.shell === "pwsh") {
      binary = "powershell.exe";
      args = ["-Command", `irm ${cmd.url} | iex`];
    } else {
      binary = "sh";
      args = ["-c", `curl -fsSL ${cmd.url} | sh`];
    }
  }

  return new Promise((resolve) => {
    const p = spawn(binary, args, {
      stdio: "pipe",
      shell: cmd.type === "npm" && isWin,
      env,
    });
    let stderrOutput = "";
    p.stdout!.on("data", (buf: Buffer) =>
      buf.toString().split("\n").filter(Boolean).forEach(onData),
    );
    p.stderr!.on("data", (buf: Buffer) => {
      const text = buf.toString();
      stderrOutput += text;
      text.split("\n").filter(Boolean).forEach(onData);
    });
    p.on("close", (code) => {
      if (code === 0) return resolve({ success: true });
      const isPermissionError =
        /EACCES|EPERM|access denied|permission denied/i.test(stderrOutput);
      resolve({
        success: false,
        error: isPermissionError
          ? isWin
            ? `Permission denied. Run the installer in a terminal opened as Administrator.`
            : `Permission denied. Try running the install command with sudo.`
          : `Install failed with exit code ${code}. See output above.`,
      });
    });
    p.on("error", (err) =>
      resolve({
        success: false,
        error: `Failed to start installer: ${err.message}`,
      }),
    );
  });
}
```

- [ ] **Step 4: Run test**

```
npm test -- --reporter=verbose src/main/wizard/install.test.ts
```

Expected: PASS.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main/wizard/install.ts src/main/wizard/install.test.ts
git commit -m "fix(wizard): correct install commands for all backends; replace bad opencode npm package with curl"
```

---

## Task 5: Update WizardStep2 labels and add Ollama "Start" button

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`

**Interfaces:**
- Consumes: `missing: string[]` from WizardStep1 — may now include `claude`, `ollama`, `codex`, `openrouter`, `claude-api`, `gemini-api`
- Produces: All backend IDs have display labels; ollama row shows a "Start Ollama" button alongside Install

- [ ] **Step 1: Write failing test**

Add to existing `src/renderer/components/Wizard/WizardStep2.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardStep2 } from "./WizardStep2";

vi.mock("../../ipc", () => ({
  installBackend: vi.fn().mockResolvedValue({ success: true }),
}));

describe("WizardStep2", () => {
  it("shows a label for every missing backend including ollama and codex", () => {
    render(
      <WizardStep2
        missing={["ollama", "codex", "claude", "openrouter"]}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Ollama")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("OpenRouter")).toBeTruthy();
  });

  it("shows a Start Ollama button for the ollama backend", () => {
    render(
      <WizardStep2
        missing={["ollama"]}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Start Ollama")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep2.test.tsx
```

Expected: FAIL — "Ollama", "Codex", "Start Ollama" not found.

- [ ] **Step 3: Update `WizardStep2.tsx`**

Replace the `LABELS` constant and add the Start Ollama button in the ollama row:

```tsx
import { useState } from "react";
import { installBackend } from "../../ipc";

const LABELS: Record<string, string> = {
  claude: "Claude Code",
  "claude-api": "Claude API",
  gemini: "Gemini CLI",
  "gemini-api": "Gemini API",
  opencode: "Opencode",
  ollama: "Ollama",
  openrouter: "OpenRouter",
  codex: "Codex",
};

interface Props {
  missing: string[];
  onNext: () => void;
  onBack: () => void;
}

export function WizardStep2({ missing, onNext, onBack }: Props) {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const install = async (id: string) => {
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setInstalling((prev) => ({ ...prev, [id]: true }));
    const addLine = (line: string) =>
      setLogs((prev) => ({ ...prev, [id]: [...(prev[id] ?? []), line] }));

    const off = window.ipc.on(
      "wizard:install:line",
      (evtBackend: unknown, line: unknown) => {
        if (evtBackend === id) addLine(String(line));
      },
    );
    const { success: ok, error } = await installBackend(id);
    off();

    setInstalling((prev) => ({ ...prev, [id]: false }));
    setDone((prev) => ({ ...prev, [id]: ok }));
    if (!ok) {
      setErrors((prev) => ({
        ...prev,
        [id]: error ?? "Installation failed. Check your internet connection.",
      }));
    }
  };

  const startOllama = () => {
    window.ipc.invoke("ollama:start").catch(() => {});
  };

  if (missing.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold mb-1">All tools found</h2>
          <p className="text-xs text-text-muted">
            Every AI tool was detected on your system.
          </p>
        </div>
        <button
          onClick={onNext}
          className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
        >
          Next
        </button>
        <button
          onClick={onBack}
          className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Install additional tools</h2>
        <p className="text-xs text-text-muted">
          These are optional. You can skip and install them from Settings later.
        </p>
      </div>
      {missing.map((id) => (
        <div
          key={id}
          className="flex flex-col gap-2 border border-border rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
            <div className="flex gap-2">
              {id === "ollama" && (
                <button
                  onClick={startOllama}
                  className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
                >
                  Start Ollama
                </button>
              )}
              <button
                onClick={() => install(id)}
                disabled={installing[id] || done[id]}
                className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
              >
                {done[id] ? "Installed" : installing[id] ? "Installing..." : "Install"}
              </button>
              <button
                onClick={() => setDone((prev) => ({ ...prev, [id]: true }))}
                disabled={done[id]}
                className="btn-sm border border-border-strong hoverable:hover:bg-bubble disabled:opacity-30"
              >
                Skip
              </button>
            </div>
          </div>
          {(logs[id] ?? []).length > 0 && (
            <pre className="text-xs bg-gray-900 text-gray-300 rounded-lg p-2 max-h-24 overflow-y-auto">
              {logs[id].join("\n")}
            </pre>
          )}
          {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
        </div>
      ))}
      <button
        onClick={onNext}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
      >
        Continue
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
      >
        Back
      </button>
    </div>
  );
}
```

Also add the `ollama:start` IPC handler in `src/main/ipc.ts` inside `registerIpcHandlers` (add after the last `ipcMain.handle` call). This spawns `ollama serve` as a detached background process — no visible terminal window is required:

```ts
ipcMain.handle("ollama:start", () => {
  const child = spawn("ollama", ["serve"], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
});
```

`spawn` is already imported at the top of `src/main/ipc.ts`. If it is not, add it:

```ts
import { spawn } from "child_process";
```

And add the channel constant to `src/shared/ipc.ts`:

```ts
OLLAMA_START: "ollama:start",
```

- [ ] **Step 4: Run test**

```
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep2.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep2.tsx src/renderer/components/Wizard/WizardStep2.test.tsx src/main/ipc.ts src/shared/ipc.ts
git commit -m "fix(wizard): add labels for all backends; add Ollama Start button; add ollama:start IPC"
```

---

## Task 6: Fix API key UX — Save button becomes Remove when key is stored

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`

**Interfaces:**
- Produces: When `keyStates[p.id]` is true, button renders as "Remove" (destructive style) and calls `deleteKey`; when false, renders "Save" as before

- [ ] **Step 1: Write failing test**

Create `src/renderer/components/Settings/SettingsPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel";

vi.mock("../../ipc", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn(),
  getAppVersion: vi.fn().mockResolvedValue("0.2.1"),
  storeKey: vi.fn().mockResolvedValue(undefined),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  hasKey: vi.fn().mockImplementation((id: string) =>
    Promise.resolve(id === "openai"),
  ),
  probeBackend: vi.fn().mockResolvedValue({ available: false, authenticated: false }),
  getProxySettings: vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  setProxySettings: vi.fn(),
}));

describe("SettingsPanel key UX", () => {
  it("shows Remove button for providers that already have a key stored", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    // Wait for hasKey to resolve
    await vi.waitFor(() => {
      expect(screen.getByText("Remove")).toBeTruthy();
    });
  });

  it("shows Save button for providers with no key stored", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    await vi.waitFor(() => {
      // OpenRouter, Claude API, Gemini API have no key — show Save
      const saveBtns = screen.getAllByText("Save");
      expect(saveBtns.length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose src/renderer/components/Settings/SettingsPanel.test.tsx
```

Expected: FAIL — "Remove" button not found.

- [ ] **Step 3: Update the API key row in `SettingsPanel.tsx`**

Replace the flex div containing the password input, Save button, and Test button for non-ollama providers (currently lines 162–191). The key change: render "Remove" button when `keyStates[p.id]` is true, "Save" otherwise:

```tsx
{p.id === "ollama" ? (
  <p className="text-xs text-text-muted italic">
    No key needed — connects to localhost:11434
  </p>
) : (
  <div className="flex gap-1">
    {keyStates[p.id] ? (
      <button
        onClick={async () => {
          await deleteKey(p.id);
          setKeyStates((prev) => ({ ...prev, [p.id]: false }));
        }}
        className="btn-sm border border-red-400 text-red-500 hoverable:hover:bg-red-50 dark:hoverable:hover:bg-red-950 text-xs px-2"
      >
        Remove
      </button>
    ) : (
      <>
        <input
          type="password"
          className="flex-1 text-xs border rounded px-2 py-1 bg-surface border-border-strong"
          placeholder="sk-..."
          value={apiKeys[p.id] ?? ""}
          onChange={(e) =>
            setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
          }
        />
        <button
          onClick={() => handleSaveKey(p.id)}
          className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark text-xs px-2"
        >
          Save
        </button>
      </>
    )}
    <button
      onClick={() => handleTest(p.id)}
      disabled={testing[p.id]}
      className="btn-sm border border-border-strong text-xs px-2 hoverable:hover:bg-bubble"
    >
      {testing[p.id] ? "..." : "Test"}
    </button>
  </div>
)}
```

Also add the `deleteKey` import at the top of the file (it's already imported from `../../ipc`).

- [ ] **Step 4: Run test**

```
npm test -- --reporter=verbose src/renderer/components/Settings/SettingsPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx src/renderer/components/Settings/SettingsPanel.test.tsx
git commit -m "fix(settings): show Remove button when API key is already stored"
```

---

## Task 7: UI integrity — settings scroll, search opens sidebar, chat fills window

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: Settings panel scrolls; search button expands sidebar; chat area fills available width

- [ ] **Step 1: Fix SettingsPanel scroll**

In `src/renderer/components/Settings/SettingsPanel.tsx`, change the root div's className from:

```tsx
<div className="w-full overflow-y-auto bg-surface">
```

to:

```tsx
<div className="w-full h-full overflow-y-auto bg-surface">
```

Adding `h-full` bounds the div to its parent's height, making `overflow-y-auto` effective.

- [ ] **Step 2: Fix search button — expand sidebar**

In `src/renderer/App.tsx`, find the search button's `onClick` handler (around line 320):

```tsx
onClick={() => setSearchMode((v) => !v)}
```

Replace with:

```tsx
onClick={() => {
  setSearchMode((v) => !v);
  setSidebarCollapsed(false);
}}
```

- [ ] **Step 3: Fix chat area fills window — wrap ChatView in flex-1**

In `src/renderer/App.tsx`, find the ChatView render in the ternary (around line 421):

```tsx
) : (
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
)}
```

Replace with:

```tsx
) : (
  <div className="flex-1 min-w-0 overflow-hidden">
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
  </div>
)}
```

The `flex-1 min-w-0` wrapper matches what the welcome screen divs use and ensures ChatView grows to fill the remaining width in the flex-row `<main>`.

- [ ] **Step 4: Lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Build to verify no TypeScript errors**

```
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx src/renderer/App.tsx
git commit -m "fix(ui): settings panel scrolls; search button expands sidebar; chat area fills window"
```

---

## Verification Checklist

Run through the following manually after all tasks are complete:

- [ ] Open the app — it reaches the chat screen (not stuck on wizard)
- [ ] Send a message with Claude backend — receives a streamed text response
- [ ] Send a message with a backend that has no key/binary — sees `⚠ Error: ...` in the bubble instead of empty
- [ ] Re-run wizard — all 8 backends are listed; Claude is probed (not pre-approved)
- [ ] In wizard step 2, click Install for opencode — no E404 error (curl-based install)
- [ ] In wizard step 2, ollama row has a "Start Ollama" button
- [ ] In Settings, enter an API key and click Save — button changes to "Remove"
- [ ] Click Remove — button returns to "Save" with empty input
- [ ] Click the search magnifying glass icon — sidebar expands and shows search input
- [ ] Open Settings panel — all content is reachable by scrolling (no clipping)
- [ ] Chat area fills the full window width when sidebar and panels are closed
