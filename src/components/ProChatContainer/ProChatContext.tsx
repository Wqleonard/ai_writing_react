"use client"

import React, { createContext, useContext, useMemo } from "react"
import type { ChatMessage, ChatTabType } from "@/stores/chatStore"

export interface ProChatContainerContextValue {
  /** 当前输入框内容 */
  inputValue: string
  /** 设置输入框内容 */
  setInputValue: (value: string | ((prev: string) => string)) => void
  /** 提交（发送）回调 */
  onSubmit: () => void | Promise<void>
  /** 是否仅回答模式 */
  isAnswerOnly: boolean
  /** 切换仅回答 */
  onAnswerOnlyChange: (value: boolean) => void
  /** 当前作品 ID（可能为空，如 workspace 首页） */
  workId: string | undefined
  /** 当前 Tab */
  activeTab: ChatTabType
  /** 用于展示的消息列表 */
  displayMessages: ChatMessage[]
  /** 是否有消息（有则展示对话区布局） */
  hasMessages: boolean
  /** 拖拽放下时 */
  handleDrop: (e: React.DragEvent) => void
  /** 是否首页（用于隐藏关联等） */
  isHomePage: boolean
  /** 是否隐藏「关联本书内容」 */
  hideAssociationFeature: boolean
  /** 打开关联选择器 */
  onOpenAssociationSelector?: () => void
  /** 插槽（由父组件传入，供子组件使用） */
  slots?: {
    header?: React.ReactNode
    emptyState?: React.ReactNode
    renderMessage?: (message: ChatMessage) => React.ReactNode
    beforeMessages?: React.ReactNode
    afterInput?: React.ReactNode
    footer?: React.ReactNode
  }
}

const ProChatContainerContext = createContext<ProChatContainerContextValue | null>(null)

export const useProChatContainer = (): ProChatContainerContextValue | null =>
  useContext(ProChatContainerContext)

/** 在 ProChatContainer 内部使用，获取上下文；不在内部使用时返回 null */
export const useProChatContainerOrNull = useProChatContainer

export { ProChatContainerContext }
