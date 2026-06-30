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

  it("re-focuses first button when a second queued event arrives while dialog is open", async () => {
    const eventA = {
      type: "injection_detected" as const,
      severity: "low" as const,
      message: "Event A",
      detail: "detail A",
      source: "claude",
    };
    const eventB = {
      type: "injection_detected" as const,
      severity: "high" as const,
      message: "Event B",
      detail: "detail B",
      source: "claude",
    };

    const { rerender } = render(
      <SecurityDialog event={eventA} onRespond={vi.fn()} />,
    );

    // Event A: dialog is open, Dismiss receives focus
    const dismissA = screen.getByRole("button", { name: /dismiss/i });
    expect(document.activeElement).toBe(dismissA);

    // Simulate user moving focus away (tabbing to another element)
    dismissA.blur();

    // Event B arrives before Event A was resolved
    rerender(<SecurityDialog event={eventB} onRespond={vi.fn()} />);

    // Focus should return to the first button of the updated dialog
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /dismiss/i }),
      );
    });
  });
});
