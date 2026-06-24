import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../../shared/types";

interface Props {
  messages: Message[];
  streaming: boolean;
  conversationId: string | null;
}

export function MessageList({ messages, streaming, conversationId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track which message IDs have been shown. Seeded with all current IDs
  // whenever conversationId changes so historical messages don't animate.
  const seenIdsRef = useRef(new Set<string>());
  const prevConvIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevConvIdRef.current !== conversationId) {
      prevConvIdRef.current = conversationId;
      seenIdsRef.current = new Set(messages.map((m) => m.id));
    }
  }, [conversationId, messages]);

  // Register rendered IDs after each paint so future renders know what's old.
  useEffect(() => {
    messages.forEach((m) => seenIdsRef.current.add(m.id));
  }, [messages]);

  // Only scroll when a genuinely new message appears (not on every chunk).
  const lastMsgId = messages.at(-1)?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "instant" : "smooth" });
  }, [lastMsgId, streaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" role="log">
      {messages.map((msg) => {
        const isNew = !seenIdsRef.current.has(msg.id);
        return (
          <div
            key={msg.id}
            className={isNew ? "animate-fade-in-up" : undefined}
          >
            <MessageBubble message={msg} />
          </div>
        );
      })}
      {streaming && (
        <div className="flex justify-start mb-3">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-dot-fade"
              style={{ animationDelay: "400ms" }}
            />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
