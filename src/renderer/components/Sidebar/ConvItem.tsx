import { useState } from "react";
import { Trash, ArrowsSplit } from "@phosphor-icons/react";
import type { Conversation } from "../../../shared/types";

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function ConvItem({
  conversation,
  active,
  onClick,
  onDelete,
  onRename,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title);
  const isPipeline = conversation.pipelineTemplateId !== null;

  const handleSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-3 py-1">
        <input
          className="w-full text-sm px-2 py-1 rounded border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-800 focus:outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={handleSubmit}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1">
      <button
        onClick={onClick}
        onDoubleClick={() => {
          setEditValue(conversation.title);
          setEditing(true);
        }}
        aria-current={active ? "page" : undefined}
        className={`flex-1 text-left px-3 py-2 rounded-lg text-sm truncate hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 transition-[background-color,transform] duration-100 ease-press active:scale-95 ${
          active ? "bg-gray-200 dark:bg-gray-700 font-medium" : ""
        }`}
      >
        <div className="font-medium truncate flex items-center gap-1">
          {isPipeline && (
            <ArrowsSplit size={12} className="flex-shrink-0 text-blue-500" />
          )}
          <span className="truncate" title={conversation.title}>
            {conversation.title}
          </span>
        </div>
        <div className="text-xs text-gray-400 flex gap-2">
          <span>{isPipeline ? "pipeline" : conversation.backend}</span>
          <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conversation.id);
        }}
        className="opacity-0 hoverable:group-hover:opacity-100 p-1 text-gray-400 hoverable:hover:text-red-500 transition-[opacity,transform] duration-100 ease-press active:scale-95"
        aria-label="Delete conversation"
        title="Delete"
      >
        <Trash size={16} />
      </button>
    </div>
  );
}
