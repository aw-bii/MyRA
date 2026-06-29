import { useState, useEffect, useCallback } from "react";
import { SetupWizard } from "./components/Wizard/SetupWizard";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ChatView } from "./components/Chat/ChatView";
import { BottomBar } from "./components/Chat/BottomBar";
import { SettingsModal } from "./components/Settings/SettingsModal";
import type { SettingsSection } from "./components/Settings/SettingsModal";
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
  const { templates } = usePipelines();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("settings");
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
    <>
      {/* Skip to main content link — only visible on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-on-primary focus:text-sm focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex h-screen overflow-hidden bg-surface text-text-base">
        <DiagnosticBanner />
      {viewportLg ? (
        <Sidebar
          collapsed={sidebarCollapsed}
          activeId={activeConvId}
          onSelect={(id) => {
            setActiveConvId(id);
          }}
          onNew={handleNew}
          onDelete={handleDelete}
          onRename={handleRename}
          refreshTrigger={refreshTrigger}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setSettingsSection("settings");
          }}
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
              }}
              onNew={() => { handleNew(); setSidebarCollapsed(true); }}
              onDelete={handleDelete}
              onRename={handleRename}
              refreshTrigger={refreshTrigger}
              onOpenSettings={() => {
                setSettingsOpen(true);
                setSettingsSection("settings");
              }}
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
        <main id="main-content" className="flex flex-1 min-h-0">
          {!activeConvId && mode === "single" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <h2 className="text-sm font-semibold mb-2">Welcome to MyRA</h2>
              <p className="text-xs text-text-muted max-w-xs mb-4">
                Claude Code is built in and ready. Create a conversation, pick a
                backend, and ask your question.
              </p>
              <button
                onClick={handleNew}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm hoverable:hover:bg-primary-dark transition-transform duration-100 ease-press active:scale-95"
              >
                New conversation
              </button>
            </div>
          ) : !activeConvId && mode === "pipeline" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <h2 className="text-sm font-semibold mb-2">Pipeline mode</h2>
              <p className="text-xs text-text-muted max-w-xs">
                Select a pipeline template from the bottom bar, then type your
                first message to begin.
              </p>
            </div>
          ) : (
            <div className="flex-1 min-w-0 overflow-hidden">
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
                bottomBar={
                  <BottomBar
                    mode={mode}
                    setMode={setMode}
                    backend={backend}
                    setBackend={setBackend}
                    model={model}
                    setModel={setModel}
                    personaId={personaId}
                    setPersonaId={setPersonaId}
                    templates={templates}
                    selectedTemplate={selectedTemplate}
                    onTemplateSelect={(t) => {
                      setSelectedTemplate(t);
                      if (t) setMode("pipeline");
                    }}
                    backendRefresh={backendRefresh}
                  />
                }
              />
            </div>
          )}
        </main>
      </div>
      <SettingsModal
        open={settingsOpen}
        section={settingsSection}
        onClose={() => setSettingsOpen(false)}
        onSectionChange={setSettingsSection}
        onReRunWizard={() => {
          localStorage.removeItem("wizardDone");
          setWizardDone(false);
          setSetting("wizard_done", "0");
          setSettingsOpen(false);
        }}
        activePersonaId={personaId}
        onPersonaSelect={setPersonaId}
        activeTemplateId={activePipelineTemplate?.id ?? null}
        onTemplateSelect={(t) => {
          setSelectedTemplate(t);
          setMode("pipeline");
        }}
      />
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
    </>
  );
}

export default App;
