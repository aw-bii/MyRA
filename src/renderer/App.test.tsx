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
vi.mock("./components/Settings/SettingsModal", () => ({
  SettingsModal: () => null,
}));
vi.mock("./components/Chat/BottomBar", () => ({ BottomBar: () => null }));

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

describe("App layout", () => {
  it("renders the welcome screen in single mode with no active conversation", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /welcome to myra/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /new conversation/i })).toBeTruthy();
  });

  it("renders a skip-to-main-content link for keyboard accessibility", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /skip to main content/i })).toBeTruthy();
  });
});
