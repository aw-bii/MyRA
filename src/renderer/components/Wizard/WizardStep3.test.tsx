import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep3 } from "./WizardStep3";

vi.mock("../../ipc", () => ({
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: true, authenticated: true }),
}));

const claudeStatus = {
  id: "claude",
  available: true,
  authenticated: true,
  loading: false,
};

describe("WizardStep3", () => {
  it("calls onBack when the Back button is clicked", () => {
    const onComplete = vi.fn();
    const onBack = vi.fn();
    render(
      <WizardStep3
        statuses={[claudeStatus]}
        onComplete={onComplete}
        onBack={onBack}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
