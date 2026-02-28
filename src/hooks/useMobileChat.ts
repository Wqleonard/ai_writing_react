import { useState, useRef, useCallback } from 'react'
import { postChatStream, type PostChatStreamData } from '@/api/m-workspace-chat'
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
  sessionId: string
  onMessageUpdate?: (messages: ChatMessage[]) => void
}

export interface UseMobileChatReturn {
  messages: ChatMessage[]
  isSending: boolean
  streamLoading: boolean
  currentStreamingMessageId: string | null
  sendMessage: (query: string) => Promise<void>
  stopStream: () => void
  clearMessages: () => void
}

export function useMobileChat(options: UseMobileChatOptions): UseMobileChatReturn {
  const { workId, sessionId, onMessageUpdate } = options
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [streamLoading, setStreamLoading] = useState(false)
  const [currentStreamingMessageId, setCurrentStreamingMessageId] = useState<string | null>(null)
  const streamAbortControllerRef = useRef<AbortController | null>(null)

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
      sessionId,
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

  return {
    messages,
    isSending,
    streamLoading,
    currentStreamingMessageId,
    sendMessage,
    stopStream,
    clearMessages,
  }
}
