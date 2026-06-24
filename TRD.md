# Technical Requirements Document
**Project:** MyRA  
**Date:** 2026-06-17  
**Status:** Draft

---

## Tech Stack

| Layer        | Choice              | Reason                                          |
|--------------|---------------------|-------------------------------------------------|
| App shell    | Electron (latest)   | Windows + macOS from one codebase               |
| Frontend     | React + TypeScript  | Component model fits chat UI well               |
| Styling      | Tailwind CSS        | Utility-first, fast iteration                   |
| Build tool   | electron-vite       | Vite HMR in renderer, fast dev loop             |
| Packaging    | electron-builder    | Handles code signing, NSIS (win), DMG (mac)     |
| Database     | better-sqlite3      | Synchronous SQLite, no ORM overhead             |
| Tests        | Vitest + Playwright | Unit (main + renderer logic) + E2E              |

## Process Architecture

```
Main Process (Node.js)          Renderer Process (Chromium)
──────────────────────          ───────────────────────────
AdapterManager                  React app
  └─ ClaudeAdapter (bundled)    IPC calls only — no Node APIs
  └─ GeminiAdapter
  └─ OpencodeAdapter
ConvStore (SQLite)
SetupWizard (probe/install)
IPC handlers
```

All IPC channel names and payload types are co-located in `src/shared/ipc.ts` and imported by both sides.

## Adapter Interface

```typescript
interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string): AsyncIterable<MessageChunk>
  abort(): void
}
```

Each adapter spawns its CLI tool as a child process, reads its structured JSON output (NDJSON stream), and maps each line to a `MessageChunk`. Persona is passed as a CLI system-prompt flag inside `send()`.

## Database Schema

Three tables: `conversations`, `messages`, `personas` + FTS5 virtual table over messages.  
See design spec for full DDL: `docs/superpowers/specs/2026-06-17-ai-agent-harness-design.md`

Migrations are numbered SQL files in `src/main/store/migrations/` applied in order on startup.

## CLI Tool Integration

| Tool      | Binary   | Structured output flag              | Auth probe command  |
|-----------|----------|-------------------------------------|---------------------|
| Claude    | `claude` | `--output-format stream-json`       | `claude --version`  |
| Gemini    | `gemini` | `--format json` (when stable)       | `gemini auth status`|
| Opencode  | `opencode`| `--json` (when stable)             | `opencode --version`|

Claude ships bundled with the app installer. Gemini and Opencode are optional, installed by the user via the setup wizard.

## Security

- Renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and a restrictive `Content-Security-Policy`.
- No remote code execution. All CLI commands are constructed with fixed templates — no shell interpolation of user input. Arguments are passed as argv arrays to `child_process.spawn`, never as shell strings.
- SQLite file stored in Electron's `app.getPath('userData')`.

## Platform Targets

| Platform | Packaging format     | Min OS version |
|----------|----------------------|----------------|
| Windows  | NSIS installer (.exe)| Windows 10     |
| macOS    | DMG + .app bundle    | macOS 12       |

## Constraints

- App must launch and reach chat screen in < 5 seconds on a mid-range laptop.
- SQLite FTS5 search over 10,000 messages must return in < 200ms.
- Bundled Claude binary adds ~50MB to installer — acceptable.
