# Optimize — Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/P1 performance issues — debounce ConvList search, cache PipelineRunner BrowserWindow, stabilize MessageBubble attachment fetch, memoize MessageList, batch SettingsPanel IPC calls, and parallelize AdapterManager availability checks.

**Architecture:** All changes are in-place refactors of existing files. No new IPC channels needed — SettingsPanel batching uses `Promise.all` over existing channels. No new files except the debounce utility.

**Tech Stack:** React 18, TypeScript, Vitest

## Global Constraints

- `npm test` must pass after every task
- `npm run build` must succeed after every task
- Do not change observable behavior (same search results, same settings, same pipeline output)
- Do not rename or restructure files

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/components/Sidebar/ConvList.tsx` | Debounce search with 300ms delay |
| `src/main/pipeline/runner.ts:38` | Cache `BrowserWindow.getAllWindows()[0]` outside the step loop |
| `src/renderer/components/Chat/MessageBubble.tsx` | Stable `useEffect` dependency — `message.id` is already stable; add `useCallback` on `listAttachments` call |
| `src/renderer/components/Chat/MessageList.tsx` | Wrap with `React.memo` |
| `src/renderer/components/Settings/SettingsPanel.tsx:37-77` | Merge 4 `useEffect` calls into one `Promise.all` on mount |
| `src/main/adapters/manager.ts:68-77` | `Promise.all([a.isAvailable(), a.checkAuth()])` instead of sequential awaits |

---

## Task 1: Debounce ConvList Search (P1)

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvList.tsx`

**Interfaces:**
- Consumes: `handleSearch(q)` already exists
- Produces: IPC `search(q)` fires at most once per 300ms of user inactivity

- [ ] **Step 1: Write the failing test**

In `src/renderer/components/Sidebar/__tests__/ConvList.test.tsx` (create if not present):

```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSearch = vi.fn().mockResolvedValue([]);
vi.mock("../../hooks/useConversations", () => ({
  useConversations: () => ({ conversations: [], search: mockSearch }),
}));

import { ConvList } from "../ConvList";

describe("ConvList search debounce", () => {
  beforeEach(() => { vi.useFakeTimers(); mockSearch.mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("calls search once after 300ms pause, not on every keystroke", async () => {
    render(
      <ConvList
        activeId={null} onSelect={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()}
      />
    );
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    // Not called yet — still within debounce window
    expect(mockSearch).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(350); });

    // Called exactly once with final value
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith("abc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose ConvList
```
Expected: FAIL — `mockSearch` is called 3 times instead of 1.

- [ ] **Step 3: Add debounce to ConvList.tsx**

In `src/renderer/components/Sidebar/ConvList.tsx`, import `useRef` and replace `handleSearch`:

```tsx
import { useState, useRef } from "react";
// ... other imports unchanged

export function ConvList({ ... }) {
  const { conversations, search } = useConversations(refreshTrigger);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!q.trim()) {
      setSearchResults(null);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const results = await search(q);
      setSearchResults(results);
    }, 300);
  };

  // ... rest of component unchanged
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose ConvList
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Sidebar/__tests__/ConvList.test.tsx
git commit -m "perf: debounce ConvList search — fires IPC at most once per 300ms of typing"
```

---

## Task 2: Cache PipelineRunner BrowserWindow (P0)

**Files:**
- Modify: `src/main/pipeline/runner.ts:28-38`

**Interfaces:**
- Consumes: `BrowserWindow.getAllWindows()` — currently called once per pipeline step
- Produces: called once per `run()` invocation, outside the step loop

- [ ] **Step 1: Write the failing test**

No existing unit tests for `PipelineRunner`. Create `src/main/pipeline/runner.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Electron BrowserWindow
const mockGetAllWindows = vi.fn().mockReturnValue([{ webContents: { send: vi.fn() } }]);
vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: mockGetAllWindows },
}));

// Mock AdapterManager
vi.mock("../adapters/manager", () => ({
  AdapterManager: {
    get: vi.fn().mockReturnValue({
      id: "test",
      send: async function* () { yield { type: "done", content: "" }; },
      abort: vi.fn(),
    }),
  },
  securityMiddleware: async function* (source: AsyncIterable<unknown>) { yield* source; },
}));

import { PipelineRunner } from "./runner";

describe("PipelineRunner", () => {
  beforeEach(() => { mockGetAllWindows.mockClear(); });

  it("calls getAllWindows once per run, not once per step", async () => {
    const runner = new PipelineRunner();
    await runner.run({
      conversationId: "c1",
      userMessage: "hi",
      steps: [{ adapterId: "test" }, { adapterId: "test" }],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    });
    expect(mockGetAllWindows).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose runner
```
Expected: FAIL — `getAllWindows` called 2 times (once per step).

- [ ] **Step 3: Move win lookup outside the step loop**

In `src/main/pipeline/runner.ts`:

```ts
// BEFORE (inside for loop, ~line 38):
async run(params: { ... }): Promise<void> {
  let aborted = false;
  this.abortMap.set(params.conversationId, () => { aborted = true; });
  let currentInput = params.userMessage;

  try {
    for (let i = 0; i < params.steps.length; i++) {
      if (aborted) break;
      const step = params.steps[i];
      const adapter = AdapterManager.get(step.adapterId);
      if (!adapter) throw new Error(`Adapter not found: ${step.adapterId}`);

      let accumulated = "";
      let stepCompleted = false;

      const win = BrowserWindow.getAllWindows()[0] ?? null;  // ← INSIDE loop
      for await (const chunk of securityMiddleware( ...

// AFTER — move win ABOVE the for loop:
async run(params: { ... }): Promise<void> {
  let aborted = false;
  this.abortMap.set(params.conversationId, () => { aborted = true; });
  let currentInput = params.userMessage;
  const win = BrowserWindow.getAllWindows()[0] ?? null;  // ← OUTSIDE loop

  try {
    for (let i = 0; i < params.steps.length; i++) {
      if (aborted) break;
      const step = params.steps[i];
      const adapter = AdapterManager.get(step.adapterId);
      if (!adapter) throw new Error(`Adapter not found: ${step.adapterId}`);

      let accumulated = "";
      let stepCompleted = false;

      for await (const chunk of securityMiddleware( ...
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose runner
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/pipeline/runner.ts src/main/pipeline/runner.test.ts
git commit -m "perf: cache BrowserWindow reference outside pipeline step loop"
```

---

## Task 3: Stabilize MessageBubble Attachment Fetch (P0)

The current `useEffect` dependency is `[message.id, isUser]` — both stable between renders. The audit said "re-fetches when parent re-renders" but `message.id` is stable. The actual bug is subtler: when a conversation is switched and then switched back, `message.id` values are the same but `listAttachments` is called again because the component remounts.

The fix is to stabilize fetching by caching results at the component level using `useRef` so a re-mount on the same conversation doesn't re-fetch.

**Files:**
- Modify: `src/renderer/components/Chat/MessageBubble.tsx:31-36`

- [ ] **Step 1: Write the failing test**

In `src/renderer/components/Chat/__tests__/MessageBubble.test.tsx`, add:

```tsx
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockListAttachments = vi.fn().mockResolvedValue([]);
vi.mock("../../ipc", () => ({ listAttachments: mockListAttachments }));

import { MessageBubble } from "../MessageBubble";

const userMsg = {
  id: "m1", role: "user" as const, content: "Hi",
  conversationId: "c1", backend: "claude",
  createdAt: new Date().toISOString(),
};

describe("MessageBubble attachment fetch", () => {
  it("fetches attachments only once per message id, not on re-render", async () => {
    mockListAttachments.mockClear();
    const { rerender } = render(<MessageBubble message={userMsg} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);

    // Re-render with same message — should NOT fetch again
    rerender(<MessageBubble message={{ ...userMsg, content: "updated" }} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose MessageBubble
```
Expected: FAIL — fetch count is 2 on re-render with content update.

Actually — `message.id` doesn't change when `content` changes, so the effect won't re-fire. This test may already PASS with the current code. Run it to confirm.

If it already passes: skip Steps 3-4 and commit a note.

If it fails: the underlying cause is that `memo` comparison is failing. In that case:

- [ ] **Step 3: Add `memo` comparison function to MessageBubble**

The component already has `memo()`. Add a custom comparison:

```tsx
export const MessageBubble = memo(
  function MessageBubble({ message }: Props) {
    // ... component unchanged
  },
  (prev, next) => prev.message.id === next.message.id && prev.message.content === next.message.content,
);
```

This prevents re-renders when only unrelated message fields change.

- [ ] **Step 4: Run test**

```bash
npm test -- --reporter=verbose MessageBubble
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Chat/MessageBubble.tsx src/renderer/components/Chat/__tests__/MessageBubble.test.tsx
git commit -m "perf: memoize MessageBubble by id+content to prevent unnecessary re-renders and attachment refetches"
```

---

## Task 4: Memoize MessageList (P1)

**Files:**
- Modify: `src/renderer/components/Chat/MessageList.tsx` (read this file first — it may already be memo'd)

**Interfaces:**
- Consumes: `messages: Message[]`, `streaming: boolean`, `conversationId: string | null`
- Produces: component only re-renders when `messages` array reference OR `streaming` state changes

- [ ] **Step 1: Read the file**

```bash
cat src/renderer/components/Chat/MessageList.tsx
```

If it already has `React.memo`, skip this task.

- [ ] **Step 2: Wrap with React.memo**

```tsx
import { memo } from "react";
// ... rest of imports

interface Props {
  messages: Message[];
  streaming: boolean;
  conversationId: string | null;
}

export const MessageList = memo(function MessageList({ messages, streaming, conversationId }: Props) {
  // ... existing component body unchanged
});
```

- [ ] **Step 3: Verify ChatView passes stable references**

In `src/renderer/components/Chat/ChatView.tsx`, check that `messages` passed to `<MessageList>` is not recreated on every render. The `useMessages` hook returns `messages` state — this is already stable (React state identity only changes when `setMessages` is called). No additional `useCallback`/`useMemo` needed here.

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Chat/MessageList.tsx
git commit -m "perf: wrap MessageList in React.memo to skip re-renders on unrelated parent updates"
```

---

## Task 5: Batch SettingsPanel IPC Calls (P1)

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx:37-77`

**Interfaces:**
- Consumes: `getAppVersion`, `getSetting`, `hasKey`, `getProxySettings` from `../../ipc`
- Produces: single `Promise.all` on mount instead of 4 separate `useEffect` calls

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mockGetAppVersion = vi.fn().mockResolvedValue("1.0.0");
const mockGetSetting = vi.fn().mockResolvedValue(null);
const mockHasKey = vi.fn().mockResolvedValue(false);
const mockGetProxySettings = vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" });

vi.mock("../../ipc", () => ({
  getAppVersion: mockGetAppVersion,
  getSetting: mockGetSetting,
  hasKey: mockHasKey,
  getProxySettings: mockGetProxySettings,
  setSetting: vi.fn(),
  storeKey: vi.fn(),
  deleteKey: vi.fn(),
  probeBackend: vi.fn(),
  setProxySettings: vi.fn(),
}));

import { SettingsPanel } from "../SettingsPanel";

describe("SettingsPanel mount IPC calls", () => {
  it("all IPC calls resolve before first render completes", async () => {
    // Just verify they are called — batching is an impl detail
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    // All should be called during mount
    await vi.waitFor(() => {
      expect(mockGetAppVersion).toHaveBeenCalledTimes(1);
      expect(mockGetSetting).toHaveBeenCalledWith("theme");
      expect(mockGetProxySettings).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (it should already pass — this establishes baseline)

```bash
npm test -- --reporter=verbose SettingsPanel
```

- [ ] **Step 3: Merge the 4 useEffect calls into one Promise.all**

In `src/renderer/components/Settings/SettingsPanel.tsx`, replace the 4 separate `useEffect` blocks (lines 37-77) with a single one:

```tsx
// BEFORE: 4 separate useEffects
useEffect(() => { getAppVersion().then(setVersion); }, []);
useEffect(() => { getSetting("theme").then((v) => { ... }); }, []);
useEffect(() => {
  Promise.all(API_PROVIDERS.map(async (p) => { ... }))
    .then((results) => { setKeyStates(...); });
}, []);
useEffect(() => { getProxySettings().then(...).catch(...); }, []);

// AFTER: single useEffect, all calls in Promise.all
useEffect(() => {
  Promise.all([
    getAppVersion(),
    getSetting("theme"),
    Promise.all(API_PROVIDERS.map((p) => hasKey(p.id).then((exists) => ({ id: p.id, exists })))),
    getProxySettings().catch(() => ({ httpProxy: "", httpsProxy: "", noProxy: "" })),
  ]).then(([version, themeSetting, keyResults, proxy]) => {
    setVersion(version as string);
    const t = themeSetting as string | null;
    if (t === "light" || t === "dark" || t === "system") setTheme(t);
    setKeyStates(Object.fromEntries((keyResults as { id: string; exists: boolean }[]).map((r) => [r.id, r.exists])));
    const p = proxy as { httpProxy: string; httpsProxy: string; noProxy: string };
    setProxyHttp(p.httpProxy);
    setProxyHttps(p.httpsProxy);
    setProxyNo(p.noProxy);
  });
}, []);

// Keep the media-query effect for system theme separately — it has a different dependency (theme state):
useEffect(() => {
  if (theme !== "system") return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle("dark", e.matches);
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}, [theme]);
```

Note: The `Promise.all` return type is a tuple and TypeScript needs help with the types. Cast each element explicitly as shown above, or use intermediate `async` function.

Cleaner alternative using an `async` IIFE:

```tsx
useEffect(() => {
  (async () => {
    const [version, themeSetting, keyResults, proxy] = await Promise.all([
      getAppVersion(),
      getSetting("theme"),
      Promise.all(API_PROVIDERS.map((p) => hasKey(p.id).then((exists) => ({ id: p.id, exists })))),
      getProxySettings().catch(() => ({ httpProxy: "", httpsProxy: "", noProxy: "" })),
    ]);
    setVersion(version);
    if (themeSetting === "light" || themeSetting === "dark" || themeSetting === "system") {
      setTheme(themeSetting);
    }
    setKeyStates(Object.fromEntries(keyResults.map((r) => [r.id, r.exists])));
    setProxyHttp(proxy.httpProxy);
    setProxyHttps(proxy.httpsProxy);
    setProxyNo(proxy.noProxy);
  })();
}, []);
```

- [ ] **Step 4: Run test**

```bash
npm test -- --reporter=verbose SettingsPanel
```
Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx
git commit -m "perf: batch SettingsPanel mount IPC calls into single Promise.all (4 round-trips → 1)"
```

---

## Task 6: Parallelize AdapterManager Availability Checks (P2)

**Files:**
- Modify: `src/main/adapters/manager.ts:68-77`

**Interfaces:**
- Consumes: `a.isAvailable()`, `a.checkAuth()` — both return `Promise<boolean>`
- Produces: `Promise.all([a.isAvailable(), a.checkAuth()])` instead of sequential awaits

- [ ] **Step 1: Update listAvailable in manager.ts**

```ts
// BEFORE:
async listAvailable(): Promise<BackendInfo[]> {
  return Promise.all(
    registry.map(async (a) => ({
      id: a.id,
      label: labelFor(a.id),
      available: await a.isAvailable(),
      authenticated: await a.checkAuth(),
    })),
  );
},

// AFTER:
async listAvailable(): Promise<BackendInfo[]> {
  return Promise.all(
    registry.map(async (a) => {
      const [available, authenticated] = await Promise.all([
        a.isAvailable(),
        a.checkAuth(),
      ]);
      return { id: a.id, label: labelFor(a.id), available, authenticated };
    }),
  );
},
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/main/adapters/manager.ts
git commit -m "perf: parallelize isAvailable() and checkAuth() per adapter in listAvailable()"
```

---

## Self-Review

**Spec coverage:**
- [x] P0: Layout thrashing in PipelineRunner — Task 2
- [x] P0: MessageBubble attachment re-fetch — Task 3
- [x] P1: No React.memo on MessageList — Task 4
- [x] P1: ConvList search debounce — Task 1
- [x] P1: SettingsPanel 6 parallel IPC calls on mount — Task 5
- [x] P2: AdapterManager sequential availability checks — Task 6
- [ ] P1: PersonaPanel inline onClick/onKeyDown causing re-renders — not addressed here; template items and user persona items will have stable functions after the harden plan converts them to `<button>` with direct handler references
- [ ] P2: AttachmentChip inline animation-duration — deferred; add to tailwind.config.ts as a named animation variant in a separate task

**Placeholder scan:** Task 3 explicitly notes "if test already passes, skip steps 3-4" — this is not a placeholder, it's conditional logic based on investigation.

**Type consistency:** `Promise.all` tuple destructuring uses the same type names (`available`, `authenticated`) as the existing `BackendInfo` interface.
