import { describe, it, expect } from "vitest";
import { applyChunk } from "./useMessages";
import type { Message } from "../../shared/types";

const makeMsg = (overrides: Partial<Message>): Message => ({
  id: "x",
  conversationId: "conv-1",
  role: "assistant",
  content: "",
  backend: "claude",
  stepIndex: null,
  createdAt: 0,
  ...overrides,
});

describe("applyChunk", () => {
  it("appends text chunk content to assistant placeholder", () => {
    const ref = { current: "" };
    const state: Message[] = [
      makeMsg({ id: "u1", role: "user", content: "hello" }),
      makeMsg({ id: "a1", role: "assistant", content: "" }),
    ];
    const next = applyChunk(
      state,
      { type: "text", content: "Hi!", conversationId: "conv-1" },
      ref,
    );
    expect(next[1].content).toBe("Hi!");
    expect(ref.current).toBe("Hi!");
  });

  it("renders error chunk as visible error message", () => {
    const ref = { current: "" };
    const state: Message[] = [
      makeMsg({ id: "u1", role: "user", content: "hello" }),
      makeMsg({ id: "a1", role: "assistant", content: "" }),
    ];
    const next = applyChunk(
      state,
      {
        type: "error",
        content: "spawn claude ENOENT",
        conversationId: "conv-1",
      },
      ref,
    );
    expect(next[1].content).toBe("⚠ Error: spawn claude ENOENT");
  });

  it("falls back to matching placeholder with empty conversationId for new conversations", () => {
    const ref = { current: "" };
    const state: Message[] = [
      makeMsg({ id: "u1", role: "user", content: "hello", conversationId: "" }),
      makeMsg({ id: "a1", role: "assistant", content: "", conversationId: "" }),
    ];
    const next = applyChunk(
      state,
      { type: "text", content: "Hi!", conversationId: "conv-new-uuid" },
      ref,
    );
    expect(next[1].content).toBe("Hi!");
    expect(next[1].conversationId).toBe("conv-new-uuid");
  });
});
