"use client"

import React, { useRef, useEffect, useCallback, useState } from "react"
import clsx from "clsx"
import { AutoScrollArea, type AutoScrollAreaRef } from "@/components/AutoScrollArea"
import { QuillChatInput } from "@/components/QuillChatInput"
import type { ChatMessage } from "@/stores/chatStore"
import { useProChatContainerRequired } from "./ProChatContext"
import titleLogo from "@/assets/images/logo.webp"

type RenderMessageFn = (
  message: ChatMessage,
  options?: { isLastMessage?: boolean }
) => React.ReactNode

const MessageItems = React.memo(
  ({
    displayMessages,
    renderMessage,
  }: {
    displayMessages: ChatMessage[]
    renderMessage?: RenderMessageFn
  }) => (
    <>
      {displayMessages.map((msg, index) => {
        if (renderMessage) {
          return (
            <React.Fragment key={msg.id}>
              {renderMessage(msg, {
                isLastMessage: index === displayMessages.length - 1,
              })}
            </React.Fragment>
          )
        }
        return (
          <div
            key={msg.id}
            className={clsx(
              "w-full flex text-sm",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "rounded-lg px-3 py-2 max-w-[85%]",
                "bg-primary text-primary-foreground"
              )}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content || ""}</div>
            </div>
          </div>
        )
      })}
    </>
  ),
  (prev, next) =>
    prev.displayMessages === next.displayMessages &&
    prev.renderMessage === next.renderMessage
)

/**
 * Editor 用聊天面板：有消息时使用 AutoScrollArea 实现对话区自动滚动，
 * 通过 useProChatContainer 从 ProChatContainer 获取状态。
 * 必须在 ProChatContainer 内部使用。
 */
export const ProChatPanel = () => {
  const ctx = useProChatContainerRequired()
  const panelRootRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<AutoScrollAreaRef | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  const {
    inputValue,
    setInputValue,
    onSubmit,
    inputStatus,
    onStopStreaming,
    hasMessages,
    displayMessages,
    handleDrop,
    isHomePage,
    hideAssociationFeature,
    onOpenAssociationSelector,
    isAnswerOnly,
    onAnswerOnlyChange,
    slots,
    scrollToBottomRef,
  } = ctx

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current?.scrollToBottom()
  }, [])

  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom
    return () => {
      scrollToBottomRef.current = null
    }
  }, [scrollToBottomRef, scrollToBottom])

  const updateScrollToBottomButton = useCallback(() => {
    const info = autoScrollRef.current?.getScrollInfo()
    if (!info) return
    // 与 AutoScrollArea 默认阈值保持一致（bottomThreshold=50）
    setShowScrollToBottom(info.distanceToBottom > 50)
  }, [])

  useEffect(() => {
    // 监听消息区滚动：用户上翻则显示按钮；回到底部则隐藏按钮
    const container = autoScrollRef.current?.containerRef
    const viewport = container?.querySelector?.(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return

    updateScrollToBottomButton()
    const onScroll = () => updateScrollToBottomButton()
    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [displayMessages.length, updateScrollToBottomButton])

  const defaultEmptyState = (
    <div className="flex-1 w-full flex items-center justify-center min-h-full">
      <div className="flex flex-col items-center max-w-[600px] w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="mt-[5.75rem] mb-[4.25rem]">
          <div className="relative overflow-visible flex flex-col items-center justify-center gap-2">
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center rounded-full shadow-md">
                <img src={titleLogo} alt="title" className="w-7 h-7 object-cover" />
              </div>
              <span className="text-black text-[25px] font-bold">爆文猫，写爆文</span>
            </div>
          </div>
        </div>
        {slots?.todos}
        <div
          className="relative w-[95%] max-w-[500px] rounded-[10px] transition-opacity duration-200"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <QuillChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={onSubmit}
            onStopStreaming={onStopStreaming}
            placeholder="输入您的消息... (Shift+Enter 换行，Enter 发送)"
            status={inputStatus ?? "ready"}
            hideAssistUI={false}
            clearOnSubmit={true}
            hasMessages={false}
            onDrop={handleDrop}
            isHomePage={isHomePage}
            hideAssociationFeature={hideAssociationFeature}
            onOpenAssociationSelector={onOpenAssociationSelector}
            isAnswerOnly={isAnswerOnly}
            onAnswerOnlyChange={onAnswerOnlyChange}
          />
        </div>
      </div>
    </div>
  )

  const inputBlock = (
    <div
      className="w-full rounded-[10px] transition-opacity duration-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <QuillChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={onSubmit}
        onStopStreaming={onStopStreaming}
        placeholder="输入消息... (Enter 发送)"
        status={inputStatus ?? "ready"}
        hideAssistUI={false}
        clearOnSubmit={true}
        hasMessages={true}
        onDrop={handleDrop}
        isHomePage={isHomePage}
        hideAssociationFeature={hideAssociationFeature}
        onOpenAssociationSelector={onOpenAssociationSelector}
        isAnswerOnly={isAnswerOnly}
        onAnswerOnlyChange={onAnswerOnlyChange}
      />
      {slots?.afterInput}
    </div>
  )

  return (
    <div
      ref={panelRootRef}
      className="h-full w-full flex flex-col rounded-[0.5rem] overflow-hidden relative chat-dashboard-panel"
    >
      {slots?.header}
      <div
        className={clsx(
          "flex-1 min-h-0 w-full flex flex-col transition-all duration-300 ease-in-out chat-panel-body",
          hasMessages && "has-messages",
          !hasMessages && !slots?.emptyState && "flex items-center justify-center"
        )}
      >
        {!hasMessages ? (
          <div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-auto">
            {slots?.beforeMessages}
            {slots?.emptyState ?? defaultEmptyState}
          </div>
        ) : (
          <>
            <div className="relative flex-1 min-h-0 w-full overflow-hidden">
              <AutoScrollArea
                ref={autoScrollRef}
                className="h-full w-full overflow-hidden min-w-0 max-w-full [&_[data-slot=scroll-area]]:min-w-0 [&_[data-slot=scroll-area]]:max-w-full [&_[data-slot=scroll-area-viewport]]:min-w-0 [&_[data-slot=scroll-area-viewport]]:max-w-full [&_[data-slot=scroll-area-viewport]>div]:min-w-0 [&_[data-slot=scroll-area-viewport]>div]:w-full [&_[data-slot=scroll-area-viewport]>div]:max-w-full"
                maxHeight="100%"
                autoScroll={true}
                bottomThreshold={50}
              >
                <div className="w-full max-w-full min-w-0 box-border p-4 flex flex-col gap-3 chat-container">
                  {slots?.beforeMessages}
                  <MessageItems
                    displayMessages={displayMessages}
                    renderMessage={slots?.renderMessage}
                  />
                </div>
              </AutoScrollArea>

              {showScrollToBottom && (
                <button
                  type="button"
                  className="absolute bottom-3 right-3 z-10 rounded-full border bg-white/90 px-3 py-1.5 text-xs text-black shadow-sm backdrop-blur hover:bg-white"
                  onClick={() => {
                    autoScrollRef.current?.scrollToBottom()
                    setShowScrollToBottom(false)
                  }}
                >
                  回到底部
                </button>
              )}
            </div>
            <div className="shrink-0 w-[95%] self-center rounded-[10px] px-0 chat-panel-footer">
              {slots?.todos}
              {inputBlock}
            </div>
          </>
        )}
      </div>
      {slots?.footer}
    </div>
  )
}
