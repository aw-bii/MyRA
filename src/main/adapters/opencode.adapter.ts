import { spawn, ChildProcess } from 'child_process'
import type { BackendAdapter, MessageChunk } from '../../shared/types'

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

  async *send(message: string, persona?: string): AsyncIterable<MessageChunk> {
    // opencode --json flag is unstable; falls back to stdout line parsing
    const args = ['run', '--json', message]
    if (persona) args.push('--system-prompt', persona)

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
