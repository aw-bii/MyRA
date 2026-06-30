import { useState, useCallback, useRef, useEffect } from "react";
import { searchConversations } from "../../ipc/conversation";
import type { SearchResult } from "../../../shared/types";

interface Props {
  onSelect: (conversationId: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await searchConversations(q);
    setResults(res);
    setLoading(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onSelect(result.message.conversationId);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <svg
          className="w-4 h-4 text-text-muted shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm outline-none placeholder-text-muted"
          placeholder="Search messages..."
          value={query}
          onChange={handleChange}
        />
        <button
          onClick={onClose}
          className="text-text-muted hoverable:hover:text-text-base"
          aria-label="Close search"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2">
        {!query.trim() && !loading && (
          <p className="text-xs text-text-muted text-center py-8">
            Type to search
          </p>
        )}

        {loading && (
          <p className="text-xs text-text-muted text-center py-8">
            Searching...
          </p>
        )}

        {!loading && results && results.length === 0 && (
          <p className="text-xs text-text-muted text-center py-8">No results</p>
        )}

        {!loading && results && results.length > 0 && (
          <div className="flex flex-col gap-1">
            {results.map((result) => (
              <button
                key={result.message.id}
                onClick={() => handleSelect(result)}
                className="w-full text-left px-3 py-2 rounded-lg hoverable:hover:bg-bubble transition-colors"
              >
                <div className="font-semibold text-sm truncate">
                  {result.conversationTitle}
                </div>
                <div className="text-xs text-text-muted italic truncate mt-0.5">
                  {result.snippet}
                </div>
                <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-bubble-strong text-text-muted">
                  {result.message.backend}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
