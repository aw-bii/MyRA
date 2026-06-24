# API Backend Integrations Design

**Date:** 2026-06-24
**Status:** Draft

Add five HTTP API-based AI backends to MyRA — OpenAI, OpenRouter, Ollama, Claude API, and Gemini API — with platform keychain-backed API key storage and per-conversation model selection.

---

## Architecture

```
Renderer (React)
  │
  ├── SettingsPanel — API Keys section
  │     └── KeyManager IPC (store/get/delete/has)
  │
  ├── ModelSelector — toolbar dropdown
  │     └── MODEL_LIST IPC → adapter lists available models
  │
  └── BackendSwitcher — now also passes model in chat:send payload
        │
Main Process
  │
  ├── KeyManager (src/main/security/key-manager.ts)
  │     ├── storeKey(provider, plaintext)
  │     ├── getKey(provider) → string | null
  │     ├── deleteKey(provider)
  │     └── Uses Electron safeStorage + SQLite settings
  │
  ├── BaseHttpAdapter (src/main/adapters/http-base-adapter.ts)
  │     └── Abstract class implementing BackendAdapter
  │           ├── send()     — fetch + SSE parsing + AbortController
  │           ├── abort()    — AbortController.abort()
  │           ├── isAvailable() — keyManager.hasKey(id) || port check
  │           └── checkAuth()   — lightweight endpoint hit
  │
  └── AdapterManager (existing) — registry extended with:
        ├── OpenAIAdapter       (openai.adapter.ts)
        ├── OpenRouterAdapter   (openrouter.adapter.ts)
        ├── OllamaAdapter       (ollama.adapter.ts)
        ├── ClaudeApiAdapter    (claude-api.adapter.ts)
        └── GeminiApiAdapter    (gemini-api.adapter.ts)
```

All five new adapters are registered in `src/main/adapters/index.ts` alongside the existing CLI adapters. The adapter registry contains both CLI and HTTP adapters — the renderer lists them uniformly via `backend:list`.

---

## Key Manager

### Storage

Electron `safeStorage.encryptString(plaintext)` produces a `Buffer`. Hex-encode it and store in SQLite `settings` table with key prefix `key:<providerId>`.

```
settings table:
  key:openai      → "a1b2c3..." (hex-encoded encrypted blob)
  key:openrouter  → "d4e5f6..."
  key:claude-api  → "g7h8i9..."
  key:gemini-api  → "j0k1l2..."
```

On retrieval: read from settings → hex-decode → `safeStorage.decryptString(buffer)` → return plaintext.

### Fallback

If `safeStorage.isEncryptionAvailable()` returns false (rare — headless/server environments), fall back to storing the key as plaintext in settings and log a warning. The app functions identically but with reduced security.

### API (KeyManager singleton)

| Method | Returns | Description |
|--------|---------|-------------|
| `storeKey(provider, key)` | `void` | Encrypt and persist key |
| `getKey(provider)` | `string \| null` | Retrieve and decrypt key |
| `deleteKey(provider)` | `void` | Remove stored key |
| `hasKey(provider)` | `boolean` | Check if key exists in storage |
| `listProviders()` | `string[]` | All provider IDs with stored keys |

### IPC channels (in `src/shared/ipc.ts`)

- `KEY_STORE: "key:store"` — invoke `(provider: string, key: string)`
- `KEY_GET: "key:get"` — invoke `(provider: string)` → `string | null`
- `KEY_DELETE: "key:delete"` — invoke `(provider: string)`
- `KEY_HAS: "key:has"` — invoke `(provider: string)` → `boolean`
- `KEY_LIST: "key:list"` — invoke `()` → `string[]`

---

## BaseHttpAdapter

An abstract class in `src/main/adapters/http-base-adapter.ts`. It implements the `BackendAdapter` interface, providing shared HTTP streaming infrastructure.

### Abstract methods (each adapter defines these)

```typescript
abstract get id: string;
abstract getDefaultModel(): string;
abstract getBaseUrl(): string;
abstract getApiKeyHeader(): Record<string, string>;
abstract buildRequestBody(params: {
  message: string;
  persona?: string;
  attachments?: Attachment[];
  model: string;
}): object;
abstract parseChunk(raw: unknown): MessageChunk | null;
```

### Concrete methods (shared by all HTTP adapters)

**`async isAvailable(): Promise<boolean>`**
- Calls `KeyManager.hasKey(this.id)` to check if an API key is configured
- If no key is needed (Ollama), pings the base URL with a HEAD or GET request
- Returns `false` if the endpoint is unreachable

**`async checkAuth(): Promise<boolean>`**
- Retrieves the key via `KeyManager.getKey(this.id)`
- Makes a lightweight authenticated request (provider-specific: model list, key info, or minimal chat)
- Returns `true` if the endpoint responds 200, `false` otherwise

**`async *send(message, persona?, attachments?): AsyncIterable<MessageChunk>`**
- Retrieves the model override from the attached conversation metadata, or falls back to `getDefaultModel()`
- Retrieves the API key via `KeyManager.getKey(this.id)`
- Calls `buildRequestBody()` to construct the JSON payload
- Uses Node.js built-in `fetch` with `keepalive: true`
- Wraps the request in an `AbortController` (for `abort()` support)
- Reads the response body as a `ReadableStream<Uint8Array>`
- Parses SSE lines: splits on `\n\n`, matches `data: {...}` lines, parses JSON
- Calls `parseChunk()` for each parsed object — returns `null` to skip (e.g., keepalive pings)
- Handles: HTTP errors (4xx/5xx → `MessageChunk` error), timeouts, malformed JSON silently
- On response error or stream end, yields `{ type: "done", content: "" }`

**`abort(): void`**
- Calls `AbortController.abort()` on the current request
- Nulls the reference

### Error handling

- **429 (Rate limited):** Yields `{ type: "error", content: "Rate limited. Wait and retry." }` followed by `{ type: "done" }`
- **401/403 (Auth failure):** Yields `{ type: "error", content: "Authentication failed. Check your API key." }` followed by `{ type: "done" }`
- **Network error / timeout:** Yields `{ type: "error", content: "Connection failed. Check your network and endpoint URL." }` followed by `{ type: "done" }`
- **SSE parse error:** Silently skip the malformed line, continue parsing

---

## Individual Adapters

### OpenAIAdapter

| Property | Value |
|----------|-------|
| `id` | `"openai"` |
| `getDefaultModel()` | `"gpt-4o"` (from settings key `model:openai`) |
| `getBaseUrl()` | `"https://api.openai.com/v1/chat/completions"` |
| `getApiKeyHeader()` | `{ "Authorization": "Bearer ${key}" }` |
| `buildRequestBody()` | OpenAI messages format: `{ model, messages: [{ role, content }], system, stream: true }` — attaches persona as `system` message, attachments as multimodal content blocks |
| `parseChunk()` | Extracts `choices[0].delta.content` from each SSE `data:` line |
| `checkAuth()` | `GET /v1/models` — returns `true` if status 200 |

### OpenRouterAdapter

| Property | Value |
|----------|-------|
| `id` | `"openrouter"` |
| `getDefaultModel()` | `"anthropic/claude-sonnet-20241022"` (from settings key `model:openrouter`) |
| `getBaseUrl()` | `"https://openrouter.ai/api/v1/chat/completions"` |
| `getApiKeyHeader()` | `{ "Authorization": "Bearer ${key}" }` |
| `buildRequestBody()` | Same OpenAI format + optional `provider: { order: [...] }` routing field — persona as `system` message |
| `parseChunk()` | Same as OpenAI (identical API format) |
| `checkAuth()` | `GET /api/v1/auth/key` — returns `true` if status 200 |
| Notes | Also sends `"HTTP-Referer": "myra://"` header (OpenRouter requires origin) |

### OllamaAdapter

| Property | Value |
|----------|-------|
| `id` | `"ollama"` |
| `getDefaultModel()` | `"llama3.2"` (from settings key `model:ollama`) |
| `getBaseUrl()` | `"http://localhost:11434/api/chat"` |
| `getApiKeyHeader()` | `{}` (no auth) |
| `buildRequestBody()` | Ollama format: `{ model, messages: [{ role, content }], stream: true }` — persona mapped to system message |
| `parseChunk()` | Extracts `message.content` from Ollama's JSON response |
| `isAvailable()` | `GET http://localhost:11434` — check port reachability (overrides base class to skip key check) |
| `checkAuth()` | Same as `isAvailable()` — no auth concept |
| Notes | No API key required; key management UI shows "No key needed — connects to localhost" |

### ClaudeApiAdapter

| Property | Value |
|----------|-------|
| `id` | `"claude-api"` |
| `getDefaultModel()` | `"claude-sonnet-4-20250514"` (from settings key `model:claude-api`) |
| `getBaseUrl()` | `"https://api.anthropic.com/v1/messages"` |
| `getApiKeyHeader()` | `{ "x-api-key": "${key}", "anthropic-version": "2023-06-01" }` |
| `buildRequestBody()` | Anthropic format: `{ model, system: persona, messages: [{ role, content }], stream: true }` — attachments as image content blocks |
| `parseChunk()` | Handles Anthropic SSE events: `content_block_start` (with `text` or `tool_use`), `content_block_delta` (with `text_delta`), `message_delta` (stop) |
| `checkAuth()` | `POST /v1/messages` with `{ model, max_tokens: 1, messages: [{ role: "user", content: "." }] }` — returns `true` if status 200 |
| Notes | Anthropic does not provide a model list endpoint for API keys — model list is hardcoded |

### GeminiApiAdapter

| Property | Value |
|----------|-------|
| `id` | `"gemini-api"` |
| `getDefaultModel()` | `"gemini-2.0-flash"` (from settings key `model:gemini-api`) |
| `getBaseUrl()` | `"https://generativelanguage.googleapis.com/v1/models/{model}:streamGenerateContent?alt=sse"` — model is embedded in URL path |
| `getApiKeyHeader()` | `{ "x-goog-api-key": "${key}" }` |
| `buildRequestBody()` | Google format: `{ contents: [{ role, parts: [{ text }] }], systemInstruction: { parts: [{ text: persona }] } }` — attachments as inline data parts |
| `parseChunk()` | Extracts `candidates[0].content.parts[0].text` from each response chunk |
| `checkAuth()` | `POST /v1/models/{model}:generateContent` with `{ contents: [{ parts: [{ text: "." }] }] }` and `maxOutputTokens: 1` — returns `true` if status 200 |
| Notes | Model name in URL vs in body — `send()` substitutes `{model}` in the URL with the active model before fetching |

---

## Model Selection

### Storage

Default models stored in SQLite `settings` table with key prefix `model:<providerId>`:
- `model:openai` → `"gpt-4o"`
- `model:openrouter` → `"anthropic/claude-sonnet-20241022"`
- `model:ollama` → `"llama3.2"`
- `model:claude-api` → `"claude-sonnet-4-20250514"`
- `model:gemini-api` → `"gemini-2.0-flash"`

### Per-conversation model

Each conversation stores a `model` field (nullable string). When the user sends a message:

```
chat:send({ backend: "openai", model: "gpt-4o-mini", message: "..." })
```

The `model` field flows through the IPC handler to the adapter's `send()` method. If `null`/`undefined`, the adapter falls back to its `getDefaultModel()`.

When loading a conversation, the stored model is displayed in the model selector dropdown.

### Model listing

| Adapter | List method |
|---------|-------------|
| OpenAI | `GET /v1/models` → filter `gpt-*` and `o*` models |
| OpenRouter | `GET /api/v1/models` → returns all models with routing info |
| Ollama | `GET /api/tags` → locally pulled models |
| Claude API | Hardcoded: [claude-sonnet-4, claude-sonnet-4-20250514, claude-haiku-3-5, claude-opus-4] |
| Gemini API | Hardcoded: [gemini-2.0-flash, gemini-2.0-flash-lite, gemini-2.5-pro, gemini-2.5-flash] |

Hardcoded lists for Claude and Gemini because their list APIs either don't exist for API keys (Anthropic) or return excessive metadata (Google). Hardcoded lists are defined as constants in each adapter file.

### IPC channels (in `src/shared/ipc.ts`)

- `MODEL_GET_DEFAULT: "model:get-default"` — invoke `(provider: string)` → `string`
- `MODEL_SET_DEFAULT: "model:set-default"` — invoke `(provider: string, model: string)`
- `MODEL_LIST: "model:list"` — invoke `(provider: string)` → `string[]`

---

## Renderer UI Changes

### Settings Panel — API Keys section

A new collapsible section "API Keys" in `SettingsPanel.tsx`:

```
┌─────────────────────────────────────┐
│ ▸ API Keys                          │
│                                     │
│   OpenAI         [••••••••] [Save]  │
│   OpenRouter     [••••••••] [Save]  │
│   Claude API     [••••••••] [Save]  │
│   Gemini API     [••••••••] [Save]  │
│   Ollama         No key needed      │
│                     (localhost:11434)│
└─────────────────────────────────────┘
```

- Inputs are `type="password"` with a toggle eye icon for reveal
- "Save" button calls `window.ipc.invoke("key:store", ...)`
- If key already exists, input is pre-populated with masked dots; blank input = delete
- A "Test Connection" button on each row calls `window.ipc.invoke("wizard:probe", ...)` for that adapter

### Model Selector

A new `<select>` dropdown in the toolbar, positioned immediately after the BackendSwitcher:

```
[ Claude CLI ▼ ] [ claude-sonnet-4 ▼ ]  [ Cron ] [ MCP ] ...
```

- Only visible when an HTTP API backend is selected (CLI backends like Claude CLI, Gemini CLI, Opencode don't support model switching)
- Fetches model list on mount via `MODEL_LIST` IPC
- Updates on backend switch (different provider → different model list)
- The selected model is stored in conversation state and sent with `chat:send`

### Backend detection

`AdapterManager.listAvailable()` already calls `isAvailable()` on all registered adapters. For HTTP adapters, `isAvailable()` returns `true` when a key is configured (or port is reachable for Ollama). This means:
- Backends without a configured key show as "not available" in BackendSwitcher
- Once a user adds a key in Settings, the backend automatically appears as selectable
- No restart needed

---

## IPC Channel Summary

8 new channels in `src/shared/ipc.ts`:

| Constant | String | Direction | Payload |
|----------|--------|-----------|---------|
| `KEY_STORE` | `"key:store"` | invoke | `(provider, key)` |
| `KEY_GET` | `"key:get"` | invoke → response | `(provider)` → `string \| null` |
| `KEY_DELETE` | `"key:delete"` | invoke | `(provider)` |
| `KEY_HAS` | `"key:has"` | invoke → response | `(provider)` → `boolean` |
| `KEY_LIST` | `"key:list"` | invoke → response | `()` → `string[]` |
| `MODEL_GET_DEFAULT` | `"model:get-default"` | invoke → response | `(provider)` → `string` |
| `MODEL_SET_DEFAULT` | `"model:set-default"` | invoke | `(provider, model)` |
| `MODEL_LIST` | `"model:list"` | invoke → response | `(provider)` → `string[]` |

Existing channels with modified payloads:

| Channel | Change |
|---------|--------|
| `CHAT_SEND` | Payload gains optional `model: string` field |
| `BACKEND_LIST` | Unchanged — HTTP adapters appear automatically via `isAvailable()` |

---

## Testing Strategy

### Unit tests (Vitest)

- **KeyManager**: store → get → delete cycle; fallback when safeStorage unavailable
- **BaseHttpAdapter**: mock fetch, test SSE parsing, abort, timeout, error handling
- **Each adapter**: test `buildRequestBody()`, `parseChunk()`, `getDefaultModel()`, `checkAuth()` URL construction
- **Model selection**: IPC handler tests for `MODEL_LIST`, `MODEL_GET_DEFAULT`, `MODEL_SET_DEFAULT`
- **Settings UI**: RTL tests for API key form save/delete, model selector render

### E2E tests (Playwright)

- Extend existing E2E suite with: Settings → add API key → verify backend appears as available
- Model selector visibility: verify it shows when API backend selected, hidden when CLI backend selected

---

## File Checklist

### New files

| File | Purpose |
|------|---------|
| `src/main/security/key-manager.ts` | Key encryption/decryption via safeStorage |
| `src/main/security/key-manager.test.ts` | Tests for KeyManager |
| `src/main/adapters/http-base-adapter.ts` | Abstract base class for HTTP adapters |
| `src/main/adapters/http-base-adapter.test.ts` | Tests for SSE parsing, timeout, abort |
| `src/main/adapters/openai.adapter.ts` | OpenAI API adapter |
| `src/main/adapters/openrouter.adapter.ts` | OpenRouter API adapter |
| `src/main/adapters/ollama.adapter.ts` | Ollama API adapter |
| `src/main/adapters/claude-api.adapter.ts` | Claude API adapter |
| `src/main/adapters/gemini-api.adapter.ts` | Gemini API adapter |

### Modified files

| File | Change |
|------|--------|
| `src/shared/ipc.ts` | Add 8 new IPC channels; add `model` to `CHAT_SEND` payload type |
| `src/shared/types.ts` | Add `model?: string` to chat send request types |
| `src/main/adapters/index.ts` | Register 5 new adapters |
| `src/main/ipc.ts` | Add IPC handlers for key management and model channels; update `chat:send` handler to pass model |
| `src/renderer/ipc.ts` | Add renderer IPC wrapper functions for all new channels |
| `src/renderer/App.tsx` | Add model state; pass model to chat send; show ModelSelector |
| `src/renderer/components/BackendSwitcher.tsx` | Accept and render `model` state |
| `src/renderer/components/Settings/SettingsPanel.tsx` | Add API Keys section |
| `src/renderer/components/Toolbar/ModelSelector.tsx` | New model dropdown component |
