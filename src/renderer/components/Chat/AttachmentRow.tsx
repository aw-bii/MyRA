import type { Attachment } from '../../../../shared/types'

interface Props {
  attachments: Attachment[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentRow({ attachments }: Props) {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map(att => (
        <div key={att.id} className="flex flex-col gap-1">
          {att.mimeType.startsWith('image/') && (
            <img
              src={`file://${att.storedPath}`}
              alt={att.originalName}
              className="max-w-[200px] rounded-lg object-cover"
            />
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z" />
            </svg>
            <span className="truncate max-w-[150px]">{att.originalName}</span>
            <span className="flex-shrink-0">· {formatBytes(att.sizeBytes)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
