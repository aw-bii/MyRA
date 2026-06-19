import { ClaudeAdapter } from './claude.adapter'
import { GeminiAdapter } from './gemini.adapter'
import { OpencodeAdapter } from './opencode.adapter'
import type { BackendAdapter, BackendInfo } from '../../shared/types'

const registry: BackendAdapter[] = [
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new OpencodeAdapter(),
]

let activeId = 'claude'

export const AdapterManager = {
  getActive(): BackendAdapter {
    return registry.find(a => a.id === activeId)!
  },

  setActive(id: string): void {
    if (!registry.find(a => a.id === id)) throw new Error(`Unknown adapter: ${id}`)
    activeId = id
  },

  get(id: string): BackendAdapter | undefined {
    return registry.find(a => a.id === id)
  },

  async listAvailable(): Promise<BackendInfo[]> {
    return Promise.all(
      registry.map(async a => ({
        id: a.id,
        label: labelFor(a.id),
        available: await a.isAvailable(),
        authenticated: await a.checkAuth(),
      }))
    )
  },
}

function labelFor(id: string): string {
  return { claude: 'Claude Code', gemini: 'Gemini CLI', opencode: 'Opencode' }[id] ?? id
}
