import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
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
vi.mock("./components/Chat/ChatView", () => ({
  ChatView: vi.fn(({ bottomBar }: { bottomBar?: React.ReactNode }) => <>{bottomBar}</>),
}));
vi.mock("./components/Sidebar/Sidebar", () => ({ Sidebar: vi.fn(() => null) }));
vi.mock("./components/Settings/SettingsModal", () => ({
  SettingsModal: vi.fn(() => null),
}));
vi.mock("./components/Chat/BottomBar", () => ({ BottomBar: vi.fn(() => null) }));

// Mock ipc module so createConversation can be controlled per-test
vi.mock("./ipc", async (importOriginal) => {
  const original = await importOriginal<typeof import("./ipc")>();
  return {
    ...original,
    createConversation: vi.fn(),
    getConversation: vi.fn().mockResolvedValue({ conversation: null }),
    getSetting: vi.fn().mockResolvedValue(undefined),
    setSetting: vi.fn().mockResolvedValue(undefined),
    onSecurityEvent: vi.fn(() => () => {}),
    checkConnectivity: vi.fn().mockResolvedValue({ online: true }),
  };
});

import React from "react";
import App from "./App";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { SettingsModal } from "./components/Settings/SettingsModal";
import { ChatView } from "./components/Chat/ChatView";
import { BottomBar } from "./components/Chat/BottomBar";
import { createConversation } from "./ipc";

beforeEach(() => {
  localStorage.setItem("wizardDone", "1");
  vi.mocked(Sidebar).mockReset();
  vi.mocked(Sidebar).mockImplementation(() => null);
  vi.mocked(SettingsModal).mockReset();
  vi.mocked(SettingsModal).mockImplementation(() => null);
  vi.mocked(ChatView).mockReset();
  vi.mocked(ChatView).mockImplementation(({ bottomBar }: { bottomBar?: React.ReactNode }) => <>{bottomBar}</>);
  vi.mocked(BottomBar).mockReset();
  vi.mocked(BottomBar).mockImplementation(() => null);
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

  it("opens SettingsModal when Sidebar calls onOpenSettings", async () => {
    // Capture the onOpenSettings prop passed to Sidebar
    let capturedOnOpenSettings: (() => void) | null = null;
    vi.mocked(Sidebar).mockImplementation(({ onOpenSettings }) => {
      capturedOnOpenSettings = onOpenSettings;
      return null;
    });

    // Render a visible marker when SettingsModal is open
    vi.mocked(SettingsModal).mockImplementation(({ open }) =>
      open ? <div data-testid="settings-modal-open" /> : null
    );

    render(<App />);

    expect(screen.queryByTestId("settings-modal-open")).not.toBeInTheDocument();

    act(() => {
      capturedOnOpenSettings?.();
    });

    expect(screen.getByTestId("settings-modal-open")).toBeInTheDocument();
  });

  it("renders BottomBar when a conversation is active", async () => {
    const fakeConv = {
      id: "conv-1",
      title: "Test",
      backend: "claude",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    vi.mocked(createConversation).mockResolvedValueOnce(fakeConv as never);

    // Render a visible marker when BottomBar is mounted
    vi.mocked(BottomBar).mockImplementation(() => (
      <div data-testid="bottom-bar" />
    ));

    render(<App />);

    // BottomBar should not be visible before a conversation is active
    expect(screen.queryByTestId("bottom-bar")).not.toBeInTheDocument();

    // Click "New conversation" to trigger handleNew → sets activeConvId
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /new conversation/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("bottom-bar")).toBeInTheDocument();
    });
  });
});
