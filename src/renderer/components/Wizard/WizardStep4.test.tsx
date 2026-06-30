import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WizardStep4 } from "./WizardStep4";
import * as keyIpc from "../../ipc/key";

vi.mock("../../ipc/key");

beforeEach(() => {
  vi.mocked(keyIpc.storeKey).mockResolvedValue(undefined);
});

describe("WizardStep4", () => {
  it("renders API key inputs for claude-api, gemini-api, openrouter", () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByLabelText("Claude API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("Gemini API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenRouter API Key")).toBeInTheDocument();
  });

  it("stores key and shows verified state on Save", async () => {
    render(<WizardStep4 onComplete={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Claude API Key"), {
      target: { value: "sk-ant-test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Save Claude API Key/i }),
    );
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
