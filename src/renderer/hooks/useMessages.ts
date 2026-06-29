import { useState, useEffect, useRef, useCallback } from "react";
import { getConversation } from "../ipc/conversation";
import { sendChat, onChatChunk, onChatDone, abortChat } from "../ipc/chat";
import type { Message } from "../../shared/types";

export type ChunkPayload = {
  type: string;
  content: string;
  conversationId: string;
};

export function applyChunk(
  prev: Message[],
  chunk: ChunkPayload,
  streamingContentRef: { current: string },
): Message[] {
  const last = prev[prev.length - 1];
  if (
    !last ||
    last.role !== "assistant" ||
    (last.conversationId !== chunk.conversationId && last.conversationId !== "")
  ) {
    return prev;
  }
  if (chunk.type === "text") {
    streamingContentRef.current += chunk.content;
    return [
      ...prev.slice(0, -1),
      {
        ...last,
        content: streamingContentRef.current,
        conversationId: chunk.conversationId,
      },
    ];
  }
  if (chunk.type === "error") {
    streamingContentRef.current = "";
    return [
      ...prev.slice(0, -1),
      {
        ...last,
        content: `⚠ Error: ${chunk.content}`,
        conversationId: chunk.conversationId,
      },
    ];
  }
  return prev;
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const streamingContent = useRef("");
  const currentConvId = useRef<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    getConversation(conversationId).then(({ messages: msgs }) =>
      setMessages(msgs),
    );
  }, [conversationId]);

  useEffect(() => {
    const offChunk = onChatChunk(({ conversationId: cid, type, content }) => {
      setMessages((prev) =>
        applyChunk(
          prev,
          { type, content, conversationId: cid },
          streamingContent,
        ),
      );
    });
    const offDone = onChatDone(() => {
      setStreaming(false);
      streamingContent.current = "";
    });
    return () => {
      offChunk();
      offDone();
    };
  }, []);

  const send = useCallback(
    async (
      message: string,
      backend: string,
      personaId?: string,
      messageId?: string,
      model?: string,
    ) => {
      setStreaming(true);
      streamingContent.current = "";
      const userMsg: Message = {
        id: messageId ?? crypto.randomUUID(),
        conversationId: conversationId ?? "",
        role: "user",
        content: message,
        backend,
        stepIndex: null,
        createdAt: Date.now(),
      };
      const assistantPlaceholder: Message = {
        id: crypto.randomUUID(),
        conversationId: conversationId ?? "",
        role: "assistant",
        content: "",
        backend,
        stepIndex: null,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
      const newConvId = await sendChat({
        conversationId,
        message,
        backend,
        personaId,
        messageId,
        model,
      });
      currentConvId.current = newConvId;
      return newConvId;
    },
    [conversationId],
  );

  const abort = useCallback(() => {
    if (currentConvId.current) abortChat(currentConvId.current);
    setStreaming(false);
  }, []);

  return { messages, streaming, send, abort };
}
