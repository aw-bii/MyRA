import { useState } from 'react'
import { usePersonas } from '../../../hooks/usePersonas'
import type { Persona } from '../../../../shared/types'

interface Props {
  activePersonaId: string | null
  onSelect: (id: string | null) => void
}

export function PersonaPanel({ activePersonaId, onSelect }: Props) {
  const { personas, save, remove } = usePersonas()
  const [editing, setEditing] = useState<Partial<Persona> | null>(null)

  const startNew = () => setEditing({ name: '', systemPrompt: '', isDefault: false })
  const cancel = () => setEditing(null)

  const submit = async () => {
    if (!editing?.name) return
    await save({ name: editing.name!, systemPrompt: editing.systemPrompt ?? '', isDefault: editing.isDefault ?? false, ...(editing.id ? { id: editing.id } : {}) })
    setEditing(null)
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Personas</h3>
        <button onClick={startNew} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">+ New</button>
      </div>

      <div
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === null ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        onClick={() => onSelect(null)}
      >
        <span>No persona</span>
      </div>

      {personas.map(p => (
        <div
          key={p.id}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm ${activePersonaId === p.id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          onClick={() => onSelect(p.id)}
        >
          <div>
            <div className="font-medium">{p.name}</div>
            {p.isDefault && <div className="text-xs text-blue-500">default</div>}
          </div>
          <div className="flex gap-1">
            <button onClick={e => { e.stopPropagation(); setEditing(p) }} className="text-xs text-gray-400 hover:text-gray-700 px-1">Edit</button>
            <button onClick={e => { e.stopPropagation(); remove(p.id) }} className="text-xs text-red-400 hover:text-red-600 px-1">Del</button>
          </div>
        </div>
      ))}

      {editing && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <input
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
            placeholder="Name"
            value={editing.name ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
          />
          <textarea
            className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 resize-none"
            placeholder="System prompt..."
            rows={3}
            value={editing.systemPrompt ?? ''}
            onChange={e => setEditing(prev => ({ ...prev, systemPrompt: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.isDefault ?? false} onChange={e => setEditing(prev => ({ ...prev, isDefault: e.target.checked }))} />
            Set as default
          </label>
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 text-sm py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
            <button onClick={cancel} className="flex-1 text-sm py-1 rounded border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
