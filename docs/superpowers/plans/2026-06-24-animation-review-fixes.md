# Animation Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four issues flagged by the animation review: remove the high-frequency welcome screen entrance animation, gate dialog animations behind `motion-safe:`, drop the non-GPU `color` property from a transition list, and fix ungated hover motion + incomplete reduced-motion handling on the landing page.

**Architecture:** All changes are isolated className string edits and one small HTML/CSS block addition. No new components, hooks, or abstractions. Three component changes get Vitest + RTL class-presence assertions; the landing page fix is verified visually.

**Tech Stack:** React 18, Vitest, `@testing-library/react`, Tailwind CSS v3, plain HTML/CSS.

## Global Constraints

- Tailwind class changes only — no new inline `style` attributes on existing components
- `motion-safe:` Tailwind variant = `@media (prefers-reduced-motion: no-preference)` — animation fires only when user has NOT opted out
- Do not change any logic, layout, or non-animation styling
- `npm test -- --run` must pass after every task; `npm run lint` must pass after the final task
- Commit after each task — do not batch

---

### Task 1: Remove welcome screen entrance animation

**Files:**
- Modify: `src/renderer/App.tsx` (line 274)

**Interfaces:**
- Produces: welcome screen `<div>` has no `animate-*` class

The welcome screen appears every time the user clicks "New conversation", deletes an active conversation, or opens the app without a prior session. For an active user this fires tens of times per day — per the frequency table that tier is "remove or drastically reduce." Delete the animation entirely; the content appearing is not an event worth marking.

- [ ] **Step 1: Remove the animation class**

In `src/renderer/App.tsx`, find the welcome screen div (currently line 274):

```tsx
<div className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-fade-in-up">
```

Change to:

```tsx
<div className="flex-1 flex flex-col items-center justify-center text-center px-8">
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npm test -- --run
```

Expected output: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "fix(animation): remove welcome screen entrance animation — fires on every new conversation"
```

---

### Task 2: Gate dialog entrance animations behind motion-safe

**Files:**
- Modify: `src/renderer/components/SecurityDialog/SecurityDialog.tsx` (line 54)
- Modify: `src/renderer/components/Wizard/SetupWizard.tsx` (line 47)
- Modify: `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx`

**Interfaces:**
- Produces: Both dialog cards render with `motion-safe:animate-scale-in` as an exact class token; bare `animate-scale-in` is absent

`motion-safe:animate-scale-in` compiles to:
```css
@media (prefers-reduced-motion: no-preference) {
  .motion-safe\:animate-scale-in { animation: scale-in 220ms cubic-bezier(0.23, 1, 0.32, 1) forwards; }
}
```
Users who've set "reduce motion" in their OS see the dialog appear without the scale + translate movement.

- [ ] **Step 1: Write failing test in SecurityDialog.test.tsx**

Add this `it` block inside the existing `describe("SecurityDialog", ...)` in `src/renderer/components/SecurityDialog/SecurityDialog.test.tsx`:

```tsx
it("uses motion-safe:animate-scale-in class, not bare animate-scale-in", () => {
  const { container } = render(
    <SecurityDialog
      event={{
        type: "injection_detected",
        severity: "high",
        message: "Injection detected",
        detail: "Found pattern X",
        source: "claude",
      }}
      onRespond={vi.fn()}
    />,
  );
  // The card is the direct child of the role="dialog" wrapper
  const card = container.querySelector('[role="dialog"] > div') as HTMLElement;
  expect(card.classList.contains("motion-safe:animate-scale-in")).toBe(true);
  expect(card.classList.contains("animate-scale-in")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run SecurityDialog
```

Expected: FAIL — `motion-safe:animate-scale-in` not present (currently bare `animate-scale-in`), so `classList.contains("motion-safe:animate-scale-in")` returns false.

- [ ] **Step 3: Apply the fix to SecurityDialog.tsx**

In `src/renderer/components/SecurityDialog/SecurityDialog.tsx`, find line 54:

```tsx
        className={`max-w-md w-full mx-4 rounded-lg border p-4 shadow-lg animate-scale-in ${severityClass}`}
```

Change to:

```tsx
        className={`max-w-md w-full mx-4 rounded-lg border p-4 shadow-lg motion-safe:animate-scale-in ${severityClass}`}
```

- [ ] **Step 4: Apply the fix to SetupWizard.tsx**

In `src/renderer/components/Wizard/SetupWizard.tsx`, find line 47:

```tsx
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 animate-scale-in">
```

Change to:

```tsx
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 motion-safe:animate-scale-in">
```

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass including the new SecurityDialog test.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SecurityDialog/SecurityDialog.tsx src/renderer/components/Wizard/SetupWizard.tsx src/renderer/components/SecurityDialog/SecurityDialog.test.tsx
git commit -m "fix(a11y): gate dialog entrance animations behind motion-safe — respects prefers-reduced-motion"
```

---

### Task 3: Drop `color` from ConvItem delete button transition list

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx` (line 82)

**Interfaces:**
- Produces: delete button transitions only `opacity` and `transform` — both GPU-compositor properties

`color` is paint-only (triggers paint step, not compositor). The hover color change (`text-gray-400` → `text-red-500`) is already communicated by `hoverable:hover:text-red-500` and snaps acceptably fast at this element size. The transition added no perceptible benefit on a 16px icon and is non-free on the GPU path.

- [ ] **Step 1: Apply the fix**

In `src/renderer/components/Sidebar/ConvItem.tsx`, find line 82:

```tsx
        className="opacity-0 hoverable:group-hover:opacity-100 p-1 text-gray-400 hoverable:hover:text-red-500 transition-[opacity,color,transform] duration-100 ease-press active:scale-95"
```

Change to:

```tsx
        className="opacity-0 hoverable:group-hover:opacity-100 p-1 text-gray-400 hoverable:hover:text-red-500 transition-[opacity,transform] duration-100 ease-press active:scale-95"
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/ConvItem.tsx
git commit -m "fix(perf): remove color from ConvItem delete button transition — GPU-only opacity and transform suffice"
```

---

### Task 4: Fix landing page hover gating and reduced-motion

**Files:**
- Modify: `docs/landing.html`

**Interfaces:**
- Produces: `.btn-p:hover .btn-icon` transform fires only on pointer devices; reduced-motion block prevents icon snapping to a displaced position

No automated tests — this is a static HTML file. Verify with browser DevTools as described below.

The two problems:

1. `.btn-p:hover .btn-icon { transform: translate(1px, -1px) scale(1.08); }` is ungated — on touch devices, `:hover` fires on tap and leaves the icon shifted until the next tap elsewhere.

2. The existing `prefers-reduced-motion` block sets `transition: none` on buttons but does NOT reset the hover `transform`. A reduced-motion user hovering the button will see the icon snap (instantly) to a displaced position — still a spatial change, just without the easing.

- [ ] **Step 1: Gate the icon hover transform**

In `docs/landing.html`, find the existing ungated rule (search for `.btn-p:hover .btn-icon`):

```css
.btn-p:hover .btn-icon { transform: translate(1px, -1px) scale(1.08); }
```

Replace it with:

```css
@media (hover: hover) and (pointer: fine) {
  .btn-p:hover .btn-icon { transform: translate(1px, -1px) scale(1.08); }
}
```

- [ ] **Step 2: Add icon transform reset to the reduced-motion block**

Find the existing `@media (prefers-reduced-motion: reduce)` block:

```css
@media (prefers-reduced-motion: reduce) {
  .rv { opacity: 1; transform: none; filter: none; transition: none; }
  .btn-p, .btn-s, .btn-nav, .btn-icon { transition: none; }
}
```

Add one rule to the end of that block:

```css
@media (prefers-reduced-motion: reduce) {
  .rv { opacity: 1; transform: none; filter: none; transition: none; }
  .btn-p, .btn-s, .btn-nav, .btn-icon { transition: none; }
  .btn-p:hover .btn-icon { transform: none; }
}
```

- [ ] **Step 3: Verify — reduced-motion path**

Open `docs/landing.html` in Chrome. Open DevTools → More tools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Hover the Download button. Confirm the arrow icon does not move.

- [ ] **Step 4: Verify — touch path**

In the same DevTools, switch to a mobile device emulator (e.g., iPhone 12). Tap the Download button. Confirm the icon does not remain in a shifted position after the tap.

- [ ] **Step 5: Commit**

```bash
git add docs/landing.html
git commit -m "fix(a11y): gate landing icon hover behind pointer media query; reset transform in reduced-motion block"
```

---

### Task 5: Final lint gate

**Files:**
- No new changes — validation only

- [ ] **Step 1: Run ESLint across the full project**

```bash
npm run lint
```

Expected: zero errors. If any appear, they will be in one of the four modified files — read the output, fix the file, and re-run.

- [ ] **Step 2: Run the full Vitest suite one final time**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 3: If everything is green, no further commit is needed**

The four task commits are already on the branch. This step is a gate, not a code change.

---

## Self-Review

**Spec coverage (review findings → tasks):**

| Review finding | Task |
|---|---|
| `color` in ConvItem transition list (paint-only, easy GPU fix) | Task 3 |
| Welcome screen `animate-fade-in-up` fires on high-frequency surface | Task 1 |
| No `prefers-reduced-motion` on `animate-fade-in-up` + `animate-scale-in` | Task 2 |
| Landing `.btn-p:hover .btn-icon` ungated hover transform | Task 4 |
| Landing reduced-motion block misses icon hover transform reset | Task 4 |

All five findings covered. ✅

**Placeholder scan:** No "TBD", "TODO", "similar to Task N", or undeclared types. All code blocks are complete. ✅

**Type consistency:** No cross-task type handoffs — each task is self-contained. ✅
