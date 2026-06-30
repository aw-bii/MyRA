import { BackendSwitcher } from "../BackendSwitcher";
import { ModelSelector } from "../Toolbar/ModelSelector";
import { usePersonas } from "../../hooks/usePersonas";
import type { PipelineTemplate } from "../../../shared/types";

// Requires .hoverable parent class for hover styles (touch detection)

export interface BottomBarProps {
  mode: "single" | "pipeline";
  setMode: (m: "single" | "pipeline") => void;
  backend: string;
  setBackend: (b: string) => void;
  model: string;
  setModel: (m: string) => void;
  personaId: string | null;
  setPersonaId: (id: string | null) => void;
  templates: PipelineTemplate[];
  selectedTemplate: PipelineTemplate | null;
  onTemplateSelect: (t: PipelineTemplate | null) => void;
  backendRefresh: number;
  disabled?: boolean;
}

export function BottomBar({
  mode,
  setMode,
  backend,
  setBackend,
  model,
  setModel,
  personaId,
  setPersonaId,
  templates,
  selectedTemplate,
  onTemplateSelect,
  backendRefresh,
  disabled,
}: BottomBarProps) {
  const { personas } = usePersonas();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border overflow-x-auto flex-shrink-0">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-border-strong overflow-hidden text-xs flex-shrink-0">
        <button
          onClick={() => {
            setMode("single");
            onTemplateSelect(null);
          }}
          disabled={disabled}
          aria-pressed={mode === "single"}
          className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${
            mode === "single"
              ? "bg-primary text-on-primary"
              : "hoverable:hover:bg-bubble"
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setMode("pipeline")}
          disabled={disabled}
          aria-pressed={mode === "pipeline"}
          className={`px-3 py-1 transition-transform duration-100 ease-press active:scale-95 ${
            mode === "pipeline"
              ? "bg-primary text-on-primary"
              : "hoverable:hover:bg-bubble"
          }`}
        >
          Pipeline
        </button>
      </div>

      {mode === "single" && (
        <>
          <div className="flex-shrink-0">
            <BackendSwitcher
              value={backend}
              onChange={setBackend}
              refreshTrigger={backendRefresh}
            />
          </div>
          <div className="flex-shrink-0">
            <ModelSelector
              provider={backend}
              value={model}
              onChange={setModel}
            />
          </div>
          <select
            aria-label="Persona"
            value={personaId ?? ""}
            onChange={(e) => setPersonaId(e.target.value || null)}
            disabled={disabled}
            className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
          >
            <option value="">No persona</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}

      {mode === "pipeline" && (
        <>
          <select
            aria-label="Pipeline template"
            value={selectedTemplate?.id ?? ""}
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              onTemplateSelect(t ?? null);
            }}
            disabled={disabled}
            className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
          >
            <option value="">Select pipeline…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div
            className="flex items-center gap-2 opacity-50 pointer-events-none"
            title="Backend is set per pipeline step"
          >
            <div className="flex-shrink-0">
              <BackendSwitcher
                value={backend}
                onChange={setBackend}
                refreshTrigger={backendRefresh}
              />
            </div>
            <div className="flex-shrink-0">
              <ModelSelector
                provider={backend}
                value={model}
                onChange={setModel}
              />
            </div>
            <select
              aria-label="Persona"
              value={personaId ?? ""}
              onChange={(e) => setPersonaId(e.target.value || null)}
              disabled
              className="text-xs border rounded px-2 py-1 bg-surface border-border-strong flex-shrink-0"
            >
              <option value="">Per-step persona</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
