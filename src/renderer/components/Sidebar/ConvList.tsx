import { useState } from 'react'
import { useConversations } from '../../../hooks/useConversations'
import { ConvItem } from './ConvItem'

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConvList({ activeId, onSelect }: Props) {
  const { conversations, search } = useConversations()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ conversationId: string }[] | null>(null)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    const results = await search(q)
    setSearchResults(results)
  }

  const displayed = searchResults
    ? conversations.filter(c => searchResults.some(r => r.conversationId === c.id))
    : conversations

  return (
    <div className="flex flex-col gap-1">
      <input
        className="mx-2 mb-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Search..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
      />
      {displayed.map(conv => (
        <ConvItem
          key={conv.id}
          conversation={conv}
          active={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  )
}
