import { useState, useMemo, useEffect, useRef } from "react";
import { usePersonas } from "../../hooks/usePersonas";
import type { Persona } from "../../../shared/types";

interface Props {
  activePersonaId: string | null;
  onSelect: (id: string | null) => void;
  onClose?: () => void;
}

export function PersonaPanel({ activePersonaId, onSelect, onClose }: Props) {
  const { personas, save, remove } = usePersonas();
  const [editing, setEditing] = useState<Partial<Persona> | null>(null);
  const [creatingFromTemplate, setCreatingFromTemplate] =
    useState<Persona | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      editFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [editing]);

  const templates = useMemo(
    () => personas.filter((p) => p.isTemplate),
    [personas],
  );
  const userPersonas = useMemo(
    () => personas.filter((p) => !p.isTemplate),
    [personas],
  );

  const categories = useMemo(() => {
    const map = new Map<string, Persona[]>();
    for (const t of templates) {
      const cat = t.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return Array.from(map.entries());
  }, [templates]);

  const startNew = () => {
    setEditing({
      name: "",
      systemPrompt: "",
      isDefault: false,
      isTemplate: false,
      variables: [],
      category: null,
      description: null,
    });
    setCreatingFromTemplate(null);
  };
  const cancel = () => {
    setEditing(null);
    setCreatingFromTemplate(null);
    setVariableValues({});
  };

  const submit = async () => {
    if (!editing?.name) return;
    await save({
      name: editing.name!,
      systemPrompt: editing.systemPrompt ?? "",
      isDefault: editing.isDefault ?? false,
      isTemplate: editing.isTemplate ?? false,
      variables: editing.variables ?? [],
      category: editing.category ?? null,
      description: editing.description ?? null,
      ...(editing.id ? { id: editing.id } : {}),
    });
    setEditing(null);
  };

  const startTemplateCreate = (t: Persona) => {
    setCreatingFromTemplate(t);
    const initial: Record<string, string> = {};
    for (const v of t.variables ?? []) initial[v.name] = "";
    setVariableValues(initial);
  };

  const submitFromTemplate = async () => {
    if (!creatingFromTemplate) return;
    let resolved = creatingFromTemplate.systemPrompt;
    for (const v of creatingFromTemplate.variables ?? []) {
      resolved = resolved.replaceAll(
        `{{${v.name}}}`,
        variableValues[v.name] ?? "",
      );
    }
    await save({
      name: creatingFromTemplate.name,
      systemPrompt: resolved,
      isDefault: false,
      isTemplate: false,
      variables: [],
      category: null,
      description: null,
    });
    setCreatingFromTemplate(null);
    setVariableValues({});
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Personas</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={startNew}
            className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark"
          >
            + New
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close personas"
              className="p-1 text-text-muted hoverable:hover:text-text-base rounded"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Templates section */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs text-text-muted font-medium uppercase tracking-wider">
            Templates
          </h4>
          {categories.map(([cat, catTemplates]) => (
            <details key={cat} className="group" open>
              <summary className="text-xs font-medium text-text-muted cursor-pointer hoverable:hover:text-text-base">
                {cat}
              </summary>
              <div className="flex flex-col gap-1 mt-1">
                {catTemplates.map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left flex items-center justify-between p-2 rounded-lg text-sm hoverable:hover:bg-bubble transition-transform duration-100 ease-press active:scale-95"
                    onClick={() => startTemplateCreate(t)}
                  >
                    <div className="min-w-0 overflow-hidden">
                      <div className="font-medium truncate">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-text-muted truncate">
                          {t.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-primary shrink-0">
                      Create
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Template variable fill form */}
      {creatingFromTemplate && (
        <div className="flex flex-col gap-2 border border-border rounded-lg p-3">
          <div className="text-sm font-medium">
            Create from: {creatingFromTemplate.name}
          </div>
          {creatingFromTemplate.description && (
            <div className="text-xs text-text-muted">
              {creatingFromTemplate.description}
            </div>
          )}
          {(creatingFromTemplate.variables ?? []).map((v) => (
            <div key={v.name} className="flex flex-col gap-1">
              <label
                htmlFor={`var-${v.name}`}
                className="text-sm font-medium text-text-base"
              >
                {v.label}
                {v.required && <span className="text-danger ml-0.5">*</span>}
              </label>
              <input
                id={`var-${v.name}`}
                className="text-sm border rounded-lg px-2 py-1.5 bg-surface border-border-strong focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={v.placeholder}
                value={variableValues[v.name] ?? ""}
                onChange={(e) =>
                  setVariableValues((prev) => ({
                    ...prev,
                    [v.name]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              onClick={submitFromTemplate}
              className="btn-md flex-1 bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
              disabled={(creatingFromTemplate.variables ?? []).some(
                (v) => v.required && !variableValues[v.name],
              )}
            >
              Create Persona
            </button>
            <button
              onClick={cancel}
              className="btn-md flex-1 border border-border-strong hoverable:hover:bg-bubble"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Separator */}
      {userPersonas.length > 0 && <div className="border-t border-border" />}

      {/* User personas */}
      <button
        className={`w-full text-left flex items-center gap-2 p-2 rounded-lg text-sm transition-transform duration-100 ease-press active:scale-95 ${activePersonaId === null ? "bg-primary-ghost" : "hoverable:hover:bg-bubble"}`}
        onClick={() => onSelect(null)}
        aria-pressed={activePersonaId === null}
      >
        <span>No persona</span>
      </button>

      {userPersonas.length === 0 && (
        <div className="text-center text-xs text-text-muted py-4 px-2">
          No saved personas. Create one to give the AI standing instructions for
          a recurring task — like a company researcher or analyst role.
        </div>
      )}

      {userPersonas.map((p) => (
        <div key={p.id} className="relative">
          <button
            className={`w-full text-left flex items-center justify-between p-2 rounded-lg text-sm transition-transform duration-100 ease-press active:scale-95 ${activePersonaId === p.id ? "bg-primary-ghost" : "hoverable:hover:bg-bubble"}`}
            onClick={() => onSelect(p.id)}
            aria-pressed={activePersonaId === p.id}
          >
            <div>
              <div className="font-medium">{p.name}</div>
              {p.isDefault && (
                <div className="text-xs text-primary">default</div>
              )}
              <div className="text-xs text-text-muted truncate max-w-[75%]">
                {p.systemPrompt || "No system prompt"}
              </div>
            </div>
            {/* spacer so text doesn't overlap action buttons */}
            <div className="w-12 flex-shrink-0" />
          </button>
          {/* Action buttons — absolutely positioned outside <button> to avoid button nesting */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              onClick={() => setEditing(p)}
              className="text-xs text-text-muted hoverable:hover:text-text-base px-1"
              aria-label={`Edit persona ${p.name}`}
            >
              Edit
            </button>
            {confirmDeleteId === p.id ? (
              <button
                onClick={() => {
                  remove(p.id);
                  setConfirmDeleteId(null);
                }}
                className="text-xs text-danger hoverable:hover:text-danger-dark px-1 font-medium"
                aria-label={`Confirm delete persona ${p.name}`}
              >
                Confirm?
              </button>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(p.id)}
                className="text-xs text-danger-muted hoverable:hover:text-danger px-1"
                aria-label={`Delete persona ${p.name}`}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}

      {/* New/edit persona form */}
      {editing && !creatingFromTemplate && (
        <div
          ref={editFormRef}
          className="flex flex-col gap-2 border border-border rounded-lg p-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-base">Name</label>
            <input
              className="text-sm border rounded-lg px-2 py-1.5 bg-surface border-border-strong focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Code Reviewer"
              value={editing.name ?? ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-base">
              System prompt
            </label>
            <textarea
              className="text-sm border rounded-lg px-2 py-1.5 bg-surface border-border-strong resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="You are a helpful assistant that..."
              rows={3}
              value={editing.systemPrompt ?? ""}
              onChange={(e) =>
                setEditing((prev) => ({
                  ...prev,
                  systemPrompt: e.target.value,
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.isDefault ?? false}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev, isDefault: e.target.checked }))
              }
            />
            Set as default
          </label>
          <div className="flex gap-2">
            <button
              onClick={submit}
              className="btn-md flex-1 bg-primary text-on-primary hoverable:hover:bg-primary-dark"
            >
              Save
            </button>
            <button
              onClick={cancel}
              className="btn-md flex-1 border border-border-strong hoverable:hover:bg-bubble"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
