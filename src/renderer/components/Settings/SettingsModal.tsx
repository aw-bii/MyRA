import { SettingsPanel } from "./SettingsPanel";
import { PersonaPanel } from "../Personas/PersonaPanel";
import { PipelinePanel } from "../Pipelines/PipelinePanel";
import { CronPanel } from "../../panels/CronPanel/CronPanel";
import { McpPanel } from "../Sidebar/McpPanel";
import type { PipelineTemplate } from "../../../shared/types";

export type SettingsSection =
  | "settings"
  | "personas"
  | "pipelines"
  | "mcp"
  | "cron";

const NAV_ITEMS: { id: SettingsSection; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "personas", label: "Personas" },
  { id: "pipelines", label: "Pipelines" },
  { id: "mcp", label: "MCP Servers" },
  { id: "cron", label: "Cron Jobs" },
];

interface Props {
  open: boolean;
  section: SettingsSection;
  onClose: () => void;
  onSectionChange: (s: SettingsSection) => void;
  onReRunWizard: () => void;
  activePersonaId: string | null;
  onPersonaSelect: (id: string | null) => void;
  activeTemplateId: string | null;
  onTemplateSelect: (t: PipelineTemplate | null) => void;
}

export function SettingsModal({
  open,
  section,
  onClose,
  onSectionChange,
  onReRunWizard,
  activePersonaId,
  onPersonaSelect,
  activeTemplateId,
  onTemplateSelect,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="settings-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className="bg-surface rounded-xl shadow-2xl flex overflow-hidden"
        style={{ width: "min(760px, 95vw)", height: "min(560px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left nav */}
        <nav className="w-36 flex-shrink-0 border-r border-border bg-surface-subtle flex flex-col py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`text-left px-4 py-2 text-xs transition-colors ${
                section === item.id
                  ? "bg-primary-ghost text-primary font-medium"
                  : "text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right column: header with close button + scrollable content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header row — keeps close button out of scrollable content */}
          <div className="flex items-center justify-end px-3 py-2 border-b border-border flex-shrink-0">
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
            >
              ✕
            </button>
          </div>

          {/* Scrollable section content */}
          <div className="flex-1 overflow-y-auto">
            {section === "settings" && (
              <SettingsPanel onClose={onClose} onReRunWizard={onReRunWizard} />
            )}
            {section === "personas" && (
              <PersonaPanel
                activePersonaId={activePersonaId}
                onSelect={onPersonaSelect}
                onClose={() => onSectionChange("settings")}
              />
            )}
            {section === "pipelines" && (
              <PipelinePanel
                activeTemplateId={activeTemplateId}
                onSelect={onTemplateSelect}
                onClose={() => onSectionChange("settings")}
              />
            )}
            {section === "mcp" && <McpPanel />}
            {section === "cron" && <CronPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
