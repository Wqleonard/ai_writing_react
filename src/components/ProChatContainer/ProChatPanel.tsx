"use client"

import React, { useRef, useEffect, useCallback } from "react"
import clsx from "clsx"
import { AutoScrollArea, type AutoScrollAreaRef } from "@/components/AutoScrollArea"
import { QuillChatInput } from "@/components/QuillChatInput"
import type { ChatMessage } from "@/stores/chatStore"
import { useProChatContainer } from "./ProChatContext"
import titleLogo from "@/assets/images/logo.webp"

/**
 * Editor 用聊天面板：有消息时使用 AutoScrollArea 实现对话区自动滚动，
 * 通过 useProChatContainer 从 ProChatContainer 获取状态。
 * 必须在 ProChatContainer 内部使用。
 */
export const ProChatPanel = () => {
  const ctx = useProChatContainer()
  const panelRootRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<AutoScrollAreaRef | null>(null)

  if (!ctx) return null

  const {
    inputValue,
    setInputValue,
    onSubmit,
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
        <div
          className="relative w-[95%] max-w-[500px] rounded-[10px] transition-opacity duration-200"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <QuillChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={onSubmit}
            placeholder="输入您的消息... (Shift+Enter 换行，Enter 发送)"
            status="ready"
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

  const defaultMessageBubble = (msg: ChatMessage) => (
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
          msg.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {msg.content || "(无文本)"}
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
        placeholder="输入消息... (Enter 发送)"
        status="ready"
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
            <AutoScrollArea
              ref={autoScrollRef}
              className="flex-1 min-h-0 w-full overflow-hidden"
              maxHeight="100%"
              autoScroll={true}
              bottomThreshold={50}
            >
              <div className="w-full p-4 flex flex-col gap-3 chat-container">
                {slots?.beforeMessages}
                {displayMessages.map((msg, index) =>
                  slots?.renderMessage ? (
                    <React.Fragment key={msg.id}>
                      {slots.renderMessage(msg, {
                        isLastMessage: index === displayMessages.length - 1,
                      })}
                    </React.Fragment>
                  ) : (
                    defaultMessageBubble(msg)
                  )
                )}
              </div>
            </AutoScrollArea>
            <div className="shrink-0 w-[95%] self-center rounded-[10px] py-2 px-0 mb-1.5 chat-panel-footer">
              {inputBlock}
            </div>
          </>
        )}
      </div>
      {slots?.footer}
    </div>
  )
}
