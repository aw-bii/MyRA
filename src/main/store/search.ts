import { getDb } from "./db";
import type { SearchResult, Message } from "../../shared/types";

export function searchMessages(query: string): SearchResult[] {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT m.id, m.conversation_id, m.role, m.content, m.backend, m.step_index, m.created_at,
                c.title as conversation_title,
                snippet(messages_fts, 0, '<b>', '</b>', '...', 32) as snippet,
                rank
         FROM messages m
         JOIN messages_fts fts ON m.rowid = fts.rowid
         JOIN conversations c ON m.conversation_id = c.id
         WHERE messages_fts MATCH ?
         ORDER BY rank LIMIT 50`,
      )
      .all(query) as any[];
    return rows.map((r) => ({
      message: {
        id: r.id,
        conversationId: r.conversation_id,
        role: r.role,
        content: r.content,
        backend: r.backend,
        stepIndex: r.step_index ?? null,
        createdAt: r.created_at,
      } satisfies Message,
      conversationTitle: r.conversation_title,
      snippet: r.snippet,
      rank: r.rank as number,
    }));
  } catch {
    return [];
  }
}
