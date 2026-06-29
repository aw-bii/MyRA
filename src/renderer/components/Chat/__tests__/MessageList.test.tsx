import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../ipc/attachment", () => ({
  listAttachments: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

import { MessageList } from "../MessageList";

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
      <MessageList messages={[]} streaming={false} conversationId={null} role="tabpanel" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("tabpanel");
    expect(root.getAttribute("aria-live")).toBeNull();
  });
});
