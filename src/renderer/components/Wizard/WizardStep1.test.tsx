import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WizardStep1 } from "./WizardStep1";

vi.mock("../../ipc/backend", () => ({
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: false, authenticated: false }),
}));

describe("WizardStep1", () => {
  it("renders all 8 backends", async () => {
    render(<WizardStep1 onNext={vi.fn()} />);
    const expectedLabels = [
      "Claude Code",
      "Claude API",
      "Gemini CLI",
      "Gemini API",
      "Opencode",
      "Ollama",
      "OpenRouter",
      "Codex",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("probes claude instead of marking it bundled", async () => {
    const { probeBackend } = await import("../../ipc/backend");
    render(<WizardStep1 onNext={vi.fn()} />);
    // probeBackend should be called for all backends including claude
    await vi.waitFor(() => {
      expect(vi.mocked(probeBackend)).toHaveBeenCalledWith("claude");
    });
  });
});
