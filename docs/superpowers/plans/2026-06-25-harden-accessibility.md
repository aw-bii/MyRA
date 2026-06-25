# Harden — Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/P1 accessibility violations — ARIA labels on toolbar buttons, semantic structure in MessageBubble, keyboard-accessible rename in ConvItem, accessible Send/Stop buttons in InputBar, focus visible styles, skip link, live regions for streaming, SecurityDialog focus trap, pipeline tabs tablist pattern, and PersonaPanel div→button.

**Architecture:** Surgical component edits. One new hook (`useFocusTrap`) for SecurityDialog. No new files beyond the hook. All changes preserve existing visual design.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

## Global Constraints

- `npm test` must pass after every task
- `npm run build` must succeed after every task
- Do not change visual appearance — only semantic/ARIA changes
- Do not rename or restructure files unless specified

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/App.tsx:261-400` | Add `aria-label` to toolbar buttons (Cron, MCP, Plugins, Personas, Pipelines); add skip link; add live-region div |
| `src/renderer/components/Chat/MessageBubble.tsx` | `aria-label` on article, `<time>` element for timestamp |
| `src/renderer/components/Sidebar/ConvItem.tsx` | F2/Enter key to start rename, `aria-label` on conversation button |
| `src/renderer/components/Chat/InputBar.tsx:146-174` | Replace overlay Send/Stop pattern with conditional render + `inert` |
| `src/renderer/index.css` | Global `focus-visible` ring |
| `src/renderer/App.tsx` | Skip-to-main link; live region wired to streaming state |
| `src/renderer/components/Sidebar/ConvList.tsx:47` | `aria-label` on search input |
| `src/renderer/components/SecurityDialog/SecurityDialog.tsx` | Focus trap via `useFocusTrap`; return focus to trigger |
| `src/renderer/hooks/useFocusTrap.ts` | New hook — traps keyboard focus inside a ref |
| `src/renderer/components/Chat/ChatView.tsx:114-130` | `role="tablist"` + `role="tab"` + `aria-selected` on pipeline step tabs |
| `src/renderer/components/Personas/PersonaPanel.tsx:239-314` | `div role="button"` → `<button>` for "No persona" and user persona list items |

---

## Task 1: Toolbar ARIA Labels (P0)

**Files:**
- Modify: `src/renderer/App.tsx` (toolbar section, lines ~335-400)

**Interfaces:**
- Consumes: nothing new
- Produces: every toolbar button has an accessible name via `aria-label`

- [ ] **Step 1: Write the failing test**

There is no existing test for App.tsx toolbar. Add a minimal smoke test verifying ARIA labels in `src/renderer/App.test.tsx` (create if not present):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// App has many IPC dependencies — mock them
vi.mock("./ipc", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  onSecurityEvent: vi.fn(() => () => {}),
  checkConnectivity: vi.fn().mockResolvedValue(true),
}));
vi.mock("./hooks/usePipelines", () => ({ usePipelines: () => ({ templates: [] }) }));

import App from "./App";

describe("Toolbar ARIA labels", () => {
  it("all toolbar buttons have accessible names", () => {
    render(<App />);
    // These aria-labels must exist after the fix
    expect(screen.getByRole("button", { name: /scheduled tasks/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /model context protocol/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /plugins/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /personas/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /pipelines/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose App.test
```
Expected: FAIL

- [ ] **Step 3: Add aria-label to toolbar buttons in App.tsx**

Find the Cron, MCP, Plugins, Personas, Pipelines buttons in the toolbar. Add `aria-label` to each:

```tsx
// Cron button — BEFORE:
<button
  onClick={() => { setShowCron((v) => !v); setSidebarCollapsed(false); }}
  title="Scheduled tasks"
  className={...}
>
  Cron
</button>

// Cron button — AFTER:
<button
  onClick={() => { setShowCron((v) => !v); setSidebarCollapsed(false); }}
  aria-label="Scheduled tasks"
  aria-pressed={showCron}
  className={...}
>
  Cron
</button>
```

```tsx
// MCP button — AFTER:
<button
  onClick={() => { setShowMCP((v) => !v); setSidebarCollapsed(false); }}
  aria-label="Model Context Protocol servers"
  aria-pressed={showMCP}
  className={...}
>
  MCP
</button>
```

```tsx
// Plugins button — AFTER:
<button
  onClick={() => { setShowPlugins((v) => !v); setSidebarCollapsed(false); }}
  aria-label="Plugins"
  aria-pressed={showPlugins}
  className={...}
>
  Plugins
</button>
```

```tsx
// Personas button — AFTER:
<button
  onClick={() => togglePanel("personas")}
  aria-label="Personas panel"
  aria-pressed={showPersonas}
  className={...}
>
  Personas
</button>
```

```tsx
// Pipelines button — AFTER:
<button
  onClick={() => togglePanel("pipelines")}
  aria-label="Pipelines panel"
  aria-pressed={showPipelines}
  className={...}
>
  Pipelines
</button>
```

Also add `aria-pressed` to the existing Search button (already has `aria-label="Search conversations"`):
```tsx
<button
  onClick={() => setSearchMode((v) => !v)}
  aria-label="Search conversations"
  aria-pressed={searchMode}
  ...
>
```

Also add `aria-pressed` to the existing mode toggle buttons (Single/Pipeline — already have `aria-pressed`; confirm they're correct ✓).

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose App.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "fix(a11y): add aria-label and aria-pressed to all toolbar buttons"
```

---

## Task 2: MessageBubble Semantic Structure (P0)

**Files:**
- Modify: `src/renderer/components/Chat/MessageBubble.tsx`
- Test: `src/renderer/components/Chat/__tests__/MessageBubble.test.tsx`

**Interfaces:**
- Consumes: `message.role`, `message.createdAt`, `message.backend`
- Produces: `role="article"` with `aria-label`, timestamp as `<time datetime="...">`, consistent with existing test

- [ ] **Step 1: Write the failing test**

Open `src/renderer/components/Chat/__tests__/MessageBubble.test.tsx` and add:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../ipc", () => ({ listAttachments: vi.fn().mockResolvedValue([]) }));

import { MessageBubble } from "../MessageBubble";

const userMsg = {
  id: "m1",
  role: "user" as const,
  content: "Hello",
  conversationId: "c1",
  backend: "claude",
  createdAt: "2026-06-25T10:00:00.000Z",
};

const assistantMsg = { ...userMsg, id: "m2", role: "assistant" as const };

describe("MessageBubble accessibility", () => {
  it("user bubble has aria-label identifying sender", () => {
    render(<MessageBubble message={userMsg} />);
    expect(screen.getByRole("article", { name: /your message/i })).toBeTruthy();
  });

  it("assistant bubble has aria-label identifying sender", () => {
    render(<MessageBubble message={assistantMsg} />);
    expect(screen.getByRole("article", { name: /assistant message/i })).toBeTruthy();
  });

  it("timestamp uses <time> element with datetime attribute", () => {
    const { container } = render(<MessageBubble message={userMsg} />);
    const timeEl = container.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute("dateTime")).toBe("2026-06-25T10:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose MessageBubble
```
Expected: FAIL on all 3 assertions.

- [ ] **Step 3: Update MessageBubble.tsx**

```tsx
return (
  <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
    <div
      role="article"
      aria-label={isUser ? "Your message" : "Assistant message"}
      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
        isUser
          ? "bg-blue-600 text-white"
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      }`}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap">{message.content}</p>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown urlTransform={safeUrl}>{message.content}</ReactMarkdown>
        </div>
      )}
      {attachments.length > 0 && <AttachmentRow attachments={attachments} />}
      <div
        className={`text-xs mt-1 ${
          isUser ? "text-blue-100" : "text-gray-400 dark:text-gray-500"
        }`}
      >
        {message.backend} ·{" "}
        <time dateTime={new Date(message.createdAt).toISOString()}>
          {new Date(message.createdAt).toLocaleTimeString()}
        </time>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose MessageBubble
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Chat/MessageBubble.tsx src/renderer/components/Chat/__tests__/MessageBubble.test.tsx
git commit -m "fix(a11y): add aria-label to MessageBubble article and use <time> for timestamp"
```

---

## Task 3: ConvItem Keyboard Rename (P0)

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx`
- Test: `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx`

**Interfaces:**
- Consumes: existing `setEditing`, `setEditValue`
- Produces: pressing F2 (or Enter when the button already has focus) opens rename mode

- [ ] **Step 1: Write the failing test**

In `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx`, add:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConvItem } from "../ConvItem";

const conv = {
  id: "c1", title: "My Conv", backend: "claude",
  pipelineTemplateId: null, updatedAt: new Date().toISOString(),
};

describe("ConvItem keyboard rename", () => {
  it("pressing F2 on the button enters rename mode", () => {
    render(
      <ConvItem
        conversation={conv} active={false}
        onClick={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /My Conv/i });
    btn.focus();
    fireEvent.keyDown(btn, { key: "F2" });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose ConvItem
```
Expected: FAIL

- [ ] **Step 3: Add F2 keyDown handler to ConvItem.tsx**

In the conversation `<button>` element, add an `onKeyDown` handler:

```tsx
<button
  onClick={onClick}
  onDoubleClick={() => {
    setEditValue(conversation.title);
    setEditing(true);
  }}
  onKeyDown={(e) => {
    if (e.key === "F2") {
      e.preventDefault();
      setEditValue(conversation.title);
      setEditing(true);
    }
  }}
  aria-current={active ? "page" : undefined}
  aria-label={conversation.title}
  className={...}
>
```

Also add `aria-label={conversation.title}` to make the button name queryable by screen readers and tests.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose ConvItem
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar/ConvItem.tsx src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx
git commit -m "fix(a11y): press F2 on ConvItem to enter rename mode (keyboard-accessible rename)"
```

---

## Task 4: InputBar Send/Stop Accessible Pattern (P0)

**Files:**
- Modify: `src/renderer/components/Chat/InputBar.tsx:146-174`

**Interfaces:**
- Consumes: `streaming: boolean` prop
- Produces: only one of Send/Stop is in the DOM at a time; animation preserved via CSS `animate-scale-in`

The overlay pattern keeps both buttons in the DOM, which confuses screen readers even with `aria-hidden`. The fix: conditionally render exactly one button and apply the `animate-scale-in` keyframe (already defined in tailwind.config.ts) on mount.

- [ ] **Step 1: Write the failing test**

In `src/renderer/components/Chat/__tests__/InputBar.test.tsx` (create if not present):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../ipc", () => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}));
vi.mock("../../hooks/useAttachments", () => ({
  useAttachments: () => ({
    pending: [], errors: [], ingesting: false,
    addFiles: vi.fn(), removeFile: vi.fn(), clear: vi.fn(),
  }),
}));

import { InputBar } from "../InputBar";

describe("InputBar Send/Stop", () => {
  it("shows Send button when not streaming", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={false} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /stop/i })).toBeNull();
  });

  it("shows Stop button when streaming", () => {
    render(<InputBar onSend={vi.fn()} onAbort={vi.fn()} streaming={true} />);
    expect(screen.getByRole("button", { name: /stop/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose InputBar
```
Expected: FAIL — both buttons exist in DOM.

- [ ] **Step 3: Replace overlay pattern with conditional render**

Replace the `<div className="relative">` block in `src/renderer/components/Chat/InputBar.tsx`:

```tsx
{/* BEFORE — overlay pattern */}
<div className="relative">
  <button
    onClick={submit}
    disabled={!value.trim() || isDisabled || streaming}
    tabIndex={streaming ? -1 : 0}
    aria-hidden={streaming}
    className={`px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 disabled:opacity-50 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
      streaming ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
    }`}
  >
    {ingesting ? "…" : "Send"}
  </button>
  <button
    onClick={onAbort}
    tabIndex={streaming ? 0 : -1}
    aria-hidden={!streaming}
    className={`absolute inset-0 rounded-xl bg-red-500 text-white text-sm hoverable:hover:bg-red-600 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
      streaming ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90 pointer-events-none"
    }`}
  >
    Stop
  </button>
</div>
```

```tsx
{/* AFTER — conditional render with scale-in animation */}
{streaming ? (
  <button
    onClick={onAbort}
    className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hoverable:hover:bg-red-600 active:scale-95 motion-safe:animate-scale-in"
  >
    Stop
  </button>
) : (
  <button
    onClick={submit}
    disabled={!value.trim() || isDisabled}
    className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 disabled:opacity-50 active:scale-95 motion-safe:animate-scale-in"
  >
    {ingesting ? "…" : "Send"}
  </button>
)}
```

The `animate-scale-in` keyframe is already defined in `tailwind.config.ts` (`scale-in: 220ms cubic-bezier(0.23, 1, 0.32, 1)`). `motion-safe:animate-scale-in` respects the reduced-motion media query.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose InputBar
```
Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/InputBar.tsx src/renderer/components/Chat/__tests__/InputBar.test.tsx
git commit -m "fix(a11y): conditionally render Send/Stop — only one button in DOM at a time (WCAG 4.1.2)"
```

---

## Task 5: Focus Visible Ring + Skip Link (P1)

**Files:**
- Modify: `src/renderer/index.css`
- Modify: `src/renderer/App.tsx` (add skip link before the sidebar)

**Interfaces:**
- Consumes: nothing new
- Produces: all interactive elements show a visible focus ring; keyboard users can skip to main content

- [ ] **Step 1: Add global focus-visible rule to index.css**

In `src/renderer/index.css`, inside the `@layer base` block, add after the tap-highlight rule:

```css
@layer base {
  html { /* existing */ }

  button:not(:disabled), a:not(:disabled), [role="button"]:not(:disabled) {
    -webkit-tap-highlight-color: transparent; /* existing */
  }

  /* Visible focus ring for keyboard navigation */
  :focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
    border-radius: 2px;
  }
}
```

This ensures every focusable element shows a ring on keyboard focus without affecting mouse/touch interactions (`:focus-visible` only applies when navigating by keyboard).

- [ ] **Step 2: Add skip link to App.tsx**

At the very top of the `return` in `App` (before the first element), add:

```tsx
return (
  <>
    {/* Skip to main content link — only visible on keyboard focus */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:text-sm focus:shadow-lg"
    >
      Skip to main content
    </a>
    {/* ... rest of existing return ... */}
  </>
);
```

Also add `id="main-content"` to the `<main>` element in App.tsx:

```tsx
// BEFORE:
<main className="flex flex-1 min-h-0">

// AFTER:
<main id="main-content" className="flex flex-1 min-h-0">
```

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.css src/renderer/App.tsx
git commit -m "fix(a11y): add global focus-visible ring and skip-to-main-content link"
```

---

## Task 6: ConvList Search Label + Live Region for Streaming (P1)

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvList.tsx:47`
- Modify: `src/renderer/App.tsx` (add aria-live region)

**Interfaces:**
- Consumes: `streaming` prop from `useMessages` (available in ChatView; needs to be surfaced or the live region placed in ChatView)
- Produces: search input has accessible name; assistant streaming text announces to screen readers via a live region in `ChatView`

- [ ] **Step 1: Add aria-label to ConvList search input**

In `src/renderer/components/Sidebar/ConvList.tsx`:

```tsx
// BEFORE:
<input
  className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
  placeholder="Search conversations..."
  ...
/>

// AFTER:
<input
  className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
  aria-label="Search conversations"
  placeholder="Search conversations..."
  ...
/>
```

- [ ] **Step 2: Add live region to ChatView**

In `src/renderer/components/Chat/ChatView.tsx`, after the `<InputBar>` element, add a visually-hidden live region that holds the latest assistant text chunk. The `streaming` state and `messages` array are already in scope:

```tsx
{/* Live region — screen readers announce new assistant content during streaming */}
<div
  role="status"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {streaming ? (messages[messages.length - 1]?.content ?? "") : ""}
</div>
```

Place this just before the closing `</div>` of the ChatView return.

For the pipeline variant of ChatView (the `PipelineChatView` component if separate, or the conditional branch), add the same live region using `activeMessages`:

```tsx
<div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
  {streaming && streamingStepIndex === activeTabIndex
    ? (activeMessages[activeMessages.length - 1]?.content ?? "")
    : ""}
</div>
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar/ConvList.tsx src/renderer/components/Chat/ChatView.tsx
git commit -m "fix(a11y): label search input; add aria-live region for streaming assistant responses"
```

---

## Task 7: SecurityDialog Focus Trap (P1)

**Files:**
- Create: `src/renderer/hooks/useFocusTrap.ts`
- Modify: `src/renderer/components/SecurityDialog/SecurityDialog.tsx`
- Test: `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx`

**Interfaces:**
- Produces: `useFocusTrap(ref, enabled)` — traps Tab/Shift+Tab within `ref` element when `enabled`
- Consumes: dialog ref and `!resolved` as the enabled flag

- [ ] **Step 1: Write failing test**

In `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx`, add:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SecurityDialog } from "./SecurityDialog";

const event = {
  type: "injection_detected" as const,
  severity: "low" as const,
  message: "Test alert",
  detail: "pattern matched",
  source: "claude",
};

describe("SecurityDialog focus trap", () => {
  it("Dismiss button receives focus when dialog opens", () => {
    render(<SecurityDialog event={event} onRespond={vi.fn()} />);
    // First focusable element inside dialog should be focused
    const dismiss = screen.getByRole("button", { name: /dismiss/i });
    expect(document.activeElement).toBe(dismiss);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose SecurityDialog
```
Expected: FAIL (no auto-focus on open)

- [ ] **Step 3: Create useFocusTrap hook**

Create `src/renderer/hooks/useFocusTrap.ts`:

```ts
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
) {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    // Auto-focus first element
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
  }, [enabled, containerRef]);
}
```

- [ ] **Step 4: Update SecurityDialog.tsx**

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import type { SecurityEvent } from "../../../shared/types";

export function SecurityDialog({ event, onRespond }: SecurityDialogProps) {
  const [resolved, setResolved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap inside the dialog while it's open
  useFocusTrap(dialogRef, !resolved);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setResolved(true);
        if (event.type !== "write_approval_needed") {
          onRespond(false);
        }
      }
    },
    [event, onRespond],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  useEffect(() => { setResolved(false); }, [event]);

  if (resolved) return null;

  // ... severityColors unchanged ...

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`${event.severity} security alert: ${event.message}`}
    >
      <div
        ref={dialogRef}
        className={`max-w-md w-full mx-4 rounded-lg border p-4 shadow-lg motion-safe:animate-scale-in ${severityClass}`}
      >
        {/* ... all existing children unchanged ... */}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --reporter=verbose SecurityDialog
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/useFocusTrap.ts src/renderer/components/SecurityDialog/SecurityDialog.tsx src/renderer/components/SecurityDialog/SecurityDialog.test.tsx
git commit -m "fix(a11y): add focus trap and auto-focus to SecurityDialog (WCAG 2.4.3)"
```

---

## Task 8: Pipeline Tabs — Tablist Pattern (P2)

**Files:**
- Modify: `src/renderer/components/Chat/ChatView.tsx:114-130`

**Interfaces:**
- Consumes: `template.steps`, `activeTabIndex`, `streaming`
- Produces: `role="tablist"` container, `role="tab"` + `aria-selected` on each step button

- [ ] **Step 1: Update ChatView step tabs**

Find the pipeline tabs section in `src/renderer/components/Chat/ChatView.tsx`:

```tsx
// BEFORE:
<div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
  {template.steps.map((step, i) => (
    <button
      key={i}
      onClick={() => !streaming && setActiveTabIndex(i)}
      className={...}
    >
      {step.backendId}
      {streamingStepIndex === i && <span ... />}
    </button>
  ))}
</div>

// AFTER:
<div
  role="tablist"
  aria-label="Pipeline steps"
  className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto"
>
  {template.steps.map((step, i) => (
    <button
      key={i}
      role="tab"
      aria-selected={activeTabIndex === i}
      aria-controls={`step-panel-${i}`}
      id={`step-tab-${i}`}
      onClick={() => !streaming && setActiveTabIndex(i)}
      className={...}
    >
      {step.backendId}
      {streamingStepIndex === i && <span ... />}
    </button>
  ))}
</div>
```

Also add `id` and `aria-labelledby` to the message panel:
```tsx
{activeMessages.length > 0 && (
  <MessageList
    id={`step-panel-${activeTabIndex}`}
    aria-labelledby={`step-tab-${activeTabIndex}`}
    role="tabpanel"
    messages={activeMessages}
    streaming={streaming && streamingStepIndex === activeTabIndex}
    conversationId={conversationId}
  />
)}
```

Note: `MessageList` must accept and forward `id`, `aria-labelledby`, `role` props — check its interface and add them if missing.

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Chat/ChatView.tsx
git commit -m "fix(a11y): pipeline step tabs use role=tablist/tab/tabpanel with aria-selected"
```

---

## Task 9: PersonaPanel div→button (P2)

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx:239-314`

**Interfaces:**
- Consumes: existing `onSelect`, `activePersonaId`
- Produces: "No persona" item and each user persona item are `<button>` elements with proper semantics

- [ ] **Step 1: Replace "No persona" div with button**

In `src/renderer/components/Personas/PersonaPanel.tsx`, find the "No persona" div (around line 239):

```tsx
// BEFORE:
<div
  role="button"
  tabIndex={0}
  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-transform duration-100 ease-press active:scale-95 ${
    activePersonaId === null ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
  }`}
  onClick={() => onSelect(null)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(null); }}
>
  <span>No persona</span>
</div>

// AFTER:
<button
  className={`w-full text-left flex items-center gap-2 p-2 rounded-lg text-sm transition-transform duration-100 ease-press active:scale-95 ${
    activePersonaId === null ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
  }`}
  onClick={() => onSelect(null)}
  aria-pressed={activePersonaId === null}
>
  <span>No persona</span>
</button>
```

- [ ] **Step 2: Replace user persona list divs with buttons**

Find the `{userPersonas.map((p) => (` block (around line 258):

```tsx
// BEFORE:
<div
  key={p.id}
  role="button"
  tabIndex={0}
  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ... ${
    activePersonaId === p.id ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
  }`}
  onClick={() => onSelect(p.id)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(p.id); }}
>
  {/* children */}
</div>

// AFTER:
<button
  key={p.id}
  className={`w-full text-left flex items-center justify-between p-2 rounded-lg text-sm ... ${
    activePersonaId === p.id ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
  }`}
  onClick={() => onSelect(p.id)}
  aria-pressed={activePersonaId === p.id}
>
  {/* same children — the inner Edit/Delete buttons are fine as children of a <button> 
      IF they call e.stopPropagation() — which they already do */}
</button>
```

Wait — `<button>` inside `<button>` is invalid HTML (same issue as ConvItem). The inner Edit/Delete buttons must be pulled OUT of the persona button. Use a relative-positioned wrapper instead:

```tsx
<div key={p.id} className="relative">
  <button
    className={`w-full text-left flex items-center justify-between p-2 rounded-lg text-sm ... ${
      activePersonaId === p.id ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
    }`}
    onClick={() => onSelect(p.id)}
    aria-pressed={activePersonaId === p.id}
  >
    <div>
      <div className="font-medium">{p.name}</div>
      {p.isDefault && <div className="text-xs text-blue-500">default</div>}
      <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
        {p.systemPrompt || "No system prompt"}
      </div>
    </div>
    {/* leave action buttons space */}
    <div className="w-12 flex-shrink-0" />
  </button>
  {/* Action buttons — absolute positioned to avoid nesting inside <button> */}
  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
    <button
      onClick={() => setEditing(p)}
      className="text-xs text-gray-400 hoverable:hover:text-gray-700 px-1"
      aria-label={`Edit persona ${p.name}`}
    >
      Edit
    </button>
    {confirmDeleteId === p.id ? (
      <button
        onClick={() => { remove(p.id); setConfirmDeleteId(null); }}
        className="text-xs text-red-500 hoverable:hover:text-red-700 px-1 font-medium"
        aria-label={`Confirm delete persona ${p.name}`}
      >
        Confirm?
      </button>
    ) : (
      <button
        onClick={() => setConfirmDeleteId(p.id)}
        className="text-xs text-red-400 hoverable:hover:text-red-600 px-1"
        aria-label={`Delete persona ${p.name}`}
      >
        Delete
      </button>
    )}
  </div>
</div>
```

Also replace the template item divs in the categories section (around line 148):

```tsx
// BEFORE:
<div
  role="button"
  tabIndex={0}
  className="flex items-center justify-between p-2 rounded-lg text-sm ..."
  onClick={() => startTemplateCreate(t)}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startTemplateCreate(t); }}
>

// AFTER:
<button
  className="w-full text-left flex items-center justify-between p-2 rounded-lg text-sm ..."
  onClick={() => startTemplateCreate(t)}
>
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=verbose PersonaPanel
```
Expected: existing PersonaPanel tests still PASS (they test confirm-delete flow which still works).

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx
git commit -m "fix(a11y): replace div role=button with <button> in PersonaPanel; fix button nesting"
```

---

## Self-Review

**Spec coverage:**
- [x] P0: Missing ARIA labels on toolbar icon buttons — Task 1
- [x] P0: Message bubbles lack semantic structure — Task 2
- [x] P0: ConvItem keyboard-accessible rename — Task 3
- [x] P0: InputBar Send/Stop DOM pattern — Task 4
- [x] P1: Focus visible styles — Task 5
- [x] P1: Skip link — Task 5
- [x] P1: ConvList search label — Task 6
- [x] P1: Live regions for streaming — Task 6
- [x] P1: SecurityDialog focus trap — Task 7
- [x] P2: Pipeline tabs tablist pattern — Task 8
- [x] P2: PersonaPanel div→button — Task 9
- [ ] P2: AttachmentChip `×` character — already has `aria-label="Remove attachment"` in current code (verified at line 28); no change needed
- [ ] P2: Tooltips via title only — deferred; title-only tooltips work on desktop with mouse; full tooltip component is a separate feature

**Placeholder scan:** Task 8 notes that `MessageList` may need prop additions — this is flagged explicitly, not silently skipped.

**Type consistency:** `useFocusTrap(ref, enabled)` signature used consistently in both definition and usage.
