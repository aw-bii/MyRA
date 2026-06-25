# App Flow Audit Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 confirmed bugs/UX issues discovered during a live Playwright audit of the full first-run flow.

**Architecture:** All fixes are surgical edits to existing components. No new files, no new abstractions. Three bugs in existing logic (wizard subtitle, panel width, backend auth warning) and two UX improvements (close buttons, description overflow).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + Testing Library

## Global Constraints

- `npm test` must pass after every task
- Match existing code style: Tailwind utility classes, no inline CSS except where already used
- Do not rename, move, or restructure files beyond what each task requires
- `npm run build` must succeed after every task

---

## Issue Map

| # | File | Symptom | Root cause |
|---|------|---------|------------|
| A | `WizardStep3.tsx:61` | "then click Check" subtitle shows when there's nothing to check | Subtitle is unconditional |
| B | `BackendSwitcher.tsx` | No warning when selected backend is installed but not authenticated | No auth check at selection time |
| C | `App.tsx:415–458` | All three right panels occupy their full width in the flex layout even when hidden, squeezing the chat area to ~180px | `translate-x-full` shifts content visually but doesn't collapse flex width; panels always take `w-56/w-64` space |
| D | `PersonaPanel.tsx:5–8` | No close button inside the Personas panel | No `onClose` prop; panel can only be closed from toolbar button |
| E | `PipelinePanel.tsx:19–22` | No close button inside the Pipelines panel | Same as D |

Issues D and E are caused by C: with width-based animation, panels collapse when closed, making a close button less urgent — but it's still good UX to have one.

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/components/Wizard/WizardStep3.tsx` | Make subtitle conditional on `needsAuth.length > 0` |
| `src/renderer/components/Wizard/WizardStep3.test.tsx` | Add test: subtitle hidden when all tools signed in |
| `src/renderer/components/BackendSwitcher.tsx` | Add inline warning when selected backend is authenticated=false |
| `src/renderer/components/Personas/PersonaPanel.tsx` | Add `onClose?: () => void` prop + close button; fix description overflow |
| `src/renderer/components/Personas/PersonaPanel.test.tsx` | Add test: close button renders when `onClose` provided |
| `src/renderer/components/Pipelines/PipelinePanel.tsx` | Add `onClose?: () => void` prop + close button |
| `src/renderer/App.tsx` | Replace `translate-x` panel animation with width animation; pass `onClose` to both panels |

---

## Task 1: Wizard Step 3 — Conditional subtitle

**Files:**
- Modify: `src/renderer/components/Wizard/WizardStep3.tsx:59–62`
- Test: `src/renderer/components/Wizard/WizardStep3.test.tsx`

**Interfaces:**
- Consumes: `needsAuth` (already computed at line 54) — `BackendStatus[]` where `available && !authenticated`
- Produces: no interface change

- [ ] **Step 1: Write the failing test**

In `src/renderer/components/Wizard/WizardStep3.test.tsx`, add after the existing `describe` blocks:

```typescript
describe("WizardStep3 all-signed-in state", () => {
  it("hides the 'click Check' subtitle when all tools are signed in", () => {
    render(
      <WizardStep3
        statuses={[claudeStatus]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/then click check/i),
    ).toBeNull();
  });

  it("shows the 'click Check' subtitle when a tool needs auth", () => {
    render(
      <WizardStep3
        statuses={[
          { id: "gemini", available: true, authenticated: false, loading: false },
        ]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/then click check/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep3.test.tsx
```

Expected: `hides the 'click Check' subtitle` FAILS (subtitle always renders), `shows the 'click Check' subtitle` PASSES.

- [ ] **Step 3: Fix WizardStep3.tsx**

In `src/renderer/components/Wizard/WizardStep3.tsx`, replace lines 59–62:

```tsx
      {/* before */}
      <div>
        <h2 className="text-sm font-semibold mb-1">Sign in to your AI tools</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Open a terminal, run the command for each tool, then click Check.
        </p>
      </div>
```

with:

```tsx
      <div>
        <h2 className="text-sm font-semibold mb-1">Sign in to your AI tools</h2>
        {needsAuth.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Open a terminal, run the command for each tool, then click Check.
          </p>
        )}
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/renderer/components/Wizard/WizardStep3.test.tsx
```

Expected: all 4 tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Wizard/WizardStep3.tsx src/renderer/components/Wizard/WizardStep3.test.tsx
git commit -m "fix: hide wizard step 3 subtitle when no tools need auth"
```

---

## Task 2: BackendSwitcher — Warn on unauthenticated selection

When a backend is installed (`available=true`) but not authenticated (`authenticated=false`), the user can select it and Send won't be blocked. Add an inline warning below the selector.

**Files:**
- Modify: `src/renderer/components/BackendSwitcher.tsx`

**Interfaces:**
- Consumes: `backends` from `useBackends(refreshTrigger)` — each item is `{ id, label, available, authenticated }`
- Produces: no interface change; renders a warning `<span>` when needed

- [ ] **Step 1: Write the failing test**

Create `src/renderer/components/BackendSwitcher.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BackendSwitcher } from "./BackendSwitcher";

vi.mock("../hooks/useBackends", () => ({
  useBackends: () => ({
    backends: [
      { id: "claude", label: "Claude Code", available: true, authenticated: true },
      { id: "gemini", label: "Gemini CLI", available: true, authenticated: false },
    ],
  }),
}));

describe("BackendSwitcher", () => {
  it("shows no warning when the selected backend is authenticated", () => {
    render(<BackendSwitcher value="claude" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a warning when the selected backend is available but not authenticated", () => {
    render(<BackendSwitcher value="gemini" onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not signed in/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/renderer/components/BackendSwitcher.test.tsx
```

Expected: `shows a warning` FAILS (no alert rendered yet).

- [ ] **Step 3: Fix BackendSwitcher.tsx**

Replace the full content of `src/renderer/components/BackendSwitcher.tsx`:

```tsx
import { memo } from "react";
import { useBackends } from "../hooks/useBackends";

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
    <div className="flex flex-col gap-0.5">
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
      {needsAuth && (
        <span
          role="alert"
          className="text-xs text-amber-600 dark:text-amber-400"
        >
          Not signed in — run{" "}
          <code className="font-mono bg-gray-100 dark:bg-gray-800 px-0.5 rounded">
            {value} auth login
          </code>{" "}
          first
        </span>
      )}
    </div>
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/renderer/components/BackendSwitcher.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/BackendSwitcher.tsx src/renderer/components/BackendSwitcher.test.tsx
git commit -m "fix: warn when selected backend is installed but not authenticated"
```

---

## Task 3: App.tsx — Fix right panel width (root cause of narrow chat + Create truncation)

The three right panels (Personas, Pipelines, Settings) use `translate-x-full`/`translate-x-0` to hide/show. Because `transform` doesn't affect flex layout, all three panels always occupy their full `w-56 lg:w-64` width even when "hidden", leaving only ~352px for the chat area at 1400px window width. Switch to width-based animation so hidden panels collapse to 0.

**Files:**
- Modify: `src/renderer/App.tsx:415–458`

**Interfaces:**
- Consumes: `showPersonas`, `showPipelines`, `showSettings`, `viewportLg` — already existing state in App.tsx
- Produces: same panel render, visually identical when open, 0px when closed

**No unit test:** this is a layout behavior change. Verify visually by running the app (Step 4).

- [ ] **Step 1: Replace the Personas panel wrapper (App.tsx ~lines 415–427)**

Find this block:
```tsx
          <div
            className={`overflow-hidden transition-transform duration-200 ease-drawer ${
              showPersonas ? "translate-x-0" : "translate-x-full"
            } ${showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
            style={{ pointerEvents: showPersonas ? "auto" : "none", willChange: "transform" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
              <PersonaPanel
                activePersonaId={personaId}
                onSelect={setPersonaId}
              />
            </div>
          </div>
```

Replace with:
```tsx
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showPersonas ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
              <PersonaPanel
                activePersonaId={personaId}
                onSelect={setPersonaId}
              />
            </div>
          </div>
```

- [ ] **Step 2: Replace the Pipelines panel wrapper (App.tsx ~lines 428–443)**

Find this block:
```tsx
          <div
            className={`overflow-hidden transition-transform duration-200 ease-drawer ${
              showPipelines ? "translate-x-0" : "translate-x-full"
            } ${showPipelines ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
            style={{ pointerEvents: showPipelines ? "auto" : "none", willChange: "transform" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={(t) => {
                  setSelectedTemplate(t);
                  setMode("pipeline");
                }}
              />
            </div>
          </div>
```

Replace with:
```tsx
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showPipelines ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showPipelines ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={(t) => {
                  setSelectedTemplate(t);
                  setMode("pipeline");
                }}
              />
            </div>
          </div>
```

- [ ] **Step 3: Replace the Settings panel wrapper (App.tsx ~lines 444–458)**

Find this block:
```tsx
          <div
            className={`overflow-hidden transition-transform duration-200 ease-drawer ${
              showSettings ? "translate-x-0" : "translate-x-full"
            } ${showSettings ? "border-l border-gray-200 dark:border-gray-700" : ""}`}
            style={{ pointerEvents: showSettings ? "auto" : "none", willChange: "transform" }}
          >
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onReRunWizard={() => {
                localStorage.removeItem("wizardDone");
                setWizardDone(false);
                setSetting("wizard_done", "0");
              }}
            />
          </div>
```

Replace with:
```tsx
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showSettings ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showSettings ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
          >
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onReRunWizard={() => {
                localStorage.removeItem("wizardDone");
                setWizardDone(false);
                setSetting("wizard_done", "0");
              }}
            />
          </div>
```

- [ ] **Step 4: Build and verify visually**

```bash
npm run build
```

Expected: builds cleanly, no TypeScript errors.

Then run `npm run dev`, open the app, click Personas — panel slides in from the right. Click Personas again — panel collapses to 0 and the chat area expands. Verify the message textarea is wider (~600px+) when no panel is open.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix: collapse right panel width to 0 when hidden so chat area fills available space"
```

---

## Task 4: PersonaPanel + PipelinePanel — Close buttons and description overflow

Add a close button to each panel's header, and fix the template row so description text doesn't push "Create" off the right edge.

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx:5–8` (Props), `src/renderer/components/Personas/PersonaPanel.tsx:10` (component signature), and `src/renderer/components/Personas/PersonaPanel.tsx:144–155` (template row)
- Modify: `src/renderer/components/Pipelines/PipelinePanel.tsx:19–22` (Props), `src/renderer/components/Pipelines/PipelinePanel.tsx:24` (component signature)
- Modify: `src/renderer/App.tsx` — pass `onClose` to both panels
- Test: `src/renderer/components/Personas/PersonaPanel.test.tsx`

**Interfaces:**
- `PersonaPanel` gains: `onClose?: () => void`
- `PipelinePanel` gains: `onClose?: () => void`
- App.tsx passes: `onClose={() => togglePanel("personas")}` and `onClose={() => togglePanel("pipelines")}`

- [ ] **Step 1: Write failing tests for PersonaPanel close button**

Add to `src/renderer/components/Personas/PersonaPanel.test.tsx`:

```typescript
describe("PersonaPanel close button", () => {
  it("renders a close button when onClose is provided", () => {
    const onClose = vi.fn();
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} onClose={onClose} />);
    const btn = screen.getByRole("button", { name: /close personas/i });
    expect(btn).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close personas/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render a close button when onClose is not provided", () => {
    render(<PersonaPanel activePersonaId={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /close personas/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/renderer/components/Personas/PersonaPanel.test.tsx
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Update PersonaPanel Props interface and signature**

In `src/renderer/components/Personas/PersonaPanel.tsx`, replace lines 5–10:

```tsx
interface Props {
  activePersonaId: string | null;
  onSelect: (id: string | null) => void;
}

export function PersonaPanel({ activePersonaId, onSelect }: Props) {
```

with:

```tsx
interface Props {
  activePersonaId: string | null;
  onSelect: (id: string | null) => void;
  onClose?: () => void;
}

export function PersonaPanel({ activePersonaId, onSelect, onClose }: Props) {
```

- [ ] **Step 4: Add close button to PersonaPanel header**

In `src/renderer/components/Personas/PersonaPanel.tsx`, find the panel header. It likely has a `+ New` button row. Find the line that renders `+ New` (around line 113–118 based on the Explore agent report). That block looks like:

```tsx
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Personas</h3>
          <button ...>+ New</button>
        </div>
```

The exact markup may differ — read the file to find the header before editing. Add the close button alongside the existing header buttons:

```tsx
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Personas</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { /* existing + New logic */ }}
              className="..."
            >
              + New
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close personas"
                className="p-1 text-gray-400 hoverable:hover:text-gray-600 dark:hoverable:hover:text-gray-300 rounded"
              >
                ✕
              </button>
            )}
          </div>
        </div>
```

**Important:** Read lines 105–125 of `src/renderer/components/Personas/PersonaPanel.tsx` first to see the exact current markup before making this edit, so you match the structure precisely.

- [ ] **Step 5: Fix template description overflow in PersonaPanel**

In `src/renderer/components/Personas/PersonaPanel.tsx`, find the template row (around lines 144–155). The current inner left div is:

```tsx
                    <div>
                      <div className="font-medium">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400">
                          {t.description}
                        </div>
                      )}
                    </div>
```

Replace with:

```tsx
                    <div className="min-w-0 overflow-hidden">
                      <div className="font-medium truncate">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400 truncate">
                          {t.description}
                        </div>
                      )}
                    </div>
```

This prevents the description from expanding wider than the panel and pushing "Create" off the right edge.

- [ ] **Step 6: Update PipelinePanel Props interface and add close button**

In `src/renderer/components/Pipelines/PipelinePanel.tsx`, replace lines 19–24:

```tsx
interface Props {
  activeTemplateId: string | null;
  onSelect: (template: PipelineTemplate) => void;
}

export function PipelinePanel({ activeTemplateId, onSelect }: Props) {
```

with:

```tsx
interface Props {
  activeTemplateId: string | null;
  onSelect: (template: PipelineTemplate) => void;
  onClose?: () => void;
}

export function PipelinePanel({ activeTemplateId, onSelect, onClose }: Props) {
```

Then add a close button to PipelinePanel's header, analogous to PersonaPanel. Read the PipelinePanel header markup before editing to find the exact `+ New` button placement. Add:

```tsx
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close pipelines"
                className="p-1 text-gray-400 hoverable:hover:text-gray-600 dark:hoverable:hover:text-gray-300 rounded"
              >
                ✕
              </button>
            )}
```

- [ ] **Step 7: Pass onClose from App.tsx to both panels**

In `src/renderer/App.tsx`, find the `<PersonaPanel` usage (around line 422) and add the `onClose` prop:

```tsx
              <PersonaPanel
                activePersonaId={personaId}
                onSelect={setPersonaId}
                onClose={() => togglePanel("personas")}
              />
```

Find the `<PipelinePanel` usage (around line 435) and add:

```tsx
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={(t) => {
                  setSelectedTemplate(t);
                  setMode("pipeline");
                }}
                onClose={() => togglePanel("pipelines")}
              />
```

- [ ] **Step 8: Run all tests**

```bash
npm test -- --reporter=verbose src/renderer/components/Personas/PersonaPanel.test.tsx
```

Expected: all tests PASS including the 3 new close button tests.

- [ ] **Step 9: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx src/renderer/components/Personas/PersonaPanel.test.tsx src/renderer/components/Pipelines/PipelinePanel.tsx src/renderer/App.tsx
git commit -m "fix: add close buttons to Personas and Pipelines panels; fix template description overflow"
```

---

## Self-Review

**Spec coverage check:**

| Issue | Task |
|-------|------|
| Wizard step 3 subtitle misleading | Task 1 ✅ |
| Backend auth warning | Task 2 ✅ |
| Panel width squeezes chat area | Task 3 ✅ |
| "Create" truncated in persona templates | Task 4 (Step 5) ✅ — root cause fixed in Task 3; Step 5 adds belt-and-suspenders truncate |
| No close button in panels | Task 4 ✅ |

**False positives NOT fixed (correct — they were test methodology artifacts):**
- "Send enabled on empty input" — code at `InputBar.tsx:150` already has `disabled={!value.trim() || ...}`. Our test script set the DOM value without triggering React's onChange, so React state still held content.
- "Uninstalled backend selectable" — options have `disabled={!b.available}` in HTML; only forced via DOM hacking in the test.
- "test backend in production" — only registered when `E2E_TEST=1` (manager.ts:47).

**Placeholder scan:** No TBD, no "similar to", no missing code blocks (Step 4 in Task 4 has a read-first guard — that's intentional, not a placeholder).

**Type consistency:** `onClose?: () => void` used consistently across PersonaPanel and PipelinePanel. `viewportLg` used in Task 3 matches the existing state variable name at App.tsx:74.
