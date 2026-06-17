import { useState } from 'react'
import { installBackend } from '../../ipc'

const LABELS: Record<string, string> = { gemini: 'Gemini CLI', opencode: 'Opencode' }

interface Props {
  missing: string[]
  onNext: () => void
}

export function WizardStep2({ missing, onNext }: Props) {
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [installing, setInstalling] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<Record<string, boolean>>({})

  const install = async (id: string) => {
    setInstalling(prev => ({ ...prev, [id]: true }))
    const addLine = (line: string) => setLogs(prev => ({ ...prev, [id]: [...(prev[id] ?? []), line] }))

    // listen for install output lines
    const off = window.ipc.on('wizard:install:line', (line: unknown) => addLine(String(line)))
    const ok = await installBackend(id)
    off()

    setInstalling(prev => ({ ...prev, [id]: false }))
    setDone(prev => ({ ...prev, [id]: ok }))
  }

  if (missing.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">All backends available</h2>
        <button onClick={onNext} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">Next</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Install optional backends</h2>
        <p className="text-sm text-gray-500">These are optional. You can skip and add them later from Settings.</p>
      </div>
      {missing.map(id => (
        <div key={id} className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{LABELS[id] ?? id}</span>
            <button
              onClick={() => install(id)}
              disabled={installing[id] || done[id]}
              className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {done[id] ? 'Installed ✓' : installing[id] ? 'Installing...' : 'Install'}
            </button>
          </div>
          {(logs[id] ?? []).length > 0 && (
            <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-2 max-h-24 overflow-y-auto">
              {logs[id].join('\n')}
            </pre>
          )}
        </div>
      ))}
      <button onClick={onNext} className="py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">
        Continue
      </button>
    </div>
  )
}
