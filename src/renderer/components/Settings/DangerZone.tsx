import { useRef, useState } from "react";
import { uninstallApp } from "../../ipc/app";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const CONFIRM_PHRASE = "DELETE";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, open);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setConfirmText("");
    setError("");
  };

  const handleUninstall = async () => {
    setSubmitting(true);
    setError("");
    try {
      // On success the main process calls app.exit(0) before this ever resolves.
      await uninstallApp();
    } catch (err) {
      const raw = (err as Error).message;
      const cleaned = raw.replace(
        /^Error invoking remote method '[^']*':\s*(Error:\s*)?/,
        "",
      );
      setError(cleaned);
      setSubmitting(false);
    }
  };

  return (
    <div className="border-t border-border pt-4">
      <span className="text-xs font-semibold block mb-2 text-danger">
        Danger Zone
      </span>
      <button
        onClick={() => setOpen(true)}
        className="btn-sm w-full px-3 py-2 border border-danger-muted text-danger hoverable:hover:bg-danger-subtle"
      >
        Uninstall MyRA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="presentation"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Uninstall MyRA"
            className="bg-surface rounded-xl shadow-2xl p-4"
            style={{ width: "min(420px, 90vw)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold mb-2">Uninstall MyRA</h2>
            <p className="text-xs text-text-muted mb-3">
              This permanently deletes all conversations, personas, cron
              jobs, API keys, and attachments, then uninstalls MyRA.
              You&apos;ll need to reinstall it to use it again.
            </p>
            <label className="text-xs text-text-muted block mb-1">
              Type {CONFIRM_PHRASE} to confirm
            </label>
            <input
              className="w-full text-xs border rounded px-2 py-1.5 bg-surface border-border-strong focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            {error && <p className="text-xs text-danger mb-3">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={close}
                disabled={submitting}
                className="btn-sm border border-border-strong hoverable:hover:bg-bubble"
              >
                Cancel
              </button>
              <button
                onClick={handleUninstall}
                disabled={confirmText !== CONFIRM_PHRASE || submitting}
                className="btn-sm bg-danger text-on-primary disabled:opacity-50 hoverable:hover:bg-danger-dark"
              >
                {submitting ? "Uninstalling…" : "Uninstall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
