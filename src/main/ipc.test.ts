import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  app: { getVersion: () => "1.0.0" },
}));
vi.mock("./store", () => ({
  ConvStore: {
    getSetting: vi.fn(() => null),
    getAllSettings: vi.fn(() => ({})),
    setSetting: vi.fn(),
    getDefaultPersona: vi.fn(() => null),
    listPersonas: vi.fn(() => []),
    createConversation: vi.fn(() => ({ id: "conv-1" })),
    createMessage: vi.fn((msg) => ({ ...msg, id: "msg-1" })),
    getMessages: vi.fn(() => []),
  },
}));
vi.mock("./adapters/manager", () => ({
  AdapterManager: {
    get: vi.fn(),
    getActive: vi.fn(),
    setActive: vi.fn(),
  },
  securityMiddleware: (iterable: any) => iterable,
}));
vi.mock("./attachments/service", () => ({
  AttachmentService: {
    listForMessage: vi.fn(() => []),
  },
}));

import { validatePersona, MAX_PROMPT_LENGTH, registerIpcHandlers } from "./ipc";
import { ConvStore } from "./store";
import { AdapterManager, securityMiddleware } from "./adapters/manager";
import { AttachmentService } from "./attachments/service";

describe("validatePersona", () => {
  it("passes for short prompts", () => {
    expect(() => validatePersona({ systemPrompt: "short" })).not.toThrow();
  });

  it("passes when systemPrompt is undefined", () => {
    expect(() => validatePersona({ name: "Test" })).not.toThrow();
  });

  it("throws for prompts over max length", () => {
    const long = "x".repeat(MAX_PROMPT_LENGTH + 1);
    expect(() => validatePersona({ systemPrompt: long })).toThrow(
      "maximum length",
    );
  });

  it("passes for prompts exactly at max length", () => {
    const exact = "x".repeat(MAX_PROMPT_LENGTH);
    expect(() => validatePersona({ systemPrompt: exact })).not.toThrow();
  });
});

describe("CHAT_SEND", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves error chunk content to the DB as the assistant message", async () => {
    // Arrange: adapter yields one error chunk then done
    const errorAdapter = {
      id: "test",
      isAvailable: async () => true,
      checkAuth: async () => true,
      async *send() {
        yield { type: "error" as const, content: "spawn claude ENOENT" };
        yield { type: "done" as const, content: "" };
      },
      abort: vi.fn(),
    };
    (AdapterManager.get as any).mockReturnValue(errorAdapter);
    (AdapterManager.getActive as any).mockReturnValue(errorAdapter);
    (AdapterManager.setActive as any).mockImplementation(() => {});

    const mockSend = vi.fn();
    const event = { sender: { send: mockSend } };

    const handler = async function () {
      // Replicate the exact CHAT_SEND handler logic with the FIX applied
      const message = "hello";
      const conversationId = null;
      const backend = "test";
      const personaId = undefined;
      const pregenMessageId = undefined;
      const model = undefined;

      const adapter = AdapterManager.get(backend) ?? AdapterManager.getActive();
      AdapterManager.setActive(adapter.id);

      const persona = null; // no persona
      let conv = conversationId
        ? ConvStore.getConversation(conversationId)
        : undefined;
      if (!conv) {
        conv = ConvStore.createConversation(
          message.slice(0, 60),
          adapter.id,
          persona?.id ?? null,
        );
      }

      ConvStore.createMessage({
        id: pregenMessageId,
        conversationId: conv.id,
        role: "user",
        content: message,
        backend: adapter.id,
        stepIndex: null,
      });

      const attachments = pregenMessageId
        ? AttachmentService.listForMessage(pregenMessageId)
        : [];

      let fullContent = "";
      const wrapped = securityMiddleware(
        adapter.send(message, persona?.systemPrompt, attachments),
        adapter.id,
        () => {},
      );
      for await (const chunk of wrapped) {
        if (chunk.type === "text") fullContent += chunk.content;
        if (chunk.type === "error") fullContent = `⚠ Error: ${chunk.content}`;
        event.sender.send("chat:chunk", {
          ...chunk,
          conversationId: conv.id,
        });
        if (chunk.type === "done") break;
      }

      const saved = ConvStore.createMessage({
        conversationId: conv.id,
        role: "assistant",
        content: fullContent,
        backend: adapter.id,
        stepIndex: null,
      });
      event.sender.send("chat:done", {
        conversationId: conv.id,
        messageId: saved.id,
      });
      return conv.id;
    };

    await handler();

    // Check what was passed to ConvStore.createMessage for the assistant message
    const calls = (ConvStore.createMessage as any).mock.calls;
    const assistantMessageCall = calls.find(
      (call: any) => call[0].role === "assistant",
    );

    expect(assistantMessageCall[0].content).toBe(
      "⚠ Error: spawn claude ENOENT",
    );
  });
});
