import { useState, useEffect, useRef, useCallback } from "react";
import { GearSix, ChatCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { SetupWizard } from "./components/Wizard/SetupWizard";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ChatView } from "./components/Chat/ChatView";
import { PersonaPanel } from "./components/Personas/PersonaPanel";
import { PipelinePanel } from "./components/Pipelines/PipelinePanel";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { BackendSwitcher } from "./components/BackendSwitcher";
import { SecurityDialog } from "./components/SecurityDialog";
import { usePipelines } from "./hooks/usePipelines";
import {
  getConversation,
  setSetting,
  deleteConversation,
  renameConversation,
  getSetting,
  onSecurityEvent,
  respondSecurity,
} from "./ipc";
import type { PipelineTemplate, Conversation, SecurityEvent } from "../shared/types";

function App() {
  const [wizardDone, setWizardDone] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("wizardDone") === "1") {
      setWizardDone(true);
      return;
    }
    getSetting("wizard_done").then((val) => {
      if (val === "1") {
        localStorage.setItem("wizardDone", "1");
        setWizardDone(true);
      }
    });
  }, []);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConvMeta, setActiveConvMeta] = useState<Conversation | null>(
    null,
  );
  const [mode, setMode] = useState<"single" | "pipeline">("single");
  const [backend, setBackend] = useState("claude");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<PipelineTemplate | null>(null);
  const [showPersonas, setShowPersonas] = useState(false);
  const [showPipelines, setShowPipelines] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { templates } = usePipelines();
  const [searchMode, setSearchMode] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (activeConvId === id) {
        setActiveConvId(null);
        setActiveConvMeta(null);
      }
      setRefreshTrigger((n) => n + 1);
    },
    [activeConvId],
  );

  const handleRename = useCallback(async (id: string, title: string) => {
    await renameConversation(id, title);
    setRefreshTrigger((n) => n + 1);
  }, []);

  // Load metadata for active conversation to detect pipeline mode
  useEffect(() => {
    if (!activeConvId) {
      setActiveConvMeta(null);
      return;
    }
    getConversation(activeConvId).then(({ conversation }) =>
      setActiveConvMeta(conversation),
    );
  }, [activeConvId]);

  // Derive the active pipeline template from loaded conversation meta or toolbar selection
  const activePipelineTemplate: PipelineTemplate | undefined = (() => {
    const templateId =
      activeConvMeta?.pipelineTemplateId ??
      (mode === "pipeline" ? selectedTemplate?.id : null);
    if (!templateId) return undefined;
    return (
      templates.find((t) => t.id === templateId) ??
      selectedTemplate ??
      undefined
    );
  })();

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleNew = useCallback(() => {
    setActiveConvId(null);
    setActiveConvMeta(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "n") {
        e.preventDefault();
        handleNew();
      }
      if (mod && e.key === "f") {
        e.preventDefault();
        setSearchMode((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNew]);

  useEffect(() => {
    return onSecurityEvent((event) => {
      setSecurityEvents((prev) => [...prev, event]);
    });
  }, []);

  if (!wizardDone) {
    return <SetupWizard onComplete={() => setWizardDone(true)} />;
  }

  return (
    <div className="flex min-h-[100dvh] bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar
        activeId={activeConvId}
        onSelect={(id) => setActiveConvId(id)}
        onNew={handleNew}
        onDelete={handleDelete}
        onRename={handleRename}
        searchInputRef={searchInputRef}
        refreshTrigger={refreshTrigger}
        searchMode={searchMode}
        onCloseSearch={() => setSearchMode(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          {/* Mode toggle */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
            <button
              onClick={() => {
                setMode("single");
                setSelectedTemplate(null);
              }}
              className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "single" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
            >
              Single
            </button>
            <button
              onClick={() => setMode("pipeline")}
              className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "pipeline" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
            >
              Pipeline
            </button>
          </div>

          {mode === "single" && !activeConvMeta?.pipelineTemplateId && (
            <BackendSwitcher value={backend} onChange={setBackend} />
          )}

          {(mode === "pipeline" || activeConvMeta?.pipelineTemplateId) && (
            <select
              className="text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
              value={activePipelineTemplate?.id ?? ""}
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                setSelectedTemplate(t ?? null);
              }}
              disabled={!!activeConvMeta?.pipelineTemplateId}
            >
              <option value="">Select pipeline…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setSearchMode((v) => !v)}
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ${searchMode ? "bg-blue-100 dark:bg-blue-900" : ""}`}
            aria-label="Search"
          >
            <MagnifyingGlass size={16} />
          </button>
          <button
            onClick={() => {
              setShowPersonas((v) => !v);
              setShowPipelines(false);
            }}
            className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 ml-auto"
          >
            Personas
          </button>
          <button
            onClick={() => {
              setShowPipelines((v) => !v);
              setShowPersonas(false);
            }}
            className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
          >
            Pipelines
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
            aria-label="Settings"
          >
            <GearSix size={16} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {!activeConvId && mode === "single" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
                <ChatCircle size={32} className="text-blue-600 dark:text-blue-300" />
              </div>
              <h2 className="text-lg font-semibold mb-2">
                Welcome to BII Agent Harness
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
                Chat with Claude Code, Gemini CLI, and Opencode from one place.
                Start a new conversation or pick one from the sidebar.
              </p>
              <button
                onClick={handleNew}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
              >
                Start a conversation
              </button>
            </div>
          ) : (
            <ChatView
              conversationId={activeConvId}
              backend={backend}
              personaId={personaId ?? undefined}
              pipelineTemplate={activePipelineTemplate}
              onNewConversation={(id) => {
                setActiveConvId(id);
                setRefreshTrigger((n) => n + 1);
              }}
            />
          )}
          <div
            className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-press ${
              showPersonas
                ? "max-w-72 opacity-100 border-l border-gray-200 dark:border-gray-700"
                : "max-w-0 opacity-0"
            }`}
          >
            <div className="w-72 overflow-y-auto h-full">
              <PersonaPanel
                activePersonaId={personaId}
                onSelect={setPersonaId}
              />
            </div>
          </div>
          <div
            className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-press ${
              showPipelines
                ? "max-w-72 opacity-100 border-l border-gray-200 dark:border-gray-700"
                : "max-w-0 opacity-0"
            }`}
          >
            <div className="w-72 overflow-y-auto h-full">
              <PipelinePanel
                activeTemplateId={activePipelineTemplate?.id ?? null}
                onSelect={(t) => {
                  setSelectedTemplate(t);
                  setMode("pipeline");
                }}
              />
            </div>
          </div>
          <div
            className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-press ${
              showSettings
                ? "max-w-72 opacity-100 border-l border-gray-200 dark:border-gray-700"
                : "max-w-0 opacity-0"
            }`}
          >
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onReRunWizard={() => {
                localStorage.removeItem("wizardDone");
                setWizardDone(false);
                setSetting("wizard_done", "0");
              }}
            />
          </div>
        </div>
      </div>
      {securityEvents.length > 0 && (
        <SecurityDialog
          event={securityEvents[0]}
          onRespond={(approved) => {
            respondSecurity({
              eventType: securityEvents[0].type,
              approved,
            });
            setSecurityEvents((prev) => prev.slice(1));
          }}
        />
      )}
    </div>
  );
}

export default App;
