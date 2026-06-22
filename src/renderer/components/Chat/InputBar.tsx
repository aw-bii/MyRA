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
      className="border-t border-gray-200 dark:border-gray-700 p-4"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Error chips */}
      {errors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {errors.map((err, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-md flex items-center gap-1.5"
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
          className="p-2 text-gray-400 hoverable:hover:text-gray-600 dark:hoverable:hover:text-gray-300 disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={isDisabled}
        />
        <div className="relative">
          {/* Send — always in layout; hidden when streaming */}
          <button
            onClick={submit}
            disabled={!value.trim() || isDisabled || streaming}
            tabIndex={streaming ? -1 : 0}
            aria-hidden={streaming}
            className={`px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 disabled:opacity-50 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
              streaming
                ? "opacity-0 scale-90 pointer-events-none"
                : "opacity-100 scale-100"
            }`}
          >
            {ingesting ? "…" : "Send"}
          </button>
          {/* Stop — absolute overlay; shown when streaming */}
          <button
            onClick={onAbort}
            tabIndex={streaming ? 0 : -1}
            aria-hidden={!streaming}
            className={`absolute inset-0 rounded-xl bg-red-500 text-white text-sm hoverable:hover:bg-red-600 transition-[opacity,transform] duration-[120ms] ease-out active:scale-95 ${
              streaming
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-90 pointer-events-none"
            }`}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}
