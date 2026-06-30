import { useEffect, useRef, memo } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "../../../shared/types";

interface Props {
  messages: Message[];
  streaming: boolean;
  conversationId: string | null;
  id?: string;
  "aria-labelledby"?: string;
  role?: string;
}

export const MessageList = memo(function MessageList({
  messages,
  streaming,
  conversationId,
  id,
  "aria-labelledby": ariaLabelledBy,
  role = "log",
}: Props) {
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
    bottomRef.current?.scrollIntoView({
      behavior: streaming ? "instant" : "smooth",
    });
  }, [lastMsgId, streaming]);

  return (
    <div
      id={id}
      aria-labelledby={ariaLabelledBy}
      className="flex-1 overflow-y-auto px-4 py-4"
      role={role}
    >
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
          <div
            data-testid="streaming-indicator"
            className="bg-bubble rounded-2xl px-4 py-3 flex items-center gap-1"
            aria-label="Generating response"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                data-testid="streaming-dot"
                className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
});
