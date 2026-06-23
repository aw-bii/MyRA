import { ConvList } from "./ConvList";
import { SearchPanel } from "../SearchPanel/SearchPanel";
import { CronPanel } from "./CronPanel";
import { McpPanel } from "./McpPanel";
import { PluginPanel } from "./PluginPanel";

interface Props {
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
  onCloseCron: () => void;
  showMCP: boolean;
  onCloseMCP: () => void;
  showPlugins: boolean;
  onClosePlugins: () => void;
}

export function Sidebar({
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
  _onCloseCron,
  showMCP,
  _onCloseMCP,
  showPlugins,
  _onClosePlugins,
}: Props) {
  return (
    <div className="w-64 flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">BII Agent Harness</span>
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
    </div>
  );
}
