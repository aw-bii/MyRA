import { spawn } from 'child_process'

const INSTALL_COMMANDS: Record<string, [string, string[]]> = {
  gemini:   ['npm', ['install', '-g', '@google/gemini-cli']],
  opencode: ['npm', ['install', '-g', 'opencode']],
}

export function installBackend(id: string, onData: (line: string) => void): Promise<boolean> {
  const cmd = INSTALL_COMMANDS[id]
  if (!cmd) return Promise.resolve(false)

  const [binary, args] = cmd
  return new Promise(resolve => {
    const p = spawn(binary, args, { stdio: 'pipe', shell: true })
    p.stdout!.on('data', (buf: Buffer) => buf.toString().split('\n').filter(Boolean).forEach(onData))
    p.stderr!.on('data', (buf: Buffer) => buf.toString().split('\n').filter(Boolean).forEach(onData))
    p.on('close', code => resolve(code === 0))
    p.on('error', () => resolve(false))
  })
}
