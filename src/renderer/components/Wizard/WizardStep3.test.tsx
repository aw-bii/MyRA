import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep3 } from "./WizardStep3";
import { probeBackend } from "../../ipc/backend";

vi.mock("../../ipc/backend", () => ({
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

describe("WizardStep3 recheck failure", () => {
  it("shows an error message when recheck returns unauthenticated", async () => {
    vi.mocked(probeBackend).mockResolvedValueOnce({
      available: true,
      authenticated: false,
    });

    const needsAuthStatus = {
      id: "gemini",
      available: true,
      authenticated: false,
      loading: false,
    };

    const { findByText } = render(
      <WizardStep3
        statuses={[needsAuthStatus]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));

    expect(await findByText(/could not verify/i)).toBeTruthy();
  });
});

describe("WizardStep3 all-signed-in state", () => {
  it("hides the 'click Check' subtitle when all tools are signed in", () => {
    render(
      <WizardStep3
        statuses={[claudeStatus]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.queryByText(/then click check/i)).toBeNull();
  });

  it("shows the 'click Check' subtitle when a tool needs auth", () => {
    render(
      <WizardStep3
        statuses={[
          {
            id: "gemini",
            available: true,
            authenticated: false,
            loading: false,
          },
        ]}
        onComplete={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/then click check/i)).toBeTruthy();
  });
});
