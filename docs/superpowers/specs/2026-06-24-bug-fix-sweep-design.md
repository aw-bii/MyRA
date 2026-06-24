# Bug Fix Sweep: IPC, Layout, Animations, and Feature Wiring

## 1. Overview

This spec addresses 9 regression/fresh-install bugs affecting the MyRA desktop app. A root-cause analysis reveals that the majority stem from a single underlying failure (silent IPC errors), with compounding issues in Windows layout, CSS transitions, and wizard error handling.

### Bug Inventory

| # | Issue | Root Cause |
|---|-------|-----------|
| 1 | Sidebar blank / same shade | IPC failure → ConvList empty; bg contrast too subtle |
| 2 | Probe never runs | IPC failure → probe hangs; no timeout fallback |
| 3 | Install doesn't happen | IPC failure + `npm -g` permission issues on Windows |
| 4 | No internet access | Missing proxy env forwarding; no connectivity check |
| 5 | New chat/pipeline buttons | IPC failure → no conversation created on send |
| 6 | Persona prompts not editable | IPC failure → empty persona list |
| 7 | Animations messy | `max-width` transitions not GPU-accelerated; overlap on rapid toggle |
| 8 | Windows layout broken | `min-w-[480px]` overflow; DPI scaling; dvh compatibility |
| 9 | Buttons don't respond | IPC failure → `window.ipc.invoke` throws silently |

## 2. Section 1: IPC / Electron Config

### The Fix Path

1. **Verify `electron.vite.config.ts`** has a preload entry pointing to `src/preload/index.ts` and the main entry to `src/main/index.ts`.
2. **Verify `BrowserWindow` webPreferences** in `src/main/index.ts`:
   - `preload` path resolves to the built preload bundle
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - `sandbox: false` (required for `contextBridge` with IPC)
3. **Add IPC error boundary** — wrap every renderer IPC call in `try/catch`. On failure, set a `window.__ipcError` flag that a diagnostic banner displays at the top of the app in dev mode.
4. **Surface IPC failures** in a visible banner (yellow warning bar, dev-only) so developers immediately see broken channels instead of silent failures.

### Acceptance Criteria

- All `window.ipc.invoke()` channels return data or reject with a clear error
- Diagnostic banner shows in dev when any IPC channel is unreachable
- Preload path works in both `dev` and `build` modes

## 3. Section 2: Wizard — Probe & Install

### Probe

- Add a 10-second timeout to `probeBackend()` calls in `WizardStep1`
- On timeout or error, mark backend as unavailable (`available: false, authenticated: false, loading: false`)
- Show inline error message per-backend if probe failed
- "Next" button remains enabled once all loading states resolve (success or failure)

### Install

- Pass `shell: true` to `spawn()` in `src/main/wizard/install.ts` on Windows so PATH is inherited from the user session
- Before installing on Windows, detect `process.platform === "win32"` and run `npm config get prefix` to verify npm is accessible
- If permission error detected, display specific instructions: "Right-click the app → Run as Administrator" or "Run the following in a terminal opened as Administrator: `npm install -g <package>`"
- Add "Skip" / "Install Later" per-backend option in WizardStep2 — users are not blocked

## 4. Section 3: Internet Access

- Add a startup connectivity check in the main process that pings `https://registry.npmjs.org` (HEAD request, 5s timeout)
- If offline, show a "No internet connection" banner in the toolbar
- Forward `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` env vars from `process.env` to spawned child processes
- Add Settings → Network section with proxy configuration fields stored in SQLite settings

## 5. Section 4: New Chat / Pipeline Buttons

- Change `handleNew` in `App.tsx` to immediately create a conversation via IPC `conv:create` instead of waiting for first message
- Newly created conversation appears in sidebar immediately
- Add `loading` state to "Send" button that disables it and shows a spinner during IPC calls
- Show inline error if conversation creation fails

## 6. Section 5: Persona Prompts

- This is unblocked by Section 1 (IPC fix)
- Additionally: ensure the right panel `max-width` / transform animation renders the panel at full width when toggled (covered in Section 7)

## 7. Section 6: Animations

### Replace `max-width` + `opacity` with `transform: translateX`

- Right panels (Personas, Pipelines, Settings) use a fixed container `div` with:
  - `transform: translateX(100%)` when hidden
  - `transform: translateX(0)` when visible
  - `transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1)` (existing `ease-drawer`)
  - `pointer-events: none` during transition (250ms `pointer-events` lock via `setTimeout` — 50ms buffer beyond the 200ms transition duration)
- Sidebar collapse: replace `transition-[width]` with a grid-based layout where sidebar column is `0fr / 1fr`
- Remove `active:scale-95` from elements that are being transitioned (sidebar toggle button, right panel toggle buttons)

### Mutual Exclusion Guard

- Ensure `showPersonas`, `showPipelines`, `showSettings` are truly mutually exclusive
- Add a state check: toggling one closes any other open right panel

## 8. Section 7: Windows Layout

- **Remove `min-w-[480px]`** from the main content wrapper. Replace with `min-width: 0; overflow-x: hidden` to prevent overflow without constraining minimum width
- **Sidebar:** at viewport < 1024px, collapse sidebar into an overlay panel (fixed position, z-40, with backdrop). At 1024px+, use the inline fixed-width column
- **Right panels:** reduce default width to `w-56` (224px) with `lg:w-64` (256px) only on large screens
- **Replace `min-h-[100dvh]` with `min-h-screen`** (`100vh`) throughout — `dvh` has inconsistent Windows Chromium support
- **Add DPI-aware media query:** `@media (min-resolution: 1.25dppx)` reduces padding on `.btn-sm`, `.btn-md`, sidebar items, and toolbar buttons by 2px on each axis to prevent content from overflowing the viewport at high zoom scales
- **Toolbar:** wrap toolbar buttons in a `overflow-x-auto` scroll container with `flex-shrink-0` on all buttons; no wrapping

## 9. Testing

- **Unit:** `wizard/probe.test.ts`, `wizard/install.test.ts` — update for timeout/shell changes
- **Manual:** Verify each of the 9 issues on a clean Windows install with no AI tools pre-installed
- **Manual:** Verify on Windows at 100%, 125%, 150% DPI scaling
- **Manual:** Verify with no internet connection (airplane mode)
- **E2E:** Add a Playwright test that completes the wizard flow end-to-end and creates a conversation

## 10. Non-Goals

- Not redesigning the wizard UI (same layout, better behavior)
- Not adding new features — only fixing existing functionality
- Not changing the design system tokens or color palette
