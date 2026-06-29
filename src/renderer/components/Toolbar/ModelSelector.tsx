import { memo, useState, useEffect } from "react";
import { listModels } from "../../ipc/key";

interface Props {
  provider: string;
  value: string;
  onChange: (model: string) => void;
}

export const ModelSelector = memo(function ModelSelector({
  provider,
  value,
  onChange,
}: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listModels(provider)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, [provider]);

  const HTTP_BACKENDS = [
    "openai",
    "openrouter",
    "ollama",
    "claude-api",
    "gemini-api",
  ];

  if (!HTTP_BACKENDS.includes(provider)) return null;

  return (
    <select
      className="text-xs px-2 py-1 rounded border border-border-strong bg-surface focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
    >
      {loading ? (
        <option>Loading...</option>
      ) : models.length === 0 ? (
        <option value={value}>{value}</option>
      ) : (
        models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))
      )}
    </select>
  );
});
