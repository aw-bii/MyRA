import { useEffect, useState } from 'react'
import { probeBackend } from '../../ipc'

const BACKENDS = [
  { id: 'claude', label: 'Claude Code', bundled: true },
  { id: 'gemini', label: 'Gemini CLI', bundled: false },
  { id: 'opencode', label: 'Opencode', bundled: false },
]

interface BackendStatus { id: string; available: boolean; authenticated: boolean; loading: boolean }

interface Props { onNext: (statuses: BackendStatus[]) => void }

export function WizardStep1({ onNext }: Props) {
  const [statuses, setStatuses] = useState<BackendStatus[]>(
    BACKENDS.map(b => ({ id: b.id, available: b.bundled, authenticated: b.bundled, loading: !b.bundled }))
  )

  useEffect(() => {
    BACKENDS.filter(b => !b.bundled).forEach(async b => {
      const result = await probeBackend(b.id)
      setStatuses(prev => prev.map(s => s.id === b.id ? { ...s, ...result, loading: false } : s))
    })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Detecting AI backends</h2>
        <p className="text-sm text-gray-500">Checking which CLI tools are installed on your system.</p>
      </div>
      <div className="flex flex-col gap-3">
        {BACKENDS.map((b, i) => {
          const s = statuses[i]
          return (
            <div key={b.id} className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
              <div className="text-xl">
                {s.loading ? '⏳' : s.available ? '✅' : '❌'}
              </div>
              <div>
                <div className="font-medium text-sm">{b.label}</div>
                <div className="text-xs text-gray-400">
                  {b.bundled ? 'Bundled — always available' : s.loading ? 'Checking...' : s.available ? 'Found' : 'Not found'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <button
        onClick={() => onNext(statuses)}
        disabled={statuses.some(s => s.loading)}
        className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  )
}
