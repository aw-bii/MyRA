# Colorize — Design Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all hardcoded Tailwind color classes into CSS custom properties backed by semantic Tailwind tokens. After this plan, changing the accent color requires editing one CSS rule, not 15+ files.

**Architecture:** Two-phase approach. Phase 1: Define CSS custom properties in `index.css` and register semantic token names in `tailwind.config.ts`. Phase 2: Replace hardcoded Tailwind color classes with semantic tokens across all components. No color values change — this is a structural refactor. Dark-mode variants collapse from two classes (`bg-gray-100 dark:bg-gray-800`) into one (`bg-bubble`) because the CSS var flips on `.dark`.

**Correction to audit finding:** DESIGN.md uses standard Tailwind-compatible hex values (blue-600, gray-100, etc.) — not warm neutrals. The "warm/cool mismatch" is not present; the refactor here is structural (tokens), not a palette change.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, CSS custom properties

## Global Constraints

- `npm test` must pass after every task
- `npm run build` must succeed after every task
- No visual changes — pixel-identical output before and after
- Tailwind class names use `rgb(var(--c-X) / <alpha-value>)` pattern for opacity modifier support (`bg-primary/50`)
- Do not rename or restructure files

---

## Token Naming Convention

| Semantic name | Light value | Dark value | Tailwind equivalent |
|---|---|---|---|
| `primary` | `#2563eb` | `#2563eb` | `blue-600` |
| `primary-dark` | `#1d4ed8` | `#1d4ed8` | `blue-700` |
| `primary-ghost` | `#dbeafe` | `#1e3a8a` | `blue-100` / `blue-900` |
| `on-primary` | `#ffffff` | `#ffffff` | `white` |
| `danger` | `#ef4444` | `#ef4444` | `red-500` |
| `danger-dark` | `#dc2626` | `#dc2626` | `red-600` |
| `danger-subtle` | `#fee2e2` | `#7f1d1d` | `red-100` / `red-900` |
| `surface` | `#ffffff` | `#111827` | `white` / `gray-900` |
| `surface-subtle` | `#f9fafb` | `#030712` | `gray-50` / `gray-950` |
| `bubble` | `#f3f4f6` | `#1f2937` | `gray-100` / `gray-800` |
| `bubble-strong` | `#e5e7eb` | `#374151` | `gray-200` / `gray-700` |
| `border` | `#e5e7eb` | `#374151` | `gray-200` / `gray-700` |
| `border-strong` | `#d1d5db` | `#4b5563` | `gray-300` / `gray-600` |
| `text-base` | `#111827` | `#f3f4f6` | `gray-900` / `gray-100` |
| `text-muted` | `#9ca3af` | `#6b7280` | `gray-400` / `gray-500` |

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/index.css` | Add `:root` + `.dark` CSS custom properties |
| `tailwind.config.ts` | Add `colors` extension with semantic token names |
| `src/renderer/App.tsx` | Replace all hardcoded color classes |
| `src/renderer/components/Chat/MessageBubble.tsx` | Replace hardcoded colors |
| `src/renderer/components/Chat/InputBar.tsx` | Replace hardcoded colors |
| `src/renderer/components/Chat/ChatView.tsx` | Replace hardcoded colors |
| `src/renderer/components/Sidebar/ConvItem.tsx` | Replace hardcoded colors |
| `src/renderer/components/Sidebar/ConvList.tsx` | Replace hardcoded colors |
| `src/renderer/components/Personas/PersonaPanel.tsx` | Replace hardcoded colors |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Replace hardcoded colors |
| `src/renderer/components/SecurityDialog/SecurityDialog.tsx` | Hardcoded severity colors — keep as-is (semantic: yellow=caution, red=critical) |

---

## Task 1: Define CSS Custom Properties + Tailwind Tokens

**Files:**
- Modify: `src/renderer/index.css`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: semantic Tailwind utility classes (`bg-primary`, `bg-bubble`, `text-muted`, etc.) backed by CSS vars that flip between `:root` and `.dark`

- [ ] **Step 1: Add CSS custom properties to index.css**

In `src/renderer/index.css`, add a `:root` block and `.dark` override **before** the `@tailwind base` line:

```css
/* Design tokens — values from DESIGN.md */
:root {
  --c-primary: 37 99 235;           /* blue-600  #2563eb */
  --c-primary-dark: 29 78 216;      /* blue-700  #1d4ed8 */
  --c-primary-ghost: 219 234 254;   /* blue-100  #dbeafe */
  --c-on-primary: 255 255 255;      /* white */
  --c-danger: 239 68 68;            /* red-500   #ef4444 */
  --c-danger-dark: 220 38 38;       /* red-600   #dc2626 */
  --c-danger-subtle: 254 226 226;   /* red-100   #fee2e2 */
  --c-surface: 255 255 255;         /* white */
  --c-surface-subtle: 249 250 251;  /* gray-50   #f9fafb */
  --c-bubble: 243 244 246;          /* gray-100  #f3f4f6 */
  --c-bubble-strong: 229 231 235;   /* gray-200  #e5e7eb */
  --c-border: 229 231 235;          /* gray-200  #e5e7eb */
  --c-border-strong: 209 213 219;   /* gray-300  #d1d5db */
  --c-text-base: 17 24 39;          /* gray-900  #111827 */
  --c-text-muted: 156 163 175;      /* gray-400  #9ca3af */
}
.dark {
  --c-primary-ghost: 30 58 138;     /* blue-900  #1e3a8a */
  --c-danger-subtle: 127 29 29;     /* red-900   #7f1d1d */
  --c-surface: 17 24 39;            /* gray-900  #111827 */
  --c-surface-subtle: 3 7 18;       /* gray-950  #030712 */
  --c-bubble: 31 41 55;             /* gray-800  #1f2937 */
  --c-bubble-strong: 55 65 81;      /* gray-700  #374151 */
  --c-border: 55 65 81;             /* gray-700  #374151 */
  --c-border-strong: 75 85 99;      /* gray-600  #4b5563 */
  --c-text-base: 243 244 246;       /* gray-100  #f3f4f6 */
  --c-text-muted: 107 114 128;      /* gray-500  #6b7280 */
}

@tailwind base;
/* ... rest of existing file unchanged ... */
```

Note: CSS var values are space-separated RGB channels (not hex), so Tailwind's `rgb(var(--c-X) / <alpha-value>)` pattern supports opacity modifiers.

- [ ] **Step 2: Register semantic tokens in tailwind.config.ts**

In `tailwind.config.ts`, inside `theme.extend`, add a `colors` block:

```ts
theme: {
  extend: {
    colors: {
      primary: "rgb(var(--c-primary) / <alpha-value>)",
      "primary-dark": "rgb(var(--c-primary-dark) / <alpha-value>)",
      "primary-ghost": "rgb(var(--c-primary-ghost) / <alpha-value>)",
      "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
      danger: "rgb(var(--c-danger) / <alpha-value>)",
      "danger-dark": "rgb(var(--c-danger-dark) / <alpha-value>)",
      "danger-subtle": "rgb(var(--c-danger-subtle) / <alpha-value>)",
      surface: "rgb(var(--c-surface) / <alpha-value>)",
      "surface-subtle": "rgb(var(--c-surface-subtle) / <alpha-value>)",
      bubble: "rgb(var(--c-bubble) / <alpha-value>)",
      "bubble-strong": "rgb(var(--c-bubble-strong) / <alpha-value>)",
      border: "rgb(var(--c-border) / <alpha-value>)",
      "border-strong": "rgb(var(--c-border-strong) / <alpha-value>)",
      "text-base": "rgb(var(--c-text-base) / <alpha-value>)",
      "text-muted": "rgb(var(--c-text-muted) / <alpha-value>)",
    },
    // ... existing transitionTimingFunction, keyframes, animation, typography unchanged
  },
},
```

Also update the hardcoded hex values in the `typography` plugin config:

```ts
typography: {
  DEFAULT: {
    css: {
      // ...
      code: {
        backgroundColor: "rgb(var(--c-bubble))",  // was: "rgb(243 244 246)"
        // ... rest unchanged
      },
      // ...
    },
  },
  invert: {
    css: {
      code: {
        backgroundColor: "rgb(var(--c-bubble))",  // was: "rgb(31 41 55)"
      },
    },
  },
},
```

- [ ] **Step 3: Run build to verify tokens are recognized**

```bash
npm run build
```
Expected: clean. If Tailwind doesn't recognize `<alpha-value>` syntax, check Tailwind version with `npx tailwindcss --version` — must be ≥ 3.0.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.css tailwind.config.ts
git commit -m "feat: define CSS custom property design tokens and register semantic Tailwind colors"
```

---

## Task 2: Replace Colors in Core Shell (App.tsx)

**Files:**
- Modify: `src/renderer/App.tsx`

**Class substitution map for this file:**

| Old class(es) | New class |
|---|---|
| `bg-blue-600` | `bg-primary` |
| `hoverable:hover:bg-blue-700` | `hoverable:hover:bg-primary-dark` |
| `bg-blue-100 dark:bg-blue-900` | `bg-primary-ghost` |
| `text-blue-100` | `text-on-primary/70` |
| `bg-yellow-100 dark:bg-yellow-900` | keep as-is (connectivity warning — semantic yellow) |
| `border-yellow-200 dark:border-yellow-700` | keep as-is |
| `text-yellow-800 dark:text-yellow-200` | keep as-is |
| `border-gray-200 dark:border-gray-700` | `border-border` |
| `bg-gray-100 dark:bg-gray-800` | `bg-bubble` |
| `hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800` | `hoverable:hover:bg-bubble` |
| `bg-gray-200 dark:bg-gray-700` | `bg-bubble-strong` |
| `text-gray-400` or `text-gray-500` | `text-text-muted` |
| `text-gray-500 dark:text-gray-400` | `text-text-muted` |
| `text-white` | `text-on-primary` |
| `bg-white dark:bg-gray-900` | `bg-surface` |
| `text-gray-900 dark:text-gray-100` | `text-text-base` |
| `w-px h-4 bg-gray-200 dark:bg-gray-700` | `w-px h-4 bg-border` |

- [ ] **Step 1: Do the replacements in App.tsx**

Work section by section through the file. Key locations:

**Offline banner** (line ~256): yellow colors are semantic — keep.

**Toolbar nav border** (line ~263):
```tsx
// Before: border-gray-200 dark:border-gray-700
// After:  border-border
```

**Mode toggle active state** (lines ~281, ~288):
```tsx
// Before: bg-blue-600 text-white
// After:  bg-primary text-on-primary
```

**Divider lines** in toolbar:
```tsx
// Before: bg-gray-200 dark:bg-gray-700
// After:  bg-border
```

**Active tool buttons** (Search, Cron, MCP, etc.):
```tsx
// Before: bg-blue-100 dark:bg-blue-900
// After:  bg-primary-ghost
```

**Panel borders**:
```tsx
// Before: border-gray-200 dark:border-gray-700
// After:  border-border
```

**Welcome screen CTA button**:
```tsx
// Before: bg-blue-600 text-white hoverable:hover:bg-blue-700
// After:  bg-primary text-on-primary hoverable:hover:bg-primary-dark
```

**Welcome text**:
```tsx
// Before: text-gray-500 dark:text-gray-400
// After:  text-text-muted
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "refactor: replace hardcoded colors with semantic tokens in App.tsx"
```

---

## Task 3: Replace Colors in Chat Components

**Files:**
- Modify: `src/renderer/components/Chat/MessageBubble.tsx`
- Modify: `src/renderer/components/Chat/InputBar.tsx`
- Modify: `src/renderer/components/Chat/ChatView.tsx`
- Modify: `src/renderer/components/Chat/AttachmentChip.tsx`

**Substitutions:**

**MessageBubble.tsx:**
```tsx
// User bubble — Before:
className={`... bg-blue-600 text-white ...`}

// User bubble — After:
className={`... bg-primary text-on-primary ...`}

// Assistant bubble — Before:
"bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"

// Assistant bubble — After:
"bg-bubble text-text-base"

// User timestamp — Before: text-blue-100
// After: text-on-primary/70

// Assistant timestamp — Before: text-gray-400 dark:text-gray-500
// After: text-text-muted
```

**InputBar.tsx:**
```tsx
// Border — Before: border-gray-200 dark:border-gray-700
// After: border-border

// Error chip — Before: bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 border-red-200 dark:border-red-700
// After: bg-danger-subtle text-danger border-danger-subtle (adjust opacity as needed)

// Textarea — Before: border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-blue-500
// After: border-border-strong bg-surface focus:ring-primary

// Send button — Before: bg-blue-600 hoverable:hover:bg-blue-700
// After: bg-primary hoverable:hover:bg-primary-dark

// Stop button — Before: bg-red-500 hoverable:hover:bg-red-600
// After: bg-danger hoverable:hover:bg-danger-dark
```

**ChatView.tsx:**
```tsx
// Tab active — Before: border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400
// After: border-primary text-primary

// Border — Before: border-gray-200 dark:border-gray-700
// After: border-border
```

**AttachmentChip.tsx:**
```tsx
// Before: bg-gray-100 dark:bg-gray-800
// After: bg-bubble
```

- [ ] **Step 1: Make all substitutions**

Apply each change above to the respective files.

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Chat/
git commit -m "refactor: replace hardcoded colors with semantic tokens in Chat components"
```

---

## Task 4: Replace Colors in Sidebar Components

**Files:**
- Modify: `src/renderer/components/Sidebar/ConvItem.tsx`
- Modify: `src/renderer/components/Sidebar/ConvList.tsx`

**Substitutions:**

**ConvItem.tsx:**
```tsx
// Active item — Before: bg-gray-200 dark:bg-gray-700
// After: bg-bubble-strong

// Hover — Before: hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800
// After: hoverable:hover:bg-bubble

// Pipeline icon — Before: text-blue-500
// After: text-primary

// Delete hover — keep text-red-500 (semantic danger color — acceptable exception)

// Edit input border — Before: border-blue-500 dark:border-blue-400
// After: border-primary
```

**ConvList.tsx:**
```tsx
// Search input — Before: border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-blue-500
// After: border-border-strong bg-surface focus:ring-primary
```

- [ ] **Step 1: Make substitutions**

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/
git commit -m "refactor: replace hardcoded colors with semantic tokens in Sidebar components"
```

---

## Task 5: Replace Colors in PersonaPanel

**Files:**
- Modify: `src/renderer/components/Personas/PersonaPanel.tsx`

**Substitutions:**
```tsx
// Active persona — Before: bg-blue-100 dark:bg-blue-900
// After: bg-primary-ghost

// Hover — Before: hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800
// After: hoverable:hover:bg-bubble

// Template "Create" label — Before: text-blue-500
// After: text-primary

// Template form border — Before: border-gray-200 dark:border-gray-700
// After: border-border

// Form inputs — Before: dark:bg-gray-800 dark:border-gray-600 focus:ring-blue-500
// After: bg-surface border-border-strong focus:ring-primary (remove dark: variants — CSS vars handle dark mode)

// "Create Persona" button — Before: bg-blue-600 hoverable:hover:bg-blue-700
// After: bg-primary hoverable:hover:bg-primary-dark

// "Cancel" button — Before: border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-50 dark:hoverable:hover:bg-gray-800
// After: border-border hoverable:hover:bg-bubble

// Variable required asterisk — Before: text-red-500  (semantic — keep as-is)

// Separator — Before: border-gray-200 dark:border-gray-700
// After: border-border

// Default label — Before: text-blue-500
// After: text-primary

// Delete buttons — text-red-400/text-red-500/text-red-600 → keep as-is (semantic danger)

// Section header — Before: text-gray-400
// After: text-text-muted

// Empty state — Before: text-gray-400 dark:text-gray-500
// After: text-text-muted
```

- [ ] **Step 1: Make substitutions**

- [ ] **Step 2: Run build and tests**

```bash
npm run build && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Personas/PersonaPanel.tsx
git commit -m "refactor: replace hardcoded colors with semantic tokens in PersonaPanel"
```

---

## Task 6: Replace Colors in SettingsPanel

**Files:**
- Modify: `src/renderer/components/Settings/SettingsPanel.tsx`

**Substitutions:**
```tsx
// Input/select borders — Before: border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-blue-500
// After: border-border-strong bg-surface focus:ring-primary

// Panel borders — Before: border-gray-200 dark:border-gray-700
// After: border-border

// Muted text — Before: text-gray-500 dark:text-gray-400 (or text-gray-400)
// After: text-text-muted

// Primary action buttons — Before: bg-blue-600 hoverable:hover:bg-blue-700
// After: bg-primary hoverable:hover:bg-primary-dark

// Danger actions — Before: bg-red-500 hoverable:hover:bg-red-600 or text-red-500
// After: bg-danger hoverable:hover:bg-danger-dark or text-danger
```

Read the full file before making changes — read `src/renderer/components/Settings/SettingsPanel.tsx` in full, then apply substitutions.

- [ ] **Step 1: Make substitutions**

- [ ] **Step 2: Run build and tests**

```bash
npm run build && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Settings/SettingsPanel.tsx
git commit -m "refactor: replace hardcoded colors with semantic tokens in SettingsPanel"
```

---

## Task 7: Replace Colors in Remaining Components

**Files:**
- Scan for remaining hardcoded color classes across all renderer components

- [ ] **Step 1: Find remaining hardcoded colors**

```bash
grep -rn "bg-blue-\|text-blue-\|bg-red-\|text-red-\|bg-gray-\|text-gray-\|bg-white\|dark:bg-" src/renderer/components/ --include="*.tsx" | grep -v "SecurityDialog\|yellow\|orange\|green\|prose"
```

Review the output. Apply the same substitution table from Tasks 2-6 to any remaining hits.

Note: `SecurityDialog` severity colors (yellow/orange/red scales) are intentionally kept hardcoded — they are semantic alerts with distinct colors by design.

- [ ] **Step 2: Apply remaining substitutions**

For each file returned by the grep, apply the same token substitution table.

- [ ] **Step 3: Run full build and tests**

```bash
npm run build && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/
git commit -m "refactor: replace remaining hardcoded colors with semantic tokens across renderer"
```

---

## Task 8: Update focus:ring Classes to Use Token

**Files:**
- All files with `focus:ring-blue-500` or `focus:ring-1 focus:ring-blue-500`

- [ ] **Step 1: Find all focus ring classes**

```bash
grep -rn "focus:ring-blue-500\|focus:ring-blue-400" src/renderer/ --include="*.tsx"
```

- [ ] **Step 2: Replace with semantic token**

```tsx
// Before: focus:ring-blue-500
// After:  focus:ring-primary
```

Apply to every file in the grep output.

- [ ] **Step 3: Run build and tests**

```bash
npm run build && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/
git commit -m "refactor: replace focus:ring-blue-500 with focus:ring-primary across all components"
```

---

## Self-Review

**Spec coverage:**
- [x] P0: Hardcoded Tailwind colors in 15+ files — Tasks 2-7
- [x] P0: No CSS custom properties for theming — Task 1
- [x] P0: Design system color mismatch — clarified in plan header: DESIGN.md uses Tailwind-compatible values; refactor is structural (tokens), not a palette change
- [x] P1: Focus rings use hardcoded `focus:ring-blue-500` — Task 8
- [x] P1: Inconsistent dark mode colors — resolved when dark: variants are removed in favor of CSS vars
- [ ] P1: SecurityDialog severity colors hardcoded — intentionally kept as-is (semantic: yellow/orange/red have distinct meaning in security context); noted in Task 7 exception

**Placeholder scan:** Task 2 (App.tsx) specifies "work section by section" — this instructs HOW to proceed, not defers WHAT to do. Each substitution is specified with before/after. Not a placeholder.

**Type consistency:** No new types introduced. All class names are standard Tailwind utility strings.

**Visual regression risk:** Minimal. The only dark-mode behavior change is that components which previously had no `dark:` variant (and were unintentionally missing dark support) now correctly invert. Scan grep output in Task 7 for any surprise hits in components not in the file map.
