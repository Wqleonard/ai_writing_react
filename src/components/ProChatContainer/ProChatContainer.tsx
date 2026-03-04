"use client"

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"
import type { ChatMessage, ChatTabType } from "@/stores/chatStore"
import {
  ProChatContainerContext,
  type ProChatContainerContextValue,
} from "./ProChatContext"
import { cn } from "@/lib/utils.ts";

/** 定制化扩展：不改组件源码即可插入/替换结构 */
export interface ProChatContainerSlots {
  /** 顶部区域（如标题、Tab 等） */
  header?: React.ReactNode
  /** 完全自定义空状态；不传则用默认占位 + 输入框 */
  emptyState?: React.ReactNode
  /** 自定义单条消息渲染；不传则用默认气泡 */
  renderMessage?: (
    message: ChatMessage,
    options?: { isLastMessage?: boolean }
  ) => React.ReactNode
  /** 消息列表上方插入内容（如提示、快捷入口） */
  beforeMessages?: React.ReactNode
  /** 输入框上方展示（如任务列表 Todos，参照 Vue NuxtUIProChatContainer #todos） */
  todos?: React.ReactNode
  /** 输入区下方插入内容 */
  afterInput?: React.ReactNode
  /** 底部固定区域（在整个输入区下方） */
  footer?: React.ReactNode
}

export interface ProChatContainerProps {
  workId?: string
  activeTab: ChatTabType
  /** 消息列表统一由外部传入；容器内部不再直接读写 chatStore。 */
  messages?: ChatMessage[]
  initialMessage?: string
  /** 当 initialMessage 有值时，自动触发一次发送（用于 workspace 跳 editor 场景） */
  autoSubmitInitialMessage?: boolean
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
  /** 自定义提交：例如 workspace 的「创建作品并跳转」。传入当前输入文本。 */
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
  /** 输入框状态：ready | error | submitted | streaming，用于发送按钮展示 */
  inputStatus?: "ready" | "error" | "submitted" | "streaming"
  /** 流式请求中点击发送按钮时调用，用于取消流式接口 */
  onStopStreaming?: () => void
  /** 定制化插槽，通过 context 派发给子组件 */
  slots?: ProChatContainerSlots
  isHomePage?: boolean
  hideAssociationFeature?: boolean
  onOpenAssociationSelector?: () => void
  isAnswerOnly?: boolean
  onAnswerOnlyChange?: (value: boolean) => void
  /** 子内容：workspace 可为 CreationInput，editor 可为整块聊天面板 DOM */
  children: React.ReactNode
  className?: string
}

const ProChatContainer = (props: ProChatContainerProps) => {
  const {
    workId,
    activeTab,
    messages: propsMessages,
    initialMessage = "",
    autoSubmitInitialMessage = false,
    initialIsAnswerOnly = true,
    checkStreamingStatusAndConfirm,
    onSendMessage,
    onSaveCurrentSession,
    onSubmit: customOnSubmit,
    onDrop,
    inputStatus,
    onStopStreaming,
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

  const displayMessages = propsMessages ?? []
  const hasMessages = displayMessages.length > 0
  const scrollToBottomRef = useRef<(() => void) | null>(null)
  const autoSubmittedMessageRef = useRef<string>("")
  const pendingAutoSubmitMessageRef = useRef<string | null>(null)

  useEffect(() => {
    if (initialMessage?.trim()) setInputValue(initialMessage)
  }, [initialMessage])

  const submitText = useCallback(async (rawText: string) => {
    const text = rawText.trim()
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
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      role: "user",
      content: text,
      createdAt: new Date(),
      messageType: "normal",
      mode: activeTab,
    }
    setInputValue("")
    onSendMessage?.(userMessage)
    onSaveCurrentSession?.()
    // 发送后滚动对话到底部（与 Vue 版 NuxtUIProChatContainer 一致）；短延迟确保 DOM 已更新
    setTimeout(() => scrollToBottomRef.current?.(), 100)
  }, [
    checkStreamingStatusAndConfirm,
    customOnSubmit,
    activeTab,
    onSendMessage,
    onSaveCurrentSession,
  ])

  const handleSubmit = useCallback(async () => {
    await submitText(inputValue)
  }, [inputValue, submitText])

  useEffect(() => {
    if (!autoSubmitInitialMessage) return
    const message = initialMessage.trim()
    if (!message) return
    if (autoSubmittedMessageRef.current === message) return
    autoSubmittedMessageRef.current = message
    pendingAutoSubmitMessageRef.current = message
    setInputValue(message)
  }, [autoSubmitInitialMessage, initialMessage])

  // 等 inputValue 完成同步后，再统一走 onSubmit 提交流程
  useEffect(() => {
    const pending = pendingAutoSubmitMessageRef.current
    if (!pending) return
    if (inputValue.trim() !== pending.trim()) return
    pendingAutoSubmitMessageRef.current = null
    void handleSubmit()
  }, [inputValue, handleSubmit])

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
      inputStatus,
      onStopStreaming,
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
      inputStatus,
      onStopStreaming,
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
      <div className={cn(
        'h-full flex flex-col overflow-hidden chat-content',
        props.className,
      )}>
        {children}
      </div>
    </ProChatContainerContext.Provider>
  )
}

export default ProChatContainer
