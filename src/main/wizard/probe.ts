import { spawn } from 'child_process'

// probe commands as [binary, args[]]
const PROBES: Record<string, [string, string[]]> = {
  claude:   ['claude',   ['--version']],
  gemini:   ['gemini',   ['auth', 'status']],
  opencode: ['opencode', ['--version']],
}

export async function probeBackend(id: string): Promise<{ available: boolean; authenticated: boolean }> {
  const probe = PROBES[id]
  if (!probe) return { available: false, authenticated: false }

  const [binary, args] = probe
  const exitCode = await runAndGetExit(binary, args)
  return { available: exitCode === 0, authenticated: exitCode === 0 }
}

function runAndGetExit(binary: string, args: string[]): Promise<number> {
  return new Promise(resolve => {
    const p = spawn(binary, args, { stdio: 'pipe' })
    p.on('close', code => resolve(code ?? 1))
    p.on('error', () => resolve(1))
  })
}
