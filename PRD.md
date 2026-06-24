# Product Requirements Document
**Project:** MyRA  
**Date:** 2026-06-17  
**Status:** Draft

---

## Problem

Existing AI desktop chat apps either require API keys and internet connectivity (ChatGPT, Claude.ai) or are too developer-oriented to set up (Hermes Desktop, raw CLI tools). Average users who want to run AI locally or via CLI agents have no good on-ramp.

## Goal

A Windows + macOS desktop app that gives any user a clean, persistent chat experience backed by locally-installed CLI AI tools — with a guided setup wizard so the barrier to first message is as low as possible.

## Target User

A technically curious non-developer: comfortable installing software, willing to set up an API key once, but not interested in editing config files or running terminal commands manually.

## v1 Features

### Must Have
- [ ] Chat UI with streaming responses
- [ ] Claude Code as bundled default backend (zero external install required)
- [ ] Guided setup wizard: auto-detects CLI tools, walks through install + auth for missing ones
- [ ] Conversation history persisted to local SQLite; full-text search
- [ ] Persona management: create/edit/delete system prompts; one default persona
- [ ] Backend switcher: per-conversation selection of active CLI backend

### Should Have
- [ ] Gemini CLI adapter
- [ ] Opencode adapter
- [ ] Auto-title conversations from first message
- [ ] Keyboard shortcuts for new conversation, search, send

### Won't Have (v1)
- File/image attachments
- Multi-agent orchestration
- Cloud sync
- Plugin system
- Mobile

## Success Metrics

- Time from app install to first AI response: < 3 minutes (with Claude bundled)
- Conversation history loads within 200ms for up to 10,000 messages
- Setup wizard completion rate > 80% for users who launch it

## Out of Scope

Anything that requires a running server, gateway, or proxy. This is a local-first desktop app.
