import { useState, useCallback } from 'react'
import { ingestAttachments } from '../ipc'
import type { Attachment } from '../../shared/types'

const MAX_SIZE = 20 * 1024 * 1024

const SUPPORTED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.pdf', '.txt', '.md', '.csv', '.docx', '.xlsx',
])

interface PendingFile {
  path: string
  name: string
  size: number
}

export function useAttachments() {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const addFiles = useCallback((filePaths: string[]) => {
    const newErrors: string[] = []
    const valid: PendingFile[] = []

    for (const fp of filePaths) {
      const name = fp.split(/[\\/]/).pop() ?? fp
      const ext = ('.' + name.split('.').pop()).toLowerCase()

      // Size check requires IPC — we rely on the renderer File API size for drag-drop
      // or skip size check here (service.ts enforces 20 MB on ingest)
      if (!SUPPORTED_EXTS.has(ext)) {
        newErrors.push(`Unsupported file type: ${name}`)
        continue
      }
      valid.push({ path: fp, name, size: 0 })
    }

    if (newErrors.length) setErrors(prev => [...prev, ...newErrors])
    setPending(prev => [...prev, ...valid])
  }, [])

  const removeFile = useCallback((filePath: string) => {
    setPending(prev => prev.filter(f => f.path !== filePath))
  }, [])

  const ingest = useCallback(async (messageId: string): Promise<Attachment[]> => {
    if (pending.length === 0) return []
    const paths = pending.map(f => f.path)
    const result = await ingestAttachments(paths, messageId)
    return result
  }, [pending])

  const clear = useCallback(() => {
    setPending([])
    setErrors([])
  }, [])

  return { pending, addFiles, removeFile, ingest, clear, errors }
}
