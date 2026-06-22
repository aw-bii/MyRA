import type {
  BackendAdapter,
  MessageChunk,
  Attachment,
} from "../../shared/types";

export class TestAdapter implements BackendAdapter {
  id = "test";

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async checkAuth(): Promise<boolean> {
    return true;
  }

  async *send(
    message: string,
    _persona?: string,
    _attachments?: Attachment[],
  ): AsyncIterable<MessageChunk> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield { type: "text", content: `Echo: ${message}` };
    yield { type: "done", content: "" };
  }

  abort(): void {
    // no-op — synchronous echo has nothing to cancel
  }
}
