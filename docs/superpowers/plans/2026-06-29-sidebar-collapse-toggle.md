# Sidebar Collapse Toggle — Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted chevron toggle button on the sidebar's right edge so desktop users can collapse/expand the sidebar after the toolbar was removed.

**Architecture:** A new `useSidebarCollapsed` hook reads/writes `localStorage` for the desktop collapse preference. `App.tsx` uses the hook and renders an absolutely-positioned chevron button that slides with the sidebar. Mobile collapse state is split into a separate local `useState` so it never touches localStorage.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, `@testing-library/react`, `@phosphor-icons/react`

## Global Constraints

- Desktop only (≥1024px) — mobile behaviour must be unchanged
- Sidebar already has `transition-[width] duration-200 ease-press` — button transition must match (`duration-200 ease-press`)
- localStorage key: `'myra:sidebar-collapsed'`
- Icons from `@phosphor-icons/react` only — no inline SVG
- No new IPC, no SQLite, no new top-level components

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `src/renderer/hooks/useSidebarCollapsed.ts` | **Create** | Read/write collapse preference to localStorage; expose `[collapsed, toggle]` |
| `src/renderer/hooks/useSidebarCollapsed.test.ts` | **Create** | Unit-test the hook's read, fallback, and toggle behaviour |
| `src/renderer/App.tsx` | **Modify** | Wire hook; split mobile state; add chevron button |

---

## Task 1: `useSidebarCollapsed` hook

**Files:**
- Create: `src/renderer/hooks/useSidebarCollapsed.ts`
- Create: `src/renderer/hooks/useSidebarCollapsed.test.ts`

**Interfaces:**
- Produces: `useSidebarCollapsed(): [collapsed: boolean, toggle: () => void]`

---

- [ ] **Step 1: Write the failing tests**

Create `src/renderer/hooks/useSidebarCollapsed.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarCollapsed } from "./useSidebarCollapsed";

const KEY = "myra:sidebar-collapsed";

beforeEach(() => localStorage.clear());

describe("useSidebarCollapsed", () => {
  it("defaults to expanded (false) when localStorage is empty", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it("reads true from localStorage", () => {
    localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it("treats garbage localStorage value as false", () => {
    localStorage.setItem(KEY, "yes-please");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it("toggle flips false → true and writes to localStorage", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("true");
  });

  it("toggle flips true → false and writes to localStorage", () => {
    localStorage.setItem(KEY, "true");
    const { result } = renderHook(() => useSidebarCollapsed());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("false");
  });
});
```

- [ ] **Step 2: Run tests — expect them to fail**

```bash
npm test -- useSidebarCollapsed
```

Expected: `Cannot find module './useSidebarCollapsed'`

- [ ] **Step 3: Implement the hook**

Create `src/renderer/hooks/useSidebarCollapsed.ts`:

```ts
import { useState, useCallback } from "react";

const KEY = "myra:sidebar-collapsed";

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(KEY) === "true",
  );

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm test -- useSidebarCollapsed
```

Expected: 5 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useSidebarCollapsed.ts src/renderer/hooks/useSidebarCollapsed.test.ts
git commit -m "feat(renderer): add useSidebarCollapsed hook with localStorage persistence"
```

---

## Task 2: Wire chevron button into `App.tsx`

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: `useSidebarCollapsed(): [boolean, () => void]` from Task 1
- Consumes: `CaretLeft`, `CaretRight` from `@phosphor-icons/react`

---

- [ ] **Step 1: Update imports in `App.tsx`**

Add to the existing import block:

```tsx
import { useSidebarCollapsed } from "./hooks/useSidebarCollapsed";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
```

- [ ] **Step 2: Replace shared collapse state with two separate variables**

Find and remove:
```tsx
const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 1024);
```

Replace with:
```tsx
const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed();
const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
```

- [ ] **Step 3: Add `relative` to the root flex container**

Find:
```tsx
<div className="flex h-screen overflow-hidden bg-surface text-text-base">
```

Replace with:
```tsx
<div className="flex h-screen overflow-hidden bg-surface text-text-base relative">
```

- [ ] **Step 4: Update the mobile drawer branch to use `mobileSidebarOpen`**

Find the mobile branch (the `else` of the `viewportLg` ternary):
```tsx
      ) : (
        <>
          {!sidebarCollapsed && (
            <div
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setSidebarCollapsed(true)}
            />
          )}
          <div
            className={`fixed left-0 top-0 z-40 h-full transition-transform duration-200 ease-drawer ${
              sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              activeId={activeConvId}
              onSelect={(id) => {
                setSidebarCollapsed(true);
                setActiveConvId(id);
              }}
              onNew={() => { handleNew(); setSidebarCollapsed(true); }}
              onDelete={handleDelete}
              onRename={handleRename}
              refreshTrigger={refreshTrigger}
              onOpenSettings={() => {
                setSettingsOpen(true);
                setSettingsSection("settings");
              }}
            />
          </div>
        </>
      )}
```

Replace with:
```tsx
      ) : (
        <>
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}
          <div
            className={`fixed left-0 top-0 z-40 h-full transition-transform duration-200 ease-drawer ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar
              collapsed={false}
              activeId={activeConvId}
              onSelect={(id) => {
                setMobileSidebarOpen(false);
                setActiveConvId(id);
              }}
              onNew={() => { handleNew(); setMobileSidebarOpen(false); }}
              onDelete={handleDelete}
              onRename={handleRename}
              refreshTrigger={refreshTrigger}
              onOpenSettings={() => {
                setSettingsOpen(true);
                setSettingsSection("settings");
              }}
            />
          </div>
        </>
      )}
```

- [ ] **Step 5: Add the chevron toggle button**

Immediately after the `viewportLg ? <Sidebar> : <drawer>` block and before `<div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">`, insert:

```tsx
      {viewportLg && (
        <button
          onClick={toggleSidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center
            w-4 h-8 rounded-r-md
            bg-surface-subtle border border-l-0 border-border
            text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-surface
            transition-[left,colors] duration-200 ease-press
            ${sidebarCollapsed ? "left-0" : "left-48 lg:left-64"}`}
        >
          {sidebarCollapsed
            ? <CaretRight size={10} weight="bold" />
            : <CaretLeft size={10} weight="bold" />
          }
        </button>
      )}
```

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (the App.tsx change has no unit tests — correctness is verified manually in Step 7).

- [ ] **Step 7: Manual smoke test**

```bash
npm run dev
```

Verify on desktop (≥1024px wide):

1. App opens with sidebar expanded (or collapsed if previously persisted).
2. Chevron button is visible on the sidebar's right edge — shows `‹` (left arrow) when expanded.
3. Click the chevron — sidebar animates to `w-0`, button slides to `left-0`, icon flips to `›`.
4. Refresh the app — sidebar stays collapsed (localStorage persisted).
5. Click `›` — sidebar expands, button slides back to the edge, icon flips to `‹`.
6. Resize window below 1024px — chevron button disappears, mobile drawer takes over.
7. On mobile width, opening/closing the sidebar (via any mobile mechanism) does not affect desktop localStorage preference.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(ui): add persisted sidebar collapse toggle button on desktop"
```
