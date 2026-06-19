import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk, Attachment } from '../../shared/types'
import { AttachmentService } from '../attachments/service'

export class OpencodeAdapter implements BackendAdapter {
  id = 'opencode'
  private proc: ChildProcess | null = null

  async isAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('opencode', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async checkAuth(): Promise<boolean> {
    return new Promise(resolve => {
      const p = spawn('opencode', ['--version'], { stdio: 'pipe' })
      p.on('close', code => resolve(code === 0))
      p.on('error', () => resolve(false))
    })
  }

  async *send(message: string, persona?: string, attachments?: Attachment[]): AsyncIterable<MessageChunk> {
    // opencode --json flag is unstable; falls back to stdout line parsing
    // NOTE: opencode CLI support for '--' end-of-flags is unconfirmed; applied defensively.
    const args = ['run', '--json']
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

    this.proc = spawn('opencode', args, { stdio: 'pipe' })

    this.proc.stdout!.on('data', (buf: Buffer) => {
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        chunks.push(parseOpencodeLine(line))
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

function parseOpencodeLine(line: string): MessageChunk {
  try {
    const json = JSON.parse(line)
    if (typeof json?.content === 'string') return { type: 'text', content: json.content, raw: json }
    if (typeof json?.text === 'string') return { type: 'text', content: json.text, raw: json }
  } catch { /* fall through */ }
  return { type: 'text', content: line }
}
