# Final Review Fix Report

**Date:** 2026-06-19  
**Branch:** master

---

## Finding 1 — `tests/e2e/global-setup.ts`: stdout pipe deadlock

**Fix applied:** Changed `stdio: "pipe"` to `stdio: ["pipe", "ignore", "pipe"]` in the `spawn` call for Electron. stdin is kept as pipe, stdout is discarded (preventing buffer-fill deadlock from Chromium startup logs), stderr is piped for debugging. The existing `child.stderr?.on(...)` listener is unaffected since stderr remains piped.

**File:** `tests/e2e/global-setup.ts`

---

## Finding 2 — `tests/e2e/global-setup.ts`: no crash detection in waitForCDP

**Fix applied:** Updated `waitForCDP` to accept the `child` process as a second argument. At the top of each polling iteration, checks `child.exitCode !== null` and throws immediately with: `"Electron process exited before CDP became ready (exit code: ${child.exitCode})"`. Updated the call site to pass `child`.

**File:** `tests/e2e/global-setup.ts`

---

## Finding 3 — `src/main/index.ts`: CDP port opened in packaged builds

**Fix applied:** Added `&& !app.isPackaged` to the `E2E_TEST` guard so the entire block (both `app.setPath(...)` and `app.commandLine.appendSwitch(...)`) is skipped in packaged builds. The condition is now:

```ts
if (process.env.E2E_TEST === "1" && !app.isPackaged) {
```

**File:** `src/main/index.ts`

---

## Finding 4 — `src/main/wizard/install.test.ts`: shell:true regression guard incomplete

**Fix applied:** Added the `shell: true` regression guard assertion to the two other spawn-calling test cases: "returns permission-error message when stderr contains EACCES" (exercises opencode backend) and "returns generic error message for non-permission failure" (exercises gemini backend). The guard now covers all three backends exercised by tests.

`INSTALL_COMMANDS` in `install.ts` currently covers `gemini` and `opencode` — both are now guarded.

**File:** `src/main/wizard/install.test.ts`

---

## Finding 5 — `src/main/adapters/manager.test.ts`: no negative assertion for TestAdapter isolation

**Fix applied:** Added a mock for `./test.adapter` (consistent with existing adapter mocks) and added a new test:

```
"does not include TestAdapter when E2E_TEST is not set to '1'"
```

This test asserts `process.env.E2E_TEST !== "1"`, calls `listAvailable()`, and asserts that no adapter with `id === "test"` is present. If the isolation gate in `manager.ts` were accidentally removed or inverted, this test would fail.

**File:** `src/main/adapters/manager.test.ts`

---

## Test Results

### `npm test -- src/main/wizard/install.test.ts`

```
✓ src/main/wizard/install.test.ts (4 tests) 44ms
Test Files  1 passed (1)
      Tests  4 passed (4)
```

### `npm test -- src/main/adapters/manager.test.ts`

```
✓ src/main/adapters/manager.test.ts (5 tests) 3ms
Test Files  1 passed (1)
      Tests  5 passed (5)
```

---

## Deviations from fix instructions

- **Finding 5:** The instructions suggested using `beforeAll` for the E2E_TEST check. The implemented test uses an inline `expect(process.env.E2E_TEST).not.toBe("1")` guard instead, which is equivalent and more readable. `beforeAll` was imported but ultimately not needed.

---

**Status:** DONE
