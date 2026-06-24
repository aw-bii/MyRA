# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes. **Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove only imports/variables/functions that YOUR changes made unused.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project: MyRA

Full design spec: [docs/superpowers/specs/2026-06-17-ai-agent-harness-design.md](docs/superpowers/specs/2026-06-17-ai-agent-harness-design.md)

### Commands

```bash
npm run dev          # Start Electron app in development (electron-vite HMR)
npm run build        # Compile TypeScript + bundle with electron-vite
npm run dist         # Package installer via electron-builder (win/mac)
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

### Architecture

The app follows a strict main/renderer split.

**Main process** (`src/main/`) owns all side effects: spawning CLI processes, reading/writing SQLite, file system access. It never imports renderer code.

**Renderer process** (`src/renderer/`) is a React app. It communicates with main exclusively via typed IPC channels defined in `src/shared/ipc.ts`. It never calls `child_process`, `fs`, or `better-sqlite3` directly.

**Adapter layer** (`src/main/adapters/`) — one file per CLI backend. Every adapter implements `BackendAdapter` from `src/shared/types.ts`. Adding a new backend = one adapter file + registration in `AdapterManager`.

**ConvStore** (`src/main/store/`) — all SQLite access. Schema migrations in `src/main/store/migrations/`.

### Key Conventions

- **IPC:** all channel names and payload types live in `src/shared/ipc.ts`. Never use raw string channel names elsewhere.
- **Adapter contract:** `send()` returns `AsyncIterable<MessageChunk>`. Adapters must respect `abort()` by terminating the child process and ending the iterable.
- **Persona injection:** system prompts are passed as a CLI flag inside each adapter's `send()`. Never concatenate persona text into the user message.
- **Security:** arguments are passed as argv arrays to `child_process.spawn` — never as shell strings. Renderer runs with `contextIsolation: true`, `nodeIntegration: false`.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
