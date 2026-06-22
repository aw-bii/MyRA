import crypto from "crypto";

interface PendingRequest {
  id: string;
  filePath: string;
  content: string;
  resolve: (result: ApprovalResult) => void;
  promise: Promise<ApprovalResult>;
  timer?: ReturnType<typeof setTimeout>;
}

export interface ApprovalResult {
  approved: boolean;
  filePath: string;
  reason?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const pending = new Map<string, PendingRequest>();

export const WriteApproval = {
  queue(
    filePath: string,
    content: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): string {
    const id = crypto.randomUUID();
    let resolve: (result: ApprovalResult) => void;
    const promise = new Promise<ApprovalResult>((r) => {
      resolve = r;
    });

    const timer = setTimeout(() => {
      const e = pending.get(id);
      if (e) {
        pending.delete(id);
        e.resolve({ approved: false, filePath, reason: "timeout" });
      }
    }, timeoutMs);

    pending.set(id, {
      id,
      filePath,
      content,
      resolve: resolve!,
      promise,
      timer,
    });

    return id;
  },

  waitFor(id: string): Promise<ApprovalResult> {
    const entry = pending.get(id);
    if (!entry) {
      return Promise.reject(new Error(`No pending request with id: ${id}`));
    }
    return entry.promise;
  },

  respond(id: string, approved: boolean): void {
    const entry = pending.get(id);
    if (!entry) throw new Error(`No pending request with id: ${id}`);
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve({ approved, filePath: entry.filePath });
  },

  pendingCount(): number {
    return pending.size;
  },

  getPending(): Array<{ id: string; filePath: string; content: string }> {
    return Array.from(pending.values()).map(({ id, filePath, content }) => ({
      id,
      filePath,
      content,
    }));
  },

  cancel(id: string): void {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
  },

  reset(): void {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
    }
    pending.clear();
  },
};
