import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorToast } from "./ErrorToast";

describe("ErrorToast", () => {
  it("renders the error message", () => {
    render(<ErrorToast message="Something went wrong" onDismiss={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("has role=alert for accessibility", () => {
    render(<ErrorToast message="Error occurred" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<ErrorToast message="Error" onDismiss={onDismiss} />);
    await userEvent.click(
      screen.getByRole("button", { name: /dismiss error/i }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorToast auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-dismisses after the duration timeout", () => {
    const onDismiss = vi.fn();
    render(
      <ErrorToast message="Error" onDismiss={onDismiss} duration={3000} />,
    );
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
