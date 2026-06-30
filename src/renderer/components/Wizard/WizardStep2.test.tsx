import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep2 } from "./WizardStep2";

vi.mock("../../ipc/backend", () => ({
  installBackend: vi.fn().mockResolvedValue({ success: false }),
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: false, authenticated: false }),
}));

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

describe("WizardStep2 install error", () => {
  it("shows an error message when installation fails", async () => {
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };

    const { findByText } = render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    expect(await findByText(/installation failed/i)).toBeTruthy();
  });
});

describe("WizardStep2 - Labels and Ollama", () => {
  it("shows a label for every missing backend including ollama and codex", () => {
    render(
      <WizardStep2
        missing={["ollama", "codex", "claude", "openrouter"]}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Ollama")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("OpenRouter")).toBeTruthy();
  });

  it("shows a Start Ollama button for the ollama backend", () => {
    render(
      <WizardStep2 missing={["ollama"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    expect(screen.getByText("Start Ollama")).toBeTruthy();
  });
});
