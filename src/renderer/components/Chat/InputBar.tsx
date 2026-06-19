import { useState, useRef, KeyboardEvent, DragEvent, useCallback } from 'react'
import { AttachmentChip } from './AttachmentChip'
import { useAttachments } from '../../hooks/useAttachments'
import type { Attachment } from '../../../../shared/types'

interface Props {
  onSend: (message: string, attachments: Attachment[], messageId: string) => void
  onAbort: () => void
  streaming: boolean
  disabled?: boolean
}

export function InputBar({ onSend, onAbort, streaming, disabled }: Props) {
  const [value, setValue] = useState('')
  // Pre-generated messageId shared for all attachments in the current draft
  const pendingMessageId = useRef<string>(crypto.randomUUID())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { pending, errors, ingesting, addFiles, removeFile, clear } = useAttachments()

  const submit = async () => {
    const trimmed = value.trim()
    if (!trimmed || streaming || ingesting) return
    const messageId = pendingMessageId.current
    const attachments = pending.slice()
    onSend(trimmed, attachments, messageId)
    setValue('')
    clear()
    // Reset to a fresh messageId for the next draft
    pendingMessageId.current = crypto.randomUUID()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const handleFiles = useCallback((paths: string[]) => {
    if (paths.length) addFiles(paths, pendingMessageId.current)
  }, [addFiles])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const paths = Array.from(e.dataTransfer.files).map((f: any) => f.path as string).filter(Boolean)
    handleFiles(paths)
  }, [handleFiles])

  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const paths = files.map((f: any) => f.path as string).filter(Boolean)
    handleFiles(paths)
    e.target.value = ''
  }

  const isDisabled = disabled || ingesting

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
            <span key={i} className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded">
              {err}
            </span>
          ))}
        </div>
      )}

      {/* Pending attachment chips */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {pending.map(att => (
            <AttachmentChip key={att.id} name={att.originalName} attachmentId={att.id} onRemove={removeFile} />
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
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
          aria-label="Attach file"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a3 3 0 0 0-3 3v4.5a4.5 4.5 0 0 0 9 0V7a1 1 0 1 1 2 0v4.5a6.5 6.5 0 1 1-13 0V7a5 5 0 0 1 10 0v4.5a2.5 2.5 0 1 1-5 0V7a1 1 0 0 1 2 0v4.5a.5.5 0 0 0 1 0V7a3 3 0 0 0-3-3z" clipRule="evenodd" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-40"
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message..."
          disabled={isDisabled}
        />
        {streaming
          ? <button onClick={onAbort} className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm hover:bg-red-600">Stop</button>
          : <button
              onClick={submit}
              disabled={!value.trim() || isDisabled}
              className="px-4 py-3 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {ingesting ? '…' : 'Send'}
            </button>
        }
      </div>
    </div>
  )
}
