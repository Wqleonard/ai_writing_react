"use client"

import React from "react"
import clsx from "clsx"
import { ScrollArea } from "@/components/ui/ScrollArea"
import { QuillChatInput } from "@/components/QuillChatInput"
import type { ChatMessage } from "@/stores/chatStore"
import { useProChatContainer } from "./ProChatContext"
import titleLogo from "@/assets/images/logo.webp"

/**
 * Editor 用聊天面板：自己维护 DOM（ScrollArea + 空状态/消息列表 + 输入框），
 * 通过 useProChatContainer 从 ProChatContainer 获取状态。
 * 必须在 ProChatContainer 内部使用。
 */
export const ProChatPanel = () => {
  const ctx = useProChatContainer()
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
  } = ctx

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
        "rounded-lg px-3 py-2 text-sm",
        msg.role === "user"
          ? "ml-8 bg-primary text-primary-foreground"
          : "mr-8 bg-muted"
      )}
    >
      <div className="whitespace-pre-wrap break-words">
        {msg.content || "(无文本)"}
      </div>
    </div>
  )

  const inputBlock = (
    <div
      className="sticky bottom-0 w-[95%] rounded-[10px] mb-1.5 transition-opacity duration-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <QuillChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={onSubmit}
        placeholder="输入消息... (Enter 发送)"
        status="ready"
        hideAssistUI={true}
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
    <div className="h-full w-full flex flex-col items-center rounded-[0.5rem] overflow-hidden relative chat-dashboard-panel">
      {slots?.header}
      <ScrollArea
        className={clsx(
          "flex-1 w-full overflow-hidden flex flex-col transition-all duration-300 ease-in-out chat-panel-body",
          hasMessages && "has-messages",
          !hasMessages && !slots?.emptyState && "flex items-center justify-center"
        )}
      >
        {!hasMessages ? (
          <>
            {slots?.beforeMessages}
            {slots?.emptyState ?? defaultEmptyState}
          </>
        ) : (
          <div className="h-full w-full p-4 overflow-x-hidden overflow-y-auto flex flex-col gap-3 chat-container">
            {slots?.beforeMessages}
            {displayMessages.map((msg) =>
              slots?.renderMessage ? (
                <React.Fragment key={msg.id}>
                  {slots.renderMessage(msg)}
                </React.Fragment>
              ) : (
                defaultMessageBubble(msg)
              )
            )}
            {inputBlock}
          </div>
        )}
      </ScrollArea>
      {slots?.footer}
    </div>
  )
}
