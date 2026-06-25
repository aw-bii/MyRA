import { useState, useEffect, useCallback, useRef } from "react";
import type { SecurityEvent } from "../../../shared/types";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface SecurityDialogProps {
  event: SecurityEvent;
  onRespond: (approved: boolean) => void;
}

export function SecurityDialog({ event, onRespond }: SecurityDialogProps) {
  const [resolved, setResolved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap inside the dialog while it's open
  useFocusTrap(dialogRef, !resolved, event);

  useEffect(() => {
    setResolved(false);
  }, [event]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setResolved(true);
        if (event.type !== "write_approval_needed") {
          onRespond(false);
        }
      }
    },
    [event, onRespond],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (resolved) return null;

  const severityColors: Record<string, string> = {
    low: "bg-yellow-50 dark:bg-yellow-900/50 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
    medium:
      "bg-orange-50 dark:bg-orange-900/50 border-orange-200 dark:border-orange-700 text-orange-800 dark:text-orange-200",
    high: "bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200",
    critical:
      "bg-red-100 dark:bg-red-900/70 border-red-400 dark:border-red-600 text-red-900 dark:text-red-100",
  };

  const severityClass = severityColors[event.severity] ?? severityColors.medium;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`${event.severity} security alert: ${event.message}`}
    >
      <div
        ref={dialogRef}
        className={`max-w-md w-full mx-4 rounded-lg border p-4 shadow-lg motion-safe:animate-scale-in ${severityClass}`}
      >
        <div className="font-semibold mb-1 text-sm uppercase tracking-wide">
          {event.severity} — Security Alert
        </div>
        <div className="font-medium mb-2">{event.message}</div>
        <div className="text-sm opacity-80 mb-3 font-mono break-all">
          {event.detail}
        </div>
        {event.filePath && (
          <div className="text-xs opacity-70 mb-3">
            File: <code className="font-mono">{event.filePath}</code>
            {event.content && (
              <div className="mt-1">Size: {event.content.length} bytes</div>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end mt-2">
          {event.type === "write_approval_needed" ? (
            <>
              <button
                onClick={() => {
                  setResolved(true);
                  onRespond(false);
                }}
                className="px-3 py-1.5 text-xs rounded border border-current opacity-80 hover:opacity-100 transition-opacity"
              >
                Deny
              </button>
              <button
                onClick={() => {
                  setResolved(true);
                  onRespond(true);
                }}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Approve
              </button>
            </>
          ) : (
            <button
              onClick={() => setResolved(true)}
              className="px-3 py-1.5 text-xs rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
