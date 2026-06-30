import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WizardStep4 } from "./WizardStep4";
import * as keyIpc from "../../ipc/key";
import * as backendIpc from "../../ipc/backend";

vi.mock("../../ipc/key");
vi.mock("../../ipc/backend");

beforeEach(() => {
  vi.mocked(keyIpc.storeKey).mockResolvedValue(undefined);
  vi.mocked(backendIpc.probeBackend).mockResolvedValue({ available: true, authenticated: true });
});

describe("WizardStep4", () => {
  it("renders API key inputs for claude-api, gemini-api, openrouter", () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    const claudeInput = screen.getByPlaceholderText(/sk-ant-api03/);
    const geminiInput = screen.getByPlaceholderText(/AIza/);
    const openrouterInput = screen.getByPlaceholderText(/sk-or-v1/);
    expect(claudeInput).toBeInTheDocument();
    expect(geminiInput).toBeInTheDocument();
    expect(openrouterInput).toBeInTheDocument();
  });

  it("stores key and shows verified state on Save", async () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/sk-ant-api03/), {
      target: { value: "sk-ant-test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Claude API Key/i }));
    await waitFor(() => {
      expect(keyIpc.storeKey).toHaveBeenCalledWith("claude-api", "sk-ant-test");
    });
    expect(await screen.findByText(/Saved ✓/i)).toBeInTheDocument();
  });

  it("calls onComplete when Finish is clicked", () => {
    const onComplete = vi.fn();
    render(<WizardStep4 onComplete={onComplete} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Finish Setup/i }));
    expect(onComplete).toHaveBeenCalled();
  });
});
