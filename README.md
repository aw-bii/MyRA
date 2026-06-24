# MyRA

**A native desktop chat app that brings Claude Code, Gemini CLI, and Opencode behind one clean UI.**

![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

</div>

---

## Overview

MyRA is a desktop application that wraps local CLI-based AI tools — Claude Code, Gemini CLI, Opencode — behind a single persistent chat interface. Claude Code ships bundled, so it works out of the box with zero additional setup.

- Chat interface backed by local CLI tools
- Persistent conversation history with full-text search
- Persona / system prompt management
- Guided setup wizard with auto-detection of installed backends
- Claude Code bundled as the default, zero-install backend

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│                                                      │
│  ┌─────────────────┐       ┌─────────────────────┐  │
│  │  Renderer        │  IPC  │  Main Process        │  │
│  │  (React UI)      │◄─────►│                     │  │
│  │                  │       │  ┌───────────────┐   │  │
│  │  - Chat view     │       │  │ AdapterManager│   │  │
│  │  - Sidebar       │       │  │ (spawns CLIs) │   │  │
│  │  - Persona panel │       │  └───────┬───────┘   │  │
│  │  - Setup wizard  │       │          │            │  │
│  └─────────────────┘       │  ┌───────▼───────┐   │  │
│                             │  │  ConvStore    │   │  │
│                             │  │  (SQLite)     │   │  │
│                             │  └───────────────┘   │  │
│                             └─────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                │               │
    claude CLI        gemini CLI     opencode CLI
  (bundled, JSON)    (optional)      (optional)
```

The renderer never spawns processes or touches the filesystem directly. All CLI orchestration lives in the main process; renderer communicates via named IPC channels defined in `src/shared/ipc.ts`.

## Tech Stack

| Layer      | Choice                         |
|------------|--------------------------------|
| App shell  | Electron 33                    |
| Frontend   | React 18 + TypeScript 5        |
| Styling    | Tailwind CSS                   |
| Database   | SQLite via `better-sqlite3`    |
| Build      | `electron-vite`                |
| Packaging  | `electron-builder` (win + mac) |
| Tests      | Vitest + Playwright            |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

This will automatically download the bundled Claude binary (`postinstall` hook).

### Development

```bash
npm run dev
```

Starts Electron with `electron-vite` HMR. The renderer reloads on save; main process changes restart the Electron shell.

### Build & Package

```bash
npm run build   # Compile TypeScript + bundle
npm run dist    # Package installer (win/mac)
```

## Commands

| Command              | Description                             |
|----------------------|-----------------------------------------|
| `npm run dev`        | Start in development mode (HMR)         |
| `npm run build`      | Compile and bundle                      |
| `npm run dist`       | Build distributable installer           |
| `npm run lint`       | Run ESLint                              |
| `npm test`           | Run Vitest unit tests                   |
| `npm run test:e2e`   | Run Playwright end-to-end tests         |
| `npm run typecheck`  | Type-check without emitting             |

## Adding a Backend

Each CLI backend is one file in `src/main/adapters/` implementing the `BackendAdapter` interface from `src/shared/types.ts`:

```typescript
interface BackendAdapter {
  id: string
  isAvailable(): Promise<boolean>
  send(message: string, persona?: string): AsyncIterable<MessageChunk>
  abort(): void
}
```

Register the new adapter in `AdapterManager` and it becomes available in the backend switcher automatically.

## Project Structure

```
src/
├── main/
│   ├── adapters/     # One file per CLI backend
│   ├── store/        # SQLite access + schema migrations
│   └── index.ts      # Electron main entry, IPC handlers
├── renderer/         # React UI
│   └── src/
└── shared/
    ├── ipc.ts        # All IPC channel names + payload types
    └── types.ts      # Shared TypeScript types (BackendAdapter, etc.)
```

## License

MIT — see [LICENSE](LICENSE) for details.
