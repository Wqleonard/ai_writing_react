"use client"

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useChatStore } from "@/stores/chatStore"
import type { ChatMessage, ChatTabType } from "@/stores/chatStore"
import {
  ProChatContainerContext,
  type ProChatContainerContextValue,
} from "./ProChatContext"

/** 定制化扩展：不改组件源码即可插入/替换结构 */
export interface ProChatContainerSlots {
  /** 顶部区域（如标题、Tab 等） */
  header?: React.ReactNode
  /** 完全自定义空状态；不传则用默认占位 + 输入框 */
  emptyState?: React.ReactNode
  /** 自定义单条消息渲染；不传则用默认气泡 */
  renderMessage?: (message: ChatMessage) => React.ReactNode
  /** 消息列表上方插入内容（如提示、快捷入口） */
  beforeMessages?: React.ReactNode
  /** 输入区下方插入内容 */
  afterInput?: React.ReactNode
  /** 底部固定区域（在整个输入区下方） */
  footer?: React.ReactNode
}

export interface ProChatContainerProps {
  workId?: string
  activeTab: ChatTabType
  messages?: ChatMessage[]
  initialMessage?: string
  initialIsAnswerOnly?: boolean
  sessionId?: string
  checkStreamingStatusAndConfirm?: (
    needReset?: boolean,
    needCheckHilt?: boolean,
    needAIMessage?: boolean
  ) => Promise<boolean>
  onSendMessage?: (message: ChatMessage) => void
  onMessageReceived?: (message: ChatMessage) => void
  onSaveCurrentSession?: () => void
  /** 自定义提交：例如 workspace 的「创建作品并跳转」。传入当前输入文本，不传则使用默认（写入 store + onSendMessage） */
  onSubmit?: (text: string) => void | Promise<void>
  onDrop?: (event: DragEvent) => void
  onUpdateFiles?: (
    files: Record<string, unknown>,
    fileId: string,
    editInfoList?: unknown[]
  ) => void
  onFileNameClick?: (fileName: string) => void
  onSendToKnowledgeBase?: (knowledge: Record<string, unknown>) => void
  onCheckWorkStage?: () => void
  /** 定制化插槽，通过 context 派发给子组件 */
  slots?: ProChatContainerSlots
  isHomePage?: boolean
  hideAssociationFeature?: boolean
  onOpenAssociationSelector?: () => void
  isAnswerOnly?: boolean
  onAnswerOnlyChange?: (value: boolean) => void
  /** 子内容：workspace 可为 CreationInput，editor 可为整块聊天面板 DOM */
  children: React.ReactNode
}

const ProChatContainer = (props: ProChatContainerProps) => {
  const {
    workId,
    activeTab,
    messages: propsMessages,
    initialMessage = "",
    initialIsAnswerOnly = true,
    sessionId: propsSessionId,
    checkStreamingStatusAndConfirm,
    onSendMessage,
    onSaveCurrentSession,
    onSubmit: customOnSubmit,
    onDrop,
    slots,
    isHomePage = false,
    hideAssociationFeature = false,
    onOpenAssociationSelector,
    isAnswerOnly: propsIsAnswerOnly,
    onAnswerOnlyChange,
    children,
  } = props

  const [inputValue, setInputValue] = useState(initialMessage)
  const [isAnswerOnlyLocal, setIsAnswerOnlyState] = useState(initialIsAnswerOnly)

  const isAnswerOnly =
    propsIsAnswerOnly !== undefined ? propsIsAnswerOnly : isAnswerOnlyLocal
  const setIsAnswerOnly = useCallback(
    (value: boolean) => {
      if (propsIsAnswerOnly === undefined) setIsAnswerOnlyState(value)
      onAnswerOnlyChange?.(value)
    },
    [onAnswerOnlyChange, propsIsAnswerOnly]
  )

  const {
    workId: storeWorkId,
    chatCurrentSession,
    faqCurrentSession,
    chatMessages,
    faqMessages,
    setWorkId,
    addMessage,
    createNewSession,
    saveCurrentSession,
  } = useChatStore()

  const currentSession =
    activeTab === "faq" ? faqCurrentSession : chatCurrentSession
  const currentMessages = activeTab === "chat" ? chatMessages : faqMessages
  const displayMessages = propsMessages ?? currentMessages
  const sessionId = propsSessionId ?? currentSession?.id ?? ""
  const hasMessages = displayMessages.length > 0
  const scrollToBottomRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (workId) setWorkId(workId)
    return () => {
      if (workId && storeWorkId === workId) setWorkId(null)
    }
  }, [workId, storeWorkId, setWorkId])

  useEffect(() => {
    if (initialMessage?.trim()) setInputValue(initialMessage)
  }, [initialMessage])

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text) return
    if (checkStreamingStatusAndConfirm) {
      const can = await checkStreamingStatusAndConfirm()
      if (!can) return
    }
    if (customOnSubmit) {
      await customOnSubmit(text)
      setInputValue("")
      return
    }
    if (!currentSession && workId) {
      createNewSession(activeTab)
    }
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      role: "user",
      content: text,
      createdAt: new Date(),
      messageType: "normal",
      mode: activeTab,
    }
    const isControlled = propsMessages != null
    if (!isControlled) {
      addMessage(activeTab, userMessage)
    }
    setInputValue("")
    onSendMessage?.(userMessage)
    onSaveCurrentSession?.()
    // 发送后滚动对话到底部（与 Vue 版 NuxtUIProChatContainer 一致）；短延迟确保 DOM 已更新
    setTimeout(() => scrollToBottomRef.current?.(), 100)
  }, [
    inputValue,
    checkStreamingStatusAndConfirm,
    customOnSubmit,
    currentSession,
    workId,
    createNewSession,
    activeTab,
    addMessage,
    onSendMessage,
    onSaveCurrentSession,
    propsMessages,
  ])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDrop?.(e as unknown as DragEvent)
    },
    [onDrop]
  )

  const contextValue = useMemo<ProChatContainerContextValue>(
    () => ({
      inputValue,
      setInputValue,
      onSubmit: handleSubmit,
      isAnswerOnly,
      onAnswerOnlyChange: setIsAnswerOnly,
      workId,
      activeTab,
      displayMessages,
      hasMessages,
      handleDrop,
      isHomePage,
      hideAssociationFeature,
      onOpenAssociationSelector,
      scrollToBottomRef,
      slots,
    }),
    [
      inputValue,
      handleSubmit,
      isAnswerOnly,
      setIsAnswerOnly,
      workId,
      activeTab,
      displayMessages,
      hasMessages,
      handleDrop,
      isHomePage,
      hideAssociationFeature,
      onOpenAssociationSelector,
      slots,
    ]
  )

  return (
    <ProChatContainerContext.Provider value={contextValue}>
      <div className="h-full flex flex-col overflow-hidden chat-content">
        {children}
      </div>
    </ProChatContainerContext.Provider>
  )
}

export default ProChatContainer
