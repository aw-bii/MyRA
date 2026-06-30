import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { applyChunk, useMessages } from "./useMessages";
import * as chatIpc from "../ipc/chat";
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

vi.mock("../ipc/chat", () => ({
  sendChat: vi.fn(),
  onChatChunk: vi.fn(() => () => {}),
  onChatDone: vi.fn(() => () => {}),
  abortChat: vi.fn(),
}));

vi.mock("../ipc/conversation", () => ({
  getConversation: vi.fn(() => Promise.resolve({ messages: [] })),
}));

describe("useMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears streaming state if sendChat throws", async () => {
    vi.mocked(chatIpc.sendChat).mockRejectedValueOnce(
      new Error("network error"),
    );
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
