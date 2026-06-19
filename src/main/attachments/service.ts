import fs from 'fs'
import path from 'path'
import { ConvStore } from '../store'
import type { Attachment } from '../../shared/types'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

const SUPPORTED_MIMES: Record<string, boolean> = {
  'image/png': true,
  'image/jpeg': true,
  'image/gif': true,
  'image/webp': true,
  'application/pdf': true,
  'text/plain': true,
  'text/markdown': true,
  'text/csv': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext] ?? 'application/octet-stream'
}

async function extractText(filePath: string, mimeType: string): Promise<{ text: string | null; error: boolean }> {
  try {
    if (mimeType.startsWith('text/')) {
      return { text: fs.readFileSync(filePath, 'utf8'), error: false }
    }
    if (mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(fs.readFileSync(filePath))
      return { text: data.text, error: false }
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return { text: result.value, error: false }
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const XLSX = await import('xlsx')
      const wb = XLSX.readFile(filePath)
      const text = wb.SheetNames.map((name: string) => {
        const sheet = wb.Sheets[name]
        return XLSX.utils.sheet_to_csv(sheet)
      }).join('\n\n')
      return { text, error: false }
    }
    return { text: null, error: false }
  } catch {
    return { text: null, error: true }
  }
}

export const AttachmentService = {
  async ingest(filePaths: string[], messageId: string, userDataPath: string): Promise<Attachment[]> {
    const results: Attachment[] = []

    for (const filePath of filePaths) {
      const mimeType = mimeFromPath(filePath)
      if (!SUPPORTED_MIMES[mimeType]) continue

      const stat = fs.statSync(filePath)
      if (stat.size > MAX_SIZE_BYTES) continue

      const destDir = path.join(userDataPath, 'attachments', messageId)
      fs.mkdirSync(destDir, { recursive: true })

      const originalName = path.basename(filePath)
      const storedPath = path.join(destDir, originalName)
      fs.copyFileSync(filePath, storedPath)

      const { text, error } = await extractText(storedPath, mimeType)

      const att = ConvStore.createAttachment({
        messageId,
        originalName,
        storedPath,
        mimeType,
        sizeBytes: stat.size,
        extractedText: text,
        extractionError: error,
      })
      results.push(att)
    }

    return results
  },

  getContent(attachment: Attachment): string {
    if (attachment.mimeType.startsWith('image/')) {
      const buf = fs.readFileSync(attachment.storedPath)
      return `data:${attachment.mimeType};base64,${buf.toString('base64')}`
    }
    return attachment.extractedText ?? `[${attachment.originalName}]`
  },

  listForMessage(messageId: string): Attachment[] {
    return ConvStore.getAttachmentsForMessage(messageId)
  },

  async purge(messageId: string, userDataPath: string): Promise<void> {
    const dir = path.join(userDataPath, 'attachments', messageId)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    ConvStore.deleteAttachmentsForMessage(messageId)
  },
}
