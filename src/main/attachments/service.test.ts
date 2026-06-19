import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Use vi.hoisted so variables are available when vi.mock factory runs
const { mockCreateAttachment, mockListAttachments, mockDeleteAttachmentsForMessage } = vi.hoisted(() => ({
  mockCreateAttachment: vi.fn(),
  mockListAttachments: vi.fn(),
  mockDeleteAttachmentsForMessage: vi.fn(),
}))

vi.mock('../store', () => ({
  ConvStore: {
    createAttachment: mockCreateAttachment,
    getAttachmentsForMessage: mockListAttachments,
    deleteAttachmentsForMessage: mockDeleteAttachmentsForMessage,
  },
}))

import { AttachmentService } from './service'

const TMP = os.tmpdir()

describe('AttachmentService.ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAttachment.mockImplementation((a: any) => ({ ...a, id: 'att-1', createdAt: Date.now() }))
  })

  it('rejects files over 20 MB', async () => {
    const bigFile = path.join(TMP, 'big.txt')
    fs.writeFileSync(bigFile, 'x')
    // Stub stat to return oversized file
    vi.spyOn(fs, 'statSync').mockReturnValueOnce({ size: 21 * 1024 * 1024 } as any)
    const results = await AttachmentService.ingest([bigFile], 'msg-1', TMP)
    expect(results).toHaveLength(0)
  })

  it('rejects unsupported MIME types', async () => {
    const mp4 = path.join(TMP, 'video.mp4')
    fs.writeFileSync(mp4, 'fake')
    const results = await AttachmentService.ingest([mp4], 'msg-1', TMP)
    expect(results).toHaveLength(0)
    fs.unlinkSync(mp4)
  })

  it('copies text file and stores extracted_text', async () => {
    const txtFile = path.join(TMP, 'hello.txt')
    fs.writeFileSync(txtFile, 'hello world')
    const destDir = path.join(TMP, 'att-test', 'msg-txt')
    fs.mkdirSync(destDir, { recursive: true })

    await AttachmentService.ingest([txtFile], 'msg-txt', TMP)

    expect(mockCreateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ originalName: 'hello.txt', extractedText: 'hello world' })
    )
    fs.unlinkSync(txtFile)
  })

  it('stores extractionError: true when extraction throws', async () => {
    const pdfFile = path.join(TMP, 'broken.pdf')
    fs.writeFileSync(pdfFile, 'not a real pdf')

    await AttachmentService.ingest([pdfFile], 'msg-pdf', TMP)

    expect(mockCreateAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ extractionError: true })
    )
    fs.unlinkSync(pdfFile)
  })
})

describe('AttachmentService.getContent', () => {
  it('returns extractedText for text files', () => {
    const att = {
      id: '1', messageId: 'm', originalName: 'f.txt', storedPath: '/tmp/f.txt',
      mimeType: 'text/plain', sizeBytes: 10, extractedText: 'hello', extractionError: false, createdAt: 0,
    }
    expect(AttachmentService.getContent(att)).toBe('hello')
  })

  it('returns base64 data URI for images', () => {
    const imgPath = path.join(TMP, 'pixel.png')
    // 1x1 PNG bytes
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    fs.writeFileSync(imgPath, pngBytes)

    const att = {
      id: '2', messageId: 'm', originalName: 'pixel.png', storedPath: imgPath,
      mimeType: 'image/png', sizeBytes: pngBytes.length, extractedText: null, extractionError: false, createdAt: 0,
    }
    const result = AttachmentService.getContent(att)
    expect(result).toMatch(/^data:image\/png;base64,/)
    fs.unlinkSync(imgPath)
  })
})

describe('AttachmentService.purge', () => {
  it('removes the attachment directory and calls deleteAttachmentsForMessage', async () => {
    const dir = path.join(TMP, 'attachments', 'msg-purge')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'dummy.txt'), 'x')

    await AttachmentService.purge('msg-purge', TMP)

    expect(mockDeleteAttachmentsForMessage).toHaveBeenCalledWith('msg-purge')
    expect(fs.existsSync(dir)).toBe(false)
  })
})
