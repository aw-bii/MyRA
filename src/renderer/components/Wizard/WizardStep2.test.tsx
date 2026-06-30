import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WizardStep2 } from "./WizardStep2";
import { probeBackend, installBackend } from "../../ipc/backend";
vi.mock("../../ipc/backend", () => ({
  installBackend: vi.fn().mockResolvedValue({ success: false }),
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: false, authenticated: false }),
}));

vi.mock("../../ipc/app", () => ({
  relaunchApp: vi.fn().mockResolvedValue(undefined),
}));

describe("WizardStep2", () => {
  it("calls onBack when the Back button is clicked", async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    // Wait for reprobing to complete (should be immediate with empty missing array)
    await waitFor(() => {
      expect(screen.queryByText(/Checking installed/i)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("calls onNext when Continue is clicked", async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    render(<WizardStep2 missing={[]} onNext={onNext} onBack={onBack} />);
    // Wait for reprobing to complete (should be immediate with empty missing array)
    await waitFor(() => {
      expect(screen.queryByText(/Checking installed/i)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});

describe("WizardStep2 install error", () => {
  it("shows an error message when installation fails", async () => {
    // Mock probeBackend to return unavailable so gemini is shown for install
    vi.mocked(probeBackend).mockResolvedValue({
      available: false,
      authenticated: false,
    });
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };

    const { findByText } = render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );

    // Wait for reprobing to complete
    await waitFor(() => {
      expect(screen.queryByText(/Checking installed/i)).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    expect(await findByText(/installation failed/i)).toBeTruthy();
  });
});

describe("WizardStep2 - Labels and Ollama", () => {
  it("shows a label for every missing backend including ollama and codex", async () => {
    // Mock probeBackend to return unavailable so all backends are shown
    vi.mocked(probeBackend).mockResolvedValue({
      available: false,
      authenticated: false,
    });
    render(
      <WizardStep2
        missing={["ollama", "codex", "claude", "openrouter"]}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Ollama")).toBeTruthy();
    });
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("OpenRouter")).toBeTruthy();
  });

  it("shows a Start Ollama button for the ollama backend", async () => {
    // Mock probeBackend to return unavailable so ollama is shown
    vi.mocked(probeBackend).mockResolvedValue({
      available: false,
      authenticated: false,
    });
    render(
      <WizardStep2 missing={["ollama"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Start Ollama")).toBeTruthy();
    });
  });
});

describe("WizardStep2 - Re-probe on mount", () => {
  it("hides backends that are now available when re-probing on mount", async () => {
    vi.mocked(probeBackend).mockResolvedValue({
      available: true,
      authenticated: false,
    });
    render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    // After re-probe resolves, gemini is available → should not show Install button
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Install/i })).toBeNull();
    });
  });
});

describe("WizardStep2 - Spinner and status line", () => {
  it("shows a spinner while installing and hides the terminal pre block", async () => {
    let probeCallCount = 0;
    vi.mocked(probeBackend).mockImplementation(async () => {
      probeCallCount++;
      // First call (initial reprobing) returns unavailable, subsequent calls return available
      return { available: probeCallCount > 1, authenticated: false };
    });
    vi.mocked(installBackend).mockImplementation(
      () => new Promise((res) => setTimeout(() => res({ success: true }), 100)),
    );
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };
    render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    await waitFor(() => screen.getByRole("button", { name: /^Install$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Install$/ }));
    expect(screen.getByTestId("install-spinner-gemini")).toBeInTheDocument();
    expect(screen.queryByRole("log")).toBeNull(); // no <pre> terminal
    await waitFor(() => {
      expect(
        screen.getByText(/Installed and detected on PATH/),
      ).toBeInTheDocument();
    });
  });
});

describe("WizardStep2 - Restart banner", () => {
  it("shows restart banner after a successful install", async () => {
    let probeCallCount = 0;
    vi.mocked(probeBackend).mockImplementation(async () => {
      probeCallCount++;
      // First call (initial reprobing) returns unavailable, subsequent calls return available
      return { available: probeCallCount > 1, authenticated: false };
    });
    vi.mocked(installBackend).mockResolvedValue({ success: true });
    (window as unknown as { ipc: { on: ReturnType<typeof vi.fn> } }).ipc = {
      on: vi.fn().mockReturnValue(() => {}),
    };
    render(
      <WizardStep2 missing={["gemini"]} onNext={vi.fn()} onBack={vi.fn()} />,
    );
    await waitFor(() => screen.getByRole("button", { name: /^Install$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Install$/ }));
    expect(
      await screen.findByTestId("path-restart-banner"),
    ).toBeInTheDocument();
  });
});
