import { useState, useEffect, useRef, useCallback } from 'react'
import { getConversation, sendChat, onChatChunk, onChatDone, abortChat } from '../ipc'
import type { Message } from '../../shared/types'

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const streamingContent = useRef('')
  const currentConvId = useRef<string | null>(null)

  useEffect(() => {
    if (!conversationId) { setMessages([]); return }
    getConversation(conversationId).then(({ messages: msgs }) => setMessages(msgs))
  }, [conversationId])

  useEffect(() => {
    const offChunk = onChatChunk(({ conversationId: cid, type, content }) => {
      if (type !== 'text') return
      streamingContent.current += content
      setMessages(prev => {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && last.conversationId === cid) {
          return [...prev.slice(0, -1), { ...last, content: streamingContent.current }]
        }
        return prev
      })
    })
    const offDone = onChatDone(() => {
      setStreaming(false)
      streamingContent.current = ''
    })
    return () => { offChunk(); offDone() }
  }, [])

  const send = useCallback(async (message: string, backend: string, personaId?: string, messageId?: string) => {
    setStreaming(true)
    streamingContent.current = ''
    const userMsg: Message = {
      id: messageId ?? crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'user', content: message, backend, stepIndex: null, createdAt: Date.now(),
    }
    const assistantPlaceholder: Message = {
      id: crypto.randomUUID(),
      conversationId: conversationId ?? '',
      role: 'assistant', content: '', backend, stepIndex: null, createdAt: Date.now(),
    }
    setMessages(prev => [...prev, userMsg, assistantPlaceholder])
    const newConvId = await sendChat({ conversationId, message, backend, personaId, messageId })
    currentConvId.current = newConvId
    return newConvId
  }, [conversationId])

  const abort = useCallback(() => {
    if (currentConvId.current) abortChat(currentConvId.current)
    setStreaming(false)
  }, [])

  return { messages, streaming, send, abort }
}
