import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import { AttachmentRow } from "./AttachmentRow";
import { listAttachments } from "../../ipc";
import type { Message, Attachment } from "../../../shared/types";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!isUser || !message.id) return;
    listAttachments(message.id)
      .then(setAttachments)
      .catch(() => {});
  }, [message.id, isUser]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {attachments.length > 0 && <AttachmentRow attachments={attachments} />}
        <div
          className={`text-xs mt-1 ${
            isUser ? "text-blue-100" : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {message.backend} · {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
