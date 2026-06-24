import { ConvList } from "./ConvList";
import { SearchPanel } from "../SearchPanel/SearchPanel";
import { CronPanel } from "./CronPanel";
import { McpPanel } from "./McpPanel";
import { PluginPanel } from "./PluginPanel";

interface Props {
  collapsed: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  refreshTrigger?: number;
  searchMode: boolean;
  onCloseSearch: () => void;
  showCron: boolean;
  showMCP: boolean;
  showPlugins: boolean;
}

export function Sidebar({
  collapsed,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  searchInputRef,
  refreshTrigger,
  searchMode,
  onCloseSearch,
  showCron,
  showMCP,
  showPlugins,
}: Props) {
  return (
    <aside
      className={`flex-shrink-0 flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-press border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 ${
        collapsed ? "w-0" : "w-64 lg:w-48"
      }`}
      style={collapsed ? { minWidth: 0 } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">MyRA</span>
        <button
          onClick={onNew}
          className="btn-sm bg-blue-600 text-white hoverable:hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {showPlugins ? (
          <PluginPanel />
        ) : showMCP ? (
          <McpPanel />
        ) : showCron ? (
          <CronPanel />
        ) : searchMode ? (
          <SearchPanel onSelect={onSelect} onClose={onCloseSearch} />
        ) : (
          <ConvList
            activeId={activeId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            searchInputRef={searchInputRef}
            refreshTrigger={refreshTrigger}
          />
        )}
      </div>
    </aside>
  );
}
