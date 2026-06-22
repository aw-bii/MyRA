import { describe, it, expect } from "vitest";
import type { SearchResult, Message } from "./types";

describe("SearchResult type", () => {
  it("can be constructed with required fields", () => {
    const msg: Message = {
      id: "m1",
      conversationId: "c1",
      role: "user",
      content: "Hello world",
      backend: "claude",
      stepIndex: null,
      createdAt: 1000,
    };
    const result: SearchResult = {
      message: msg,
      conversationTitle: "Test Chat",
      snippet: "Hello ...",
      rank: 0.5,
    };
    expect(result.message.id).toBe("m1");
    expect(result.conversationTitle).toBe("Test Chat");
    expect(result.snippet).toBe("Hello ...");
    expect(result.rank).toBe(0.5);
  });
});
