import { useState, useRef, useEffect } from "react";
import { useConversations } from "../../hooks/useConversations";
import { ConvItem } from "./ConvItem";
import type { SearchResult } from "../../../shared/types";

interface Props {
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  refreshTrigger?: number;
}

export function ConvList({
  activeId,
  onSelect,
  onDelete,
  onRename,
  refreshTrigger,
}: Props) {
  const { conversations, search } = useConversations(refreshTrigger);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );
  useEffect(
    () => () => {
      isMounted.current = false;
    },
    [],
  );

  const handleSearch = (q: string) => {
    setQuery(q);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!q.trim()) {
      setSearchResults(null);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      const results = await search(q);
      if (isMounted.current) setSearchResults(results);
    }, 300);
  };

  const displayed = searchResults
    ? conversations.filter((c) =>
        searchResults.some((r) => r.message.conversationId === c.id),
      )
    : conversations;

  return (
    <div className="flex flex-col gap-1">
      <input
        className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-border-strong bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        aria-label="Search conversations"
        placeholder="Search conversations..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {displayed.map((conv) => (
        <ConvItem
          key={conv.id}
          conversation={conv}
          active={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
