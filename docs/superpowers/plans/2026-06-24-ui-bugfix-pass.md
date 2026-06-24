# UI Bug Fix Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 confirmed bugs across critical blockers, visual/layout, and feature gaps in MyRA without introducing new abstractions.

**Architecture:** All changes are surgical edits to existing files. No new files are created. The changes fall into three layers: Electron security config (`index.html`, `main/ipc.ts`), React layout and state (`App.tsx`, `Sidebar.tsx`), and component behaviour (`PersonaPanel.tsx`, `useBackends.ts`, `BackendSwitcher.tsx`).

**Tech Stack:** Electron + React + TypeScript + Tailwind CSS, `electron-vite` build, Vitest unit tests.

## Global Constraints

- Never use raw string channel names — always reference `IPC.*` constants from `src/shared/ipc.ts`.
- Never touch uninvolved code; match the surrounding style exactly.
- All Tailwind classes must exist in the config or in Tailwind's default utility set — no arbitrary values unless already used nearby.
- Run `npm run lint` and `npm test` before each commit; fix failures before committing.
- Commit message format: `fix: <short description>` for bug fixes.

---

## File Map

| File | What changes |
| --- | --- |
| `src/renderer/index.html` | CSP `connect-src`, `html`/`body`/`#root` height |
| `src/renderer/App.tsx` | `h-screen` layout, pipeline empty state, Cron/MCP/Plugins auto-expand, `willChange` on panels, wizard `onComplete` refresh trigger |
| `src/renderer/components/Sidebar/Sidebar.tsx` | Background colour, width breakpoints |
| `src/renderer/components/Personas/PersonaPanel.tsx` | System prompt preview line, scroll-into-view on edit open |
| `src/renderer/hooks/useBackends.ts` | Optional `refreshTrigger` param |
| `src/renderer/components/BackendSwitcher.tsx` | Accept + forward `refreshTrigger` |
| `src/renderer/ipc.ts` | `installBackend` return type includes `error?: string` |
| `src/renderer/components/Wizard/WizardStep2.tsx` | Display specific install error message |

---

### Task 1: Fix CSP and full-height HTML skeleton

**Files:**
- Modify: `src/renderer/index.html`

**Interfaces:**
- Produces: `#root` fills the full window height; HTTPS fetch calls from the renderer are no longer blocked by CSP.

- [ ] **Step 1: Update `index.html`**

Replace the entire file content with:

```html
<!DOCTYPE html>
<html lang="en" style="height:100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https:">
    <title>MyRA</title>
    <script>(function(){var t=localStorage.getItem("theme");if(t==="dark"||(t===null&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")})()</script>
  </head>
  <body style="height:100%;margin:0">
    <div id="root" style="height:100%"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Key changes:
- `connect-src 'self' https:` — allows HTTPS fetch from renderer
- `html`, `body`, `#root` all set to `height: 100%` — enables the `h-screen` chain

- [ ] **Step 2: Verify build compiles**

```bash
npm run build
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.html
git commit -m "fix: relax CSP connect-src to https, set full-height html/body/root"
```

---

### Task 2: Fix outer layout to h-screen and add pipeline empty state

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: App is locked to window height with no body scrollbar. Pipeline mode with no active conversation shows a guidance empty state instead of a blank ChatView.

- [ ] **Step 1: Change outer wrapper from `min-h-screen` to `h-screen overflow-hidden`**

In `src/renderer/App.tsx`, find the outer `<div>` at line 174:

```tsx
// Before
<div className="flex min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
```

Change to:

```tsx
// After
<div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
```

- [ ] **Step 2: Add pipeline empty state**

In `App.tsx`, find the `<main>` block. The current condition is:

```tsx
{!activeConvId && mode === "single" ? (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
    ...welcome state...
  </div>
) : (
  <ChatView ... />
)}
```

Replace with a three-branch condition:

```tsx
{!activeConvId && mode === "single" ? (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
    <h2 className="text-sm font-semibold mb-2">
      Welcome to MyRA
    </h2>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-4">
      Claude Code is built in and ready. Create a conversation, pick a
      backend, and ask your question.
    </p>
    <button
      onClick={handleNew}
      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
    >
      New conversation
    </button>
  </div>
) : !activeConvId && mode === "pipeline" ? (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
    <h2 className="text-sm font-semibold mb-2">Pipeline mode</h2>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
      Select a pipeline template from the toolbar above, then type your
      first message to begin.
    </p>
  </div>
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

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: h-screen layout and pipeline empty state"
```

---

### Task 3: Auto-expand sidebar when Cron/MCP/Plugins is clicked

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: Clicking Cron, MCP, or Plugins in the toolbar always shows the panel — expanding the sidebar first if it is collapsed.

- [ ] **Step 1: Update the three toolbar buttons in `App.tsx`**

Find the Cron button (around line 312):

```tsx
// Before
<button
  onClick={() => setShowCron((v) => !v)}
  ...
>
  Cron
</button>
```

Change to:

```tsx
// After
<button
  onClick={() => { setShowCron((v) => !v); setSidebarCollapsed(false); }}
  ...
>
  Cron
</button>
```

Find the MCP button (around line 319):

```tsx
// Before
<button
  onClick={() => setShowMCP((v) => !v)}
  ...
>
  MCP
</button>
```

Change to:

```tsx
// After
<button
  onClick={() => { setShowMCP((v) => !v); setSidebarCollapsed(false); }}
  ...
>
  MCP
</button>
```

Find the Plugins button (around line 326):

```tsx
// Before
<button
  onClick={() => setShowPlugins((v) => !v)}
  ...
>
  Plugins
</button>
```

Change to:

```tsx
// After
<button
  onClick={() => { setShowPlugins((v) => !v); setSidebarCollapsed(false); }}
  ...
>
  Plugins
</button>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: auto-expand sidebar when Cron/MCP/Plugins toolbar button clicked"
```

---

### Task 4: Add `willChange: width` to animating right panels

**Files:**
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: The three right-side panels (Personas, Pipelines, Settings) have `willChange: 'width'` set, promoting them to compositor layers and reducing layout-reflow jank on Windows during width transitions.

- [ ] **Step 1: Add `style` prop to each animated panel wrapper**

In `App.tsx`, find the three animated panel `<div>` wrappers. Each has the pattern `overflow-hidden transition-[width] duration-200 ease-drawer`. Add `style={{ willChange: 'width' }}` to each.

Personas panel wrapper (find the `showPersonas` transition div):

```tsx
// Before
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showPersonas ? "w-56 lg:w-64" : "w-0"
  } ${showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showPersonas ? "auto" : "none" }}
>
```

```tsx
// After
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showPersonas ? "w-56 lg:w-64" : "w-0"
  } ${showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showPersonas ? "auto" : "none", willChange: "width" }}
>
```

Pipelines panel wrapper (find the `showPipelines` transition div):

```tsx
// Before
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showPipelines ? "w-56 lg:w-64" : "w-0"
  } ${showPipelines ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showPipelines ? "auto" : "none" }}
>
```

```tsx
// After
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showPipelines ? "w-56 lg:w-64" : "w-0"
  } ${showPipelines ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showPipelines ? "auto" : "none", willChange: "width" }}
>
```

Settings panel wrapper (find the `showSettings` transition div):

```tsx
// Before
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showSettings ? "w-72 lg:w-56" : "w-0"
  } ${showSettings ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showSettings ? "auto" : "none" }}
>
```

```tsx
// After
<div
  className={`overflow-hidden transition-[width] duration-200 ease-drawer ${
    showSettings ? "w-72 lg:w-56" : "w-0"
  } ${showSettings ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
  style={{ pointerEvents: showSettings ? "auto" : "none", willChange: "width" }}
>
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: add willChange width to animated side panels to reduce reflow jank"
```

---

### Task 5: Fix sidebar visual appearance

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

**Interfaces:**
- Produces: Sidebar has `bg-gray-100` in light mode (distinct from `bg-white` main area) and correct width: `w-48` on mobile, `w-64` on desktop.

- [ ] **Step 1: Fix background colour and width breakpoints**

In `Sidebar.tsx`, find the `<aside>` element at line 39. Change:

```tsx
// Before
className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${
  collapsed ? "w-0" : "w-64 lg:w-48"
}`}
```

To:

```tsx
// After
className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 ${
  collapsed ? "w-0" : "w-48 lg:w-64"
}`}
```

Two changes: `bg-gray-50` → `bg-gray-100`, and `w-64 lg:w-48` → `w-48 lg:w-64`.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "fix: sidebar background contrast and reversed width breakpoints"
```

---

### Task 6: Show system prompt preview in persona list and scroll edit form into view

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx`

**Interfaces:**
- Produces: Each persona list item shows a 1-line truncated system prompt below the name. When the edit form opens, it scrolls into view.

- [ ] **Step 1: Add system prompt preview to each persona item**

In `PersonaPanel.tsx`, find the user persona list items (around line 235). Each item's name block currently looks like:

```tsx
<div>
  <div className="font-medium">{p.name}</div>
  {p.isDefault && (
    <div className="text-xs text-blue-500">default</div>
  )}
</div>
```

Add a system prompt preview line:

```tsx
<div>
  <div className="font-medium">{p.name}</div>
  {p.isDefault && (
    <div className="text-xs text-blue-500">default</div>
  )}
  <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]">
    {p.systemPrompt || "No system prompt"}
  </div>
</div>
```

- [ ] **Step 2: Add scroll-into-view when edit form opens**

At the top of `PersonaPanel`, add a ref:

```tsx
import { useState, useMemo, useEffect, useRef } from "react";
```

After the existing state declarations (around line 18), add:

```tsx
const editFormRef = useRef<HTMLDivElement>(null);
```

Add a `useEffect` that fires when `editing` becomes non-null:

```tsx
useEffect(() => {
  if (editing) {
    editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}, [editing]);
```

Attach the ref to the edit form wrapper (around line 291):

```tsx
// Before
{editing && !creatingFromTemplate && (
  <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
```

```tsx
// After
{editing && !creatingFromTemplate && (
  <div ref={editFormRef} className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx
git commit -m "fix: show system prompt preview in persona list and scroll edit form into view"
```

---

### Task 7: Add refreshTrigger to useBackends and wire it through BackendSwitcher

**Files:**
- Modify: `src/renderer/hooks/useBackends.ts`
- Modify: `src/renderer/components/BackendSwitcher.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Produces: `useBackends(refreshTrigger?: number)` re-fetches whenever `refreshTrigger` changes. `BackendSwitcher` accepts a `refreshTrigger` prop and forwards it. `App.tsx` increments a counter on wizard completion so the dropdown immediately reflects newly installed backends.

- [ ] **Step 1: Update `useBackends.ts`**

Replace the entire file:

```typescript
import { useState, useEffect } from "react";
import { listBackends } from "../ipc";
import type { BackendInfo } from "../../shared/types";

export function useBackends(refreshTrigger = 0) {
  const [backends, setBackends] = useState<BackendInfo[]>([]);

  useEffect(() => {
    listBackends().then(setBackends);
  }, [refreshTrigger]);

  return { backends };
}
```

- [ ] **Step 2: Update `BackendSwitcher.tsx`**

Add `refreshTrigger` to the Props interface and forward it to `useBackends`:

```tsx
import { memo } from "react";
import { useBackends } from "../hooks/useBackends";

interface Props {
  value: string;
  onChange: (id: string) => void;
  refreshTrigger?: number;
}

export const BackendSwitcher = memo(function BackendSwitcher({ value, onChange, refreshTrigger = 0 }: Props) {
  const { backends } = useBackends(refreshTrigger);

  return (
    <select
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
  );
});
```

- [ ] **Step 3: Wire the refresh trigger in `App.tsx`**

In `App.tsx`, add a `backendRefresh` state counter near the other state declarations:

```tsx
const [backendRefresh, setBackendRefresh] = useState(0);
```

Update the `SetupWizard` `onComplete` callback to increment it:

```tsx
// Before
return <SetupWizard onComplete={() => setWizardDone(true)} />;
```

```tsx
// After
return (
  <SetupWizard
    onComplete={() => {
      setWizardDone(true);
      setBackendRefresh((n) => n + 1);
    }}
  />
);
```

Pass `backendRefresh` to `BackendSwitcher` in the toolbar (find the `<BackendSwitcher>` usage around line 275):

```tsx
// Before
<div className="flex-shrink-0"><BackendSwitcher value={backend} onChange={setBackend} /></div>
```

```tsx
// After
<div className="flex-shrink-0"><BackendSwitcher value={backend} onChange={setBackend} refreshTrigger={backendRefresh} /></div>
```

- [ ] **Step 4: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useBackends.ts src/renderer/components/BackendSwitcher.tsx src/renderer/App.tsx
git commit -m "fix: refresh backend list after wizard completes"
```

---

### Task 8: Forward install error message to renderer

**Files:**
- Modify: `src/renderer/ipc.ts`
- Modify: `src/renderer/components/Wizard/WizardStep2.tsx`

**Interfaces:**
- Produces: `installBackend` in the renderer returns `{ success: boolean; error?: string }`. `WizardStep2` displays the specific error message from the main process instead of a generic fallback.

- [ ] **Step 1: Update `installBackend` return type in `src/renderer/ipc.ts`**

Find the `installBackend` export (search for `WIZARD_INSTALL`). Change the return type from `Promise<{ success: boolean }>` to `Promise<{ success: boolean; error?: string }>`:

```typescript
// Before
export async function installBackend(id: string): Promise<{ success: boolean }> {
  return ipcInvoke<{ success: boolean }>(IPC.WIZARD_INSTALL, { backend: id });
}
```

```typescript
// After
export async function installBackend(id: string): Promise<{ success: boolean; error?: string }> {
  return ipcInvoke<{ success: boolean; error?: string }>(IPC.WIZARD_INSTALL, { backend: id });
}
```

- [ ] **Step 2: Use the error message in `WizardStep2.tsx`**

In `src/renderer/components/Wizard/WizardStep2.tsx`, find the install handler:

```tsx
// Before
const { success: ok } = await installBackend(id);
off();

setInstalling((prev) => ({ ...prev, [id]: false }));
setDone((prev) => ({ ...prev, [id]: ok }));
if (!ok) {
  setErrors((prev) => ({
    ...prev,
    [id]: "Installation failed. Check your internet connection.",
  }));
}
```

```tsx
// After
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
```

- [ ] **Step 3: Run lint and tests**

```bash
npm run lint && npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc.ts src/renderer/components/Wizard/WizardStep2.tsx
git commit -m "fix: surface specific install error message in wizard step 2"
```

---

## Self-Review

### Spec coverage

| Spec item | Task |
| --- | --- |
| 1a CSP `connect-src` | Task 1 |
| 1b Cron/MCP/Plugins auto-expand | Task 3 |
| 1c Pipeline empty state | Task 2 |
| 2a Sidebar background | Task 5 |
| 2b Sidebar width breakpoints | Task 5 |
| 2c `h-screen` layout + HTML height | Tasks 1 + 2 |
| 2d `willChange` on panels | Task 4 |
| 3a Persona prompt preview | Task 6 |
| 3b Persona edit scroll-into-view | Task 6 |
| 3c Backend refresh after wizard | Task 7 |
| 3d Install error forwarding | Task 8 |

All spec items covered. ✓

### Placeholder scan

No TBDs, TODOs, or vague steps. All code blocks contain exact content. ✓

### Type consistency

- `useBackends(refreshTrigger = 0)` defined in Task 7 Step 1, consumed in Task 7 Step 2 — parameter name matches.
- `BackendSwitcher` `refreshTrigger?: number` prop defined in Task 7 Step 2, passed in Task 7 Step 3 — prop name matches.
- `installBackend` return type updated in Task 8 Step 1, destructured in Task 8 Step 2 as `{ success: ok, error }` — matches. ✓
