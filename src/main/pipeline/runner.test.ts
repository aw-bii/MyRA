import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock variables so they are available when vi.mock factory is evaluated
const { mockAbort, mockGet, mockGetAllWindows, mockSecurityMiddleware } =
  vi.hoisted(() => ({
    mockAbort: vi.fn(),
    mockGet: vi.fn(),
    mockGetAllWindows: vi.fn(() => []),
    mockSecurityMiddleware: vi.fn(async function* (
      source: AsyncIterable<unknown>,
    ) {
      yield* source as AsyncIterable<any>;
    }),
  }));

vi.mock("../adapters/manager", () => ({
  AdapterManager: {
    get: mockGet,
  },
  securityMiddleware: mockSecurityMiddleware,
}));

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: mockGetAllWindows },
}));

vi.mock("../../shared/ipc", () => ({
  IPC: { SECURITY_EVENT: "security:event" },
}));

import { pipelineRunner } from "./runner";

describe("PipelineRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-fetches BrowserWindow once per step so security events reach a reloaded window", async () => {
    mockGet.mockImplementation(() => ({
      id: "mock",
      abort: mockAbort,
      send: async function* () {
        yield { type: "text", content: "out" };
        yield { type: "done", content: "" };
      },
    }));

    await pipelineRunner.run({
      conversationId: "conv-getAllWindows",
      userMessage: "hi",
      steps: [{ adapterId: "a" }, { adapterId: "b" }, { adapterId: "c" }],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    });

    // Called once per step — if window reloads between steps, later steps
    // still deliver security events instead of throwing on a destroyed BrowserWindow
    expect(mockGetAllWindows).toHaveBeenCalledTimes(3);
  });

  it("passes user message to step 0 and accumulated output to step 1", async () => {
    const capturedInputs: string[] = [];
    mockGet.mockImplementation(() => ({
      id: "mock",
      abort: mockAbort,
      send: async function* (msg: string) {
        capturedInputs.push(msg);
        yield { type: "text", content: "out-" + capturedInputs.length };
        yield { type: "done", content: "" };
      },
    }));

    await pipelineRunner.run({
      conversationId: "conv-1",
      userMessage: "hello",
      steps: [
        { adapterId: "claude", persona: undefined },
        { adapterId: "gemini", persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    });

    expect(capturedInputs[0]).toBe("hello");
    expect(capturedInputs[1]).toBe("out-1");
  });

  it("tags chunks with the correct stepIndex", async () => {
    mockGet.mockImplementation((id: string) => ({
      id,
      abort: mockAbort,
      send: async function* () {
        yield { type: "text", content: "text" };
        yield { type: "done", content: "" };
      },
    }));

    const chunks: Array<{ stepIndex: number }> = [];
    await pipelineRunner.run({
      conversationId: "conv-2",
      userMessage: "test",
      steps: [
        { adapterId: "claude", persona: undefined },
        { adapterId: "gemini", persona: undefined },
      ],
      onChunk: (c) => chunks.push(c),
      onStepDone: vi.fn(),
    });

    expect(chunks.filter((c) => c.stepIndex === 0).length).toBeGreaterThan(0);
    expect(chunks.filter((c) => c.stepIndex === 1).length).toBeGreaterThan(0);
  });

  it("calls onStepDone with the correct index after each step", async () => {
    mockGet.mockImplementation(() => ({
      id: "mock",
      abort: mockAbort,
      send: async function* () {
        yield { type: "text", content: "result" };
        yield { type: "done", content: "" };
      },
    }));

    const doneIndices: number[] = [];
    await pipelineRunner.run({
      conversationId: "conv-3",
      userMessage: "test",
      steps: [
        { adapterId: "claude", persona: undefined },
        { adapterId: "gemini", persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: (i) => doneIndices.push(i),
    });

    expect(doneIndices).toEqual([0, 1]);
  });

  it("abort stops execution before the next step", async () => {
    let stepCount = 0;
    mockGet.mockImplementation(() => ({
      id: "mock",
      abort: mockAbort,
      send: async function* () {
        stepCount++;
        yield { type: "text", content: "result" };
        yield { type: "done", content: "" };
      },
    }));

    const runPromise = pipelineRunner.run({
      conversationId: "conv-4",
      userMessage: "test",
      steps: [
        { adapterId: "claude", persona: undefined },
        { adapterId: "gemini", persona: undefined },
        { adapterId: "opencode", persona: undefined },
      ],
      onChunk: vi.fn(),
      onStepDone: (i) => {
        if (i === 0) pipelineRunner.abort("conv-4");
      },
    });

    await runPromise;
    expect(stepCount).toBe(1);
  });

  it("throws if adapter not found", async () => {
    mockGet.mockReturnValue(undefined);
    await expect(
      pipelineRunner.run({
        conversationId: "conv-5",
        userMessage: "test",
        steps: [{ adapterId: "nonexistent", persona: undefined }],
        onChunk: vi.fn(),
        onStepDone: vi.fn(),
      }),
    ).rejects.toThrow("Adapter not found: nonexistent");
  });

  it("wraps adapter.send with securityMiddleware", async () => {
    mockGet.mockReturnValue({
      id: "test-adapter",
      send: async function* () {
        yield { type: "text" as const, content: "safe text" };
        yield { type: "done" as const };
      },
      abort: vi.fn(),
    });

    await pipelineRunner.run({
      conversationId: "conv-6",
      userMessage: "hello",
      steps: [{ adapterId: "test-adapter" }],
      onChunk: vi.fn(),
      onStepDone: vi.fn(),
    });

    expect(mockSecurityMiddleware).toHaveBeenCalledWith(
      expect.anything(),
      "test-adapter",
      expect.any(Function),
    );
  });
});
