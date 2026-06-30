import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../ipc/attachment", () => ({
  listAttachments: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

import { MessageList } from "../MessageList";

describe("MessageList streaming indicator", () => {
  it("renders three animated dots when streaming", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={true} conversationId={null} />,
    );
    const indicator = container.querySelector(
      '[data-testid="streaming-indicator"]',
    );
    // Should have 3 child dot elements with animate-bounce class
    const dots = indicator?.querySelectorAll("[data-testid='streaming-dot']");
    expect(dots).toHaveLength(3);
    expect(dots?.[0]).toHaveClass("animate-bounce");
  });

  it("shows an indicator during streaming", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={true} conversationId={null} />,
    );
    const indicator = container.querySelector(
      '[data-testid="streaming-indicator"]',
    );
    expect(indicator).toBeTruthy();
  });

  it("hides indicator when not streaming", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    expect(
      container.querySelector('[data-testid="streaming-indicator"]'),
    ).toBeNull();
  });
});

describe("MessageList aria-live", () => {
  it("does not carry aria-live on its root element", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-live")).toBeNull();
  });

  it("renders with role=log by default", () => {
    const { container } = render(
      <MessageList messages={[]} streaming={false} conversationId={null} />,
    );
    expect(container.firstElementChild?.getAttribute("role")).toBe("log");
  });

  it("accepts role=tabpanel without aria-live", () => {
    const { container } = render(
      <MessageList
        messages={[]}
        streaming={false}
        conversationId={null}
        role="tabpanel"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("tabpanel");
    expect(root.getAttribute("aria-live")).toBeNull();
  });
});
