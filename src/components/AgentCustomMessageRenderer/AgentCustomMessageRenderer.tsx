"use client";

import React from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { AgentCustomMessageItem } from "@/stores/chatStore";

export interface AgentCustomMessageRendererProps {
  customMessage: AgentCustomMessageItem[];
  activeTab?: "chat" | "faq" | "canvas";
  isLastMessage?: boolean;
  onFileNameClick?: (fileName: string) => void;
  onSendMessage?: (text: string) => void;
}

const AgentCustomMessageRenderer = ({
  customMessage,
  isLastMessage = false,
  onFileNameClick,
  onSendMessage,
}: AgentCustomMessageRendererProps) => {
  if (!customMessage?.length) return null;

  return (
    <div className="agent-custom-message-container space-y-3">
      {customMessage.map((msg, index) => (
        <div key={msg.id || index} className="custom-message-item">
          {(msg.type === "ai" || msg.type === "tool" || msg.type === "human") &&
            msg.content && (
              <div className="message-content">
                <MarkdownRenderer
                  content={msg.content}
                  onFileNameClick={onFileNameClick}
                />
              </div>
            )}
          {msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0 && (
            <div className="tool-calls-container mt-2 space-y-1">
              {msg.tool_calls.map((tc, i: number) => {
                const toolCall = tc as { name?: string; id?: string };
                return (
                  <div
                    key={toolCall.id ?? i}
                    className="tool-call-item rounded-md bg-muted/50 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium">{toolCall.name ?? "工具调用"}</span>
                  </div>
                );
              })}
            </div>
          )}
          {isLastMessage &&
            msg.suggestions &&
            msg.suggestions.length > 0 && (
              <div className="suggestions-container mt-2 flex flex-wrap gap-1">
                {msg.suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    className="suggestion-item flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs cursor-pointer hover:bg-muted/60"
                    onClick={() => onSendMessage?.(suggestion)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSendMessage?.(suggestion);
                      }
                    }}
                  >
                    <span className="suggestion-text truncate max-w-[180px]">
                      {suggestion}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      ))}
    </div>
  );
};

export default AgentCustomMessageRenderer;
