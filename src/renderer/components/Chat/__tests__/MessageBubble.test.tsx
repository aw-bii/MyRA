import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MessageBubble, clearAttachmentCache } from "../MessageBubble";
import type { Message } from "../../../../shared/types";

vi.mock("react-markdown", () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

const { mockListAttachments } = vi.hoisted(() => ({
  mockListAttachments: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../ipc/attachment", () => ({
  listAttachments: mockListAttachments,
}));

beforeEach(() => {
  mockListAttachments.mockClear();
  clearAttachmentCache();
});

describe("MessageBubble", () => {
  const userMsg: Message = {
    id: "1",
    conversationId: "c1",
    role: "user",
    content: "Hello",
    backend: "claude",
    stepIndex: null,
    createdAt: Date.now(),
  };
  const assistantMsg: Message = {
    id: "2",
    conversationId: "c1",
    role: "assistant",
    content: "Hi there",
    backend: "claude",
    stepIndex: null,
    createdAt: Date.now(),
  };

  it("renders user message content", () => {
    const { container } = render(<MessageBubble message={userMsg} />);
    expect(container.textContent).toContain("Hello");
  });

  it("renders assistant message content", () => {
    render(<MessageBubble message={assistantMsg} />);
    expect(screen.getByTestId("markdown")).toBeTruthy();
  });

  it("shows backend and timestamp", () => {
    const { container } = render(<MessageBubble message={userMsg} />);
    expect(container.textContent).toContain("claude");
  });

  it("renders user message timestamp without opacity-50 class", () => {
    const { container } = render(<MessageBubble message={userMsg} />);
    const timestampEl = container.querySelector(".text-xs.mt-1");
    expect(timestampEl).not.toHaveClass("opacity-50");
    expect(timestampEl).toHaveClass("text-on-primary/70");
  });
});

describe("MessageBubble accessibility", () => {
  const userMsg: Message = {
    id: "m1",
    role: "user",
    content: "Hello",
    conversationId: "c1",
    backend: "claude",
    stepIndex: null,
    createdAt: 1719313200000, // 2026-06-25T10:00:00.000Z
  };

  const assistantMsg: Message = {
    id: "m2",
    role: "assistant",
    content: "Hi there",
    conversationId: "c1",
    backend: "claude",
    stepIndex: null,
    createdAt: 1719313200000, // 2026-06-25T10:00:00.000Z
  };

  it("user bubble has aria-label identifying sender", () => {
    render(<MessageBubble message={userMsg} />);
    expect(screen.getByRole("article", { name: /your message/i })).toBeTruthy();
  });

  it("assistant bubble has aria-label identifying sender", () => {
    render(<MessageBubble message={assistantMsg} />);
    expect(
      screen.getByRole("article", { name: /assistant message/i }),
    ).toBeTruthy();
  });

  it("timestamp uses <time> element with datetime attribute", () => {
    const { container } = render(<MessageBubble message={userMsg} />);
    const timeEl = container.querySelector("time");
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute("dateTime")).toBe(
      new Date(userMsg.createdAt).toISOString(),
    );
  });
});

describe("MessageBubble attachment fetch", () => {
  const userMsg: Message = {
    id: "m1",
    role: "user",
    content: "Hi",
    conversationId: "c1",
    backend: "claude",
    stepIndex: null,
    createdAt: Date.now(),
  };

  it("fetches attachments only once per message id, not on re-render", async () => {
    mockListAttachments.mockClear();
    const { rerender } = render(<MessageBubble message={userMsg} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);

    // Re-render with same message id but different content — should NOT fetch again
    rerender(<MessageBubble message={{ ...userMsg, content: "updated" }} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);
  });

  it("uses cached attachments on remount with same message id (conversation switch back)", async () => {
    mockListAttachments.mockClear();
    const { unmount } = render(<MessageBubble message={userMsg} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);

    // Unmount (switch away)
    unmount();

    // Remount (switch back) — should use cache, not re-fetch
    render(<MessageBubble message={userMsg} />);
    await act(async () => {});
    expect(mockListAttachments).toHaveBeenCalledTimes(1);
  });
});
