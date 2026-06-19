import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getConversation,
  runPipeline,
  abortPipeline,
  onPipelineChunk,
  onPipelineStepDone,
  onPipelineDone,
} from '../ipc'
import type { Message, PipelineTemplate } from '../../shared/types'

export function usePipelineMessages(conversationId: string | null, template: PipelineTemplate) {
  const [stepMessages, setStepMessages] = useState<Record<number, Message[]>>({})
  const [streamingStepIndex, setStreamingStepIndex] = useState<number | null>(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)
  const streamingContent = useRef<Record<number, string>>({})
  const currentConvId = useRef<string | null>(null)

  // Load history when conversation changes
  useEffect(() => {
    if (!conversationId) { setStepMessages({}); return }
    getConversation(conversationId).then(({ messages }) => {
      const grouped: Record<number, Message[]> = {}
      for (const m of messages) {
        if (m.role === 'user') continue
        const idx = m.stepIndex ?? 0
        if (!grouped[idx]) grouped[idx] = []
        grouped[idx].push(m)
      }
      setStepMessages(grouped)
    })
  }, [conversationId])

  // Listen for pipeline streaming events
  useEffect(() => {
    const offChunk = onPipelineChunk(({ stepIndex, type, content, conversationId: cid }) => {
      if (type !== 'text') return
      if (!streamingContent.current[stepIndex]) streamingContent.current[stepIndex] = ''
      streamingContent.current[stepIndex] += content
      const accumulated = streamingContent.current[stepIndex]
      setStepMessages(prev => ({
        ...prev,
        [stepIndex]: [
          ...(prev[stepIndex]?.filter(m => m.id !== `streaming-${stepIndex}`) ?? []),
          {
            id: `streaming-${stepIndex}`,
            conversationId: cid,
            role: 'assistant',
            content: accumulated,
            backend: template.steps[stepIndex]?.backendId ?? '',
            stepIndex,
            createdAt: Date.now(),
          } as Message,
        ],
      }))
    })

    const offStepDone = onPipelineStepDone(({ stepIndex }) => {
      setStreamingStepIndex(stepIndex + 1 < template.steps.length ? stepIndex + 1 : null)
      setActiveTabIndex(stepIndex + 1 < template.steps.length ? stepIndex + 1 : stepIndex)
      streamingContent.current[stepIndex] = ''
    })

    const offDone = onPipelineDone(() => {
      setStreamingStepIndex(null)
      streamingContent.current = {}
    })

    return () => { offChunk(); offStepDone(); offDone() }
  }, [template])

  const send = useCallback(async (message: string) => {
    setStreamingStepIndex(0)
    setActiveTabIndex(0)
    streamingContent.current = {}
    // Initialize empty placeholders for all steps
    const initial: Record<number, Message[]> = {}
    template.steps.forEach((_, i) => { initial[i] = [] })
    setStepMessages(initial)

    const newConvId = await runPipeline({
      conversationId,
      message,
      templateId: template.id,
    })
    currentConvId.current = newConvId
    return newConvId
  }, [conversationId, template])

  const abort = useCallback(() => {
    if (currentConvId.current) abortPipeline(currentConvId.current)
    setStreamingStepIndex(null)
  }, [])

  return { stepMessages, streamingStepIndex, activeTabIndex, setActiveTabIndex, send, abort }
}
