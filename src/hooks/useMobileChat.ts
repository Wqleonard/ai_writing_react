import { useState, useRef, useCallback } from 'react'
import { getKeywordsRankReq, postChatStream, type PostChatStreamData } from '@/api/m-workspace-chat'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'

export interface ChatMessage {
  role: 'human' | 'ai'
  content: any
  messageId: string
  attachments: any[]
  updatedTime: string
}

export interface UseMobileChatOptions {
  workId: string | number
  initialSessionId?: string
  generateSessionId?: () => string
  onMessageUpdate?: (messages: ChatMessage[]) => void
}

export interface UseMobileChatReturn {
  messages: ChatMessage[]
  currentSessionId: string
  isSending: boolean
  streamLoading: boolean
  currentStreamingMessageId: string | null
  trendingTopics: Topic[]
  setTrendingTopics: (topics: Topic[]) => void
  updateTrendingTopics: () => Promise<void>
  sendMessage: (query: string) => Promise<void>
  stopStream: () => void
  clearMessages: () => void
  replaceMessages: (nextMessages: ChatMessage[]) => void
  setSessionId: (sessionId: string) => void
  resetSessionId: () => string
}

export interface Topic {
  name: string
  description: string
  workReference: string
}

export function useMobileChat(options: UseMobileChatOptions): UseMobileChatReturn {
  const { workId, initialSessionId = '', generateSessionId } = options
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId)
  const [isSending, setIsSending] = useState(false)
  const [streamLoading, setStreamLoading] = useState(false)
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null)
  const streamAbortControllerRef = useRef<AbortController | null>(null)

  const createSessionId = useCallback(() => {
    return generateSessionId?.() || crypto.randomUUID?.().replace(/-/g, '') || Date.now().toString(36)
  }, [generateSessionId])

  const resetSessionId = useCallback(() => {
    const nextSessionId = createSessionId()
    setCurrentSessionId(nextSessionId)
    return nextSessionId
  }, [createSessionId])

  const handleStreamData = useCallback((data: any) => {
    switch (data.event) {
      case 'messages/partial': {
        const messageId = data.data?.[0]?.id || null
        const rawContent = data.data

        if (rawContent && messageId) {
          const parsedContent = getContentFromPartial(rawContent)

          if (parsedContent) {
            setCurrentStreamingMessageId(messageId)

            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (item) => item.role === 'ai' && item.messageId === messageId
              )

              if (existingIndex >= 0) {
                const updated = [...prev]
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  content: rawContent,
                }
                return updated
              } else {
                return [
                  ...prev,
                  {
                    role: 'ai',
                    content: rawContent,
                    messageId,
                    attachments: [],
                    updatedTime: new Date().toISOString(),
                  },
                ]
              }
            })
            setStreamLoading(false)
          }
        }
        break
      }
      case 'updates':
      case 'end':
        break
    }
  }, [])

  const handleStreamError = useCallback((error: Error) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('流式请求已取消')
      setIsSending(false)
      setStreamLoading(false)
      streamAbortControllerRef.current = null
      return
    }
    setIsSending(false)
    setStreamLoading(false)
  }, [])

  const handleStreamEnd = useCallback(() => {
    setIsSending(false)
    setStreamLoading(false)
    setCurrentStreamingMessageId(null)
    streamAbortControllerRef.current = null
  }, [])

  const sendMessage = useCallback(
    async (query: string) => {
      if (isSending || !query.trim()) return

      // 如果已有正在进行的请求，先取消
      if (streamAbortControllerRef.current) {
        streamAbortControllerRef.current.abort()
        streamAbortControllerRef.current = null
      }

      setIsSending(true)
      setCurrentStreamingMessageId(null)

      const sessionId = currentSessionId || resetSessionId()

      // 添加用户消息
      const userMessage: ChatMessage = {
        role: 'human',
        content: query.trim(),
        messageId: sessionId,
        attachments: [],
        updatedTime: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, userMessage])
      setStreamLoading(true)

      // 创建新的 AbortController
      streamAbortControllerRef.current = new AbortController()

      try {
        const params: PostChatStreamData = {
          workId,
          query: query.trim(),
          sessionId,
        }

        await postChatStream(
          params,
          handleStreamData,
          handleStreamError,
          handleStreamEnd,
          { signal: streamAbortControllerRef.current.signal }
        )
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          console.log('流式请求已取消')
          setIsSending(false)
          setStreamLoading(false)
          streamAbortControllerRef.current = null
          return
        }
        console.error('发送消息失败:', e)
        setIsSending(false)
        setStreamLoading(false)

        // 移除失败的 AI 消息
        if (currentStreamingMessageId) {
          setMessages((prev) =>
            prev.filter((item) => item.messageId !== currentStreamingMessageId)
          )
          setCurrentStreamingMessageId(null)
        }
        streamAbortControllerRef.current = null
      }
    },
    [
      isSending,
      workId,
      currentSessionId,
      resetSessionId,
      currentStreamingMessageId,
      handleStreamData,
      handleStreamError,
      handleStreamEnd,
    ]
  )

  const stopStream = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort()
      streamAbortControllerRef.current = null
      setIsSending(false)
      setStreamLoading(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const replaceMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages(nextMessages)
  }, [])


  const [trendingTopics, setTrendingTopics] = useState<Topic[]>(
    Array.from({ length: 5 }, () => ({
      name: '',
      description: '',
      workReference: '',
    }))
  )

  const updateTrendingTopics = useCallback(async () => {
    try {
      const req: any = await getKeywordsRankReq()
      if (req && Array.isArray(req?.keywords)) {
        const keywords = req.keywords as any[]
        const nextTrendingTopics: Topic[] = Array.from({ length: 5 }, (_, i) => {
          const keyword = keywords[i]
          return {
            name: keyword?.name || '',
            description: keyword?.description || '',
            workReference: keyword?.workReference || '',
          }
        })
        setTrendingTopics(nextTrendingTopics)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])



  return {
    messages,
    currentSessionId,
    isSending,
    streamLoading,
    currentStreamingMessageId,
    trendingTopics,
    setTrendingTopics,
    updateTrendingTopics,
    sendMessage,
    stopStream,
    clearMessages,
    replaceMessages,
    setSessionId: setCurrentSessionId,
    resetSessionId,
  }
}
