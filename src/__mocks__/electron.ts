import { vi } from "vitest";

export const ipcMain = { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() };
export const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), send: vi.fn() };
export const BrowserWindow = vi.fn();
export const app = {
  getPath: vi.fn(),
  getVersion: vi.fn(() => "0.0.0"),
  quit: vi.fn(),
};
export const shell = { openExternal: vi.fn() };
export const dialog = { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() };
