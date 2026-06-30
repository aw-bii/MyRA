import { describe, it, expect, vi, beforeEach } from "vitest";

// child_process mock — must be defined before importing the module under test
vi.mock("child_process");

import { installBackend } from "./install";
import * as child_process from "child_process";

function expectShellMatchesPlatform() {
  if (process.platform === "win32") {
    expect(child_process.spawn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  } else {
    expect(child_process.spawn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  }
}

function makeMockProcess(exitCode: number, stderrOutput = "") {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation(
    (_event: string, _cb: (data: Buffer) => void) => {},
  );

  mockProc.stderr.on.mockImplementation(
    (_event: string, cb: (data: Buffer) => void) => {
      if (stderrOutput) {
        // emit stderr data synchronously so it is captured before close fires
        cb(Buffer.from(stderrOutput));
      }
    },
  );

  mockProc.on.mockImplementation(
    (event: string, cb: (code?: number) => void) => {
      if (event === "close") setTimeout(() => cb(exitCode), 0);
      if (event === "error") {
        /* never fires in these tests */
      }
    },
  );

  return mockProc;
}

describe("installBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves { success: true } when gemini install exits 0", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(makeMockProcess(0));

    const result = await installBackend("gemini", vi.fn());

    expect(result).toEqual({ success: true });
    expect(child_process.spawn).toHaveBeenCalledWith(
      "npm",
      ["install", "-g", "@google/gemini-cli"],
      expect.objectContaining({ stdio: "pipe" }),
    );
    // Regression guard: shell must match platform (true on Windows, absent on others)
    expectShellMatchesPlatform();
  });

  it("resolves { success: false } for an unknown backend without calling spawn", async () => {
    const result = await installBackend("unknown", vi.fn());

    expect(result).toEqual({
      success: false,
      error: "Unknown backend: unknown",
    });
    expect(child_process.spawn).not.toHaveBeenCalled();
  });

  it("uses curl for opencode, not npm", async () => {
    const originalPlatform = process.platform;
    // Mock as non-Windows to test sh behavior
    Object.defineProperty(process, "platform", {
      value: "linux",
      writable: true,
    });

    vi.mocked(child_process.spawn).mockReturnValue(makeMockProcess(0));

    const result = await installBackend("opencode", vi.fn());

    expect(result).toEqual({ success: true });
    expect(child_process.spawn).toHaveBeenCalledWith(
      "sh",
      expect.arrayContaining([expect.stringContaining("opencode.ai/install")]),
      expect.objectContaining({ stdio: "pipe" }),
    );

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });

  it("returns permission-error message when stderr contains EACCES", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(
      makeMockProcess(1, "npm ERR! EACCES: permission denied"),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/i);
    // Regression guard: shell must match platform (true on Windows, absent on others)
    expectShellMatchesPlatform();
  });

  it("returns generic error message for non-permission failure", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(
      makeMockProcess(1, "some unrelated error"),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Install failed with exit code 1/);
    // Regression guard: shell must match platform (true on Windows, absent on others)
    expectShellMatchesPlatform();
  });

  it("uses powershell on win32 for curl-based backends", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
    });

    vi.mocked(child_process.spawn).mockReturnValue(makeMockProcess(0));

    await installBackend("claude", vi.fn());

    expect(child_process.spawn).toHaveBeenCalledWith(
      "powershell.exe",
      expect.arrayContaining(["-Command"]),
      expect.anything(),
    );

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
    });
  });
});
