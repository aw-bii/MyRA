import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

export function ConvItem({ conversation, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700' : ''
      }`}
    >
      <div className="font-medium truncate">{conversation.title}</div>
      <div className="text-xs text-gray-400 flex gap-2">
        <span>{conversation.backend}</span>
        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
