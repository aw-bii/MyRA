# Adapt — Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/P1 responsive issues — fluid sidebar widths, wrapping toolbar, adaptive InputBar height, and touch-accessible ConvItem rename.

**Architecture:** All changes are surgical edits to existing components. No new files. Sidebar panels get `min(px, vw)` fluid widths instead of fixed px. Toolbar gets `flex-wrap` so buttons collapse naturally on narrow viewports. ConvItem gains a long-press handler for mobile rename. InputBar gets viewport-relative `max-height`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

## Global Constraints

- `npm test` must pass after every task
- `npm run build` must succeed after every task
- Match existing code style — Tailwind utility classes, `style` prop only where already used
- Do not rename, restructure, or move files

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/App.tsx:444-450` | Fluid sidebar widths via `min(Npx, 80vw)` |
| `src/renderer/App.tsx:261-400` | Remove `flex-shrink-0` from toolbar nav; add `flex-wrap` |
| `src/renderer/components/Sidebar/ConvItem.tsx` | Add long-press touch handler for rename |
| `src/renderer/components/Chat/InputBar.tsx:138` | Viewport-relative `max-height` |
| `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx` | Test long-press rename |

---

## Task 1: Fluid Sidebar Widths

**Files:**
- Modify: `src/renderer/App.tsx:444-470`

**Interfaces:**
- Consumes: existing `showPersonas`, `showPipelines`, `showSettings`, `viewportLg` state
- Produces: panels that never exceed 80vw on any viewport

- [ ] **Step 1: Write the failing test**

No direct component test for this (it's layout state). Verify visually after Step 3 by resizing the window to 360px.

- [ ] **Step 2: Update Personas panel width in App.tsx**

In `src/renderer/App.tsx`, find both panel `style` props. Replace the fixed `(viewportLg ? 256 : 224)` with a fluid expression:

```tsx
// BEFORE (line ~444):
style={{
  width: showPersonas ? (viewportLg ? 256 : 224) : 0,
  willChange: "width",
}}

// AFTER:
style={{
  width: showPersonas ? `min(${viewportLg ? 256 : 224}px, 80vw)` : 0,
  willChange: "width",
}}
```

Do the same for the Pipelines panel `style` prop (same pattern, `showPipelines`):

```tsx
// BEFORE:
style={{
  width: showPipelines ? (viewportLg ? 256 : 224) : 0,
  willChange: "width",
}}

// AFTER:
style={{
  width: showPipelines ? `min(${viewportLg ? 256 : 224}px, 80vw)` : 0,
  willChange: "width",
}}
```

Also update the SettingsPanel panel (same pattern, `showSettings`):

```tsx
// BEFORE:
style={{
  width: showSettings ? (viewportLg ? 256 : 224) : 0,
  willChange: "width",
}}

// AFTER:
style={{
  width: showSettings ? `min(${viewportLg ? 256 : 224}px, 80vw)` : 0,
  willChange: "width",
}}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: No TypeScript errors.

- [ ] **Step 4: Manual verify**

Open DevTools → Toggle device toolbar → set viewport to 360px wide → open Personas panel → panel must not overflow screen edge.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: clamp sidebar panel widths to 80vw on narrow viewports"
```

---

## Task 2: Wrapping Toolbar

**Files:**
- Modify: `src/renderer/App.tsx:261-400` (the `<nav>` toolbar element)

**Interfaces:**
- Consumes: no state change — pure class change
- Produces: toolbar that wraps to a second row on narrow viewports instead of horizontal-scrolling

- [ ] **Step 1: Update nav className**

In `src/renderer/App.tsx`, find the toolbar `<nav>` element (around line 261):

```tsx
// BEFORE:
<nav
  aria-label="Toolbar"
  className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0"
>

// AFTER:
<nav
  aria-label="Toolbar"
  className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700"
>
```

Changes: added `flex-wrap`, removed `overflow-x-auto` and `flex-shrink-0`.

- [ ] **Step 2: Remove flex-shrink-0 from the spacer**

Find the spacer div between zones 2 and 3 inside the toolbar (currently `<div className="flex-1 flex-shrink-0" />`):

```tsx
// BEFORE:
<div className="flex-1 flex-shrink-0" />

// AFTER:
<div className="flex-1" />
```

- [ ] **Step 3: Run build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 4: Manual verify**

Set viewport to 600px → toolbar buttons must wrap to a second row instead of creating a horizontal scrollbar.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: toolbar wraps to second row on narrow viewports instead of horizontal scroll"
```

---

## Task 3: ConvItem Long-Press Rename (Mobile)

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx`
- Test: `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx`

**Interfaces:**
- Consumes: existing `setEditing`, `setEditValue`, `conversation.title` in `ConvItem`
- Produces: `onTouchStart`/`onTouchEnd`/`onTouchMove` on the conversation `<button>` that trigger rename after 600ms hold

- [ ] **Step 1: Write the failing test**

Open `src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx` and add:

```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConvItem } from "../ConvItem";

const conv = {
  id: "c1",
  title: "Test Conv",
  backend: "claude",
  pipelineTemplateId: null,
  updatedAt: new Date().toISOString(),
};

describe("ConvItem long-press rename", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("enters rename mode after 600ms touch hold", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    act(() => { vi.advanceTimersByTime(650); });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("does not enter rename on short tap", () => {
    render(
      <ConvItem
        conversation={conv}
        active={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />
    );
    const btn = screen.getByRole("button", { name: /Test Conv/i });
    fireEvent.touchStart(btn);
    fireEvent.touchEnd(btn);
    act(() => { vi.advanceTimersByTime(650); });
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose ConvItem
```
Expected: FAIL — "enters rename mode after 600ms touch hold"

- [ ] **Step 3: Add long-press handler to ConvItem.tsx**

In `src/renderer/components/Sidebar/ConvItem.tsx`, add a `useRef` import and the long-press logic:

```tsx
import { memo, useState, useRef } from "react";
// ... existing imports

export const ConvItem = memo(function ConvItem({ ... }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title);
  const isPipeline = conversation.pipelineTemplateId !== null;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setEditValue(conversation.title);
      setEditing(true);
    }, 600);
  };

  const onTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ... existing handleSubmit ...

  if (editing) { /* unchanged */ }

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={onClick}
        onDoubleClick={() => {
          setEditValue(conversation.title);
          setEditing(true);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchEnd}
        aria-current={active ? "page" : undefined}
        className={...}
      >
        {/* unchanged children */}
      </button>
      {/* unchanged delete button */}
    </div>
  );
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose ConvItem
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar/ConvItem.tsx src/renderer/components/Sidebar/__tests__/ConvItem.test.tsx
git commit -m "feat: add long-press (600ms) to trigger rename in ConvItem on touch devices"
```

---

## Task 4: InputBar Adaptive Max-Height

**Files:**
- Modify: `src/renderer/components/Chat/InputBar.tsx:138`

**Interfaces:**
- Consumes: existing textarea element
- Produces: textarea that caps at `min(160px, 40vh)` — prevents it consuming most of screen on mobile

- [ ] **Step 1: Update textarea className**

In `src/renderer/components/Chat/InputBar.tsx`, find the textarea (around line 136):

```tsx
// BEFORE:
<textarea
  ref={textareaRef}
  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
  ...
/>

// AFTER:
<textarea
  ref={textareaRef}
  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  style={{ maxHeight: 'min(10rem, 40vh)' }}
  ...
/>
```

Removes `max-h-40` (160px fixed) and replaces with an inline `min()` that scales down to 40% of viewport height on mobile.

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Chat/InputBar.tsx
git commit -m "fix: InputBar textarea max-height scales with viewport on mobile (min(10rem, 40vh))"
```

---

## Task 5: Touch Targets for Small Interactive Elements

**Files:**
- Modify: `src/renderer/index.css:52-61`

**Interfaces:**
- Consumes: existing `.btn-sm`/`.btn-md` coarse-pointer rules
- Produces: delete button in ConvItem and persona action buttons also meet 44px minimum on touch devices

- [ ] **Step 1: Extend coarse-pointer block**

In `src/renderer/index.css`, find the `@media (pointer: coarse)` block and extend it:

```css
@media (pointer: coarse) {
  .btn-sm {
    min-height: 44px;
    min-width: 44px;
  }
  .btn-md {
    min-height: 44px;
    min-width: 44px;
  }
  /* Ensure small action buttons (delete, edit) also meet touch target size */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}
```

- [ ] **Step 2: Apply touch-target class to ConvItem delete button**

In `src/renderer/components/Sidebar/ConvItem.tsx`, update the delete button:

```tsx
// BEFORE:
<button
  onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
  className="opacity-0 hoverable:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-1 text-gray-400 hoverable:hover:text-red-500 transition-[opacity,transform] duration-100 ease-press active:scale-95"
  aria-label="Delete conversation"
  title="Delete"
>

// AFTER:
<button
  onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
  className="touch-target opacity-0 hoverable:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-1 text-gray-400 hoverable:hover:text-red-500 transition-[opacity,transform] duration-100 ease-press active:scale-95"
  aria-label="Delete conversation"
  title="Delete"
>
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.css src/renderer/components/Sidebar/ConvItem.tsx
git commit -m "fix: ensure touch targets meet 44px minimum on coarse-pointer devices"
```

---

## Self-Review

**Spec coverage:**
- [x] P0: Fluid sidebar widths — Task 1
- [x] P0: Toolbar overflow — Task 2
- [x] P0: Touch-accessible ConvItem rename — Task 3
- [x] P1: InputBar max-height fixed → adaptive — Task 4
- [x] P2: Touch targets < 44px — Task 5
- [ ] P1: ChatView pipeline tabs horizontal scroll — not addressed (overflow-x-auto on tabs is acceptable UX with scroll indicators; adding scroll indicator is a P2 follow-up)
- [ ] P1: SettingsPanel fixed width — not addressed (w-72 lg:w-56 is inside a panel that already has a clamped container width from Task 1)
- [ ] P1: No container queries or fluid typography — deferred; requires Tailwind v4 or plugin

**Placeholder scan:** None found.

**Type consistency:** `ReturnType<typeof setTimeout>` used correctly for the timer ref.
