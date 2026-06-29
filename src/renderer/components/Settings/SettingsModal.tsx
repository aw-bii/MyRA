import { SettingsPanel } from "./SettingsPanel";
import { PersonaPanel } from "../Personas/PersonaPanel";
import { PipelinePanel } from "../Pipelines/PipelinePanel";
import { CronPanel } from "../Sidebar/CronPanel";
import { McpPanel } from "../Sidebar/McpPanel";
import { PluginPanel } from "../Sidebar/PluginPanel";
import type { PipelineTemplate } from "../../../shared/types";

export type SettingsSection =
  | "settings"
  | "personas"
  | "pipelines"
  | "mcp"
  | "cron"
  | "plugins";

const NAV_ITEMS: { id: SettingsSection; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "personas", label: "Personas" },
  { id: "pipelines", label: "Pipelines" },
  { id: "mcp", label: "MCP Servers" },
  { id: "cron", label: "Cron Jobs" },
  { id: "plugins", label: "Plugins" },
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
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className="relative bg-surface rounded-xl shadow-2xl flex overflow-hidden"
        style={{ width: "min(760px, 95vw)", height: "min(560px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute top-3 right-3 btn-sm border border-border-strong hoverable:hover:bg-bubble z-10"
        >
          ✕
        </button>

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

        {/* Section content */}
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
          {section === "plugins" && <PluginPanel />}
        </div>
      </div>
    </div>
  );
}
