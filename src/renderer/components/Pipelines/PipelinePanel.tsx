import { useState } from "react";
import { usePipelines } from "../../hooks/usePipelines";
import { usePersonas } from "../../hooks/usePersonas";
import { useBackends } from "../../hooks/useBackends";
import type { PipelineTemplate, PipelineStep } from "../../../shared/types";

interface EditingStep {
  stepOrder: number;
  backendId: string;
  personaId: string | null;
}

interface EditingTemplate {
  id?: string;
  name: string;
  steps: EditingStep[];
}

interface Props {
  activeTemplateId: string | null;
  onSelect: (template: PipelineTemplate) => void;
}

export function PipelinePanel({ activeTemplateId, onSelect }: Props) {
  const { templates, save, remove } = usePipelines();
  const { personas } = usePersonas();
  const { backends } = useBackends();
  const [editing, setEditing] = useState<EditingTemplate | null>(null);

  const startNew = () =>
    setEditing({
      name: "",
      steps: [
        {
          stepOrder: 0,
          backendId: backends[0]?.id ?? "claude",
          personaId: null,
        },
        {
          stepOrder: 1,
          backendId: backends[0]?.id ?? "claude",
          personaId: null,
        },
      ],
    });

  const cancel = () => setEditing(null);

  const submit = async () => {
    if (!editing?.name || editing.steps.length < 2) return;
    await save({ id: editing.id, name: editing.name, steps: editing.steps });
    setEditing(null);
  };

  const addStep = () => {
    if (!editing) return;
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            steps: [
              ...prev.steps,
              {
                stepOrder: prev.steps.length,
                backendId: backends[0]?.id ?? "claude",
                personaId: null,
              },
            ],
          }
        : null,
    );
  };

  const removeStep = (idx: number) => {
    if (!editing || editing.steps.length <= 2) return;
    setEditing((prev) =>
      prev
        ? {
            ...prev,
            steps: prev.steps
              .filter((_, i) => i !== idx)
              .map((s, i) => ({ ...s, stepOrder: i })),
          }
        : null,
    );
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    if (!editing) return;
    const steps = [...editing.steps];
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    setEditing({
      ...editing,
      steps: steps.map((s, i) => ({ ...s, stepOrder: i })),
    });
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Pipelines</h3>
        <button
          onClick={startNew}
          className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
        >
          + New
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-4">
          No pipeline templates yet. Create one to chain multiple backends in
          sequence.
        </div>
      ) : (
        templates.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between p-2 rounded-lg text-sm ${
              activeTemplateId === t.id
                ? "bg-blue-100 dark:bg-blue-900"
                : "hoverable:hover:bg-gray-100 dark:hoverable:hover:bg-gray-800"
            }`}
          >
            <div
              tabIndex={0}
              role="button"
              className="flex-1 cursor-pointer"
              onClick={() => onSelect(t)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t);
                }
              }}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-xs text-gray-400">
                {t.steps.length} steps
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() =>
                  setEditing({
                    id: t.id,
                    name: t.name,
                    steps: t.steps.map((s: PipelineStep) => ({
                      stepOrder: s.stepOrder,
                      backendId: s.backendId,
                      personaId: s.personaId,
                    })),
                  })
                }
                className="text-xs text-gray-400 hoverable:hover:text-gray-700 px-1"
              >
                Edit
              </button>
              <button
                onClick={() => remove(t.id)}
                className="text-xs text-red-400 hoverable:hover:text-red-600 px-1"
                aria-label={`Delete pipeline ${t.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}

      {editing && (
        <div className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Template name
            </label>
            <input
              className="text-sm border rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Draft → Review"
              value={editing.name}
              onChange={(e) =>
                setEditing((prev) =>
                  prev ? { ...prev, name: e.target.value } : null,
                )
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            {editing.steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                <select
                  className="text-xs border rounded-lg px-1 py-1 dark:bg-gray-800 dark:border-gray-600 flex-1"
                  value={step.backendId}
                  onChange={(e) =>
                    setEditing((prev) => {
                      if (!prev) return null;
                      const steps = [...prev.steps];
                      steps[idx] = { ...steps[idx], backendId: e.target.value };
                      return { ...prev, steps };
                    })
                  }
                >
                  {backends.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <select
                  className="text-xs border rounded-lg px-1 py-1 dark:bg-gray-800 dark:border-gray-600 flex-1"
                  value={step.personaId ?? ""}
                  onChange={(e) =>
                    setEditing((prev) => {
                      if (!prev) return null;
                      const steps = [...prev.steps];
                      steps[idx] = {
                        ...steps[idx],
                        personaId: e.target.value || null,
                      };
                      return { ...prev, steps };
                    })
                  }
                >
                  <option value="">No persona</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => moveStep(idx, -1)}
                  className="text-xs text-gray-400 hoverable:hover:text-gray-600 px-1"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStep(idx, 1)}
                  className="text-xs text-gray-400 hoverable:hover:text-gray-600 px-1"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeStep(idx)}
                  disabled={editing.steps.length <= 2}
                  className="text-xs text-red-400 hoverable:hover:text-red-600 px-1 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addStep}
            className="text-xs text-blue-500 hoverable:hover:text-blue-700 text-left transition-transform duration-100 ease-press active:scale-95"
          >
            + Add step
          </button>

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={!editing.name || editing.steps.length < 2}
              className="btn-md flex-1 bg-blue-600 text-white hoverable:hover:bg-blue-700 disabled:opacity-50"
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
