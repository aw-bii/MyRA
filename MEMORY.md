# MEMORY.md

Running context for the BII Agent Harness project. Update this as decisions are made, patterns are established, or scope changes.

## Project Identity

**Name:** BII Agent Harness
**Type:** Native Electron desktop chat app (Windows + macOS)
**Goal:** Hermes-Desktop-style AI chat, easier to set up for non-developers
**Constraint:** Local-first, no gateways, no proxies, no servers

## Key Decisions Made

| Decision | Choice | Reason |
| --- | --- | --- |
| App framework | Electron | Windows + macOS from one codebase, Electron chosen over Tauri |
| Backend integration | Structured-output adapters (not PTY) | Reliable message parsing → clean history + persona features |
| Default bundled backend | Claude Code CLI | Zero-install path for users |
| Database | SQLite via better-sqlite3 | Local-first, no ORM overhead |
| Build tooling | electron-vite + electron-builder | Fast HMR dev loop, handles code signing and packaging |
| IPC typing | Manual types in src/shared/ipc.ts | Single source of truth for both processes |

## Architecture at a Glance

```
Renderer (React) ←IPC→ Main Process (Node)
                              ├─ AdapterManager
                              │    ├─ ClaudeAdapter   (bundled)
                              │    ├─ GeminiAdapter   (optional)
                              │    └─ OpencodeAdapter (optional)
                              └─ ConvStore (SQLite)
                                   ├─ conversations
                                   ├─ messages + FTS5
                                   └─ personas
```

## v1 Scope

**In:** chat UI, streaming responses, conversation history + search, persona management, setup wizard (detect → install → auth), backend switcher per conversation.

**Out:** file attachments, multi-agent orchestration, cloud sync, plugin system, mobile.

## Spec & Docs

- Design spec: `docs/superpowers/specs/2026-06-17-ai-agent-harness-design.md`
- Product requirements: `PRD.md`
- Technical requirements: `TRD.md`

## Open Questions

- Which version of Claude Code CLI to bundle, and how to handle updates to the bundled binary?
- Opencode JSON output flag — confirm once Opencode stable release lands.
