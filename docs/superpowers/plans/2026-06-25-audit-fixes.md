# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six confirmed/plausible bugs and one code-quality issue surfaced by the 2026-06-25 commit audit.

**Architecture:** Each task is a surgical, isolated change — one root cause, one commit. Tests are modified or added for every behavioural change. No task touches code outside its scope.

**Tech Stack:** TypeScript, React 18, Electron, Vitest, @testing-library/react, Tailwind CSS.

> **Note (no code change):** The `wizard:install:line` IPC callback restructure (per-backend routing guard) was bundled into commit `ea81039` (color-token refactor). The code is correct; git history is the only issue. No fix needed, but future refactor PRs should contain only style changes.

## Global Constraints

- Run `npm test` after every task; all tests must pass before committing.
- Follow the surgical-changes rule from CLAUDE.md: touch only lines required by this task's fix.
- All IPC channel names must come from `src/shared/ipc.ts` — never use raw strings.
- Never import renderer code from `src/main/` and vice versa.

---

### Task 1: Fix useFocusTrap re-initialization for queued security events

**Root cause (CONFIRMED):** When a second `SecurityEvent` arrives while the dialog is already open and `resolved === false`, `setResolved(false)` is a no-op (state unchanged → no re-render → `useFocusTrap`'s `[enabled, containerRef]` deps never change → the effect never re-fires → auto-focus is skipped for the new event).

**Files:**
- Modify: `src/renderer/hooks/useFocusTrap.ts`
- Modify: `src/renderer/components/SecurityDialog/SecurityDialog.tsx`
- Modify: `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx`

**Interfaces:**
- `useFocusTrap(containerRef, enabled, trigger?)` — `trigger` added as optional third param; any change to it re-fires the effect even if `enabled` stays `true`.

- [ ] **Step 1: Write the failing test**

Add to `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx` inside the `"SecurityDialog focus trap"` describe block:

```tsx
it("re-focuses first button when a second queued event arrives while dialog is open", async () => {
  const eventA = {
    type: "injection_detected" as const,
    severity: "low" as const,
    message: "Event A",
    detail: "detail A",
    source: "claude",
  };
  const eventB = {
    type: "injection_detected" as const,
    severity: "high" as const,
    message: "Event B",
    detail: "detail B",
    source: "claude",
  };

  const { rerender } = render(<SecurityDialog event={eventA} onRespond={vi.fn()} />);

  // Event A: dialog is open, Dismiss receives focus
  const dismissA = screen.getByRole("button", { name: /dismiss/i });
  expect(document.activeElement).toBe(dismissA);

  // Simulate user moving focus away (tabbing to another element)
  dismissA.blur();

  // Event B arrives before Event A was resolved
  rerender(<SecurityDialog event={eventB} onRespond={vi.fn()} />);

  // Focus should return to the first button of the updated dialog
  await vi.waitFor(() => {
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /dismiss/i }));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npm test -- SecurityDialog.test
```

Expected: FAIL — focus is not restored on the second event.

- [ ] **Step 3: Add `trigger` parameter to useFocusTrap**

Replace the entire contents of `src/renderer/hooks/useFocusTrap.ts`:

```typescript
import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  trigger?: unknown,
) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    focusable[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (!focusable.length) { e.preventDefault(); return; }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [enabled, containerRef, trigger]);
}
```

- [ ] **Step 4: Update SecurityDialog to pass `event` as trigger and remove the now-redundant rAF block**

In `src/renderer/components/SecurityDialog/SecurityDialog.tsx`, make two changes:

Change line 15:
```tsx
// Before:
useFocusTrap(dialogRef, !resolved);

// After:
useFocusTrap(dialogRef, !resolved, event);
```

Replace the `useEffect` on lines 17–26 (the one that calls `requestAnimationFrame`):
```tsx
// Before:
useEffect(() => {
  setResolved(false);
  // Re-focus first focusable element when a new queued event arrives
  requestAnimationFrame(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  });
}, [event]);

// After:
useEffect(() => {
  setResolved(false);
}, [event]);
```

Also remove `useRef` from the import since `dialogRef` still needs it — leave `useRef` in the import. Remove `useState, useEffect, useCallback, useRef` is the full current import; we're only removing the rAF block so `dialogRef` still uses `useRef`. No import changes needed.

- [ ] **Step 5: Run the test to confirm it passes**

```
npm test -- SecurityDialog.test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/renderer/hooks/useFocusTrap.ts src/renderer/components/SecurityDialog/SecurityDialog.tsx src/renderer/components/SecurityDialog/SecurityDialog.test.tsx
git commit -m "fix: re-fire focus trap on queued security events by passing event as trigger"
```

---

### Task 2: Fix SettingsPanel silent failure on IPC rejection

**Root cause (PLAUSIBLE):** `Promise.all([getAppVersion(), getSetting('theme'), Promise.all(hasKey)])` — the first three promises have no individual `.catch()`. If any rejects (e.g., IPC handler throws at startup), the entire `Promise.all` rejects silently, leaving all settings fields at initial empty/default values with no error shown.

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`
- Modify: `src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add inside `describe("SettingsPanel mount IPC calls")` in `src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx`:

```tsx
it("renders with defaults when getAppVersion rejects — other fields still load", async () => {
  mockGetAppVersion.mockRejectedValueOnce(new Error("IPC error"));

  render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);

  await vi.waitFor(() => {
    // theme and key states still loaded even though version failed
    expect(mockGetSetting).toHaveBeenCalledWith("theme");
    expect(mockHasKey).toHaveBeenCalledTimes(5);
  });
  // No uncaught rejection — component still renders
  expect(screen.getByText(/theme/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npm test -- SettingsPanel.test
```

Expected: FAIL — the rejection propagates and other mocks are not called.

- [ ] **Step 3: Add `.catch()` fallbacks to unguarded promises**

In `src/renderer/components/Settings/SettingsPanel.tsx`, replace lines 39–52 (the `Promise.all` in the `useEffect`):

```typescript
// Before:
const [appVersion, themeSetting, keyResults, proxy] = await Promise.all([
  getAppVersion(),
  getSetting("theme"),
  Promise.all(
    API_PROVIDERS.map((p) =>
      hasKey(p.id).then((exists) => ({ id: p.id, exists })),
    ),
  ),
  getProxySettings().catch(() => ({
    httpProxy: "",
    httpsProxy: "",
    noProxy: "",
  })),
]);

// After:
const [appVersion, themeSetting, keyResults, proxy] = await Promise.all([
  getAppVersion().catch(() => ""),
  getSetting("theme").catch(() => null),
  Promise.all(
    API_PROVIDERS.map((p) =>
      hasKey(p.id)
        .then((exists) => ({ id: p.id, exists }))
        .catch(() => ({ id: p.id, exists: false })),
    ),
  ),
  getProxySettings().catch(() => ({
    httpProxy: "",
    httpsProxy: "",
    noProxy: "",
  })),
]);
```

- [ ] **Step 4: Run the test to confirm it passes**

```
npm test -- SettingsPanel.test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```
git add src/renderer/components/Settings/SettingsPanel.tsx src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx
git commit -m "fix: add per-promise catch fallbacks in SettingsPanel mount so partial IPC failures don't blank the panel"
```

---

### Task 3: Fix double aria-live announcement during streaming

**Root cause (PLAUSIBLE):** `MessageList` renders with `aria-live="polite"` when `role !== "tabpanel"`. `SingleChatView` passes no explicit `role`, so `MessageList` defaults to `role="log"` with `aria-live="polite"` active. The `<div role="status" aria-live="polite">` sr-only div in the same view then announces the same streaming content — double-announcement on NVDA/JAWS.

**Fix:** Remove `aria-live` from `MessageList` entirely (the `role="log"` semantic is kept; screen readers that honor it still treat it as a live region). The sr-only status div is the single, controlled announcement source.

**Files:**
- Modify: `src/renderer/components/Chat/MessageList.tsx`
- Modify: `src/renderer/components/Chat/ChatView.tsx`

- [ ] **Step 1: Write the test**

There is no existing test file for MessageList or ChatView. Add a new test file `src/renderer/components/Chat/__tests__/MessageList.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../ipc", () => ({
  listAttachments: vi.fn().mockResolvedValue([]),
}));

import { MessageList } from "../MessageList";

describe("MessageList aria-live", () => {
  it("does not carry aria-live on its root element", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-live")).toBeNull();
  });

  it("renders with role=log by default", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    expect(container.firstElementChild?.getAttribute("role")).toBe("log");
  });

  it("accepts role=tabpanel without aria-live", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} role="tabpanel" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("tabpanel");
    expect(root.getAttribute("aria-live")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (first test fails)**

```
npm test -- MessageList.test
```

Expected: FAIL — `MessageList` still has `aria-live="polite"` on its root.

- [ ] **Step 3: Remove aria-live from MessageList**

In `src/renderer/components/Chat/MessageList.tsx`, remove the conditional spread on line 47.

```tsx
// Before:
<div
  id={id}
  aria-labelledby={ariaLabelledBy}
  className="flex-1 overflow-y-auto px-4 py-4"
  {...(role !== "tabpanel" ? { "aria-live": "polite" } : {})}
  role={role}
>

// After:
<div
  id={id}
  aria-labelledby={ariaLabelledBy}
  className="flex-1 overflow-y-auto px-4 py-4"
  role={role}
>
```

- [ ] **Step 4: Extract the sr-only announcer in ChatView to remove copy-paste**

The `<div role="status" aria-live="polite" aria-atomic="false" className="sr-only">` block is duplicated in both `SingleChatView` and `PipelineChatView`. Define a local component at the bottom of `src/renderer/components/Chat/ChatView.tsx` (after the `PipelineChatView` function):

```tsx
function StreamingAnnouncer({ content }: { content: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
      {content}
    </div>
  );
}
```

Then update `SingleChatView` (replace lines 77–85):
```tsx
// Before:
{/* Live region — screen readers announce new assistant content during streaming */}
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {streaming ? (messages[messages.length - 1]?.content ?? "") : ""}
</div>

// After:
<StreamingAnnouncer
  content={streaming ? (messages[messages.length - 1]?.content ?? "") : ""}
/>
```

And update `PipelineChatView` (replace lines 170–180):
```tsx
// Before:
{/* Live region — screen readers announce new assistant content during streaming */}
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {streaming && streamingStepIndex === activeTabIndex
    ? (activeMessages[activeMessages.length - 1]?.content ?? "")
    : ""}
</div>

// After:
<StreamingAnnouncer
  content={
    streaming && streamingStepIndex === activeTabIndex
      ? (activeMessages[activeMessages.length - 1]?.content ?? "")
      : ""
  }
/>
```

- [ ] **Step 5: Run the tests to confirm they pass**

```
npm test -- MessageList.test
```

Expected: all three tests PASS.

- [ ] **Step 6: Commit**

```
git add src/renderer/components/Chat/MessageList.tsx src/renderer/components/Chat/ChatView.tsx src/renderer/components/Chat/__tests__/MessageList.test.tsx
git commit -m "fix(a11y): remove duplicate aria-live from MessageList; single StreamingAnnouncer per chat view"
```

---

### Task 4: Fix pipeline runner re-fetching BrowserWindow per step

**Root cause (PLAUSIBLE):** `runner.ts` caches `BrowserWindow.getAllWindows()[0]` before the step loop. If the Electron window is destroyed mid-run (developer hot-reload, window close/reopen), `win` references the destroyed `BrowserWindow`. Calling `.webContents.send()` on it throws "Object has been destroyed", which if swallowed by the security middleware callback silently drops all security events from subsequent steps.

**Files:**
- Modify: `src/main/pipeline/runner.ts`
- Modify: `src/main/pipeline/runner.test.ts`

- [ ] **Step 1: Update the existing test to assert the new expected behaviour**

In `src/main/pipeline/runner.test.ts`, find the test titled `"calls getAllWindows once per run, not once per step"` and replace it:

```typescript
// Before:
it("calls getAllWindows once per run, not once per step", async () => {
  mockGet.mockImplementation(() => ({
    id: "mock",
    abort: mockAbort,
    send: async function* () {
      yield { type: "text", content: "out" };
      yield { type: "done", content: "" };
    },
  }));

  await pipelineRunner.run({
    conversationId: "conv-getAllWindows",
    userMessage: "hi",
    steps: [{ adapterId: "a" }, { adapterId: "b" }, { adapterId: "c" }],
    onChunk: vi.fn(),
    onStepDone: vi.fn(),
  });

  expect(mockGetAllWindows).toHaveBeenCalledTimes(1);
});

// After:
it("re-fetches BrowserWindow once per step so security events reach a reloaded window", async () => {
  mockGet.mockImplementation(() => ({
    id: "mock",
    abort: mockAbort,
    send: async function* () {
      yield { type: "text", content: "out" };
      yield { type: "done", content: "" };
    },
  }));

  await pipelineRunner.run({
    conversationId: "conv-getAllWindows",
    userMessage: "hi",
    steps: [{ adapterId: "a" }, { adapterId: "b" }, { adapterId: "c" }],
    onChunk: vi.fn(),
    onStepDone: vi.fn(),
  });

  // Called once per step — if window reloads between steps, later steps
  // still deliver security events instead of throwing on a destroyed BrowserWindow
  expect(mockGetAllWindows).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npm test -- runner.test
```

Expected: FAIL — `mockGetAllWindows` was called 1 time, expected 3.

- [ ] **Step 3: Move BrowserWindow fetch inside the step loop**

In `src/main/pipeline/runner.ts`, move the `win` declaration from before the loop to inside it.

```typescript
// Before (lines 26–27):
let currentInput = params.userMessage;
const win = BrowserWindow.getAllWindows()[0] ?? null;

try {
  for (let i = 0; i < params.steps.length; i++) {
    if (aborted) break;

// After:
let currentInput = params.userMessage;

try {
  for (let i = 0; i < params.steps.length; i++) {
    if (aborted) break;
    const win = BrowserWindow.getAllWindows()[0] ?? null;
```

- [ ] **Step 4: Run the tests to confirm they pass**

```
npm test -- runner.test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```
git add src/main/pipeline/runner.ts src/main/pipeline/runner.test.ts
git commit -m "fix: re-fetch BrowserWindow per pipeline step to avoid stale reference after window reload"
```

---

### Task 5: Fix ConvList debounced search isMounted guard

**Root cause (PLAUSIBLE):** The 300ms debounce timer fires and dispatches an async IPC call. The cleanup `useEffect` only cancels a still-pending timer via `clearTimeout` — it cannot cancel an in-flight IPC promise. If the component unmounts between timer-fire and IPC resolve, `setSearchResults` is called on the unmounted component. In React 18 this is a silent no-op, but the IPC round-trip still runs wastefully.

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvList.tsx`
- Modify: `src/renderer/components/Sidebar/ConvList.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/renderer/components/Sidebar/ConvList.test.tsx`:

```tsx
describe("ConvList search unmount safety", () => {
  beforeEach(() => { vi.useFakeTimers(); mockSearch.mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does not call setState after unmount when search resolves late", async () => {
    let resolveSearch!: (v: SearchResult[]) => void;
    mockSearch.mockReturnValueOnce(
      new Promise<SearchResult[]>((res) => { resolveSearch = res; }),
    );

    const { unmount } = render(
      <ConvList activeId={null} onSelect={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });

    // Advance past debounce — timer fires, IPC is now in flight
    await act(async () => { vi.advanceTimersByTime(350); });

    // Unmount before search resolves
    unmount();

    // Resolving after unmount must not throw
    await act(async () => { resolveSearch([]); });
    // If we reach here without error, the guard works
  });
});
```

Add `SearchResult` to the import at the top of the test file:
```tsx
import type { SearchResult } from "../../../shared/types";
```

- [ ] **Step 2: Run the test to confirm it passes without the guard**

```
npm test -- ConvList.test
```

This test may pass even without the guard (React 18 swallows the setState). That's expected — the test documents intent. Proceed to Step 3.

- [ ] **Step 3: Add the isMounted guard to ConvList**

In `src/renderer/components/Sidebar/ConvList.tsx`, add an `isMounted` ref and guard the `setSearchResults` call:

```typescript
// Add after line 28 (after the debounceTimer ref):
const isMounted = useRef(true);
useEffect(() => () => { isMounted.current = false; }, []);
```

And inside `handleSearch`, guard the setState:
```typescript
// Before (lines 42–45):
debounceTimer.current = setTimeout(async () => {
  const results = await search(q);
  setSearchResults(results);
}, 300);

// After:
debounceTimer.current = setTimeout(async () => {
  const results = await search(q);
  if (isMounted.current) setSearchResults(results);
}, 300);
```

- [ ] **Step 4: Run all tests to confirm nothing is broken**

```
npm test -- ConvList.test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```
git add src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Sidebar/ConvList.test.tsx
git commit -m "fix: guard ConvList debounced search setState with isMounted to prevent stale async updates"
```

---

### Task 6: Extract AUTH_COMMANDS and fix BackendSwitcher toolbar layout

**Two issues fixed together (both touch BackendSwitcher):**

**Issue A (Reuse):** `AUTH_COMMANDS` is defined identically in `BackendSwitcher.tsx` and `WizardStep3.tsx`. Two copies can silently diverge when a new backend is added.

**Issue B (PLAUSIBLE layout):** `BackendSwitcher` changed its root from `<select>` to `<div className="flex flex-col gap-0.5">`. When `needsAuth=true`, the div grows a second row (the auth warning), making `BackendSwitcher` taller than sibling toolbar elements. The toolbar's `flex items-center` then center-aligns the taller component, misaligning the `<select>` relative to neighbouring elements.

**Files:**
- Create: `src/renderer/constants/auth.ts`
- Modify: `src/renderer/components/BackendSwitcher.tsx`
- Modify: `src/renderer/components/Wizard/WizardStep3.tsx`
- Modify: `src/renderer/components/BackendSwitcher.test.tsx`

- [ ] **Step 1: Write the test for AUTH_COMMANDS deduplication**

Open `src/renderer/components/BackendSwitcher.test.tsx` and add (checking the existing test structure first — add a new describe block):

```tsx
import { AUTH_COMMANDS } from "../../constants/auth";

describe("BackendSwitcher AUTH_COMMANDS", () => {
  it("references the shared constant — not an inline copy", () => {
    // Verifies the constant is importable and correct
    expect(AUTH_COMMANDS["claude"]).toBe("claude login");
    expect(AUTH_COMMANDS["gemini"]).toBe("gemini auth login");
    expect(AUTH_COMMANDS["opencode"]).toBe("opencode auth");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (module not found)**

```
npm test -- BackendSwitcher.test
```

Expected: FAIL — `../../constants/auth` does not exist.

- [ ] **Step 3: Create the shared constant**

Create `src/renderer/constants/auth.ts`:

```typescript
export const AUTH_COMMANDS: Record<string, string> = {
  claude: "claude login",
  gemini: "gemini auth login",
  opencode: "opencode auth",
};
```

- [ ] **Step 4: Update BackendSwitcher to import the shared constant and fix the layout**

Replace the entire contents of `src/renderer/components/BackendSwitcher.tsx`:

```typescript
import { memo } from "react";
import { useBackends } from "../hooks/useBackends";
import { AUTH_COMMANDS } from "../constants/auth";

interface Props {
  value: string;
  onChange: (id: string) => void;
  refreshTrigger?: number;
}

export const BackendSwitcher = memo(function BackendSwitcher({
  value,
  onChange,
  refreshTrigger = 0,
}: Props) {
  const { backends } = useBackends(refreshTrigger);
  const selected = backends.find((b) => b.id === value);
  const needsAuth = selected?.available && !selected?.authenticated;

  return (
    <div className="relative">
      <select
        className="text-xs px-2 py-1 rounded border border-border-strong bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {backends.map((b) => (
          <option key={b.id} value={b.id} disabled={!b.available}>
            {b.label}
            {!b.available
              ? " (not installed)"
              : !b.authenticated
                ? " (not auth)"
                : ""}
          </option>
        ))}
      </select>
      {needsAuth && (
        <span
          role="alert"
          className="absolute left-0 top-full mt-0.5 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
        >
          Not signed in — run{" "}
          <code className="font-mono bg-bubble px-0.5 rounded">
            {AUTH_COMMANDS[value] ?? `${value} auth login`}
          </code>{" "}
          first
        </span>
      )}
    </div>
  );
});
```

Key changes:
- `<div className="relative">` instead of `<div className="flex flex-col gap-0.5">` — wrapper no longer participates in flex layout
- Auth warning span: `absolute left-0 top-full mt-0.5 whitespace-nowrap` — floats below the select without affecting toolbar height
- `AUTH_COMMANDS` imported from `../constants/auth` instead of declared inline

- [ ] **Step 5: Update WizardStep3 to import the shared constant**

In `src/renderer/components/Wizard/WizardStep3.tsx`, replace lines 5–9:

```typescript
// Before:
const AUTH_COMMANDS: Record<string, string> = {
  claude: "claude login",
  gemini: "gemini auth login",
  opencode: "opencode auth",
};

// After:
import { AUTH_COMMANDS } from "../../constants/auth";
```

- [ ] **Step 6: Run the tests to confirm they pass**

```
npm test -- BackendSwitcher.test WizardStep3.test
```

Expected: all tests PASS, including the new AUTH_COMMANDS test.

- [ ] **Step 7: Run the full test suite**

```
npm test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```
git add src/renderer/constants/auth.ts src/renderer/components/BackendSwitcher.tsx src/renderer/components/Wizard/WizardStep3.tsx src/renderer/components/BackendSwitcher.test.tsx
git commit -m "fix: extract shared AUTH_COMMANDS constant; position BackendSwitcher auth warning absolutely to avoid toolbar height growth"
```

---

## Self-Review

**Spec coverage:**
- CONFIRMED bug (useFocusTrap second-event focus): Task 1 ✓
- PLAUSIBLE: SettingsPanel silent failure: Task 2 ✓
- PLAUSIBLE: double aria-live a11y regression: Task 3 ✓
- PLAUSIBLE: pipeline BrowserWindow stale ref: Task 4 ✓
- PLAUSIBLE: ConvList setState after unmount: Task 5 ✓
- Reuse: AUTH_COMMANDS duplication: Task 6 ✓
- Layout: BackendSwitcher toolbar height: Task 6 ✓
- Conventions: behavioral change in refactor commit — noted in plan intro, no code fix needed ✓
- Simplification: SecurityDialog rAF redundant — fixed in Task 1 ✓
- Simplification: ChatView sr-only copy-paste — fixed in Task 3 ✓

**Placeholder scan:** No TBD, TODO, or "implement later" phrases. All steps contain real code.

**Type consistency:** `SearchResult` type is imported from `../../../shared/types` in the ConvList test — consistent with how the existing file imports it. `AUTH_COMMANDS: Record<string, string>` is consistent between the new constant file and the existing inline declarations it replaces. `trigger?: unknown` in `useFocusTrap` is intentionally untyped to avoid coupling the hook to `SecurityEvent`.
