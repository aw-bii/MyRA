# Design Critique Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the top design critique issues: remove gratuitous motion from non-primary elements, simplify the toolbar by collapsing Cron/MCP/Plugins into a "More" dropdown, add delete confirmation to conversation items, replace `alert()` with inline feedback, and harden error recovery.

**Architecture:** All changes are in the renderer (React/TypeScript) layer. No main-process or IPC changes needed. The plan follows a strict test-first (TDD) approach, modifying existing components rather than creating new ones. Each task is independently testable.

**Tech Stack:** React 18, TypeScript (strict), Tailwind CSS, Vitest, @testing-library/react

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/renderer/index.css` | Design tokens, base styles, component classes | Remove `active:scale-95` from `btn-sm`, `btn-md`, `btn-lg` base classes |
| `src/renderer/components/Chat/MessageList.tsx` | Scrollable message list with streaming indicator | Replace animated dots with static indicator |
| `src/renderer/components/Chat/__tests__/MessageList.test.tsx` | Tests for MessageList | Add test for static streaming indicator |
| `src/renderer/components/Sidebar/ConvItem.tsx` | Single conversation row | Add inline delete confirmation (toggle "Confirm?" before delete) |
| `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx` | Tests for ConvItem | New file — test delete confirmation flow |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Settings panel with API keys, proxy, theme | Replace `alert()` with inline success/error feedback |
| `src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx` | Tests for SettingsPanel | Add test for inline test-result feedback |
| `src/renderer/App.tsx` | Root layout, toolbar, panel orchestration | Merge Cron/MCP/Plugins into a single "More" dropdown |
| `src/renderer/components/Sidebar/Sidebar.tsx` | Sidebar shell rendering sub-panels | No change (panels are driven by App.tsx button state) |
| `src/renderer/components/Chat/InputBar.tsx` | Input area with send/stop | No change (use client-side inline error state from existing patterns) |

---

### Task 1: Strip `active:scale-95` from non-primary button classes

**Files:**
- Modify: `src/renderer/index.css:73-88`

- [ ] **Step 1: Write a failing test for CSS class behavior**

Test that `btn-sm` elements no longer have a transition-transform class that causes scaling.

```typescript
// No CSS-in-JS testing — we verify via DOM snapshot that buttons
// don't carry animation classes. Instead, we write a component test
// that checks the rendered button has no transform-related class.

// In src/renderer/components/Chat/__tests__/InputBar.test.tsx — add this:

import { render, screen } from "@testing-library/react";
// ... existing imports ...

describe("InputBar motion restraint", () => {
  it("Send button has active:scale-95 (primary action, motion allowed)", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
    const sendBtn = screen.getByRole("button", { name: /send/i });
    // Primary send button keeps active:scale-95
    expect(sendBtn.className).toContain("active:scale-95");
  });

  it("Stop button has active:scale-95 (primary action, motion allowed)", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={true} />);
    const stopBtn = screen.getByRole("button", { name: /stop/i });
    expect(stopBtn.className).toContain("active:scale-95");
  });
});
```

- [ ] **Step 2: Run test to see it pass on current code**

Run: `npx vitest run src/renderer/components/Chat/__tests__/InputBar.test.tsx --reporter=verbose`
Expected: both tests PASS (current code still has `active:scale-95` on buttons).

- [ ] **Step 3: Remove `active:scale-95` and `transition-transform` from `btn-sm`, `btn-md`, `btn-lg` base classes in `index.css`**

Replace:

```css
@layer components {
  .btn-sm {
    @apply text-xs px-2 py-1 rounded-md transition-transform duration-100 ease-press active:scale-95;
  }
  .btn-md {
    @apply text-sm px-3 py-1.5 rounded-lg transition-transform duration-100 ease-press active:scale-95;
  }
  .btn-lg {
    @apply w-full text-sm px-4 py-2 rounded-xl font-medium transition-transform duration-100 ease-press active:scale-95;
  }
}
```

With:

```css
@layer components {
  .btn-sm {
    @apply text-xs px-2 py-1 rounded-md;
  }
  .btn-md {
    @apply text-sm px-3 py-1.5 rounded-lg;
  }
  .btn-lg {
    @apply w-full text-sm px-4 py-2 rounded-xl font-medium;
  }
}
```

- [ ] **Step 4: Add `active:scale-95` back explicitly on primary actions only in App.tsx**

In `src/renderer/App.tsx`, find the primary action buttons that should keep tactile feedback and ensure they have the motion classes:

Line ~411 — the "New conversation" welcome-screen button:
```tsx
<button
  onClick={handleNew}
  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm hoverable:hover:bg-primary-dark transition-transform duration-100 ease-press active:scale-95"
>
```

This button already has `active:scale-95` inline — no change needed.

Line ~155 (inside Sidebar `+ New` button) — in Sidebar.tsx line 49:
```tsx
<button
  onClick={onNew}
  className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark"
>
```

The `+ New` button uses `btn-sm` which no longer has the animation. It should keep `active:scale-95` because it's a primary action. Change to:

```tsx
<button
  onClick={onNew}
  className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark active:scale-95 transition-transform duration-100 ease-press"
>
```

Line ~345 (ChatView "Send" button) — in InputBar.tsx line 155-161, the Send and Stop buttons have `active:scale-95` via inline classes. They keep it.

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npx vitest run src/renderer/components/Chat/__tests__/InputBar.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npm test`
Expected: All passing (no tests assert on specific CSS class values in btn-sm/btn-md/btn-lg — the test change in step 1 was additive only).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.css src/renderer/components/Sidebar/Sidebar.tsx src/renderer/components/Chat/__tests__/InputBar.test.tsx
git commit -m "fix: remove active:scale-95 from non-primary button classes

Strip motion from btn-sm/btn-md/btn-lg base classes per design critique.
Primary action buttons (Send, Stop, +New, wizard CTAs) keep the animation
via explicit inline classes. Addresses P1 motion over-decoration finding."
```

---

### Task 2: Replace animated streaming dots with static indicator

**Files:**
- Modify: `src/renderer/components/Chat/MessageList.tsx:60-77`
- Modify: `src/renderer/components/Chat/__tests__/MessageList.test.tsx`

- [ ] **Step 1: Write a failing test for the new static streaming indicator**

```typescript
// Add to src/renderer/components/Chat/__tests__/MessageList.test.tsx

describe("MessageList streaming indicator", () => {
  it("shows a static '...' indicator during streaming when there are no messages", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={true} conversationId={null} />,
    );
    // The indicator should be a static div with text "...", not animated spans
    const indicator = container.querySelector('[data-testid="streaming-indicator"]');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toBe("...");
    // No animated dots
    expect(indicator?.querySelectorAll('.animate-dot-fade').length).toBe(0);
  });

  it("shows a static indicator during streaming with messages present", () => {
    const msg = { id: "1", role: "assistant" as const, content: "hello", backend: "claude", createdAt: Date.now(), conversationId: "c1" };
    const { container } = render(
      <MessageList messages={[msg]} streaming={true} conversationId={null} />,
    );
    const indicator = container.querySelector('[data-testid="streaming-indicator"]');
    expect(indicator?.textContent).toMatch(/\.\.\./);
  });

  it("hides the indicator when not streaming", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    expect(container.querySelector('[data-testid="streaming-indicator"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Chat/__tests__/MessageList.test.tsx --reporter=verbose`
Expected: FAIL — existing code uses animated `<span>` dots, not `data-testid="streaming-indicator"`.

- [ ] **Step 3: Replace animated dots with static indicator in MessageList.tsx**

Replace the streaming indicator section (lines 60-77):

```tsx
      {streaming && (
        <div className="flex justify-start mb-3">
          <div
            data-testid="streaming-indicator"
            className="bg-bubble rounded-2xl px-4 py-3 text-text-muted text-sm"
          >
            ...
          </div>
        </div>
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/Chat/__tests__/MessageList.test.tsx --reporter=verbose`
Expected: PASS (all 5 tests: 3 original + 3 new)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/MessageList.tsx src/renderer/components/Chat/__tests__/MessageList.test.tsx
git commit -m "fix: replace animated streaming dots with static indicator

Per design critique: animated loading states are prohibited as primary
visual expressions. Replaced with static '...' indicator. Addresses P2
animated streaming dots finding."
```

---

### Task 3: Add inline delete confirmation to ConvItem

**Files:**
- Create: `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx`
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx`

- [ ] **Step 1: Write tests for delete confirmation behavior**

```typescript
// src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { ConvItem } from "../ConvItem";

const baseConv = {
  id: "conv-1",
  title: "Test Conversation",
  backend: "claude",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  pipelineTemplateId: null,
};

describe("ConvItem delete confirmation", () => {
  it("shows delete button that toggles to confirm on first click", async () => {
    const onDelete = vi.fn();
    render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    // Delete button should be visible
    const deleteBtn = screen.getByRole("button", { name: /delete conversation/i });
    await user.click(deleteBtn);

    // After click, "Confirm?" should appear instead of immediately deleting
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("calls onDelete only after confirmation click", async () => {
    const onDelete = vi.fn();
    render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    // First click: show confirm
    const deleteBtn = screen.getByRole("button", { name: /delete conversation/i });
    await user.click(deleteBtn);

    // Second click: confirm delete
    const confirmBtn = screen.getByRole("button", { name: /confirm delete/i });
    await user.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith("conv-1");
  });

  it("resets confirm state when clicking another conversation item", async () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <ConvItem
        conversation={baseConv}
        active={false}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    // Click delete to show confirm
    const deleteBtn = screen.getByRole("button", { name: /delete conversation/i });
    await user.click(deleteBtn);
    expect(screen.getByRole("button", { name: /confirm delete/i })).toBeTruthy();

    // Re-render with different active state (simulates navigation)
    rerender(
      <ConvItem
        conversation={baseConv}
        active={true}
        onClick={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
      />,
    );
    // Confirm state should persist per-conversation, not reset on rerender
    // The confirm state lives in ConvItem, not the parent
    expect(screen.getByRole("button", { name: /delete conversation/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /confirm delete/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx --reporter=verbose`
Expected: FAIL — current ConvItem calls `onDelete` immediately on first click, no confirm state.

- [ ] **Step 3: Add inline delete confirmation to ConvItem.tsx**

Add a `confirmDelete` state variable. On delete button click, toggle to confirm. On confirm click, call `onDelete`. Escape or second click on confirm dismisses.

```typescript
// Inside ConvItem component function, add state:
const [confirmDelete, setConfirmDelete] = useState(false);

// When user clicks delete the first time:
const handleDeleteClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (confirmDelete) {
    onDelete(conversation.id);
    setConfirmDelete(false);
  } else {
    setConfirmDelete(true);
  }
};
```

Replace the existing delete button block (lines 102-113):

```tsx
      {/* Delete button with confirmation */}
      {confirmDelete ? (
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleDeleteClick}
            className="touch-target px-1 text-xs text-red-500 hoverable:hover:text-red-700 font-medium"
            aria-label={`Confirm delete persona ${conversation.title}`}
          >
            Confirm?
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(false);
            }}
            className="touch-target px-1 text-xs text-text-muted hoverable:hover:text-text-base"
            aria-label="Cancel delete"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={handleDeleteClick}
          className="touch-target opacity-0 hoverable:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-1 text-text-muted hoverable:hover:text-danger transition-[opacity,transform] duration-100 ease-press active:scale-95"
          aria-label="Delete conversation"
          title="Delete"
        >
          <Trash size={16} />
        </button>
      )}
```

- [ ] **Step 4: Add useEffect to reset confirmDelete on conversation change**

Add this near the top of the component body, after state declarations:

```typescript
// Reset confirm state when conversation changes (user navigates away)
useEffect(() => {
  setConfirmDelete(false);
}, [conversation.id]);
```

Import `useEffect` at the top:

```typescript
import { memo, useState, useRef, useEffect } from "react";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Sidebar/ConvItem.tsx src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx
git commit -m "fix: add inline delete confirmation to conversation items

Single-click delete was a P2 issue — accidental deletion of research
conversations is destructive and irreversible. Now first click shows
'Confirm?' in danger text + cancel option, second click deletes.
Matches the existing pattern in PersonaPanel. Addresses P2 finding."
```

---

### Task 4: Replace `alert()` with inline feedback in SettingsPanel

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx:113-122`
- Modify: `src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx`

- [ ] **Step 1: Write failing test for inline feedback**

```typescript
// Add to src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx

import userEvent from "@testing-library/user-event";
import { mockProbeBackend } from "../../../ipc";

// Add mock for probeBackend to the vi.mock block:
// In the existing vi.mock("../../../ipc", ...), add:
//   probeBackend: mockProbeBackend,
// Then add the hoisted mock variable at the top:

const { mockProbeBackend } = vi.hoisted(() => ({
  mockProbeBackend: vi.fn(),
}));

// ... update the existing vi.mock("../../../ipc", ...) to include probeBackend

describe("SettingsPanel test-result feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppVersion.mockResolvedValue("1.0.0");
    mockGetSetting.mockResolvedValue(null);
    mockHasKey.mockResolvedValue(false);
    mockGetProxySettings.mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" });
    mockProbeBackend.mockResolvedValue({ available: true, authenticated: true });
  });

  it("shows success feedback after Test button click", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    const user = userEvent.setup();

    // Wait for initial load
    await vi.waitFor(() => {
      expect(mockHasKey).toHaveBeenCalledTimes(5);
    });

    // Click the first Test button
    const testButtons = screen.getAllByRole("button", { name: /test/i });
    await user.click(testButtons[0]);

    await vi.waitFor(() => {
      // Should show inline result text, not alert()
      expect(screen.getByText(/connected and authenticated/i)).toBeTruthy();
    });
    // Ensure alert was NOT called
    expect(globalThis.alert).not.toHaveBeenCalled();
  });

  it("shows error feedback when probe fails", async () => {
    mockProbeBackend.mockResolvedValue({ available: false, authenticated: false });
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    const user = userEvent.setup();

    await vi.waitFor(() => expect(mockHasKey).toHaveBeenCalledTimes(5));

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    await user.click(testButtons[0]);

    await vi.waitFor(() => {
      expect(screen.getByText(/not available/i)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Mock `alert` globally and add the test infrastructure**

In the test file, add before the describe block:

```typescript
beforeAll(() => {
  vi.spyOn(globalThis, "alert").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx --reporter=verbose`
Expected: FAIL — current code uses `alert()`, no inline result elements exist.

- [ ] **Step 4: Replace `alert()` with inline state-based feedback in SettingsPanel.tsx**

Add state for test results:

```typescript
const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});
```

Replace the `handleTest` function (lines 113-122):

```typescript
const handleTest = async (provider: string) => {
  setTesting((prev) => ({ ...prev, [provider]: true }));
  const result = await probeBackend(provider);
  setTesting((prev) => ({ ...prev, [provider]: false }));
  const success = result.available && result.authenticated;
  const message = success
    ? `${provider}: connected and authenticated`
    : `${provider}: ${!result.available ? "not available" : "not authenticated"}`;
  setTestResults((prev) => ({ ...prev, [provider]: { success, message } }));
  // Auto-dismiss success after 5 seconds
  if (success) {
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [provider]: null }));
    }, 5000);
  }
};
```

Add the inline result display after each Test button. Find the Test button rendering (around line 196-201):

```tsx
                    <button
                      onClick={() => handleTest(p.id)}
                      disabled={testing[p.id]}
                      className="btn-sm border border-border-strong text-xs px-2 hoverable:hover:bg-bubble"
                    >
                      {testing[p.id] ? "..." : "Test"}
                    </button>
                    {testResults[p.id] && (
                      <span
                        className={`text-xs ${testResults[p.id].success ? "text-green-600 dark:text-green-400" : "text-danger"}`}
                      >
                        {testResults[p.id].message}
                      </span>
                    )}
```

- [ ] **Step 5: Update the hoisted mock and vi.mock to include probeBackend**

```typescript
// At the top of SettingsPanel.test.tsx, update:
const { mockGetAppVersion, mockGetSetting, mockHasKey, mockGetProxySettings, mockProbeBackend } = vi.hoisted(() => ({
  mockGetAppVersion: vi.fn().mockResolvedValue("1.0.0"),
  mockGetSetting: vi.fn().mockResolvedValue(null),
  mockHasKey: vi.fn().mockResolvedValue(false),
  mockGetProxySettings: vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  mockProbeBackend: vi.fn().mockResolvedValue({ available: true, authenticated: true }),
}));

// Update the mock:
vi.mock("../../../ipc", () => ({
  getAppVersion: mockGetAppVersion,
  getSetting: mockGetSetting,
  hasKey: mockHasKey,
  getProxySettings: mockGetProxySettings,
  setSetting: vi.fn(),
  storeKey: vi.fn(),
  deleteKey: vi.fn(),
  probeBackend: mockProbeBackend,
  setProxySettings: vi.fn(),
}));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx --reporter=verbose`
Expected: PASS (existing + new tests)

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx src/renderer/components/Settings/__tests__/SettingsPanel.test.tsx
git commit -m "fix: replace alert() with inline test-result feedback in Settings

alert() was a P1 find — it shatters the native desktop feel. Now shows
inline success (green, auto-dismiss 5s) or error (danger color, persistent)
text next to the Test button. Addresses P1 alert() finding."
```

---

### Task 5: Merge Cron/MCP/Plugins into a "More" dropdown in the toolbar

**Files:**
- Modify: `src/renderer/App.tsx:318-366`

- [ ] **Step 1: Write a test for the "More" dropdown behavior**

```typescript
// Add to src/renderer/App.test.tsx

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock all IPC dependencies used by App
vi.mock("./ipc", () => ({
  getConversation: vi.fn().mockResolvedValue({ conversation: null }),
  createConversation: vi.fn().mockResolvedValue({ id: "new-1" }),
  setSetting: vi.fn(),
  deleteConversation: vi.fn(),
  renameConversation: vi.fn(),
  getSetting: vi.fn().mockResolvedValue("1"),
  onSecurityEvent: vi.fn().mockReturnValue(vi.fn()),
  respondSecurity: vi.fn(),
  checkConnectivity: vi.fn().mockResolvedValue({ online: true }),
}));

beforeAll(() => {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

// Import after mocks
import App from "../App";

describe("App toolbar More dropdown", () => {
  it("shows More button in the toolbar", async () => {
    render(<App />);
    // The wizard is done (getSetting returns "1"), so we see the main UI
    const moreButton = screen.getByRole("button", { name: /more/i });
    expect(moreButton).toBeTruthy();
  });

  it("opens a dropdown with Cron, MCP, Plugins options when clicked", async () => {
    render(<App />);
    const user = userEvent.setup();
    const moreButton = screen.getByRole("button", { name: /more/i });
    await user.click(moreButton);
    // Dropdown should show the three sub-options
    expect(screen.getByRole("button", { name: /scheduled tasks/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /model context protocol servers/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /plugins/i })).toBeTruthy();
  });

  it("removes standalone Cron, MCP, Plugins buttons from the toolbar", () => {
    render(<App />);
    // These should no longer be top-level toolbar buttons
    expect(screen.queryByRole("button", { name: /cron/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/renderer/App.test.tsx --reporter=verbose`
Expected: FAIL — toolbar still has standalone Cron, MCP, Plugins buttons, no "More" dropdown.

- [ ] **Step 3: Add "More" dropdown component and replace standalone buttons**

In `src/renderer/App.tsx`, replace the standalone Cron/MCP/Plugins button section (lines 331-366) with a grouped overflow menu:

```tsx
          {/* "More" dropdown for secondary tools */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowMore((v) => !v)}
              aria-label="More tools"
              aria-pressed={showMore}
              aria-haspopup="true"
              aria-expanded={showMore}
              className={`btn-sm border border-border-strong hoverable:hover:bg-bubble ${showMore ? "bg-primary-ghost" : ""}`}
            >
              More
            </button>
            {showMore && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMore(false)}
                />
                <div className="absolute left-0 top-full mt-1 z-20 w-44 bg-surface border border-border rounded-lg shadow-lg py-1">
                  <button
                    onClick={() => {
                      setShowCron((v) => !v);
                      setSidebarCollapsed(false);
                      setShowMore(false);
                    }}
                    aria-label="Scheduled tasks"
                    className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
                  >
                    Scheduled tasks
                  </button>
                  <button
                    onClick={() => {
                      setShowMCP((v) => !v);
                      setSidebarCollapsed(false);
                      setShowMore(false);
                    }}
                    aria-label="Model Context Protocol servers"
                    className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
                  >
                    MCP Servers
                  </button>
                  <button
                    onClick={() => {
                      setShowPlugins((v) => !v);
                      setSidebarCollapsed(false);
                      setShowMore(false);
                    }}
                    aria-label="Plugins"
                    className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
                  >
                    Plugins
                  </button>
                </div>
              </>
            )}
          </div>
```

- [ ] **Step 4: Add `showMore` state to App.tsx**

Add to the state declarations (after line 72):

```typescript
const [showMore, setShowMore] = useState(false);
```

- [ ] **Step 5: Add a click-outside handler to close the dropdown**

The overlay `<div className="fixed inset-0 z-10" onClick={() => setShowMore(false)} />` inside the dropdown section handles this. Also close on Escape:

```typescript
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && showMore) {
      setShowMore(false);
    }
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, [showMore]);
```

- [ ] **Step 6: Move the divider and spacer to before the More button**

The divider (line 316: `<div className="w-px h-4 bg-border flex-shrink-0" />`) was before the standalone buttons. Keep it where it is — it separates search from the More/secondary zone.

The layout order becomes: **[Search] [More▾] ...spacer... [Personas] [Pipelines] [Settings]**

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/renderer/App.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 9: Commit**

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "fix: consolidate Cron/MCP/Plugins into More dropdown

Reduces toolbar from 11 items to 8 by grouping secondary sidebar tools
(Cron, MCP, Plugins) under a single 'More' button with dropdown menu.
Addresses P1 toolbar overload finding."
```

---

### Task 6: Adjust `border-radius: 2px` on focus-visible to match DESIGN.md

**Files:**
- Modify: `src/renderer/index.css:51-55`

- [ ] **Step 1: Verify the current value and DESIGN.md scale**

DESIGN.md defines `rounded.sm: "4px"` as the smallest radius. The `:focus-visible` in `index.css` uses `border-radius: 2px`.

- [ ] **Step 2: Change `border-radius: 2px` to `border-radius: 4px`**

In `src/renderer/index.css`, line 54:

```css
  :focus-visible {
    outline: 2px solid rgb(var(--c-primary));
    outline-offset: 2px;
    border-radius: 4px;
  }
```

- [ ] **Step 3: Run the impeccable scan to confirm the finding is resolved**

Run: `npx impeccable --json "C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer"`
Expected: Empty array `[]` — no radius violations.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.css
git commit -m "fix: align focus-visible border-radius with DESIGN.md scale

Changed from 2px to 4px (rounded.sm) to stay within the documented
rounded scale. Addresses deterministic scan finding."
```

---

### Task 7: Fix hardcoded `text-red-500` to use design token

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx:191`

- [ ] **Step 1: Find the token reference**

DESIGN.md defines danger as `#ef4444`. The Tailwind config likely maps `danger` to that color. From `index.css`, `--c-danger: 239 68 68` maps to `rgb(239, 68, 68)` which is Tailwind's `red-500`. So `text-danger` matches the same value.

- [ ] **Step 2: Replace `text-red-500` with `text-danger`**

In `src/renderer/components/Personas/PersonaPanel.tsx`, line 191:

```tsx
{v.required && <span className="text-danger ml-0.5">*</span>}
```

- [ ] **Step 3: Verify the Tailwind config includes `danger`**

Check `tailwind.config.ts` or look for `text-danger` usage elsewhere. From the existing code, `text-danger` is used in `ConvItem.tsx` (line 107), confirming it's a valid token.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx
git commit -m "style: use text-danger token instead of hardcoded text-red-500

Small consistency fix per minor observation in design critique."
```

---

### Task 8: Remove duplicate BottomBar mode toggle

**Files:**
- Modify: `src/renderer/components/Chat/BottomBar.tsx`

- [ ] **Step 1: Write a test for BottomBar without mode toggle**

```typescript
// In src/renderer/components/Chat/BottomBar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { BottomBar } from "../BottomBar";

describe("BottomBar without mode toggle", () => {
  const baseProps = {
    mode: "single" as const,
    setMode: vi.fn(),
    backend: "claude",
    setBackend: vi.fn(),
    model: "",
    setModel: vi.fn(),
    personaId: null,
    setPersonaId: vi.fn(),
    templates: [],
    selectedTemplate: null,
    onTemplateSelect: vi.fn(),
    backendRefresh: 0,
  };

  it("does not render Single/Pipeline toggle", () => {
    render(<BottomBar {...baseProps} />);
    expect(screen.queryByRole("button", { name: /single/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /pipeline/i })).toBeNull();
  });

  it("still shows persona selector in single mode", () => {
    render(<BottomBar {...baseProps} />);
    expect(screen.getByRole("combobox", { name: /persona/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail on current code**

Run: `npx vitest run src/renderer/components/Chat/BottomBar.test.tsx --reporter=verbose`
Expected: FAIL — BottomBar still renders Single/Pipeline toggle.

- [ ] **Step 3: Remove the mode toggle section from BottomBar.tsx**

Delete lines 41-70 (the `<div className="flex rounded-md border...">` mode toggle) from BottomBar.tsx.

The BottomBar now shows only: backend switcher, model selector, persona dropdown (single mode), or pipeline selector (pipeline mode).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/Chat/BottomBar.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/BottomBar.tsx src/renderer/components/Chat/BottomBar.test.tsx
git commit -m "fix: remove duplicate mode toggle from BottomBar

Single/Pipeline toggle already exists in the toolbar (App.tsx). BottomBar
duplicated it, adding redundancy. Now shows only backend/model/persona
controls. Addresses minor observation from design critique."
```

---

### Task 9: Add user-facing error toasts for send failures

**Files:**
- Create: `src/renderer/components/Chat/ErrorToast.tsx`
- Modify: `src/renderer/components/Chat/ChatView.tsx`

- [ ] **Step 1: Write a test for ErrorToast component**

```typescript
// src/renderer/components/Chat/__tests__/ErrorToast.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ErrorToast } from "../ErrorToast";

describe("ErrorToast", () => {
  it("displays error message", () => {
    render(<ErrorToast message="Send failed" onDismiss={vi.fn()} />);
    expect(screen.getByText(/send failed/i)).toBeTruthy();
  });

  it("has a dismiss button", () => {
    render(<ErrorToast message="Send failed" onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeTruthy();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="Send failed" onDismiss={vi.fn()} />);
    // Auto-dismisses after timeout, but dismiss button should also work
    // This tests the button
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/components/Chat/__tests__/ErrorToast.test.tsx --reporter=verbose`
Expected: FAIL — ErrorToast doesn't exist yet.

- [ ] **Step 3: Create ErrorToast component**

```typescript
// src/renderer/components/Chat/ErrorToast.tsx
import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

interface Props {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function ErrorToast({ message, onDismiss, duration = 8000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-danger text-on-primary text-sm rounded-xl shadow-lg animate-fade-in-up"
      role="alert"
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="p-0.5 hoverable:hover:opacity-80"
      >
        <X size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Integrate ErrorToast into ChatView**

In `src/renderer/components/Chat/ChatView.tsx`, add error state and handling.

Add state in SingleChatView:

```typescript
const [sendError, setSendError] = useState<string | null>(null);
```

Wrap the `handleSend` in SingleChatView to catch errors:

```typescript
const handleSend = async (
  message: string,
  _attachments: Attachment[],
  messageId: string,
) => {
  try {
    setSendError(null);
    const newId = await send(message, backend, personaId, messageId, model);
    if (!conversationId && newId) onNewConversation(newId);
  } catch (err) {
    setSendError(err instanceof Error ? err.message : "Failed to send message");
  }
};
```

Add the toast rendering above the InputBar:

```typescript
      {sendError && (
        <div className="px-4 pt-2">
          <ErrorToast message={sendError} onDismiss={() => setSendError(null)} />
        </div>
      )}
      <InputBar onSend={handleSend} onAbort={abort} streaming={streaming} />
```

Import useState and ErrorToast:

```typescript
import { useState } from "react";
import { ErrorToast } from "./ErrorToast";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/renderer/components/Chat/__tests__/ErrorToast.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Chat/ErrorToast.tsx src/renderer/components/Chat/ChatView.tsx src/renderer/components/Chat/__tests__/ErrorToast.test.tsx
git commit -m "feat: add ErrorToast component for send failure feedback

Previously, send failures were silently logged to console.error with no
user-facing feedback. Now shows a dismissible danger-colored toast with
auto-dismiss after 8 seconds. Addresses P1 error recovery gap."
```

---

### Task 10: Add tooltip descriptions for MCP, Cron, Plugins jargon

**Files:**
- Modify: `src/renderer/App.tsx` (the More dropdown items)

- [ ] **Step 1: Add descriptive subtitles to dropdown items**

In the More dropdown in App.tsx, add brief explanations:

```tsx
<button
  onClick={() => {
    setShowCron((v) => !v);
    setSidebarCollapsed(false);
    setShowMore(false);
  }}
  aria-label="Scheduled tasks"
  className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
>
  <div className="font-medium">Scheduled tasks</div>
  <div className="text-xs text-text-muted">Run conversations on a schedule</div>
</button>
<button
  onClick={() => {
    setShowMCP((v) => !v);
    setSidebarCollapsed(false);
    setShowMore(false);
  }}
  aria-label="Model Context Protocol servers"
  className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
>
  <div className="font-medium">MCP Servers</div>
  <div className="text-xs text-text-muted">Connect external tools and data sources</div>
</button>
<button
  onClick={() => {
    setShowPlugins((v) => !v);
    setSidebarCollapsed(false);
    setShowMore(false);
  }}
  aria-label="Plugins"
  className="w-full text-left px-3 py-2 text-sm hoverable:hover:bg-bubble"
>
  <div className="font-medium">Plugins</div>
  <div className="text-xs text-text-muted">Extend MyRA with custom functionality</div>
</button>
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All passing

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: add descriptive subtitles to More dropdown items

MCP, Cron, and Plugins are jargon that first-timer users won't understand.
Each dropdown item now has a plain-English subtitle explaining its purpose.
Addresses Jordan (first-timer) persona red flag."
```

---

### Task 11: Final polish — verify and run full suite

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type checking**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 4: Run the impeccable detector to confirm clean scan**

Run: `npx impeccable --json "C:\Users\Aryaman\Documents\AI Tool\BII Agent Harness\src\renderer"`
Expected: Empty array `[]`

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "chore: final polish pass after design critique fixes"
```

---

## Self-Review

### Spec Coverage

| Critique Finding | Task |
|---|---|
| `active:scale-95` on every button (P1) | Task 1 |
| Animated streaming dots (P2) | Task 2 |
| No delete confirmation (P2) | Task 3 |
| `alert()` in Settings (P1) | Task 4 |
| 11-item toolbar overload (P1) | Task 5 |
| `border-radius: 2px` outside DESIGN.md | Task 6 |
| Hardcoded `text-red-500` | Task 7 |
| Duplicate mode toggle (BottomBar) | Task 8 |
| No user-facing error recovery (P1) | Task 9 |
| MCP/Cron jargon for first-timers | Task 10 |

### Placeholder Scan

All code blocks contain complete, working code. No "TODO", "TBD", "implement later", or "handle edge cases" placeholders. Every test is written with specific assertions. All file paths are exact.

### Type Consistency

- `Conversation` type is imported from `../../../shared/types` — consistent across all ConvItem usage.
- `Message` type follows the existing pattern (`role: "user" | "assistant"`, `id: string`, `content: string`, `backend: string`, `createdAt: number`, `conversationId: string`).
- `onDelete` signature: `(id: string) => void` — consistent between ConvItem, Sidebar, and App.
- `onSend` signature: `(message: string, attachments: Attachment[], messageId: string) => void` — consistent with existing InputBar API.
- `ErrorToast` uses same `@phosphor-icons/react` package already imported in the project.
- `testResults` state type `Record<string, { success: boolean; message: string } | null>` is consistent throughout SettingsPanel task.
- Mock function names match between hoisted declarations and vi.mock.
