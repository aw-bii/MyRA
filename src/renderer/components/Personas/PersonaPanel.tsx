import { useState, useMemo } from "react";
import { usePersonas } from "../../hooks/usePersonas";
import type { Persona } from "../../../shared/types";

interface Props {
  activePersonaId: string | null;
  onSelect: (id: string | null) => void;
}

export function PersonaPanel({ activePersonaId, onSelect }: Props) {
  const { personas, save, remove } = usePersonas();
  const [editing, setEditing] = useState<Partial<Persona> | null>(null);
  const [creatingFromTemplate, setCreatingFromTemplate] =
    useState<Persona | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    {},
  );

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
        <button
          onClick={startNew}
          className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      {/* Templates section */}
      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Templates
          </h4>
          {categories.map(([cat, catTemplates]) => (
            <details key={cat} className="group" open>
              <summary className="text-xs font-medium text-gray-500 cursor-pointer hoverable:hover:text-gray-700 dark:hoverable:hover:text-gray-300">
                {cat}
              </summary>
              <div className="flex flex-col gap-1 mt-1">
                {catTemplates.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between p-2 rounded-lg text-sm hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800 cursor-pointer transition-transform duration-100 ease-press active:scale-95"
                    onClick={() => startTemplateCreate(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        startTemplateCreate(t);
                    }}
                  >
                    <div>
                      <div className="font-medium">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400">
                          {t.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-blue-500 shrink-0">
                      Create
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Template variable fill form */}
      {creatingFromTemplate && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-sm font-medium">
            Create from: {creatingFromTemplate.name}
          </div>
          {creatingFromTemplate.description && (
            <div className="text-xs text-gray-400">
              {creatingFromTemplate.description}
            </div>
          )}
          {(creatingFromTemplate.variables ?? []).map((v) => (
            <div key={v.name} className="flex flex-col gap-1">
              <label
                htmlFor={`var-${v.name}`}
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {v.label}
                {v.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                id={`var-${v.name}`}
                className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="btn-md flex-1 bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
              disabled={(creatingFromTemplate.variables ?? []).some(
                (v) => v.required && !variableValues[v.name],
              )}
            >
              Create Persona
            </button>
            <button
              onClick={cancel}
              className="btn-md flex-1 border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-50 dark:hoverable:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Separator */}
      {userPersonas.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700" />
      )}

      {/* User personas */}
      <div
        role="button"
        tabIndex={0}
        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-transform duration-100 ease-press active:scale-95 ${activePersonaId === null ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
        onClick={() => onSelect(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(null);
        }}
      >
        <span>No persona</span>
      </div>

      {userPersonas.length === 0 && (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4 px-2">
          No saved personas. Create one to give the AI standing instructions for
          a recurring task — like a company researcher or analyst role.
        </div>
      )}

      {userPersonas.map((p) => (
        <div
          key={p.id}
          role="button"
          tabIndex={0}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-transform duration-100 ease-press active:scale-95 ${activePersonaId === p.id ? "bg-blue-100 dark:bg-blue-900" : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"}`}
          onClick={() => onSelect(p.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(p.id);
          }}
        >
          <div>
            <div className="font-medium">{p.name}</div>
            {p.isDefault && (
              <div className="text-xs text-blue-500">default</div>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(p);
              }}
              className="text-xs text-gray-400 hoverable:hover:text-gray-700 px-1"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(p.id);
              }}
              className="text-xs text-red-400 hoverable:hover:text-red-600 px-1"
              aria-label={`Delete persona ${p.name}`}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      {/* New/edit persona form */}
      {editing && !creatingFromTemplate && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Code Reviewer"
              value={editing.name ?? ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              System prompt
            </label>
            <textarea
              className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="btn-md flex-1 bg-blue-600 text-white hoverable:hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={cancel}
              className="btn-md flex-1 border border-gray-300 dark:border-gray-600 hoverable:hover:bg-gray-50 dark:hoverable:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
