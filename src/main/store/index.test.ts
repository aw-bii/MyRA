import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDb, closeDb } from "./db";
import { ConvStore } from "./index";
import path from "path";
import os from "os";
import fs from "fs";

let dbPath: string;

beforeEach(() => {
  dbPath = path.join(os.tmpdir(), `test-${crypto.randomUUID()}.db`);
  initDb(dbPath);
});

afterEach(() => {
  closeDb();
  fs.unlinkSync(dbPath);
});

describe("ConvStore.createConversation", () => {
  it("returns a Conversation with generated id and timestamps", () => {
    const conv = ConvStore.createConversation("Hello world", "claude", null);
    expect(conv.id).toBeTruthy();
    expect(conv.title).toBe("Hello world");
    expect(conv.backend).toBe("claude");
    expect(conv.personaId).toBeNull();
    expect(conv.createdAt).toBeGreaterThan(0);
  });
});

describe("ConvStore.createMessage + getMessages", () => {
  it("creates and retrieves messages by conversationId", () => {
    const conv = ConvStore.createConversation("Test", "claude", null);
    ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "hi",
      backend: "claude",
    });
    const msgs = ConvStore.getMessages(conv.id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("hi");
  });
});

describe("ConvStore.searchMessages", () => {
  it("finds messages by content keyword", () => {
    const conv = ConvStore.createConversation("Test", "claude", null);
    ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "pineapple juice",
      backend: "claude",
    });
    ConvStore.createMessage({
      conversationId: conv.id,
      role: "assistant",
      content: "mango smoothie",
      backend: "claude",
    });
    const results = ConvStore.searchMessages("pineapple");
    expect(results).toHaveLength(1);
    expect(results[0].message.content).toBe("pineapple juice");
  });
});

describe("ConvStore.searchMessages error handling", () => {
  it("returns empty array for malformed FTS5 query", () => {
    const conv = ConvStore.createConversation("Test", "claude", null);
    ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "hello world",
      backend: "claude",
    });
    const results = ConvStore.searchMessages('"unclosed');
    expect(results).toEqual([]);
  });
});

describe("ConvStore persona methods", () => {
  it("creates, lists, and marks default persona", () => {
    ConvStore.createPersona({
      name: "Coder",
      systemPrompt: "You are a coder.",
      isDefault: false,
    });
    const p2 = ConvStore.createPersona({
      name: "Writer",
      systemPrompt: "You write.",
      isDefault: true,
    });
    const personas = ConvStore.listPersonas();
    expect(personas.length).toBeGreaterThanOrEqual(8);
    expect(personas.some((p) => p.id === p2.id)).toBe(true);
    expect(ConvStore.getDefaultPersona()?.id).toBe(p2.id);
  });

  it("creates and retrieves template persona with variable fields", () => {
    const t = ConvStore.createPersona({
      name: "Deep-Dive Template",
      systemPrompt: "Analyze {{ticker}}",
      isDefault: false,
      isTemplate: true,
      category: "Research",
      description: "Company analysis",
      variables: [
        {
          name: "ticker",
          label: "Ticker",
          placeholder: "AAPL",
          required: true,
        },
      ],
    });
    expect(t.isTemplate).toBe(true);
    expect(t.category).toBe("Research");
    expect(t.description).toBe("Company analysis");
    expect(t.variables).toHaveLength(1);
    expect(t.variables[0].name).toBe("ticker");

    // Verify it persists by re-loading
    const loaded = ConvStore.listPersonas().find((p) => p.id === t.id)!;
    expect(loaded.isTemplate).toBe(true);
    expect(loaded.category).toBe("Research");
    expect(loaded.variables[0].label).toBe("Ticker");
  });

  it("updates template fields on an existing persona", () => {
    const p = ConvStore.createPersona({
      name: "Test",
      systemPrompt: "Hello",
      isDefault: false,
      isTemplate: false,
      category: null,
      description: null,
      variables: [],
    });
    ConvStore.updatePersona(p.id, {
      isTemplate: true,
      category: "Analysis",
      description: "Test desc",
      variables: [{ name: "x", label: "X", placeholder: "", required: false }],
    });
    const loaded = ConvStore.listPersonas().find((x) => x.id === p.id)!;
    expect(loaded.isTemplate).toBe(true);
    expect(loaded.category).toBe("Analysis");
    expect(loaded.description).toBe("Test desc");
    expect(loaded.variables[0].name).toBe("x");
  });
});

describe("ConvStore pipeline CRUD", () => {
  it("createPipelineTemplate round-trips name and steps", () => {
    const t = ConvStore.createPipelineTemplate("Draft+Critique", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "gemini", personaId: null },
    ]);
    expect(t.name).toBe("Draft+Critique");
    expect(t.steps).toHaveLength(2);
    expect(t.steps[0].backendId).toBe("claude");
    expect(t.steps[1].backendId).toBe("gemini");
    expect(t.steps[0].stepOrder).toBe(0);
  });

  it("listPipelineTemplates returns created templates", () => {
    const t = ConvStore.createPipelineTemplate("Test", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "opencode", personaId: null },
    ]);
    const list = ConvStore.listPipelineTemplates();
    expect(list.some((x) => x.id === t.id)).toBe(true);
  });

  it("getPipelineTemplate returns template with steps", () => {
    const t = ConvStore.createPipelineTemplate("Get test", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "gemini", personaId: null },
    ]);
    const found = ConvStore.getPipelineTemplate(t.id);
    expect(found).toBeDefined();
    expect(found!.steps).toHaveLength(2);
  });

  it("updatePipelineTemplate replaces steps", () => {
    const t = ConvStore.createPipelineTemplate("Update test", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "gemini", personaId: null },
    ]);
    const updated = ConvStore.updatePipelineTemplate(t.id, "Renamed", [
      { stepOrder: 0, backendId: "opencode", personaId: null },
      { stepOrder: 1, backendId: "claude", personaId: null },
    ]);
    expect(updated.name).toBe("Renamed");
    expect(updated.steps[0].backendId).toBe("opencode");
  });

  it("deletePipelineTemplate removes template and steps", () => {
    const t = ConvStore.createPipelineTemplate("Delete test", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "gemini", personaId: null },
    ]);
    ConvStore.deletePipelineTemplate(t.id);
    expect(ConvStore.getPipelineTemplate(t.id)).toBeUndefined();
  });

  it("createPipelineConversation sets pipelineTemplateId", () => {
    const t = ConvStore.createPipelineTemplate("Conv test", [
      { stepOrder: 0, backendId: "claude", personaId: null },
      { stepOrder: 1, backendId: "gemini", personaId: null },
    ]);
    const conv = ConvStore.createPipelineConversation("Test query", t.id);
    expect(conv.pipelineTemplateId).toBe(t.id);
    expect(conv.backend).toBe("pipeline");
  });

  it("createMessage stores and retrieves stepIndex", () => {
    const conv = ConvStore.createConversation("Test", "claude", null);
    const msg = ConvStore.createMessage({
      conversationId: conv.id,
      role: "assistant",
      content: "step result",
      backend: "claude",
      stepIndex: 1,
    });
    const msgs = ConvStore.getMessages(conv.id);
    expect(msgs.find((m) => m.id === msg.id)?.stepIndex).toBe(1);
  });
});

describe("ConvStore attachment CRUD", () => {
  it("createAttachment and listAttachments round-trip", () => {
    const conv = ConvStore.createConversation("Attach test", "claude", null);
    const msg = ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "hi",
      backend: "claude",
      stepIndex: null,
    });
    const att = ConvStore.createAttachment({
      messageId: msg.id,
      originalName: "report.pdf",
      storedPath: "/tmp/report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12345,
      extractedText: "some text",
      extractionError: false,
    });
    expect(att.id).toBeTruthy();
    expect(att.originalName).toBe("report.pdf");

    const list = ConvStore.getAttachmentsForMessage(msg.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(att.id);
    expect(list[0].extractedText).toBe("some text");
    expect(list[0].extractionError).toBe(false);
  });

  it("deleteAttachmentsForMessage removes all attachments", () => {
    const conv = ConvStore.createConversation(
      "Delete att test",
      "claude",
      null,
    );
    const msg = ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "hi",
      backend: "claude",
      stepIndex: null,
    });
    ConvStore.createAttachment({
      messageId: msg.id,
      originalName: "a.pdf",
      storedPath: "/tmp/a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      extractedText: null,
      extractionError: false,
    });
    ConvStore.deleteAttachmentsForMessage(msg.id);
    expect(ConvStore.getAttachmentsForMessage(msg.id)).toHaveLength(0);
  });

  it("getAttachmentsForMessage returns all attachments for a message", () => {
    const conv = ConvStore.createConversation("Test2", "claude", null);
    const msg = ConvStore.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "hi",
      backend: "claude",
      stepIndex: null,
    });
    ConvStore.createAttachment({
      messageId: msg.id,
      originalName: "a.txt",
      storedPath: "/tmp/a.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
    });
    ConvStore.createAttachment({
      messageId: msg.id,
      originalName: "b.txt",
      storedPath: "/tmp/b.txt",
      mimeType: "text/plain",
      sizeBytes: 20,
    });
    const atts = ConvStore.getAttachmentsForMessage(msg.id);
    expect(atts).toHaveLength(2);
  });
});
