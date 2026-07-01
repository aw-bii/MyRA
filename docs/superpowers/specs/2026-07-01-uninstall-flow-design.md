# Uninstall Flow — Design Spec

Date: 2026-07-01

## Problem

MyRA has no way to fully remove itself and its data. Users who want to start
fresh, or remove the app entirely, must manually find and delete the app's
data directory and run the OS uninstaller (or drag to Trash) themselves.

## Goal

A single "Uninstall MyRA" action, reachable from Settings, that:

1. Permanently deletes all app data (SQLite database — conversations,
   personas, cron jobs, settings, encrypted API keys — plus the
   `attachments/` and `plugins/` folders under `userData`).
2. Removes the installed application binaries via the platform's own
   uninstall mechanism, so the user must reinstall MyRA to run it again.

This is a single combined action, not two separate "wipe data" /
"uninstall binaries" buttons — "uninstall" means both together.

## Non-goals

- No partial/selective data deletion (e.g. "delete conversations but keep
  API keys"). Existing per-item delete (conversations, keys) already covers
  that.
- No Linux support — the project only packages for Windows (NSIS) and macOS
  (DMG); see `package.json` `build` config.
- No "wipe data and keep the app installed" mode. (Considered during
  design; rejected in favor of one combined action to keep the Danger Zone
  simple.)

## Architecture

### IPC

Add to `src/shared/ipc.ts`:

- `APP_UNINSTALL: "app:uninstall"` — no payload, `Promise<void>` response
  (in practice the call never resolves on success, since the process exits
  itself; it only rejects on failure).

### Main process handler (`src/main/ipc.ts`)

Registered next to the existing `APP_RELAUNCH` handler. Order of operations:

1. **Capability check (must pass before any destructive step runs):**
   - `!app.isPackaged` → throw `"Uninstall isn't available in development mode."`
   - **Windows:** scan `path.dirname(process.execPath)` (the install
     directory) for a file matching `/^uninstall.*\.exe$/i` via
     `readdirSync`. Not found → throw
     `"Could not find the Windows uninstaller."`
     (We scan by pattern rather than hardcoding `Uninstall MyRA.exe`,
     since electron-builder names the uninstaller after `productName`
     while `app.getName()` reads `package.json`'s `name` field — these can
     differ in casing, and scanning avoids that fragility.)
   - **macOS:** walk up the directory ancestors of `process.execPath` to
     find the first one ending in `.app`. Not found → throw
     `"Could not locate the app bundle."`
   - **Any other platform:** throw
     `"Uninstall is not supported on this platform."`
2. **Wipe app data** (only reached if step 1 passed):
   - `closeDb()` (from `store/db.ts`) — releases the SQLite file handle;
     required on Windows before the file can be deleted.
   - `fs.rmSync(app.getPath("userData"), { recursive: true, force: true })`
3. **Trigger the platform uninstaller:**
   - **Windows:** `spawn(uninstallerPath, [], { detached: true, stdio: "ignore" })`
     — no silent flag, so the native NSIS uninstaller window opens and the
     user goes through its normal confirmation UI. Then `app.exit(0)`
     immediately (the running process must exit before the uninstaller can
     remove its own files).
   - **macOS:** `await shell.trashItem(appBundlePath)`, then `app.exit(0)`.

If step 1 fails, nothing in step 2 or 3 runs — a failed uninstall attempt is
always a no-op with respect to user data.

### Renderer

- `src/renderer/ipc/app.ts`: add `uninstallApp()`, following the existing
  `relaunchApp()` pattern (`ipcInvoke(IPC.APP_UNINSTALL)`).
- New component `src/renderer/components/Settings/DangerZone.tsx`, rendered
  at the bottom of `SettingsPanel.tsx` below the existing "Re-run Setup
  Wizard" button. Visually separated with the existing danger styling
  (`text-danger` / `border-danger-muted` tokens already used for API key
  removal).
  - Contains a single "Uninstall MyRA" button.
  - Clicking it opens a confirmation modal (same dialog pattern as
    `SettingsModal`: `role="dialog"`, `aria-modal`, Escape/backdrop to
    close).
  - Modal copy: explains that this permanently deletes all conversations,
    personas, cron jobs, API keys, and attachments, then uninstalls MyRA,
    and that reinstalling is required to use it again.
  - Confirm button stays disabled until the user types `DELETE` into a text
    field (matches the destructive-action pattern already used elsewhere
    for irreversible actions of this severity — stronger than the
    single-click confirm used for deleting one conversation).
  - On confirm: calls `uninstallApp()`. If it rejects, show the error
    message inline in the modal (nothing was deleted) and let the user
    close it. There is no success UI to render — on success the app process
    exits.

## Error handling

All capability failures (dev mode, missing Windows uninstaller,
unresolvable macOS bundle path, unsupported platform) are thrown before
`closeDb()`/`rmSync` run, so a failed attempt never leaves the user with a
half-deleted app. Errors surface to the renderer as a rejected IPC call and
are displayed inline in the confirmation modal.

## Testing

- **Main handler (`src/main/ipc.test.ts` or a new colocated test):** mock
  `app.isPackaged`, `fs.readdirSync`/`existsSync`, `child_process.spawn`,
  and `shell.trashItem` to cover:
  - Dev mode → rejects, no `closeDb`/`rmSync` called.
  - Windows, uninstaller present → `closeDb` → `rmSync` → `spawn` →
    `app.exit(0)`, in that order.
  - Windows, uninstaller missing → rejects, no deletion.
  - macOS, bundle path resolvable → `closeDb` → `rmSync` →
    `shell.trashItem` → `app.exit(0)`.
  - macOS, bundle path unresolvable → rejects, no deletion.
- **Renderer (`DangerZone.test.tsx`):** confirm button disabled until
  `DELETE` is typed exactly; calls `uninstallApp()` on confirm; displays the
  rejection message on failure.
