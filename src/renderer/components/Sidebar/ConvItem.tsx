import type { Conversation } from '../../../../shared/types'

interface Props {
  conversation: Conversation
  active: boolean
  onClick: () => void
}

export function ConvItem({ conversation, active, onClick }: Props) {
  const isPipeline = conversation.pipelineTemplateId !== null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
        active ? 'bg-gray-200 dark:bg-gray-700' : ''
      }`}
    >
      <div className="font-medium truncate flex items-center gap-1">
        {isPipeline && (
          <svg className="w-3 h-3 flex-shrink-0 text-blue-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-5-1h2v2H7V7zm0-4h2v2H7V3z" />
          </svg>
        )}
        <span className="truncate">{conversation.title}</span>
      </div>
      <div className="text-xs text-gray-400 flex gap-2">
        <span>{isPipeline ? 'pipeline' : conversation.backend}</span>
        <span>{new Date(conversation.updatedAt).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
