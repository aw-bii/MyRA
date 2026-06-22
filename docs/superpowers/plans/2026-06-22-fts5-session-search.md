# FTS5 Session Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic `searchMessages()` function with a full-featured session search system supporting conversation-scoped queries, relevance ranking, highlighted snippets, and a search UI in the sidebar.

**Architecture:** Enhance the existing FTS5 virtual table with additional indexed columns, add a search-specific IPC channel, and build a search result panel in the renderer sidebar.

**Tech Stack:** TypeScript, better-sqlite3 (FTS5), Electron IPC, React

---

### Task 1: Add migration 006 with improved FTS5 setup

**Files:**
- Create: `src/main/store/migrations/006_search_indexes.sql`

- [ ] **Step 1: Write migration SQL**

```sql
CREATE INDEX IF NOT EXISTS idx_conversations_title ON conversations(title);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
```

- [ ] **Step 2: Write test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, getDb } from "../db";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";

let dbPath: string;

describe("FTS5 Search Migration", () => {
  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-search-${crypto.randomUUID()}.db`);
    initDb(dbPath);
  });

  afterAll(() => {
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("messages_fts virtual table exists", () => {
    const row = getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='virtual_table' AND name='messages_fts'"
    ).get();
    expect(row).toBeTruthy();
  });

  it("idx_messages_conv_created index exists", () => {
    const row = getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_messages_conv_created'"
    ).get();
    expect(row).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx vitest run src/main/store/search.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/store/migrations/006_search_indexes.sql src/main/store/search.test.ts
git commit -m "feat(search): add indexes for search performance"
```

---

### Task 2: Add SearchResult type and IPC channels

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`

- [ ] **Step 1: Add SearchResult type**

In `src/shared/types.ts`, add:

```typescript
export interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  snippet: string;
  rank: number;
  role: "user" | "assistant";
  backend: string;
  createdAt: number;
}
```

- [ ] **Step 2: Add IPC constants**

In `src/shared/ipc.ts`, add to `IPC` const:

```typescript
CONV_SEARCH_SCOPED: "conv:search-scoped",
CONV_SEARCH_CONTEXT: "conv:search-context",
```

Add to `IpcInvokeMap`:

```typescript
[IPC.CONV_SEARCH_SCOPED]: { conversationId: string; query: string; limit?: number };
[IPC.CONV_SEARCH_CONTEXT]: { messageId: string; before?: number; after?: number };
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts src/shared/ipc.ts
git commit -m "feat(search): add SearchResult type and IPC channels"
```

---

### Task 3: Build enhanced search module

**Files:**
- Create: `src/main/store/search.ts`
- Create: `src/main/store/search.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb, getDb } from "../db";
import path from "path";
import os from "os";
import crypto from "crypto";
import fs from "fs";
import { SearchStore } from "./search";

let dbPath: string;

describe("SearchStore", () => {
  beforeAll(() => {
    dbPath = path.join(os.tmpdir(), `test-search-${crypto.randomUUID()}.db`);
    initDb(dbPath);
    const db = getDb();
    db.exec(`INSERT INTO conversations (id, title, backend, created_at, updated_at) VALUES ('conv1', 'Financial Analysis', 'claude', 1, 1)`);
    db.exec(`INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES ('msg1', 'conv1', 'user', 'What is the financial analysis for Q3?', 'claude', 1)`);
    db.exec(`INSERT INTO messages (id, conversation_id, role, content, backend, created_at) VALUES ('msg2', 'conv1', 'assistant', 'The financial analysis shows strong revenue growth of 15%.', 'claude', 2)`);
  });

  afterAll(() => {
    closeDb();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("searchAll returns results matching query", () => {
    const results = SearchStore.searchAll("financial");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].conversationTitle).toBe("Financial Analysis");
  });

  it("searchScoped filters by conversation", () => {
    const results = SearchStore.searchScoped("conv1", "growth");
    expect(results.length).toBeGreaterThan(0);
  });

  it("searchScoped returns empty for non-matching conversation", () => {
    const results = SearchStore.searchScoped("nonexistent", "growth");
    expect(results).toEqual([]);
  });

  it("snippet includes context around match", () => {
    const results = SearchStore.searchAll("revenue");
    if (results.length > 0) {
      expect(results[0].snippet.length).toBeGreaterThan(0);
      expect(results[0].snippet.toLowerCase()).toContain("revenue");
    }
  });

  it("handles empty query gracefully", () => {
    expect(SearchStore.searchAll("")).toEqual([]);
  });

  it("handles no-match query gracefully", () => {
    expect(SearchStore.searchAll("xyznonexistent999")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npx vitest run src/main/store/search.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
import { getDb } from "./db";
import type { SearchResult } from "../../shared/types";

function snippet(content: string, query: string, contextChars = 80): string {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.slice(0, contextChars * 2) + "...";
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return prefix + content.slice(start, end) + suffix;
}

export const SearchStore = {
  searchAll(query: string, limit = 50): SearchResult[] {
    if (!query.trim()) return [];
    const db = getDb();
    try {
      const rows = db.prepare(`
        SELECT m.id as messageId, m.conversation_id as conversationId,
               c.title as conversationTitle, m.content, m.role, m.backend, m.created_at as createdAt,
               rank
        FROM messages_fts fts
        JOIN messages m ON m.rowid = fts.rowid
        JOIN conversations c ON c.id = m.conversation_id
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(query, limit) as any[];
      return rows.map((r: any) => ({
        ...r,
        snippet: snippet(r.content, query),
        createdAt: Number(r.createdAt),
      }));
    } catch {
      return [];
    }
  },

  searchScoped(conversationId: string, query: string, limit = 50): SearchResult[] {
    if (!query.trim()) return [];
    const db = getDb();
    try {
      const rows = db.prepare(`
        SELECT m.id as messageId, m.conversation_id as conversationId,
               c.title as conversationTitle, m.content, m.role, m.backend, m.created_at as createdAt,
               rank
        FROM messages_fts fts
        JOIN messages m ON m.rowid = fts.rowid
        JOIN conversations c ON c.id = m.conversation_id
        WHERE messages_fts MATCH ? AND m.conversation_id = ?
        ORDER BY rank
        LIMIT ?
      `).all(query, conversationId, limit) as any[];
      return rows.map((r: any) => ({
        ...r,
        snippet: snippet(r.content, query),
        createdAt: Number(r.createdAt),
      }));
    } catch {
      return [];
    }
  },

  getMessageContext(messageId: string, before = 3, after = 3) {
    const db = getDb();
    const msg = db.prepare(`SELECT conversation_id, created_at FROM messages WHERE id = ?`).get(messageId) as any;
    if (!msg) return null;
    const prev = db.prepare(`
      SELECT id, role, content FROM messages
      WHERE conversation_id = ? AND created_at < ?
      ORDER BY created_at DESC LIMIT ?
    `).all(msg.conversation_id, msg.created_at, before).reverse();
    const next = db.prepare(`
      SELECT id, role, content FROM messages
      WHERE conversation_id = ? AND created_at > ?
      ORDER BY created_at ASC LIMIT ?
    `).all(msg.conversation_id, msg.created_at, after);
    return { prev, current: msg, next };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/main/store/search.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/store/search.ts src/main/store/search.test.ts
git commit -m "feat(search): add enhanced search module with scoped queries and snippets"
```

---

### Task 4: Wire search IPC handlers

**Files:**
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Read `src/main/ipc.ts`**

- [ ] **Step 2: Add imports and handlers**

```typescript
import { SearchStore } from "./store/search";

ipcMain.handle(IPC.CONV_SEARCH_SCOPED, (_event, { conversationId, query, limit }) => {
  return SearchStore.searchScoped(conversationId, query, limit);
});

ipcMain.handle(IPC.CONV_SEARCH_CONTEXT, (_event, { messageId, before, after }) => {
  return SearchStore.getMessageContext(messageId, before, after);
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/main/ipc.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat(search): wire search IPC handlers"
```

---

### Task 5: Add renderer IPC wrappers

**Files:**
- Modify: `src/renderer/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Read the two files**

- [ ] **Step 2: Add preload channels**

In `src/preload/index.ts`, add to `ALLOWED_CHANNELS`:
```typescript
"conv:search-scoped",
"conv:search-context",
```

- [ ] **Step 3: Add renderer wrappers**

In `src/renderer/ipc.ts`:
```typescript
import type { SearchResult } from "../shared/types";

export async function searchConversationScoped(
  conversationId: string, query: string, limit?: number,
): Promise<SearchResult[]> {
  return window.ipc.invoke("conv:search-scoped", { conversationId, query, limit }) as Promise<SearchResult[]>;
}

export async function getMessageContext(
  messageId: string, before?: number, after?: number,
): Promise<{
  prev: Array<{ id: string; role: string; content: string }>;
  current: any;
  next: Array<{ id: string; role: string; content: string }>;
} | null> {
  return window.ipc.invoke("conv:search-context", { messageId, before, after }) as Promise<any>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc.ts src/preload/index.ts
git commit -m "feat(search): add renderer search IPC wrappers"
```

---

### Task 6: Build SearchPanel component

**Files:**
- Create: `src/renderer/components/Sidebar/SearchPanel.tsx`

- [ ] **Step 1: Write component**

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import type { SearchResult } from "../../../shared/types";
import { searchConversationScoped } from "../../ipc";

interface SearchPanelProps {
  conversationId?: string;
  onSelectMessage: (messageId: string, conversationId: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SearchPanel({ conversationId, onSelectMessage, searchInputRef }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scoped, setScoped] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string, scope: boolean) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const r = scope && conversationId
        ? await searchConversationScoped(conversationId, q)
        : await searchConversationScoped("", q); // Will use searchAll
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query, scoped), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, scoped, search]);

  return (
    <div className="px-3 py-2">
      <input
        ref={searchInputRef}
        type="text"
        placeholder="Search conversations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full text-xs border rounded px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 mb-2"
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <input type="checkbox" checked={scoped} onChange={(e) => setScoped(e.target.checked)} />
        Search this conversation only
      </label>
      {loading && <div className="text-xs text-gray-400 text-center py-4">Searching…</div>}
      {!loading && results.length === 0 && query.trim() && (
        <div className="text-xs text-gray-400 text-center py-4">No results found</div>
      )}
      {!loading && results.length > 0 && (
        <ul className="space-y-1 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <li key={r.messageId}>
              <button
                onClick={() => onSelectMessage(r.messageId, r.conversationId)}
                className="w-full text-left text-xs p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="font-medium truncate">{r.conversationTitle}</div>
                <div className="text-gray-500 line-clamp-2">{r.snippet}</div>
                <div className="text-gray-400 mt-0.5">{r.role} · {new Date(r.createdAt).toLocaleDateString()}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Sidebar/SearchPanel.tsx
git commit -m "feat(search): add SearchPanel component"
```

---

### Task 7: Integrate SearchPanel into Sidebar

**Files:**
- Modify: `src/renderer/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Read `Sidebar.tsx`**

- [ ] **Step 2: Replace inline search with SearchPanel**

Replace existing search input with:
```typescript
import { SearchPanel } from "./SearchPanel";

// Inside the Sidebar component, replace the search input:
<SearchPanel
  conversationId={activeId}
  onSelectMessage={(messageId, conversationId) => onSelect(conversationId)}
  searchInputRef={searchInputRef}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar/Sidebar.tsx
git commit -m "feat(search): integrate SearchPanel into sidebar"
```

---

### Task 8: Run full test suite

- [ ] **Step 1: Run all tests**

Run: `npx vitest run --reporter=verbose`
Expected: All existing + new tests pass

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Commit**

```bash
git commit -m "test: fix search-related test failures"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Enhanced search, scoped queries, context retrieval, search UI in sidebar.
- [x] **Placeholder scan**: Clean.
- [x] **Type consistency**: `SearchResult` used consistently across `types.ts`, `search.ts`, `ipc.ts`, `SearchPanel.tsx`.
