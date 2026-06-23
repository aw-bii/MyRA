import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep2 } from "./WizardStep2";

describe("WizardStep2", () => {
  it("calls onBack when the Back button is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onNext when Continue is clicked", () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
