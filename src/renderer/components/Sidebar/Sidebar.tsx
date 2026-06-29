import { GearSix } from "@phosphor-icons/react";
import { ConvList } from "./ConvList";

interface Props {
  collapsed: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  refreshTrigger?: number;
  onOpenSettings: () => void;
}

export function Sidebar({
  collapsed,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  refreshTrigger,
  onOpenSettings,
}: Props) {
  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-border bg-surface-subtle ${
        collapsed ? "w-0" : "w-48 lg:w-64"
      }`}
      style={collapsed ? { minWidth: 0 } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">MyRA</span>
        <button
          onClick={onNew}
          className="btn-sm bg-primary text-on-primary hoverable:hover:bg-primary-dark"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList
          activeId={activeId}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <div className="border-t border-border p-2">
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hoverable:hover:text-text-base hoverable:hover:bg-bubble rounded-lg transition-colors"
        >
          <GearSix size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}
