import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// window.matchMedia is used by the media-query effect that remains separate
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const { mockGetAppVersion, mockGetSetting, mockHasKey, mockGetProxySettings } =
  vi.hoisted(() => ({
    mockGetAppVersion: vi.fn().mockResolvedValue("1.0.0"),
    mockGetSetting: vi.fn().mockResolvedValue(null),
    mockHasKey: vi.fn().mockResolvedValue(false),
    mockGetProxySettings: vi
      .fn()
      .mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
  }));

vi.mock("../../../ipc/key", () => ({
  hasKey: mockHasKey,
  storeKey: vi.fn(),
  deleteKey: vi.fn(),
}));
vi.mock("../../../ipc/settings", () => ({
  getSetting: mockGetSetting,
  setSetting: vi.fn(),
  getAppVersion: mockGetAppVersion,
}));
vi.mock("../../../ipc/net", () => ({
  getProxySettings: mockGetProxySettings,
  setProxySettings: vi.fn(),
  openExternal: vi.fn(),
}));
vi.mock("../../../ipc/backend", () => ({
  probeBackend: vi.fn(),
}));

import { SettingsPanel } from "../SettingsPanel";

describe("SettingsPanel mount IPC calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppVersion.mockResolvedValue("1.0.0");
    mockGetSetting.mockResolvedValue(null);
    mockHasKey.mockResolvedValue(false);
    mockGetProxySettings.mockResolvedValue({
      httpProxy: "",
      httpsProxy: "",
      noProxy: "",
    });
  });

  it("all IPC calls resolve and their results render", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    await vi.waitFor(() => {
      expect(mockGetAppVersion).toHaveBeenCalledTimes(1);
      expect(mockGetSetting).toHaveBeenCalledWith("theme");
      // 4 API_PROVIDERS + 1 from OpenRouterSignIn.useEffect on mount
      expect(mockHasKey).toHaveBeenCalledTimes(5);
      expect(mockGetProxySettings).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/1\.0\.0/)).toBeTruthy();
    });
  });

  it("shows Sign In button for OpenRouter instead of a persistent key input", () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    // Should NOT have a visible password input labeled "OpenRouter API Key"
    expect(screen.queryByLabelText(/OpenRouter API Key/i)).toBeNull();
    // Should have a sign-in button
    expect(
      screen.getByRole("button", { name: /Sign in to OpenRouter/i }),
    ).toBeInTheDocument();
  });

  it("renders with defaults when getAppVersion rejects — other fields still load", async () => {
    mockGetAppVersion.mockRejectedValueOnce(new Error("IPC error"));

    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);

    await vi.waitFor(() => {
      // theme and key states still loaded even though version failed
      expect(mockGetSetting).toHaveBeenCalledWith("theme");
      expect(mockHasKey).toHaveBeenCalledTimes(5);
    });
    // No uncaught rejection — component still renders
    expect(screen.getByText(/theme/i)).toBeTruthy();
  });
});
