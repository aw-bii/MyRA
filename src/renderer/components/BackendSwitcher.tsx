import { memo } from "react";
import { useBackends } from "../hooks/useBackends";

interface Props {
  value: string;
  onChange: (id: string) => void;
  refreshTrigger?: number;
}

export const BackendSwitcher = memo(function BackendSwitcher({
  value,
  onChange,
  refreshTrigger = 0,
}: Props) {
  const { backends } = useBackends(refreshTrigger);
  const selected = backends.find((b) => b.id === value);
  const needsAuth = selected?.available && !selected?.authenticated;

  return (
    <div className="flex flex-col gap-0.5">
      <select
        className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {backends.map((b) => (
          <option key={b.id} value={b.id} disabled={!b.available}>
            {b.label}
            {!b.available
              ? " (not installed)"
              : !b.authenticated
                ? " (not auth)"
                : ""}
          </option>
        ))}
      </select>
      {needsAuth && (
        <span
          role="alert"
          className="text-xs text-amber-600 dark:text-amber-400"
        >
          Not signed in — run{" "}
          <code className="font-mono bg-gray-100 dark:bg-gray-800 px-0.5 rounded">
            {value} auth login
          </code>{" "}
          first
        </span>
      )}
    </div>
  );
});
