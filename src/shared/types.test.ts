import { describe, it, expect } from "vitest";
import type {
  SecurityEvent,
  WriteApprovalRequest,
  SecurityRespondPayload,
} from "./types";

describe("SecurityEvent types", () => {
  it("SecurityEvent discriminates on type", () => {
    const injection: SecurityEvent = {
      type: "injection_detected",
      severity: "high",
      message: "Potential prompt injection detected",
      detail: 'Found pattern: "ignore all previous instructions"',
      source: "claude",
    };
    const approval: SecurityEvent = {
      type: "write_approval_needed",
      filePath: "/etc/passwd",
      content: "root:x:0:0:root:/root:/bin/bash",
      source: "opencode",
      severity: "high",
      message: "File write requires approval",
      detail: "Write to system file",
    };
    expect(injection.type).toBe("injection_detected");
    expect(approval.type).toBe("write_approval_needed");
  });

  it("WriteApprovalRequest carries file path and content", () => {
    const req: WriteApprovalRequest = {
      filePath: "/tmp/test.txt",
      content: "hello",
    };
    expect(req.filePath).toBe("/tmp/test.txt");
  });

  it("SecurityRespondPayload uses id, not eventType", () => {
    const payload: SecurityRespondPayload = {
      id: "uuid-abc-123",
      approved: true,
    };
    expect(payload.id).toBe("uuid-abc-123");
    expect(payload.approved).toBe(true);

    const _bad: SecurityRespondPayload = {
      // @ts-expect-error — eventType must no longer be accepted
      eventType: "write_approval_needed",
      approved: true,
    };
    void _bad;
  });
});
