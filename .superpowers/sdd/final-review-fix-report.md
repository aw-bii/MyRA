# Final Review Fix Report — Phase 2 Nav Restructure (Round 2)

**Status:** DONE  
**Date:** 2026-06-29

---

## Fix 1: Store method names in `defaults.ts`

**Store methods found in `ConvStore` (`src/main/store/index.ts`):**
- Persona creation: `ConvStore.createPersona(p: Omit<Persona, "id">): Persona`
- Pipeline template creation: `ConvStore.createPipelineTemplate(name, steps): PipelineTemplate`

**`defaults.ts` verdict: CORRECT — no changes needed.**

Both `defaults.ts` and `defaults.test.ts` already called `createPersona` and `createPipelineTemplate` with the exact correct signatures. No edits were made to either file.

---

## Fix 2: BottomBar added to pipeline empty-state

**File changed:** `src/renderer/App.tsx`

The `!activeConvId && mode === "pipeline"` branch previously rendered only hint text with no BottomBar, making template selection unreachable. The fix adds a `<BottomBar>` with the same props as in the ChatView branch (mode, setMode, backend, setBackend, model, setModel, personaId, setPersonaId, templates, selectedTemplate, onTemplateSelect, backendRefresh) inside the pipeline empty-state div. The hint copy was updated to "Select a pipeline template below, then create a new conversation to begin."

---

## Fix 3: `onTemplateSelect` type in SettingsModal.Props

**File changed:** `src/renderer/components/Settings/SettingsModal.tsx`

Changed line 35 of the `Props` interface from:
```ts
onTemplateSelect: (t: PipelineTemplate) => void;
```
to:
```ts
onTemplateSelect: (t: PipelineTemplate | null) => void;
```
This aligns the type with `BottomBarProps.onTemplateSelect` and the actual usage in `App.tsx`.

---

## Build and Test Results

- `npm run build`: exit 0 — all three bundles compiled cleanly
- `npm test`: **265 tests passed** across 50 test files — no regressions
- `npm run lint`: 0 errors — only pre-existing prettier formatting warnings

---

## Commit

**`dc1f431`** — `fix(review): BottomBar in pipeline empty state; onTemplateSelect type; verify store API`

---

# Previous Report (fix(review) round 1)

**Status:** DONE  
**Date:** 2026-06-29

---

## Files Changed

1. `src/renderer/components/Wizard/WizardStep2.tsx`
2. `src/shared/ipc.ts`
3. `src/renderer/hooks/useMessages.ts`
4. `src/main/adapters/claude.adapter.ts`

---

## Finding 1 (Critical): Raw string "ollama:start" in renderer

**File:** `src/renderer/components/Wizard/WizardStep2.tsx`

Added `import { IPC } from "../../../shared/ipc";`. Changed `window.ipc.invoke("ollama:start")` to `window.ipc.invoke(IPC.OLLAMA_START)`.

Note: The import path in the brief was `../../../../shared/ipc` (4 levels up) but the file lives at `src/renderer/components/Wizard/`, which is 3 levels deep from `src/renderer/`. The correct path is `../../../shared/ipc`. The build caught the incorrect path immediately.

---

## Finding 2 (Important): `OLLAMA_START` missing from `IpcInvokeMap`

**File:** `src/shared/ipc.ts`

Added `[IPC.OLLAMA_START]: void;` immediately after `[IPC.WIZARD_DONE]: void;` in the `IpcInvokeMap` interface.

---

## Finding 3 (Important): `applyChunk` doesn't reset `streamingContentRef` on error

**File:** `src/renderer/hooks/useMessages.ts`

Added `streamingContentRef.current = "";` as the first statement in the `chunk.type === "error"` branch. Prevents stale accumulated streaming text from corrupting subsequent messages after an error event.

---

## Finding 4 (Important): Attachment file-existence fallback in `claude.adapter.ts`

**File:** `src/main/adapters/claude.adapter.ts`

Added `import fs from "fs";` after the `spawn` import. In the attachment loop, the non-error branch was split:
- `else if (fs.existsSync(att.storedPath))` → `args.push("--file", att.storedPath)` (original behavior when file exists)
- `else` → inline injection: `[Attachment: name]\n<extractedText ?? [name]>\n[/Attachment]` (fallback when file is missing)

Note: The opencode adapter uses `AttachmentService.getContent()` for all attachments and does not itself use `fs.existsSync`. The fallback pattern was sourced from the finding description and applied directly to claude.adapter.ts.

---

## Finding 5 (Important): API-key-only backends show "Install" button

**File:** `src/renderer/components/Wizard/WizardStep2.tsx`

Added `const API_KEY_ONLY = new Set(["claude-api", "gemini-api", "openrouter"]);` before the component definition. In `missing.map()`, branched on `API_KEY_ONLY.has(id)`:
- API-key-only: render label + "No installation needed — configure your API key in Settings" note + Skip button only. No Install button, no logs pre, no error text.
- CLI backends: unchanged (Install / Skip / logs / error UI exactly as before).

---

## Lint / Build / Test Results

**Lint:** `npm run lint` → 0 errors, 386 warnings (all pre-existing prettier formatting warnings unrelated to these changes).

**Build:** `npm run build` → exit 0. All three bundles compiled cleanly (main 93.37 kB, preload 3.13 kB, renderer 706.56 kB).

**Tests:** `npx vitest run src/renderer/hooks/useMessages.test.tsx --reporter=verbose`
```
✓ applyChunk > appends text chunk content to assistant placeholder
✓ applyChunk > renders error chunk as visible error message
✓ applyChunk > falls back to matching placeholder with empty conversationId for new conversations

Test Files  1 passed (1)
      Tests  3 passed (3)
      Duration 7.26s
```

---

## Commit

**Message:** `fix(review): IPC constant, IpcInvokeMap, applyChunk reset, attachment fallback, API-key wizard UI`
