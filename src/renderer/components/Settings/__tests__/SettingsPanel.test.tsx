import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

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

const { mockGetAppVersion, mockGetSetting, mockHasKey, mockGetProxySettings } = vi.hoisted(() => ({
  mockGetAppVersion: vi.fn().mockResolvedValue("1.0.0"),
  mockGetSetting: vi.fn().mockResolvedValue(null),
  mockHasKey: vi.fn().mockResolvedValue(false),
  mockGetProxySettings: vi.fn().mockResolvedValue({ httpProxy: "", httpsProxy: "", noProxy: "" }),
}));

// From __tests__/, the ipc module is at ../../../ipc (relative to this test file)
vi.mock("../../../ipc", () => ({
  getAppVersion: mockGetAppVersion,
  getSetting: mockGetSetting,
  hasKey: mockHasKey,
  getProxySettings: mockGetProxySettings,
  setSetting: vi.fn(),
  storeKey: vi.fn(),
  deleteKey: vi.fn(),
  probeBackend: vi.fn(),
  setProxySettings: vi.fn(),
}));

import { SettingsPanel } from "../SettingsPanel";

describe("SettingsPanel mount IPC calls", () => {
  it("all IPC calls resolve and their results render", async () => {
    render(<SettingsPanel onClose={vi.fn()} onReRunWizard={vi.fn()} />);
    await vi.waitFor(() => {
      expect(mockGetAppVersion).toHaveBeenCalledTimes(1);
      expect(mockGetSetting).toHaveBeenCalledWith("theme");
      expect(mockHasKey).toHaveBeenCalledTimes(5);
      expect(mockGetProxySettings).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/1\.0\.0/)).toBeTruthy();
    });
  });
});
