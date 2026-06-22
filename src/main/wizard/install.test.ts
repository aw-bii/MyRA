import { describe, it, expect, vi, beforeEach } from "vitest";

// child_process mock — must be defined before importing the module under test
vi.mock("child_process");

import { installBackend } from "./install";
import * as child_process from "child_process";

function makeMockProcess(exitCode: number, stderrOutput = "") {
  const mockProc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
  };

  mockProc.stdout.on.mockImplementation((_event: string, _cb: (data: Buffer) => void) => {});

  mockProc.stderr.on.mockImplementation((_event: string, cb: (data: Buffer) => void) => {
    if (stderrOutput) {
      // emit stderr data synchronously so it is captured before close fires
      cb(Buffer.from(stderrOutput));
    }
  });

  mockProc.on.mockImplementation((event: string, cb: (code?: number) => void) => {
    if (event === "close") setTimeout(() => cb(exitCode), 0);
    if (event === "error") { /* never fires in these tests */ }
  });

  return mockProc;
}

describe("installBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves { success: true } when gemini install exits 0", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(
      makeMockProcess(0),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result).toEqual({ success: true });
    expect(child_process.spawn).toHaveBeenCalledWith(
      "npm",
      ["install", "-g", "@google/gemini-cli"],
      expect.objectContaining({ stdio: "pipe" }),
    );
    // Regression guard: shell:true must not be present
    expect(child_process.spawn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  });

  it("resolves { success: false } for an unknown backend without calling spawn", async () => {
    const result = await installBackend("unknown", vi.fn());

    expect(result).toEqual({
      success: false,
      error: "Unknown backend: unknown",
    });
    expect(child_process.spawn).not.toHaveBeenCalled();
  });

  it("returns permission-error message when stderr contains EACCES", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(
      makeMockProcess(1, "npm ERR! EACCES: permission denied"),
    );

    const result = await installBackend("opencode", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/i);
    // Regression guard: shell:true must not be present for any backend
    expect(child_process.spawn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  });

  it("returns generic error message for non-permission failure", async () => {
    vi.mocked(child_process.spawn).mockReturnValue(
      makeMockProcess(1, "some unrelated error"),
    );

    const result = await installBackend("gemini", vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Install failed with exit code 1/);
    // Regression guard: shell:true must not be present for any backend
    expect(child_process.spawn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ shell: true }),
    );
  });
});
