import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel";

vi.mock("../../ipc/settings", () => ({
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn(),
}));
vi.mock("../../ipc/key", () => ({
  getAppVersion: vi.fn().mockResolvedValue("0.2.1"),
  storeKey: vi.fn().mockResolvedValue(undefined),
  deleteKey: vi.fn().mockResolvedValue(undefined),
  hasKey: vi
    .fn()
    .mockImplementation((id: string) => Promise.resolve(id === "openai")),
}));
vi.mock("../../ipc/backend", () => ({
  probeBackend: vi
    .fn()
    .mockResolvedValue({ available: false, authenticated: false }),
}));
vi.mock("../../ipc/net", () => ({
  getProxySettings: vi
    .fn()
    .mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  setProxySettings: vi.fn(),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe("SettingsPanel key UX", () => {
  it("shows Remove button for providers that already have a key stored", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    // Wait for hasKey to resolve
    await vi.waitFor(() => {
      expect(screen.getByText("Remove")).toBeTruthy();
    });
  });

  it("shows Save button for providers with no key stored", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    await vi.waitFor(() => {
      // OpenRouter, Claude API, Gemini API have no key — show Save
      const saveBtns = screen.getAllByText("Save");
      expect(saveBtns.length).toBeGreaterThan(0);
    });
  });
});
