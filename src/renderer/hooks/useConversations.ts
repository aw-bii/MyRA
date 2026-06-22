import { useState, useEffect, useCallback } from "react";
import { listConversations, searchConversations } from "../ipc";
import type { Conversation, SearchResult } from "../../shared/types";

export function useConversations(refreshKey?: number) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const convs = await listConversations();
    setConversations(convs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    return searchConversations(query);
  }, []);

  return { conversations, loading, refresh, search };
}
