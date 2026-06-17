import { useState } from 'react'
import { probeBackend } from '../../ipc'

const AUTH_COMMANDS: Record<string, string> = {
  claude: 'claude login',
  gemini: 'gemini auth login',
  opencode: 'opencode auth',
}

interface BackendStatus { id: string; available: boolean; authenticated: boolean; loading: boolean }

interface Props {
  statuses: BackendStatus[]
  onComplete: () => void
}

export function WizardStep3({ statuses: initial, onComplete }: Props) {
  const [statuses, setStatuses] = useState(initial)

  const recheck = async (id: string) => {
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, loading: true } : s))
    const result = await probeBackend(id)
    setStatuses(prev => prev.map(s => s.id === id ? { ...s, ...result, loading: false } : s))
  }

  const needsAuth = statuses.filter(s => s.available && !s.authenticated)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Authenticate backends</h2>
        <p className="text-sm text-gray-500">Run the command shown, then click Recheck.</p>
      </div>
      {needsAuth.length === 0 && (
        <div className="text-sm text-green-600 font-medium">All available backends are authenticated ✓</div>
      )}
      {needsAuth.map(s => (
        <div key={s.id} className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="font-medium text-sm">{s.id}</div>
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">{AUTH_COMMANDS[s.id]}</code>
          <button
            onClick={() => recheck(s.id)}
            disabled={s.loading}
            className="text-sm py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {s.loading ? 'Checking...' : 'Recheck'}
          </button>
        </div>
      ))}
      <button onClick={onComplete} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">
        Finish Setup
      </button>
    </div>
  )
}
