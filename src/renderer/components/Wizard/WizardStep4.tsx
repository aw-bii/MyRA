import { useState } from "react";
import { storeKey } from "../../ipc/key";

const API_BACKENDS = [
  {
    id: "claude-api",
    label: "Claude API Key",
    placeholder: "sk-ant-api03-…",
    keyName: "claude-api",
  },
  {
    id: "gemini-api",
    label: "Gemini API Key",
    placeholder: "AIza…",
    keyName: "gemini-api",
  },
  {
    id: "openrouter",
    label: "OpenRouter API Key",
    placeholder: "sk-or-v1-…",
    keyName: "openrouter",
  },
];

interface Props {
  onComplete: () => void;
  onBack: () => void;
}

export function WizardStep4({ onComplete, onBack }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const save = async (id: string, keyName: string) => {
    const val = values[id]?.trim();
    if (!val) {
      setErrors((prev) => ({ ...prev, [id]: "Enter a key before saving." }));
      return;
    }
    setSaving((prev) => ({ ...prev, [id]: true }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    try {
      await storeKey(keyName, val);
      setSaved((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Enter API keys</h2>
        <p className="text-xs text-text-muted">
          Optional — skip any you don't use. Keys are encrypted and stored
          locally.
        </p>
      </div>
      {API_BACKENDS.map(({ id, label, placeholder, keyName }) => (
        <div
          key={id}
          className="flex flex-col gap-2 border border-border rounded-xl p-4"
        >
          <label htmlFor={`key-${id}`} className="font-medium text-sm">
            {label}
          </label>
          <div className="flex gap-2">
            <input
              id={`key-${id}`}
              type="password"
              placeholder={placeholder}
              value={values[id] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [id]: e.target.value }))
              }
              disabled={saved[id]}
              className="flex-1 text-xs border rounded-lg px-3 py-1.5 bg-surface border-border-strong font-mono disabled:opacity-50"
            />
            <button
              onClick={() => save(id, keyName)}
              disabled={saving[id] || saved[id]}
              aria-label={`Save ${label}`}
              className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark disabled:opacity-50"
            >
              {saved[id] ? "Saved ✓" : saving[id] ? "Saving…" : "Save"}
            </button>
          </div>
          {errors[id] && <p className="text-xs text-red-500">{errors[id]}</p>}
        </div>
      ))}
      <button
        onClick={onComplete}
        className="btn-lg bg-primary text-on-primary hoverable:hover:bg-primary-dark"
      >
        Finish Setup
      </button>
      <button
        onClick={onBack}
        className="btn-md w-full text-text-muted hoverable:hover:text-text-base transition-transform duration-100 ease-press active:scale-95"
      >
        Back
      </button>
    </div>
  );
}
