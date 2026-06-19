import { ConvList } from './ConvList'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export function Sidebar({ activeId, onSelect, onNew, searchInputRef }: Props) {
  return (
    <div className="w-64 flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">BII Agent Harness</span>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <ConvList activeId={activeId} onSelect={onSelect} searchInputRef={searchInputRef} />
      </div>
    </div>
  )
}
