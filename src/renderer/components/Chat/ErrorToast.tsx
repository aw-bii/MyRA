import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

interface Props {
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export function ErrorToast({ message, onDismiss, duration = 8000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-danger text-on-primary text-sm rounded-xl shadow-lg"
      role="alert"
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="p-0.5 hoverable:hover:opacity-80"
      >
        <X size={16} />
      </button>
    </div>
  );
}
