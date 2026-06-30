import { useState, useRef, KeyboardEvent, DragEvent, useCallback } from "react";
import { Paperclip, Warning } from "@phosphor-icons/react";
import { AttachmentChip } from "./AttachmentChip";
import { useAttachments } from "../../hooks/useAttachments";
import type { Attachment } from "../../../shared/types";

interface Props {
  onSend: (
    message: string,
    attachments: Attachment[],
    messageId: string,
  ) => void;
  onAbort: () => void;
  streaming: boolean;
  disabled?: boolean;
}

export function InputBar({ onSend, onAbort, streaming, disabled }: Props) {
  const [value, setValue] = useState("");
  // Pre-generated messageId shared for all attachments in the current draft
  const pendingMessageId = useRef<string>(crypto.randomUUID());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pending, errors, ingesting, addFiles, removeFile, clear } =
    useAttachments();

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || streaming || ingesting) return;
    const messageId = pendingMessageId.current;
    const attachments = pending.slice();
    onSend(trimmed, attachments, messageId);
    setValue("");
    clear();
    // Reset to a fresh messageId for the next draft
    pendingMessageId.current = crypto.randomUUID();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = useCallback(
    (paths: string[]) => {
      if (paths.length) addFiles(paths, pendingMessageId.current);
    },
    [addFiles],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const paths = Array.from(e.dataTransfer.files)
        .map((f) => window.ipc.getPathForFile(f))
        .filter(Boolean) as string[];
      handleFiles(paths);
    },
    [handleFiles],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const paths = files
      .map((f) => window.ipc.getPathForFile(f))
      .filter(Boolean) as string[];
    handleFiles(paths);
    e.target.value = "";
  };

  const isDisabled = disabled || ingesting;

  return (
    <div
      className="border-t border-border p-4"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Error chips */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {errors.map((err, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 bg-danger-subtle text-danger border border-danger-subtle rounded-md flex items-center gap-1.5"
            >
              <Warning size={12} weight="bold" />
              {err}
            </span>
          ))}
        </div>
      )}

      {/* Pending attachment chips */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {pending.map((att) => (
            <AttachmentChip
              key={att.id}
              name={att.originalName}
              attachmentId={att.id}
              onRemove={removeFile}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.docx,.xlsx"
          onChange={onFileChange}
        />

        {/* Paperclip button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="p-2 text-text-muted hoverable:hover:text-text-base disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-border-strong bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          style={{ maxHeight: "min(10rem, 40vh)" }}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={isDisabled}
          aria-label="Message input"
        />
        {streaming ? (
          <button
            onClick={onAbort}
            className="px-4 py-3 rounded-xl bg-danger text-on-primary text-sm hoverable:hover:bg-danger-dark active:scale-95 motion-safe:animate-scale-in"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim() || isDisabled}
            className="px-4 py-3 rounded-xl bg-primary text-on-primary text-sm hoverable:hover:bg-primary-dark disabled:opacity-50 active:scale-95 motion-safe:animate-scale-in"
          >
            {ingesting ? "…" : "Send"}
          </button>
        )}
      </div>
    </div>
  );
}
