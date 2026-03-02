"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { AgentCustomMessageItem } from "@/stores/chatStore";
import { Button } from "../ui/Button";

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
              <div className="suggestions-container mt-3 flex flex-col gap-1.5 items-start">
                {msg.suggestions.map((suggestion, i) => {
                  const isSelected = i === msg.suggestions!.length - 1;
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      className={
                        isSelected
                          ? "suggestion-item suggestion-item-selected inline-flex items-center justify-between gap-2 rounded-[30px] px-4 py-1.5 text-base cursor-pointer transition-all border-2 border-white bg-[var(--bg-editor-save)] text-white font-semibold hover:bg-[var(--bg-editor-save)] hover:text-white w-fit max-w-full text-left"
                          : "suggestion-item inline-flex items-center justify-between gap-2 rounded-[30px] px-4 py-1.5 text-base cursor-pointer transition-all border border-[var(--border-color,#e5e7eb)] bg-white text-black hover:bg-[#e0e0e0] w-fit max-w-full text-left"
                      }
                      onClick={() => onSendMessage?.(suggestion)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSendMessage?.(suggestion);
                        }
                      }}
                    >
                      <span className="suggestion-text break-words flex-1 min-w-0">
                        {suggestion}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 flex-shrink-0 ml-1 [color:inherit]"
                        aria-hidden
                      />
                    </Button>
                  );
                })}
              </div>
            )}
        </div>
      ))}
    </div>
  );
};

export default AgentCustomMessageRenderer;
