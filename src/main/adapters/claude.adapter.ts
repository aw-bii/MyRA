import fs from 'fs'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk, Attachment } from '../../shared/types'
import { AttachmentService } from '../attachments/service'

function getClaudeBinaryPath(): string {
  try {
    const { app } = require('electron') as typeof import('electron')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
    const bundledPath = app.isPackaged
      ? path.join(process.resourcesPath!, 'claude-bin', binaryName)
      : path.join(__dirname, '..', '..', '..', 'resources', 'claude-bin', binaryName)
    if (fs.existsSync(bundledPath)) return bundledPath
  } catch { /* fallback to PATH */ }
  return 'claude'
}

export class ClaudeAdapter implements BackendAdapter {
  id = 'claude'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn(getClaudeBinaryPath(), ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk> {
    const args = ['--output-format', 'stream-json', '--print']
    if (persona) args.push('--system-prompt', persona)

    let fullMessage = message
    if (attachments && attachments.length > 0) {
      const injections: string[] = []
      for (const att of attachments) {
        if (att.extractionError) {
          injections.push(`[Attachment: ${att.originalName}]\n(extraction failed)\n[/Attachment]`)
        } else if (!fs.existsSync(att.storedPath)) {
          console.warn(`[ClaudeAdapter] attachment file not found: ${att.storedPath}, falling back to content injection`)
          injections.push(`[Attachment: ${att.originalName}]\n${AttachmentService.getContent(att)}\n[/Attachment]`)
        } else {
          args.push('--file', att.storedPath)
        }
      }
      if (injections.length > 0) {
        fullMessage = `${message}\n\n${injections.join('\n\n')}`
      }
    }

    args.push('--', fullMessage)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn(getClaudeBinaryPath(), args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line)
          const chunk = parseClaudeEvent(json)
          if (chunk) { chunks.push(chunk); resolve?.() }
        } catch { /* skip malformed lines */ }
      }
    })

    this.proc.on('close', () => {
      done = true
      chunks.push({ type: 'done', content: '' })
      resolve?.()
    })

    this.proc.on('error', (err) => {
      done = true
      chunks.push({ type: 'error', content: err.message })
      resolve?.()
    })

    while (true) {
      while (chunks.length > 0) yield chunks.shift()!
      if (done) break
      await new Promise<void>(r => { resolve = r })
    }
  }

  abort(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }
}

function parseClaudeEvent(event: any): MessageChunk | null {
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { type: 'text', content: event.delta.text, raw: event }
  }
  if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
    return { type: 'tool_use', content: event.content_block.name ?? '', raw: event }
  }
  if (event.type === 'error') {
    return { type: 'error', content: event.error?.message ?? 'Unknown error', raw: event }
  }
  return null
}
