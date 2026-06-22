import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, getDb } from "./db";
import { searchMessages } from "./search";
import type { SearchResult } from "../../shared/types";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";

let dbPath: string;

describe("searchMessages", () => {
  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-search-enh-${crypto.randomUUID()}.db`);
    initDb(dbPath);
    const db = getDb();

    db.prepare(
      "INSERT INTO conversations (id, title, backend, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("c1", "Test Chat", "claude", 1000, 1000);
    db.prepare(
      "INSERT INTO conversations (id, title, backend, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("c2", "Project Alpha", "gemini", 2000, 2000);
    db.prepare(
      "INSERT INTO conversations (id, title, backend, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("c3", "Empty Chat", "claude", 3000, 3000);

    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m1", "c1", "user", "Hello, how does this work?", "claude", 1001);
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m2", "c1", "assistant", "Let me explain how the search feature works. It uses FTS5 for full-text search.", "claude", 1002);
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m3", "c2", "user", "What's the architecture of Project Alpha?", "gemini", 2001);
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m4", "c2", "assistant", "Project Alpha uses React and Node.js.", "gemini", 2002);
    db.prepare(
      "INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("m5", "c3", "user", "Just a test message", "claude", 3001);

    // Rebuild FTS5 index to ensure external content table is populated
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')");
  });

  afterAll(() => {
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("returns SearchResult[] for matching query", () => {
    const results = searchMessages("search");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("message");
    expect(results[0]).toHaveProperty("conversationTitle");
    expect(results[0]).toHaveProperty("snippet");
    expect(results[0]).toHaveProperty("rank");
  });

  it("includes conversation title in results", () => {
    const results = searchMessages("search");
    expect(results.some((r) => r.conversationTitle === "Test Chat")).toBe(true);
  });

  it("returns message with correct shape", () => {
    const results = searchMessages("search");
    const r = results[0];
    expect(r.message).toHaveProperty("id");
    expect(r.message).toHaveProperty("conversationId");
    expect(r.message).toHaveProperty("role");
    expect(r.message).toHaveProperty("content");
    expect(r.message).toHaveProperty("backend");
    expect(r.message).toHaveProperty("createdAt");
  });

  it("orders results by rank (relevance)", () => {
    const results = searchMessages("Project");
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].rank).toBeGreaterThanOrEqual(results[i - 1].rank);
    }
  });

  it("returns empty array for no matches", () => {
    const results = searchMessages("xyznonexistent12345");
    expect(results).toEqual([]);
  });

  it("handles special characters safely", () => {
    const results = searchMessages("");
    expect(results).toEqual([]);
  });
});
