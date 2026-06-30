import ReactMarkdown from "react-markdown";
import { memo, useState, useEffect } from "react";
import { AttachmentRow } from "./AttachmentRow";
import { listAttachments } from "../../ipc/attachment";
import type { Message, Attachment } from "../../../shared/types";

function safeUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    if (
      protocol === "https:" ||
      protocol === "http:" ||
      protocol === "mailto:"
    ) {
      return url;
    }
  } catch {
    if (!url.startsWith("javascript:") && !url.startsWith("data:")) return url;
  }
  return null;
}

const attachmentCache = new Map<string, Attachment[]>();
const MAX_CACHE_SIZE = 100;

function cacheAttachments(messageId: string, atts: Attachment[]) {
  if (attachmentCache.size >= MAX_CACHE_SIZE) {
    const first = attachmentCache.keys().next().value;
    if (first !== undefined) attachmentCache.delete(first);
  }
  attachmentCache.set(messageId, atts);
}

export function clearAttachmentCache() {
  attachmentCache.clear();
}

interface Props {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!isUser || !message.id) return;
    const cached = attachmentCache.get(message.id);
    if (cached) {
      setAttachments(cached);
      return;
    }
    listAttachments(message.id)
      .then((atts) => {
        cacheAttachments(message.id, atts);
        setAttachments(atts);
      })
      .catch(() => {});
  }, [message.id, isUser]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        role="article"
        aria-label={isUser ? "Your message" : "Assistant message"}
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-primary text-on-primary" : "bg-bubble text-text-base"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown urlTransform={safeUrl}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {attachments.length > 0 && <AttachmentRow attachments={attachments} />}
        <div
          className={`text-xs mt-1 ${
            isUser ? "text-on-primary/70" : "text-text-muted"
          }`}
        >
          {message.backend} ·{" "}
          <time dateTime={new Date(message.createdAt).toISOString()}>
            {new Date(message.createdAt).toLocaleTimeString()}
          </time>
        </div>
      </div>
    </div>
  );
});
