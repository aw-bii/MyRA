# Sidebar Collapse Toggle — Desktop

**Date:** 2026-06-29  
**Scope:** Desktop only (≥1024px viewport). Mobile sidebar behaviour is unchanged.

---

## Problem

The toolbar was removed in commit `1d51770`. The toolbar previously held the only collapse/expand control for the sidebar. On desktop the sidebar now has no toggle — once open it cannot be collapsed, and once collapsed it cannot be re-expanded.

---

## Solution Overview

1. A `useSidebarCollapsed` hook manages collapse state and persists it to `localStorage`.
2. A small chevron `<button>` in `App.tsx` rides the sidebar's right edge, sliding with it via a CSS `left` transition.
3. No new IPC, no database writes, no new components beyond the hook.

---

## State Management — `useSidebarCollapsed`

**File:** `src/renderer/hooks/useSidebarCollapsed.ts`

- On mount, reads `localStorage.getItem('myra:sidebar-collapsed')`.
- Interprets the literal string `'true'` as collapsed; anything else (absent, `'false'`, garbage) as expanded (`false`).
- Returns `[collapsed: boolean, toggle: () => void]`.
- `toggle` flips the bool and writes `localStorage.setItem('myra:sidebar-collapsed', String(next))`.

**`App.tsx` change:** replace `useState(window.innerWidth < 1024)` with `useSidebarCollapsed()`. The existing `setSidebarCollapsed(true)` calls in mobile handlers are removed; mobile collapse is handled separately by the overlay/drawer mechanism and does not touch localStorage.

---

## Chevron Toggle Button

**Location:** `App.tsx`, inside the root `flex h-screen` container (which gains `relative`).

**Renders only when `viewportLg` is true** (the existing `viewportLg` state flag).

**Positioning:**

```
position: absolute
top: 50%  →  -translate-y-1/2  (vertically centred in the screen)
left: left-0 (collapsed) | left-48 lg:left-64 (expanded)
transition-[left] duration-200 ease-press   ← matches sidebar's own transition
z-20
```

The `left` value matches the sidebar's Tailwind width classes (`w-48` / `lg:w-64`) so the button stays flush with the sidebar's right edge during animation.

**Appearance:**

```
w-4 h-8
rounded-r-md
bg-surface-subtle            ← same as sidebar background
border border-l-0 border-border
flex items-center justify-center
text-text-muted hover:text-text-base
hoverable:hover:bg-surface
transition-colors duration-100
```

Icon: `‹` when expanded (click to collapse), `›` when collapsed (click to expand). Uses the existing `CaretLeft` / `CaretRight` from `@phosphor-icons/react` to stay consistent with the icon set.

**Accessibility:** `aria-label="Collapse sidebar"` / `"Expand sidebar"` toggled with state. `aria-expanded={!collapsed}` on the button.

---

## Sidebar Transition

`Sidebar.tsx` already has `transition-[width] duration-200 ease-press` on the `<aside>` — no change needed.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Corrupt localStorage value | Falls back to expanded (`false`) |
| Resize from desktop → mobile | `viewportLg` flips to `false`; button unmounts; mobile drawer takes over; desktop localStorage preference is unaffected |
| Resize from mobile → desktop | `viewportLg` flips to `true`; button mounts; reads stored desktop preference |

---

## Files Changed

| File | Change |
|---|---|
| `src/renderer/hooks/useSidebarCollapsed.ts` | New — ~15 lines |
| `src/renderer/App.tsx` | Replace `useState` with hook; add `relative` to root div; add chevron button inside `viewportLg` branch |

---

## Out of Scope

- Mobile sidebar collapse toggle (existing overlay/drawer mechanism remains)
- Keyboard shortcut for toggle (can be added later)
- Persisting sidebar width preference (fixed widths only)
