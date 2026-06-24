# AGENTS.md

Guidance for AI coding agents (Gemini CLI, Copilot, Opencode, etc.) working in this repository.

## Project Summary

**MyRA** — Electron desktop chat app wrapping local CLI AI backends (Claude Code, Gemini CLI, Opencode) with persistent conversation history and persona management.

Full design: `docs/superpowers/specs/2026-06-17-ai-agent-harness-design.md`

## Process Boundary Rule

The single most important architectural rule: **main process and renderer process are isolated**.

- `src/main/` — Node.js context. Owns CLI spawning, SQLite, filesystem.
- `src/renderer/` — Browser context. React UI only. No Node APIs.
- `src/shared/` — Types and IPC channel constants shared by both. No side effects.

Any agent generating code that calls `child_process`, `fs`, or `better-sqlite3` in renderer code is incorrect.

## Adding a New CLI Backend

1. Create `src/main/adapters/<name>.adapter.ts` implementing `BackendAdapter` from `src/shared/types.ts`
2. Register it in `src/main/adapters/index.ts`
3. Add detection logic to `SetupWizard` for the new binary name
4. Add an entry to the `wizard:probe` IPC handler

## Dev Commands

```bash
npm run dev      # development
npm run build    # compile
npm test         # unit tests (Vitest)
npm run lint     # ESLint
```

## Style

TypeScript strict mode is on. No `any` without a comment explaining why. Prefer explicit return types on public functions.
