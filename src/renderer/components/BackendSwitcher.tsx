import { memo } from "react";
import { useBackends } from "../hooks/useBackends";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export const BackendSwitcher = memo(function BackendSwitcher({ value, onChange }: Props) {
  const { backends } = useBackends();

  return (
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
  );
});
