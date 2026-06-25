import { useState, useEffect, useRef, useCallback } from "react";
import { GearSix, MagnifyingGlass, List } from "@phosphor-icons/react";
import { SetupWizard } from "./components/Wizard/SetupWizard";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ChatView } from "./components/Chat/ChatView";
import { PersonaPanel } from "./components/Personas/PersonaPanel";
import { PipelinePanel } from "./components/Pipelines/PipelinePanel";
import { SettingsPanel } from "./components/Settings/SettingsPanel";
import { BackendSwitcher } from "./components/BackendSwitcher";
import { ModelSelector } from "./components/Toolbar/ModelSelector";
import { SecurityDialog } from "./components/SecurityDialog";
import { UpdateBanner } from "./components/UpdateBanner";
import { DiagnosticBanner } from "./components/DiagnosticBanner";
import { usePipelines } from "./hooks/usePipelines";
import {
  getConversation,
  createConversation,
  setSetting,
  deleteConversation,
  renameConversation,
  getSetting,
  onSecurityEvent,
  respondSecurity,
  checkConnectivity,
} from "./ipc";
import type {
  PipelineTemplate,
  Conversation,
  SecurityEvent,
} from "../shared/types";

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
  const [model, setModel] = useState("");
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<PipelineTemplate | null>(null);
  const [showPersonas, setShowPersonas] = useState(false);
  const [showPipelines, setShowPipelines] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { templates } = usePipelines();
  const togglePanel = useCallback((panel: "personas" | "pipelines" | "settings") => {
    const nextPersonas = panel === "personas" ? !showPersonas : false;
    const nextPipelines = panel === "pipelines" ? !showPipelines : false;
    const nextSettings = panel === "settings" ? !showSettings : false;
    setShowPersonas(nextPersonas);
    setShowPipelines(nextPipelines);
    setShowSettings(nextSettings);
  }, [showPersonas, showPipelines, showSettings]);
  const [searchMode, setSearchMode] = useState(false);
  const [showCron, setShowCron] = useState(false);
  const [showMCP, setShowMCP] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [viewportLg, setViewportLg] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setViewportLg(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [backendRefresh, setBackendRefresh] = useState(0);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [online, setOnline] = useState(true);

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

  const handleNew = useCallback(async () => {
    try {
      const conv = await createConversation(
        `Conversation ${new Date().toLocaleDateString()}`,
        backend,
        personaId ?? undefined,
      );
      setActiveConvId(conv.id);
      setActiveConvMeta(conv);
      setRefreshTrigger((n) => n + 1);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, [backend, personaId]);

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

  useEffect(() => {
    checkConnectivity().then((r) => setOnline(r.online)).catch(() => setOnline(false));
  }, []);

  if (!wizardDone) {
    return (
      <SetupWizard
        onComplete={() => {
          setWizardDone(true);
          setBackendRefresh((n) => n + 1);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <DiagnosticBanner />
      {viewportLg ? (
        <Sidebar
          collapsed={sidebarCollapsed}
          activeId={activeConvId}
          onSelect={(id) => {
            setActiveConvId(id);
            setShowCron(false);
            setShowMCP(false);
            setShowPlugins(false);
          }}
          onNew={handleNew}
          onDelete={handleDelete}
          onRename={handleRename}
          searchInputRef={searchInputRef}
          refreshTrigger={refreshTrigger}
          searchMode={searchMode}
          onCloseSearch={() => setSearchMode(false)}
          showCron={showCron}
          showMCP={showMCP}
          showPlugins={showPlugins}
        />
      ) : (
        <>
          {!sidebarCollapsed && (
            <div
              className="fixed inset-0 z-30 bg-black/30"
              onClick={() => setSidebarCollapsed(true)}
            />
          )}
          <div
            className={`fixed left-0 top-0 z-40 h-full transition-transform duration-200 ease-drawer ${
              sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
            }`}
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              activeId={activeConvId}
              onSelect={(id) => {
                setSidebarCollapsed(true);
                setActiveConvId(id);
                setShowCron(false);
                setShowMCP(false);
                setShowPlugins(false);
              }}
              onNew={() => { handleNew(); setSidebarCollapsed(true); }}
              onDelete={handleDelete}
              onRename={handleRename}
              searchInputRef={searchInputRef}
              refreshTrigger={refreshTrigger}
              searchMode={searchMode}
              onCloseSearch={() => setSearchMode(false)}
              showCron={showCron}
              showMCP={showMCP}
              showPlugins={showPlugins}
            />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
        <UpdateBanner />
        {!online && (
          <div className="px-4 py-1 bg-yellow-100 dark:bg-yellow-900 text-xs text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-700">
            No internet connection. Some features require internet access.
          </div>
        )}
        {/* Toolbar */}
        <nav aria-label="Toolbar" className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0"
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <List size={16} />
          </button>
          {/* Zone 1: Mode + Backend */}
          <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden text-xs flex-shrink-0">
            <button
              onClick={() => {
                setMode("single");
                setSelectedTemplate(null);
              }}
              aria-pressed={mode === "single"}
              className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "single" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
            >
              Single
            </button>
            <button
              onClick={() => setMode("pipeline")}
              aria-pressed={mode === "pipeline"}
              className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${mode === "pipeline" ? "bg-blue-600 text-white" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
            >
              Pipeline
            </button>
          </div>

          {mode === "single" && !activeConvMeta?.pipelineTemplateId && (
            <>
              <div className="flex-shrink-0"><BackendSwitcher value={backend} onChange={setBackend} refreshTrigger={backendRefresh} /></div>
              <div className="flex-shrink-0"><ModelSelector provider={backend} value={model} onChange={setModel} /></div>
            </>
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

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

          {/* Zone 2: Sidebar tools */}
          <button
            onClick={() => setSearchMode((v) => !v)}
            title="Search conversations (Ctrl+F)"
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${searchMode ? "bg-blue-100 dark:bg-blue-900" : ""}`}
            aria-label="Search conversations"
          >
            <MagnifyingGlass size={16} />
          </button>
          <button
            onClick={() => {
              setShowCron((v) => !v);
              setSidebarCollapsed(false);
            }}
            title="Scheduled tasks"
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${showCron ? "bg-blue-100 dark:bg-blue-900" : ""}`}
          >
            Cron
          </button>
          <button
            onClick={() => {
              setShowMCP((v) => !v);
              setSidebarCollapsed(false);
            }}
            title="Model Context Protocol servers"
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${showMCP ? "bg-blue-100 dark:bg-blue-900" : ""}`}
          >
            MCP
          </button>
          <button
            onClick={() => {
              setShowPlugins((v) => !v);
              setSidebarCollapsed(false);
            }}
            title="Installed plugins"
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${showPlugins ? "bg-blue-100 dark:bg-blue-900" : ""}`}
          >
            Plugins
          </button>

          {/* Spacer + Divider */}
          <div className="flex-1 flex-shrink-0" />
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

          {/* Zone 3: Right panels */}
          <button
            onClick={() => togglePanel("personas")}
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${showPersonas ? "bg-blue-100 dark:bg-blue-900" : ""}`}
          >
            Personas
          </button>
          <button
            onClick={() => togglePanel("pipelines")}
            className={`btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0 ${showPipelines ? "bg-blue-100 dark:bg-blue-900" : ""}`}
          >
            Pipelines
          </button>
          <button
            onClick={() => togglePanel("settings")}
            title="Settings"
            className="btn-sm border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 flex-shrink-0"
            aria-label="Settings"
          >
            <GearSix size={16} />
          </button>
        </nav>

        <main className="flex flex-1 min-h-0">
          {!activeConvId && mode === "single" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <h2 className="text-sm font-semibold mb-2">
                Welcome to MyRA
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mb-4">
                Claude Code is built in and ready. Create a conversation, pick a
                backend, and ask your question.
              </p>
              <button
                onClick={handleNew}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm hoverable:hover:bg-blue-700 transition-transform duration-100 ease-press active:scale-95"
              >
                New conversation
              </button>
            </div>
          ) : !activeConvId && mode === "pipeline" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <h2 className="text-sm font-semibold mb-2">Pipeline mode</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                Select a pipeline template from the toolbar above, then type your
                first message to begin.
              </p>
            </div>
          ) : (
            <ChatView
              conversationId={activeConvId}
              backend={backend}
              model={model}
              personaId={personaId ?? undefined}
              pipelineTemplate={activePipelineTemplate}
              onNewConversation={(id) => {
                setActiveConvId(id);
                setRefreshTrigger((n) => n + 1);
              }}
            />
          )}
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showPersonas ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showPersonas ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
              <PersonaPanel
                activePersonaId={personaId}
                onSelect={setPersonaId}
              />
            </div>
          </div>
          <div
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showPipelines ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showPipelines ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
          >
            <div className="w-56 lg:w-64 overflow-y-auto h-full">
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
            className={`overflow-hidden transition-[width] duration-200 ease-drawer flex-shrink-0 ${
              showSettings ? "border-l border-gray-200 dark:border-gray-700" : ""
            }`}
            style={{ width: showSettings ? (viewportLg ? 256 : 224) : 0, willChange: "width" }}
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
        </main>
      </div>
      {securityEvents.length > 0 && (
        <SecurityDialog
          event={securityEvents[0]}
          onRespond={(approved) => {
            const eventId = securityEvents[0]?.id;
            if (eventId) {
              respondSecurity({ id: eventId, approved });
            }
            setSecurityEvents((prev) => prev.slice(1));
          }}
        />
      )}
    </div>
  );
}

export default App;
