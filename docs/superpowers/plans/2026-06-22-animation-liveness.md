# Animation Liveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two animation regressions that make the app feel sluggish, then add five targeted liveness improvements — streaming dots, button morphing, and micro-entrances — to make the chat feel alive without adding noise.

**Architecture:** All animation is CSS-first (Tailwind keyframes + transitions); no animation library is introduced. New keyframes are registered once in `tailwind.config.ts` and consumed as utility classes. The `MessageList` component receives a `conversationId` prop so it can distinguish historical messages from live ones and only animate the latter.

**Tech Stack:** React 18, Tailwind CSS v3, TypeScript, Electron (renderer process only — no main process changes)

## Global Constraints

- Animate only `transform` and `opacity` — never `width`, `height`, `margin`, `padding`, `top`, `left`
- Never use `transition: all` or `transition-all`
- All hover animations must be gated behind the existing `hoverable:` variant (`@media (hover: hover) and (pointer: fine)`)
- UI animations must stay under 300ms unless explicitly justified
- `prefers-reduced-motion` handling must be preserved (behavior changes in Task 2 but coverage must not shrink)
- Do not add any new npm dependencies

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/components/Chat/MessageList.tsx` | Add `conversationId` prop; replace all-message stagger with seen-ID tracking; replace "thinking…" with bounce dots; fix scroll dep |
| `src/renderer/components/Chat/ChatView.tsx` | Pass `conversationId` to `<MessageList>` in both `SingleChatView` and `PipelineChatView` |
| `tailwind.config.ts` | Add `bounce-dot` keyframe and animation |
| `src/renderer/index.css` | Remove `transition-duration` from the global reduced-motion kill rule |
| `src/renderer/components/Chat/InputBar.tsx` | Overlay Send/Stop buttons and crossfade between them |
| `src/renderer/components/Chat/AttachmentChip.tsx` | Add entrance animation to the chip wrapper |

---

## Task 1: Fix MessageList — history stagger and scroll regression

**Problem 1 — stagger fires on all historical messages:** Every time you switch conversations, all loaded messages animate in with `animate-fade-in-up`. For 20+ messages the stagger cap (500 ms) causes a visible cascade and a simultaneous burst at the end. Switching conversations is "occasional" per frequency table, but this amount of motion is excessive.

**Problem 2 — scroll fires on every streaming chunk:** `useEffect([messages])` calls `scrollIntoView` whenever the `messages` array reference changes — including mid-stream content updates. This fights the user's scroll position during generation.

**Fix:** Track which message IDs have already been rendered. Seed the seen-set with all current IDs whenever `conversationId` changes (marking them historical). New IDs (streaming / newly sent) animate; the rest don't. Scroll only when the last message ID changes.

**Files:**
- Modify: `src/renderer/components/Chat/MessageList.tsx`
- Modify: `src/renderer/components/Chat/ChatView.tsx`

**Interfaces:**
- Produces: `MessageList` now accepts `conversationId: string | null` as a required prop

- [ ] **Step 1: Update MessageList to accept and use conversationId**

Replace the entire contents of `src/renderer/components/Chat/MessageList.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../../shared/types";

interface Props {
  messages: Message[];
  streaming: boolean;
  conversationId: string | null;
}

export function MessageList({ messages, streaming, conversationId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track which message IDs have been shown. Seeded with all current IDs
  // whenever conversationId changes so historical messages don't animate.
  const seenIdsRef = useRef(new Set<string>());
  const prevConvIdRef = useRef<string | null | undefined>(undefined);

  if (prevConvIdRef.current !== conversationId) {
    prevConvIdRef.current = conversationId;
    messages.forEach((m) => seenIdsRef.current.add(m.id));
  }

  // Register rendered IDs after each paint so future renders know what's old.
  useEffect(() => {
    messages.forEach((m) => seenIdsRef.current.add(m.id));
  }, [messages]);

  // Only scroll when a genuinely new message appears (not on every chunk).
  const lastMsgId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMsgId]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.map((msg) => {
        const isNew = !seenIdsRef.current.has(msg.id);
        return (
          <div key={msg.id} className={isNew ? "animate-fade-in-up" : undefined}>
            <MessageBubble message={msg} />
          </div>
        );
      })}
      {streaming && (
        <div className="flex justify-start mb-3">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-1">
            <span className="animate-pulse text-sm text-gray-500">thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

Note: the streaming indicator stays as `animate-pulse` for now — Task 3 replaces it with bounce dots.

- [ ] **Step 2: Pass conversationId in SingleChatView**

In `src/renderer/components/Chat/ChatView.tsx`, find the `MessageList` call inside `SingleChatView` (line 67) and add the prop:

```tsx
// Before:
<MessageList messages={messages} streaming={streaming} />

// After:
<MessageList messages={messages} streaming={streaming} conversationId={conversationId} />
```

- [ ] **Step 3: Pass conversationId in PipelineChatView**

In the same file, find the `MessageList` call inside `PipelineChatView` (line 134) and add the prop:

```tsx
// Before:
<MessageList
  messages={activeMessages}
  streaming={streaming && streamingStepIndex === activeTabIndex}
/>

// After:
<MessageList
  messages={activeMessages}
  streaming={streaming && streamingStepIndex === activeTabIndex}
  conversationId={conversationId}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, no type errors. If you see `Property 'conversationId' is missing`, you missed one of the two call sites above.

- [ ] **Step 5: Visual smoke test**

```bash
npm run dev
```

1. Open a conversation that has existing messages → they should appear **without** any fade animation.
2. Send a new message → your message and the AI response should each **fade up** individually as they arrive.
3. Switch to another conversation → messages appear immediately, no cascade.
4. During streaming, try scrolling up → the view should stay put (not jump back on every chunk).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Chat/MessageList.tsx src/renderer/components/Chat/ChatView.tsx
git commit -m "fix: only animate new messages in MessageList; fix scroll dep to last message ID"
```

---

## Task 2: Fix prefers-reduced-motion to preserve comprehension transitions

**Problem:** The global rule in `index.css` sets `transition-duration: 0.01ms !important` on `*`. This kills color and opacity transitions, which aid comprehension (e.g., the active state highlight on sidebar items, the disabled-state fade on buttons). Per the standards, reduced-motion means **reduce movement**, not eliminate all feedback. Only `animation-duration` (keyframe-based motion) needs to be zeroed.

**Files:**
- Modify: `src/renderer/index.css`

- [ ] **Step 1: Remove transition-duration from the kill rule**

In `src/renderer/index.css`, find the reduced-motion block (lines 20–29) and remove the `transition-duration` line:

```css
/* Before: */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* After: */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

`animation-duration: 0.01ms` still kills all keyframe animations (fade-in-up, bounce-dot). Button press scale (`transition-transform 100ms`) remains active but is a 2% visual change over 100 ms — well within WCAG vestibular thresholds.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.css
git commit -m "fix: keep color/opacity transitions under prefers-reduced-motion; only kill keyframe animations"
```

---

## Task 3: Streaming dots — replace "thinking…" with bouncing dots

**Problem:** The `animate-pulse` on the "thinking…" text is invisible against the gray bubble. Users stare at this indicator during every AI response — it should feel alive.

**Solution:** Three dots bouncing in sequence (iMessage-style). Each dot animates `translateY(0 → -4px → 0)` over a 1.4 s loop, staggered 200 ms apart. Implemented as a Tailwind keyframe so it runs off the main thread.

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/renderer/components/Chat/MessageList.tsx`

- [ ] **Step 1: Add bounce-dot keyframe to Tailwind config**

In `tailwind.config.ts`, add to the `keyframes` and `animation` objects (alongside the existing `fade-in-up`):

```ts
keyframes: {
  "fade-in-up": {
    "0%": { opacity: "0", transform: "translateY(8px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
  "bounce-dot": {
    "0%, 60%, 100%": { transform: "translateY(0)" },
    "30%": { transform: "translateY(-4px)" },
  },
},
animation: {
  "fade-in-up": "fade-in-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
  "bounce-dot": "bounce-dot 1.4s ease-in-out infinite",
},
```

- [ ] **Step 2: Replace the streaming indicator in MessageList**

In `src/renderer/components/Chat/MessageList.tsx`, replace the `streaming` block:

```tsx
// Before:
{streaming && (
  <div className="flex justify-start mb-3">
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
      <span className="animate-pulse text-sm text-gray-500">
        thinking...
      </span>
    </div>
  </div>
)}

// After:
{streaming && (
  <div className="flex justify-start mb-3">
    <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce-dot" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce-dot" style={{ animationDelay: "200ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce-dot" style={{ animationDelay: "400ms" }} />
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Visual smoke test**

```bash
npm run dev
```

Send a message and watch the streaming indicator. Three dots should rise and fall in sequence (left-to-right wave). The dots should be visible against both light and dark backgrounds. The animation should run smoothly and continuously until the response begins.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts src/renderer/components/Chat/MessageList.tsx
git commit -m "feat: replace thinking pulse with bouncing dots streaming indicator"
```

---

## Task 4: Send→Stop button morph

**Problem:** The Send and Stop buttons swap instantly (`{streaming ? <Stop> : <Send>}`). The hard toggle reads as a blink, with no indication that the app mode changed.

**Solution:** Always render both buttons stacked. The Send button holds layout (not `absolute`). The Stop button overlays it absolutely. Crossfade with `opacity` + `scale(0.9 → 1.0)` over 120 ms using `ease-out`. Use `transition-[opacity,transform]` — never `transition-all`.

**Files:**
- Modify: `src/renderer/components/Chat/InputBar.tsx`

- [ ] **Step 1: Replace the conditional Send/Stop render**

In `src/renderer/components/Chat/InputBar.tsx`, find the ternary at line 146–161:

```tsx
// Before:
{streaming ? (
  <button
    onClick={onAbort}
    className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hoverable:hover:bg-red-600 transition-transform duration-100 ease-press active:scale-95"
  >
    Stop
  </button>
) : (
  <button
    onClick={submit}
    disabled={!value.trim() || isDisabled}
    className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 disabled:opacity-50 transition-transform duration-100 ease-press active:scale-95"
  >
    {ingesting ? "…" : "Send"}
  </button>
)}
```

Replace with:

```tsx
<div className="relative">
  {/* Send — always in layout; hidden when streaming */}
  <button
    onClick={submit}
    disabled={!value.trim() || isDisabled || streaming}
    tabIndex={streaming ? -1 : 0}
    aria-hidden={streaming}
    className={`px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 disabled:opacity-50 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
      streaming ? "opacity-0 scale-90 pointer-events-none" : "opacity-100 scale-100"
    }`}
  >
    {ingesting ? "…" : "Send"}
  </button>
  {/* Stop — absolute overlay; shown when streaming */}
  <button
    onClick={onAbort}
    tabIndex={streaming ? 0 : -1}
    aria-hidden={!streaming}
    className={`absolute inset-0 rounded-xl bg-red-500 text-white text-sm hoverable:hover:bg-red-600 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
      streaming ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90 pointer-events-none"
    }`}
  >
    Stop
  </button>
</div>
```

Key details:
- `tabIndex` swaps so keyboard navigation always reaches the correct button.
- `aria-hidden` hides the inactive button from screen readers.
- `pointer-events-none` on the hidden button prevents accidental clicks through the overlay.
- `scale-90` is Tailwind's `scale(0.9)` — the hidden button shrinks away as it fades.
- `duration-[120ms]` uses Tailwind's arbitrary value syntax.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0. TypeScript will catch any class name errors.

- [ ] **Step 3: Visual smoke test**

```bash
npm run dev
```

1. Send a message. As streaming starts, the blue Send button should fade out and shrink while the red Stop button fades in and grows — a smooth ~120 ms crossfade.
2. The Stop button should be clickable immediately (abort works).
3. When streaming ends, the reverse morph plays: Stop fades out, Send fades in.
4. Tab through the input area — only the active button should be focusable at any given time.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Chat/InputBar.tsx
git commit -m "feat: crossfade Send/Stop button on streaming state change"
```

---

## Task 5: Micro-entrances — AttachmentChip and empty states

Three small one-line changes, all using the already-defined `animate-fade-in-up`. Each targets an element that currently appears with no transition.

**Files:**
- Modify: `src/renderer/components/Chat/AttachmentChip.tsx`
- Modify: `src/renderer/components/Chat/ChatView.tsx`

**Interfaces:**
- Consumes: `animate-fade-in-up` from `tailwind.config.ts` (defined in Task 1; no new keyframes needed)

- [ ] **Step 1: Add entrance animation to AttachmentChip**

In `src/renderer/components/Chat/AttachmentChip.tsx`, add `animate-fade-in-up [animation-duration:150ms]` to the outer `<div>`:

```tsx
// Before:
<div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs max-w-[160px]">

// After:
<div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs max-w-[160px] animate-fade-in-up [animation-duration:150ms]">
```

`[animation-duration:150ms]` overrides the default 300 ms — chips are small and should snap in faster.

- [ ] **Step 2: Add entrance animation to the SingleChatView empty state**

In `src/renderer/components/Chat/ChatView.tsx`, find the empty state div inside `SingleChatView` (the `"Start a conversation"` text, around line 61):

```tsx
// Before:
<div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
  Start a conversation
</div>

// After:
<div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-fade-in-up">
  Start a conversation
</div>
```

- [ ] **Step 3: Add entrance animation to the PipelineChatView empty states**

In the same file, `PipelineChatView` has two empty state divs (around lines 127–131). Add `animate-fade-in-up` to both:

```tsx
// First empty state (no pipeline run yet):
// Before:
<div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
  {Object.keys(stepMessages).length === 0
    ? "Start a pipeline run"
    : "No output for this step yet"}
</div>

// After:
<div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-fade-in-up">
  {Object.keys(stepMessages).length === 0
    ? "Start a pipeline run"
    : "No output for this step yet"}
</div>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 5: Visual smoke test**

```bash
npm run dev
```

1. Open a new conversation → "Start a conversation" placeholder should fade up over 300 ms.
2. Attach a file via the paperclip → the chip should fade up over ~150 ms when it appears.
3. Remove the attachment → chip disappears immediately (no exit animation needed).
4. Open a pipeline conversation with no messages → empty state fades in.

- [ ] **Step 6: Lint check**

```bash
npm run lint
```

Expected: exits 0 (no new lint errors introduced).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Chat/AttachmentChip.tsx src/renderer/components/Chat/ChatView.tsx
git commit -m "feat: add fade-in-up entrance to attachment chips and empty state placeholders"
```

---

## Self-Review

**Spec coverage check:**

| Finding from review | Covered by |
|---------------------|-----------|
| History-load stagger fires on all messages | Task 1 — seenIds ref |
| Stagger cap (500ms) causes burst | Task 1 — stagger removed entirely for new-only model |
| `prefers-reduced-motion` kills all transitions | Task 2 |
| Streaming indicator invisible | Task 3 |
| Send→Stop instant toggle | Task 4 |
| AttachmentChip no entrance | Task 5, Step 1 |
| Empty state no entrance | Task 5, Steps 2–3 |
| `scrollIntoView` on every streaming chunk | Task 1 |

**Placeholder scan:** No TBD, TODO, or "similar to" references. Every code block is complete and copy-pasteable.

**Type consistency:**
- `conversationId: string | null` — defined in Task 1's `Props` interface; used as `string | null` in both call sites (both parents already have `conversationId: string | null` in their own props).
- `animate-fade-in-up` — defined in `tailwind.config.ts` (unchanged); consumed in Tasks 1, 5.
- `animate-bounce-dot` — defined in Task 3 Step 1; consumed in Task 3 Step 2. No forward reference.
- `duration-[120ms]`, `scale-90` — standard Tailwind arbitrary/utility classes; no config needed.
