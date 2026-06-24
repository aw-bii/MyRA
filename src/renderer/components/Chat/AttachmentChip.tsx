import { memo } from "react";

interface Props {
  name: string;
  attachmentId: string;
  onRemove: (id: string) => void;
}

export const AttachmentChip = memo(function AttachmentChip({ name, attachmentId, onRemove }: Props) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs max-w-[160px] animate-fade-in-up [animation-duration:150ms]">
      <svg
        className="w-3 h-3 flex-shrink-0 text-gray-500"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M8 0a2 2 0 0 1 2 2v8a4 4 0 0 1-8 0V3a1 1 0 0 1 2 0v7a2 2 0 0 0 4 0V2a.5.5 0 0 0-1 0v8a1.5 1.5 0 0 1-3 0V3a3 3 0 0 1 6 0v8a4 4 0 0 1-8 0V2a2 2 0 0 1 2-2z" />
      </svg>
      <span className="truncate">{name}</span>
      <button
        onClick={() => onRemove(attachmentId)}
        className="ml-1 text-gray-400 hoverable:hover:text-red-500 flex-shrink-0 transition-transform duration-100 ease-press active:scale-95"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </div>
  );
});
