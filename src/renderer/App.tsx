import { useState, useEffect } from 'react'
import { SetupWizard } from './components/Wizard/SetupWizard'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatView } from './components/Chat/ChatView'
import { PersonaPanel } from './components/Personas/PersonaPanel'
import { PipelinePanel } from './components/Pipelines/PipelinePanel'
import { BackendSwitcher } from './components/BackendSwitcher'
import { usePipelines } from './hooks/usePipelines'
import { getConversation } from './ipc'
import type { PipelineTemplate, Conversation } from '../shared/types'

function App() {
  const [wizardDone, setWizardDone] = useState(() => localStorage.getItem('wizardDone') === '1')
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvMeta, setActiveConvMeta] = useState<Conversation | null>(null)
  const [mode, setMode] = useState<'single' | 'pipeline'>('single')
  const [backend, setBackend] = useState('claude')
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null)
  const [showPersonas, setShowPersonas] = useState(false)
  const [showPipelines, setShowPipelines] = useState(false)
  const { templates } = usePipelines()

  // Load metadata for active conversation to detect pipeline mode
  useEffect(() => {
    if (!activeConvId) { setActiveConvMeta(null); return }
    getConversation(activeConvId).then(({ conversation }) => setActiveConvMeta(conversation))
  }, [activeConvId])

  // Derive the active pipeline template from loaded conversation meta or toolbar selection
  const activePipelineTemplate: PipelineTemplate | undefined = (() => {
    const templateId = activeConvMeta?.pipelineTemplateId ?? (mode === 'pipeline' ? selectedTemplate?.id : null)
    if (!templateId) return undefined
    return templates.find(t => t.id === templateId) ?? selectedTemplate ?? undefined
  })()

  const handleNew = () => {
    setActiveConvId(null)
    setActiveConvMeta(null)
  }

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={id => setActiveConvId(id)}
        onNew={handleNew}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              onClick={() => { setMode('single'); setSelectedTemplate(null) }}
              className={`px-3 py-1 ${mode === 'single' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Single
            </button>
            <button
              onClick={() => setMode('pipeline')}
              className={`px-3 py-1 ${mode === 'pipeline' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              Pipeline
            </button>
          </div>

          {mode === 'single' && !activeConvMeta?.pipelineTemplateId && (
            <BackendSwitcher value={backend} onChange={setBackend} />
          )}

          {(mode === 'pipeline' || activeConvMeta?.pipelineTemplateId) && (
            <select
              className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
              value={activePipelineTemplate?.id ?? ''}
              onChange={e => {
                const t = templates.find(x => x.id === e.target.value)
                setSelectedTemplate(t ?? null)
              }}
              disabled={!!activeConvMeta?.pipelineTemplateId}
            >
              <option value="">Select pipeline…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => { setShowPersonas(v => !v); setShowPipelines(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 ml-auto"
          >
            Personas
          </button>
          <button
            onClick={() => { setShowPipelines(v => !v); setShowPersonas(false) }}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Pipelines
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <ChatView
            conversationId={activeConvId}
            backend={backend}
            personaId={personaId ?? undefined}
            pipelineTemplate={activePipelineTemplate}
            onNewConversation={id => setActiveConvId(id)}
          />
          {showPersonas && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PersonaPanel activePersonaId={personaId} onSelect={setPersonaId} />
            </div>
          )}
          {showPipelines && (
            <div className="w-72 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={t => { setSelectedTemplate(t); setMode('pipeline') }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
