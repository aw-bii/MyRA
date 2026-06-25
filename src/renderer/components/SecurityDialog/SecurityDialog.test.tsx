import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecurityDialog } from "./SecurityDialog";

describe("SecurityDialog", () => {
  const mockRespond = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders warning for injection event", () => {
    render(
      <SecurityDialog
        event={{
          type: "injection_detected",
          severity: "high",
          message: "Injection detected",
          detail: "Found pattern X",
          source: "claude",
        }}
        onRespond={mockRespond}
      />,
    );
    expect(screen.getByText(/Injection detected/i)).toBeDefined();
    expect(screen.getByText(/high/i)).toBeDefined();
  });

  it("renders approve/deny buttons for write approval", () => {
    render(
      <SecurityDialog
        event={{
          type: "write_approval_needed",
          severity: "medium",
          message: "File write requires approval",
          detail: "/etc/passwd",
          source: "opencode",
          filePath: "/etc/passwd",
          content: "root:x:0:0:",
        }}
        onRespond={mockRespond}
      />,
    );
    expect(screen.getByText(/Approve/i)).toBeDefined();
    expect(screen.getByText(/Deny/i)).toBeDefined();
  });

  it("uses motion-safe:animate-scale-in class, not bare animate-scale-in", () => {
    const { container } = render(
      <SecurityDialog
        event={{
          type: "injection_detected",
          severity: "high",
          message: "Injection detected",
          detail: "Found pattern X",
          source: "claude",
        }}
        onRespond={vi.fn()}
      />,
    );
    const card = container.querySelector(
      '[role="dialog"] > div',
    ) as HTMLElement;
    expect(card.classList.contains("motion-safe:animate-scale-in")).toBe(true);
    expect(card.classList.contains("animate-scale-in")).toBe(false);
  });

  it("calls onRespond with approved=true when approve clicked", () => {
    render(
      <SecurityDialog
        event={{
          type: "write_approval_needed",
          severity: "medium",
          message: "Write approval needed",
          detail: "/tmp/test.txt",
          source: "claude",
          filePath: "/tmp/test.txt",
          content: "data",
        }}
        onRespond={mockRespond}
      />,
    );
    fireEvent.click(screen.getByText(/Approve/i));
    expect(mockRespond).toHaveBeenCalledWith(true);
  });
});

describe("SecurityDialog focus trap", () => {
  it("Dismiss button receives focus when dialog opens", () => {
    const event = {
      type: "injection_detected" as const,
      severity: "low" as const,
      message: "Test alert",
      detail: "pattern matched",
      source: "claude",
    };
    render(<SecurityDialog event={event} onRespond={vi.fn()} />);
    // First focusable element inside dialog should be focused
    const dismiss = screen.getByRole("button", { name: /dismiss/i });
    expect(document.activeElement).toBe(dismiss);
  });
});
