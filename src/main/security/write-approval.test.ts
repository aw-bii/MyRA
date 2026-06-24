import { describe, it, expect, beforeEach } from "vitest";
import { WriteApproval } from "./write-approval";

describe("WriteApproval", () => {
  beforeEach(() => {
    WriteApproval.reset();
  });

  describe("queue and respond", () => {
    it("queues a pending request and returns an id", () => {
      const id = WriteApproval.queue("/tmp/test.txt", "hello world");
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("resolves queued request on approval", async () => {
      const id = WriteApproval.queue("/tmp/test.txt", "hello");
      const promise = WriteApproval.waitFor(id);
      WriteApproval.respond(id, true);
      const result = await promise;
      expect(result.approved).toBe(true);
      expect(result.filePath).toBe("/tmp/test.txt");
    });

    it("rejects queued request on denial", async () => {
      const id = WriteApproval.queue("/tmp/test.txt", "hello");
      const promise = WriteApproval.waitFor(id);
      WriteApproval.respond(id, false);
      const result = await promise;
      expect(result.approved).toBe(false);
    });

    it("times out after configured duration", async () => {
      const id = WriteApproval.queue("/tmp/test.txt", "hello", 50);
      const result = await WriteApproval.waitFor(id);
      expect(result.approved).toBe(false);
      expect(result.reason).toBe("timeout");
    }, 100);

    it("returns pending count", () => {
      WriteApproval.queue("/tmp/a", "1");
      WriteApproval.queue("/tmp/b", "2");
      expect(WriteApproval.pendingCount()).toBe(2);
    });

    it("throws when responding to non-existent id", () => {
      expect(() => WriteApproval.respond("nonexistent", true)).toThrow();
    });

    it("getPending returns queued items", () => {
      WriteApproval.queue("/tmp/a", "content a");
      WriteApproval.queue("/tmp/b", "content b");
      const pending = WriteApproval.getPending();
      expect(pending.length).toBe(2);
      expect(pending.some((p) => p.filePath === "/tmp/a")).toBe(true);
      expect(pending.some((p) => p.filePath === "/tmp/b")).toBe(true);
    });

    it("cancel removes a pending request", () => {
      const id = WriteApproval.queue("/tmp/test.txt", "hello");
      expect(WriteApproval.pendingCount()).toBe(1);
      WriteApproval.cancel(id);
      expect(WriteApproval.pendingCount()).toBe(0);
    });

    it("reset clears all pending requests", () => {
      WriteApproval.queue("/tmp/a", "1");
      WriteApproval.queue("/tmp/b", "2");
      WriteApproval.reset();
      expect(WriteApproval.pendingCount()).toBe(0);
    });
  });

  describe("pending queue limit", () => {
    beforeEach(() => {
      WriteApproval.reset();
    });

    it("throws when pending queue reaches MAX_PENDING (100)", () => {
      for (let i = 0; i < 100; i++) {
        WriteApproval.queue(`/tmp/file-${i}.txt`, `content-${i}`);
      }
      expect(() => WriteApproval.queue("/tmp/overflow.txt", "overflow")).toThrow(
        /pending.*limit|limit.*pending|queue.*full/i,
      );
      WriteApproval.reset();
    });
  });
});
