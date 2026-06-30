import { it, expect, vi, beforeEach } from "vitest";
import { ipcInvoke, lastIpcError, clearIpcError } from "./index";

beforeEach(() => {
  clearIpcError();
  vi.restoreAllMocks();
});

it("calls window.ipc.invoke and returns result", async () => {
  (window as any).ipc = { invoke: vi.fn().mockResolvedValue("ok") };
  const result = await ipcInvoke<string>("test:chan", { x: 1 });
  expect(result).toBe("ok");
  expect((window as any).ipc.invoke).toHaveBeenCalledWith("test:chan", {
    x: 1,
  });
});

it("sets lastIpcError on failure", async () => {
  const err = new Error("fail");
  (window as any).ipc = { invoke: vi.fn().mockRejectedValue(err) };
  await expect(ipcInvoke("test:chan")).rejects.toThrow("fail");
  expect(lastIpcError).toBe(err);
});

it("clearIpcError resets the error", () => {
  clearIpcError();
  expect(lastIpcError).toBeNull();
});
