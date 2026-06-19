import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk, Attachment } from '../../shared/types'
import { AttachmentService } from '../attachments/service'

export class GeminiAdapter implements BackendAdapter {
  id = 'gemini'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('gemini', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async checkAuth(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('gemini', ['auth', 'status'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk> {
    // NOTE: gemini CLI support for '--' end-of-flags is unconfirmed; applied defensively.
    const args = ['--format', 'json', '-p']
    if (persona) args.push('--system-prompt', persona)

    let fullMessage = message
    if (attachments && attachments.length > 0) {
      const injected = attachments.map(a =>
        `[Attachment: ${a.originalName}]\n${AttachmentService.getContent(a)}\n[/Attachment]`
      ).join('\n\n')
      fullMessage = `${message}\n\n${injected}`
    }

    args.push('--', fullMessage)

    const chunks: MessageChunk[] = []
    let resolve: (() => void) | null = null
    let done = false

    this.proc = spawn('gemini', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        const chunk = parseGeminiLine(line)
        chunks.push(chunk)
        resolve?.()
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

function parseGeminiLine(line: string): MessageChunk {
  try {
    const json = JSON.parse(line)
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string') return { type: 'text', content: text, raw: json }
  } catch { /* fall through */ }
  return { type: 'text', content: line }
}
