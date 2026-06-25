import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all hooks to avoid rendering full App dependencies
vi.mock("./hooks/usePipelines", () => ({ usePipelines: () => ({ templates: [] }) }));
vi.mock("./hooks/useConversations", () => ({
  useConversations: () => ({ conversations: [], loading: false }),
}));
vi.mock("./hooks/useBackends", () => ({
  useBackends: () => ({ backends: [], loading: false }),
}));
vi.mock("./hooks/usePersonas", () => ({
  usePersonas: () => ({ personas: [], loading: false, save: vi.fn(), remove: vi.fn() }),
}));

// Mock components that have complex dependencies
vi.mock("./components/UpdateBanner", () => ({ UpdateBanner: () => null }));
vi.mock("./components/DiagnosticBanner", () => ({ DiagnosticBanner: () => null }));
vi.mock("./components/SecurityDialog", () => ({ SecurityDialog: () => null }));
vi.mock("./components/Chat/ChatView", () => ({ ChatView: () => null }));
vi.mock("./components/Sidebar/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("./components/Personas/PersonaPanel", () => ({ PersonaPanel: () => null }));
vi.mock("./components/Pipelines/PipelinePanel", () => ({ PipelinePanel: () => null }));
vi.mock("./components/Settings/SettingsPanel", () => ({ SettingsPanel: () => null }));

// Mock window.ipc
Object.defineProperty(window, "ipc", {
  value: {
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(() => vi.fn()),
  },
  configurable: true,
});

import App from "./App";

beforeEach(() => {
  localStorage.setItem("wizardDone", "1");
});

describe("Toolbar ARIA labels", () => {
  it("all toolbar buttons have accessible names", () => {
    render(<App />);
    // These aria-labels must exist after the fix
    expect(screen.getByRole("button", { name: /scheduled tasks/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /model context protocol/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /plugins/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /personas/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /pipelines/i })).toBeTruthy();
  });
});
