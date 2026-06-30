import { useState, useEffect, useCallback, useRef } from "react";
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
import { useSidebarCollapsed } from "./hooks/useSidebarCollapsed";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  getConversation,
  createConversation,
  deleteConversation,
  renameConversation,
} from "./ipc/conversation";
import { getSetting, setSetting } from "./ipc/settings";
import { onSecurityEvent, respondSecurity } from "./ipc/security";
import { checkConnectivity } from "./ipc/net";
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
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("settings");
  const [sidebarCollapsed, toggleSidebarCollapsed] = useSidebarCollapsed();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);
  const [viewportLg, setViewportLg] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useFocusTrap(
    mobileSidebarRef,
    mobileSidebarOpen && !viewportLg,
    !mobileSidebarOpen,
  );
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
      const pipelineTemplateId =
        mode === "pipeline" ? selectedTemplate?.id : undefined;
      const conv = await createConversation(
        `Conversation ${new Date().toLocaleDateString()}`,
        backend,
        personaId ?? undefined,
        pipelineTemplateId,
      );
      setActiveConvId(conv.id);
      setActiveConvMeta(conv);
      setRefreshTrigger((n) => n + 1);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, [backend, personaId, mode, selectedTemplate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "n") {
        e.preventDefault();
        handleNew();
      }
      if (mod && e.key === "f") {
        const input = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search conversations"]',
        );
        if (input) {
          e.preventDefault();
          input.focus();
        }
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
    checkConnectivity()
      .then((r) => setOnline(r.online))
      .catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setViewportLg(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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
      <div className="flex h-screen overflow-hidden bg-surface text-text-base relative">
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
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-30 bg-surface-darker/50"
                onClick={() => setMobileSidebarOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMobileSidebarOpen(false);
                }}
                role="presentation"
              />
            )}
            <div
              ref={mobileSidebarRef}
              className={`fixed left-0 top-0 z-40 h-full transition-transform duration-200 ease-drawer ${
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <Sidebar
                collapsed={false}
                activeId={activeConvId}
                onSelect={(id) => {
                  setMobileSidebarOpen(false);
                  setActiveConvId(id);
                }}
                onNew={() => {
                  handleNew();
                  setMobileSidebarOpen(false);
                }}
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
        {viewportLg && (
          <button
            onClick={toggleSidebarCollapsed}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            aria-expanded={!sidebarCollapsed}
            className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-4 h-8 rounded-r-md bg-surface-subtle border border-l-0 border-border text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-surface transition-[left,colors] duration-200 ease-press ${sidebarCollapsed ? "left-0" : "left-48 lg:left-64"}`}
          >
            {sidebarCollapsed ? (
              <CaretRight size={10} weight="bold" />
            ) : (
              <CaretLeft size={10} weight="bold" />
            )}
          </button>
        )}

        <div className="flex flex-col flex-1 min-w-0 overflow-x-hidden">
          <UpdateBanner />
          {!online && (
            <div className="px-4 py-1 bg-danger-subtle text-xs text-danger border-b border-danger/30">
              No internet connection. Some features require internet access.
            </div>
          )}
          <main id="main-content" className="flex flex-1 min-h-0">
            {!activeConvId && mode === "single" ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <h2 className="text-sm font-semibold mb-2">Welcome to MyRA</h2>
                <p className="text-xs text-text-muted max-w-xs mb-4">
                  Claude Code is built in and ready. Create a conversation, pick
                  a backend, and ask your question.
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
                <p className="text-xs text-text-muted max-w-xs mb-6">
                  Select a pipeline template below, then create a new
                  conversation to begin.
                </p>
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
                      disabled={!!activeConvId}
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
