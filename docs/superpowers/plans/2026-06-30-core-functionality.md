# Core Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix blank replies (error chunks are streamed to the UI but the DB saves empty content, so a DB reload after conversation creation wipes the error) and replace the static `...` streaming indicator with an animated typing indicator.

**Architecture:** Two separate fixes. (1) In `src/main/ipc.ts`, error-type chunks must also populate `fullContent` before the assistant message is saved to the DB — this ensures the DB reload that happens when a new `conversationId` is set reflects what was streamed. (2) In `src/renderer/components/Chat/MessageList.tsx`, replace the plain `...` div with three pulse-animated dots to give a clear "thinking" signal. A third cleanup ensures `streaming` is always set to `false` when a `send()` call throws, preventing an infinite spinner.

**Tech Stack:** TypeScript, React 18, Tailwind CSS, Electron IPC, better-sqlite3, Vitest

## Global Constraints

- IPC channel names only from `src/shared/ipc.ts`
- No new IPC channels needed for this plan
- Tailwind only for styling — no `style=` props
- Run `npm test` after every task; all tests must pass before committing

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/main/ipc.ts:108-115` | Accumulate error-chunk content into `fullContent` so it is persisted to DB |
| Modify | `src/renderer/components/Chat/MessageList.tsx:60-69` | Replace static `...` with animated pulse dots |
| Modify | `src/renderer/hooks/useMessages.ts:86-126` | Clear `streaming` state if `send()` throws |

---

### Task 1: Fix blank reply — persist error chunk content to DB

**Root cause:** `src/main/ipc.ts` line 109 only adds `text`-type chunks to `fullContent`. When the adapter emits an error chunk (e.g. backend not in PATH → `spawn ENOENT`), `fullContent` stays `""`. The assistant message is saved with empty content. When the renderer receives `onNewConversation(conv.id)` and reloads from DB, it replaces the streamed error with blank.

**Files:**
- Modify: `src/main/ipc.ts:108-115`
- Test: `src/main/ipc.test.ts`

**Interfaces:**
- Consumes: `MessageChunk.type: "text" | "tool_use" | "error" | "done"` from `src/shared/types.ts`
- Produces: the IPC handler saves non-empty `fullContent` for both text and error responses

- [ ] **Step 1: Write the failing test**

```typescript
// src/main/ipc.test.ts — add inside the CHAT_SEND describe block
it("saves error chunk content to the DB as the assistant message", async () => {
  // Arrange: adapter yields one error chunk then done
  const errorAdapter = {
    id: "test",
    isAvailable: async () => true,
    checkAuth: async () => true,
    async *send() {
      yield { type: "error" as const, content: "spawn claude ENOENT" };
      yield { type: "done" as const, content: "" };
    },
    abort: vi.fn(),
  };
  AdapterManager.get = vi.fn().mockReturnValue(errorAdapter);
  AdapterManager.getActive = vi.fn().mockReturnValue(errorAdapter);
  AdapterManager.setActive = vi.fn();

  const convId = await ipcMain._handlers["chat:send"]({ sender: { send: vi.fn() } }, {
    conversationId: null,
    message: "hello",
    backend: "test",
    personaId: undefined,
    messageId: undefined,
    model: undefined,
  });

  const msgs = ConvStore.getMessages(convId);
  const assistant = msgs.find((m) => m.role === "assistant");
  expect(assistant?.content).toBe("⚠ Error: spawn claude ENOENT");
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- ipc.test
```
Expected: FAIL — `assistant.content` is `""`, not `"⚠ Error: spawn claude ENOENT"`.

- [ ] **Step 3: Fix the content accumulation in ipc.ts**

In `src/main/ipc.ts`, replace line 109:

```typescript
      if (chunk.type === "text") fullContent += chunk.content;
```

with:

```typescript
      if (chunk.type === "text") fullContent += chunk.content;
      if (chunk.type === "error") fullContent = `⚠ Error: ${chunk.content}`;
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- ipc.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.ts src/main/ipc.test.ts
git commit -m "fix: persist error chunk content to DB so DB reload shows error instead of blank"
```

---

### Task 2: Clear `streaming` when `send()` throws so spinner doesn't hang

**Root cause:** In `src/renderer/hooks/useMessages.ts`, `send()` sets `streaming = true` before calling `sendChat()`. If `sendChat()` rejects (e.g. adapter throws before yielding any chunk), `streaming` is never set back to `false` because `onChatDone` never fires. The UI shows an infinite spinner.

**Files:**
- Modify: `src/renderer/hooks/useMessages.ts:86-125`
- Test: `src/renderer/hooks/useMessages.test.tsx`

**Interfaces:**
- Consumes: `sendChat(payload): Promise<string>` from `../ipc/chat`
- Produces: `send()` — same signature; now guarantees `streaming` is `false` after rejection

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/hooks/useMessages.test.tsx — add test
it("clears streaming state if sendChat throws", async () => {
  vi.mocked(sendChat).mockRejectedValueOnce(new Error("network error"));
  const { result } = renderHook(() => useMessages(null));

  await act(async () => {
    try {
      await result.current.send("hello", "claude");
    } catch {
      // expected
    }
  });

  expect(result.current.streaming).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- useMessages.test
```
Expected: FAIL — `streaming` stays `true` after rejection.

- [ ] **Step 3: Wrap sendChat in try/finally**

In `src/renderer/hooks/useMessages.ts`, replace the `send` callback:

```typescript
  const send = useCallback(
    async (
      message: string,
      backend: string,
      personaId?: string,
      messageId?: string,
      model?: string,
    ) => {
      setStreaming(true);
      streamingContent.current = "";
      const userMsg: Message = {
        id: messageId ?? crypto.randomUUID(),
        conversationId: conversationId ?? "",
        role: "user",
        content: message,
        backend,
        stepIndex: null,
        createdAt: Date.now(),
      };
      const assistantPlaceholder: Message = {
        id: crypto.randomUUID(),
        conversationId: conversationId ?? "",
        role: "assistant",
        content: "",
        backend,
        stepIndex: null,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      try {
        const newConvId = await sendChat({
          conversationId,
          message,
          backend,
          personaId,
          messageId,
          model,
        });
        currentConvId.current = newConvId;
        return newConvId;
      } catch (err) {
        setStreaming(false);
        throw err;
      }
    },
    [conversationId],
  );
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- useMessages.test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useMessages.ts src/renderer/hooks/useMessages.test.tsx
git commit -m "fix: clear streaming state when sendChat throws to prevent infinite spinner"
```

---

### Task 3: Add animated thinking indicator to MessageList

**Root cause:** `src/renderer/components/Chat/MessageList.tsx:60-69` renders a plain `...` inside a bubble while `streaming === true`. This provides no motion signal that the model is actively processing.

**Files:**
- Modify: `src/renderer/components/Chat/MessageList.tsx:60-69`
- Test: `src/renderer/components/Chat/__tests__/MessageList.test.tsx`

**Interfaces:**
- Consumes: `streaming: boolean` prop (unchanged)
- Produces: same component, animated indicator while streaming

- [ ] **Step 1: Write the failing test**

```typescript
// src/renderer/components/Chat/__tests__/MessageList.test.tsx — add test
it("renders three animated dots when streaming", () => {
  render(
    <MessageList
      messages={[]}
      streaming={true}
      conversationId={null}
    />,
  );
  const indicator = screen.getByTestId("streaming-indicator");
  // Should have 3 child dot elements with animate-bounce class
  const dots = indicator.querySelectorAll("[data-testid='streaming-dot']");
  expect(dots).toHaveLength(3);
  expect(dots[0]).toHaveClass("animate-bounce");
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- MessageList.test
```
Expected: FAIL — current indicator is a single `...` text node with no `streaming-dot` children.

- [ ] **Step 3: Replace static `...` with animated pulse dots**

In `src/renderer/components/Chat/MessageList.tsx`, replace lines 60–69:

```tsx
      {streaming && (
        <div className="flex justify-start mb-3">
          <div
            data-testid="streaming-indicator"
            className="bg-bubble rounded-2xl px-4 py-3 flex items-center gap-1"
            aria-label="Generating response"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                data-testid="streaming-dot"
                className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
```

Note: `animationDelay` is an inline style — Tailwind doesn't support arbitrary delay values without config changes. This is the one permitted inline style in this plan.

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- MessageList.test
```
Expected: PASS

- [ ] **Step 5: Run full test suite**

```
npm test
```
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/MessageList.tsx src/renderer/components/Chat/__tests__/MessageList.test.tsx
git commit -m "feat: animated three-dot thinking indicator while streaming"
```
