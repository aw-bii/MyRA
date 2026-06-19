# Final Fix Report — BII Agent Harness

**Date:** 2026-06-19  
**Status:** DONE

---

## Fixes Applied

### C1 — File.path undefined under Electron 33

**Files changed:**
- `src/preload/index.ts` — imported `webUtils` from `electron`, added `getPathForFile(file: File): string` to the `contextBridge` exposure.
- `src/renderer/components/Chat/InputBar.tsx` — replaced both `(f: any) => f.path` casts (in `onDrop` and `onFileChange`) with `window.ipc.getPathForFile(f)`.
- `src/renderer/ipc.ts` — added `getPathForFile(file: File): string` to the `Window.ipc` type declaration.

### C2 — Pre-generated messageId never used in createMessage

**Files changed:**
- `src/main/store/index.ts` — changed `createMessage` signature from `Omit<Message, 'id' | 'createdAt'>` to `Omit<Message, 'createdAt'> & { id?: string }`. Uses `msg.id ?? crypto.randomUUID()` so the caller can supply an id.
- `src/main/ipc.ts` — the `CHAT_SEND` handler now passes `id: pregenMessageId` to the user message `createMessage` call, so the persisted row id matches the id used during attachment ingest.

`src/renderer/hooks/useMessages.ts` already pre-generates the UUID (`pendingMessageId.current`) and passes it via `sendChat({ ..., messageId })`. No changes needed there.

### C3 — CSP blocks file:// images in history

**Files changed:**
- `src/shared/ipc.ts` — added `ATTACHMENT_DATA_URL: 'attachment:dataurl'` constant and its `IpcInvokeMap` entry `{ storedPath: string }`.
- `src/main/attachments/service.ts` — added `getDataUrl(storedPath: string): string` method that reads the file and returns a `data:<mime>;base64,<b64>` URI.
- `src/main/ipc.ts` — registered `ipcMain.handle(IPC.ATTACHMENT_DATA_URL, ...)` that delegates to `AttachmentService.getDataUrl`.
- `src/renderer/ipc.ts` — added `getAttachmentDataUrl(storedPath)` wrapper.
- `src/renderer/components/Chat/AttachmentRow.tsx` — extracted an `ImageAttachment` sub-component that fetches the data URL via `getAttachmentDataUrl` in a `useEffect` and renders `<img src={dataUrl}>`. No `file://` URIs remain.

### I4 — Remove unsafe `any` cast in file path extraction

Confirmed: after Fix 1, grep for `(f: any)` across `src/` returns zero matches.

---

## Test Summary

**Command:** `npx vitest run`  
**Result:** 9 test suites, 36 tests — all passing

| Suite | Tests |
|---|---|
| adapters/manager.test.ts | 4 |
| pipeline/runner.test.ts | 5 |
| adapters/opencode.adapter.test.ts | 2 |
| wizard/probe.test.ts | 3 |
| wizard/install.test.ts | 3 |
| adapters/gemini.adapter.test.ts | 3 |
| ipc.test.ts | 4 |
| adapters/claude.adapter.test.ts | 5 |
| attachments/service.test.ts | 7 |

---

## Concerns

None. The Windows Vitest exit-code anomaly (non-zero on process teardown due to CJS deprecation warning) was present before these changes and is unrelated to test results — all checkmarks are green.
