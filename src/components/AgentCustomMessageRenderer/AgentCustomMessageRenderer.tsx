"use client";

/**
 * 与 Vue AgentCustomMessageRenderer.vue 的 toolCallsActiveObject 及各 ToolCallsKey 展示逻辑一致：
 * getToolCallDisplayText、formatToolCallArgs、visibleToolCallsMap、shouldShowExpand、getToolCallIconStatus 等。
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import clsx from "clsx";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  CheckCircle2,
  Loader,
  PauseCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type {
  AgentCustomMessageItem,
  ToolCallItemForRender,
  HiltTodoItem,
} from "@/stores/chatStore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/Tooltip";
import {
  toolCallsActiveObject,
  type ToolCallsKey,
} from "./toolCallsConfig";
import { messageLikeReq } from "@/api/works";
import { openFeedbackDialog } from "@/components/FeedbackDialog";
import { useLoginStore } from "@/stores/loginStore";
import "./AgentCustomMessageRenderer.css";

const LOCAL_HILT_STATUS_STORAGE_KEY = "boom_cat:hilt.localHiltStatusByMessageId:v1";
const DISMISSED_HILT_CARD_KEY_STORAGE_KEY = "boom_cat:hilt.dismissedHiltCardKeyByMessageId:v1";

function safeReadRecordFromLocalStorage(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export interface AgentCustomMessageRendererProps {
  customMessage: AgentCustomMessageItem[];
  activeTab?: "chat" | "faq" | "canvas";
  isLastMessage?: boolean;
  streamingStatus?: "streaming" | "ready";
  currentMessageId?: string;
  streamingMessageId?: string;
  onFileNameClick?: (fileName: string) => void;
  onSendMessage?: (text: string, reload?: boolean) => void;
  onSendToKnowledgeBase?: (knowledge: Record<string, string>) => void;
  onHiltReject?: (message: AgentCustomMessageItem) => void;
  onHiltApprove?: (message: AgentCustomMessageItem) => void;
  onRatingLike?: (message: AgentCustomMessageItem) => void;
  onRatingDislike?: (message: AgentCustomMessageItem) => void;
  onRatingReload?: (message: AgentCustomMessageItem) => void;
}

function getFirstLineContent(content: string, forKnowledge = false): string {
  if (!content) return "";
  let firstLine = content.split("\n")[0].trim();
  firstLine = firstLine
    .replace(/^#+\s+/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/_/g, "")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
  if (forKnowledge) return firstLine;
  if (!firstLine) {
    firstLine = content.replace(/[#*_~`\[\]()]/g, "").substring(0, 50).trim();
  }
  if (firstLine.length > 80) firstLine = firstLine.substring(0, 80) + "...";
  return firstLine || "内容预览";
}

function getSubagentName(subagent_type?: string): string {
  if (!subagent_type) return "";
  const m: Record<string, string> = {
    "content-analysis-agent": "作品内容及结构分析",
    "structure-planning-agent": "作品结构设计",
    "writing-agent": "作品内容起草",
  };
  return m[subagent_type] || "工具";
}

function formatFullArgs(args: unknown): string {
  if (typeof args === "object" && args !== null) {
    try {
      return "```json\n" + JSON.stringify(args, null, 2) + "\n```";
    } catch {
      return String(args);
    }
  }
  if (typeof args === "string") {
    try {
      return "```json\n" + JSON.stringify(JSON.parse(args), null, 2) + "\n```";
    } catch {
      return args;
    }
  }
  return String(args);
}

function formatOldNewString(args: Record<string, unknown>): string {
  const oldString = (args.old_string as string) || "";
  const newString = (args.new_string as string) || "";
  let result = "";
  if (oldString) {
    oldString
      .replace(/\n+/g, "\n")
      .trim()
      .split("\n")
      .forEach((line: string) => {
        if (line.trim())
          result += `<div class="diff-line old-line">${line.startsWith("-") ? line : `- ${line}`}</div>`;
      });
  }
  if (oldString && newString) result += "\n";
  if (newString) {
    newString
      .replace(/\n+/g, "\n")
      .trim()
      .split("\n")
      .forEach((line: string) => {
        if (line.trim())
          result += `<div class="diff-line new-line">${line.startsWith("+") ? line : `+ ${line}`}</div>`;
      });
  }
  return result || "无修改内容";
}

function formatTodosDisplay(todos: unknown[]): string {
  if (!Array.isArray(todos) || todos.length === 0) return "无待办事项";
  const listClass = "todos-list";
  let result = '<div class="todos-display"><div class="todos-header">To-dos ' + todos.length + "</div><div class=\"" + listClass + "\">";
  todos.forEach((todo: unknown) => {
    const t = todo as { status?: string; content?: string };
    const status = t.status || "pending";
    const content = t.content || "";
    const icon = status === "completed" ? "✓" : status === "in_progress" ? "→" : "○";
    result += "<div class=\"todo-item " + status + "\"><div class=\"todo-icon\">" + icon + "</div><div class=\"todo-content\">" + content + "</div></div>";
  });
  result += "</div></div>";
  return result;
}

const AgentCustomMessageRenderer = ({
  customMessage,
  isLastMessage = false,
  streamingStatus = "ready",
  currentMessageId,
  streamingMessageId,
  onFileNameClick,
  onSendMessage,
  onSendToKnowledgeBase,
  onHiltReject,
  onHiltApprove,
  onRatingLike,
  onRatingDislike,
  onRatingReload,
}: AgentCustomMessageRendererProps) => {
  const requireLogin = useLoginStore((s) => s.requireLogin);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [expandedToolCalls, setExpandedToolCalls] = useState<Record<string, Set<number>>>({});
  const [localRatingByMessageId, setLocalRatingByMessageId] = useState<
    Record<string, "none" | "like" | "dislike">
  >({});
  /** 当从 write_todos tool call 推导外层卡片时，用本地状态记录用户点击拒绝/接受，避免未设置 hiltTodos/hiltStatus 时直接展示建议列表 */
  const [localHiltStatusByMessageId, setLocalHiltStatusByMessageId] = useState<
    Record<string, "in_progress" | "approved" | "rejected">
  >(() => {
    const raw = safeReadRecordFromLocalStorage(LOCAL_HILT_STATUS_STORAGE_KEY);
    const out: Record<string, "in_progress" | "approved" | "rejected"> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === "in_progress" || v === "approved" || v === "rejected") out[k] = v;
    }
    return out;
  });
  /** 接受后仅收起“当前这轮 todo 快照”的确认卡片；当 todo 进入下一步（快照变化）时重新弹出 */
  const [dismissedHiltCardKeyByMessageId, setDismissedHiltCardKeyByMessageId] = useState<
    Record<string, string>
  >(() => safeReadRecordFromLocalStorage(DISMISSED_HILT_CARD_KEY_STORAGE_KEY));
  const [hiltActionLoadingByMessageId, setHiltActionLoadingByMessageId] = useState<
    Record<string, boolean>
  >({});
  const shouldCollapseMessageContent = useCallback((msg: AgentCustomMessageItem): boolean => {
    if ((msg as { resultType?: string }).resultType !== "output") return false;
    const config = toolCallsActiveObject[(msg.name || "") as ToolCallsKey];
    return !!config?.output?.is_expend;
  }, []);

  const getEffectiveRating = useCallback(
    (msg: AgentCustomMessageItem): "none" | "like" | "dislike" => {
      return localRatingByMessageId[msg.id] ?? msg.rating ?? "none";
    },
    [localRatingByMessageId]
  );

  const handleToggleLike = useCallback(
    async (msg: AgentCustomMessageItem) => {
      const current = getEffectiveRating(msg);
      const next = current === "like" ? "none" : "like";
      setLocalRatingByMessageId((prev) => ({ ...prev, [msg.id]: next }));
      msg.rating = next;
      onRatingLike?.(msg);
      if (next === "like") {
        try {
          await messageLikeReq(msg.id, 1);
        } catch {
          // 接口失败不阻断交互，保持当前视觉状态
        }
      }
    },
    [getEffectiveRating, onRatingLike]
  );

  const handleToggleDislike = useCallback(
    async (msg: AgentCustomMessageItem) => {
      const current = getEffectiveRating(msg);
      const next = current === "dislike" ? "none" : "dislike";
      setLocalRatingByMessageId((prev) => ({ ...prev, [msg.id]: next }));
      msg.rating = next;
      onRatingDislike?.(msg);
      if (next === "dislike") {
        try {
          await messageLikeReq(msg.id, 2);
        } catch {
          // 接口失败不阻断交互，保持当前视觉状态
        }
        requireLogin(() => {
          openFeedbackDialog();
        }).catch(() => {});
      }
    },
    [getEffectiveRating, onRatingDislike, requireLogin]
  );

  const handleReload = useCallback(
    (msg: AgentCustomMessageItem) => {
      onRatingReload?.(msg);
      onSendMessage?.("重新生成", true);
    },
    [onRatingReload, onSendMessage]
  );

  const shouldShowMessageContent = useCallback((msg: AgentCustomMessageItem): boolean => {
    if ((msg as { resultType?: string }).resultType === "output") {
      const config = toolCallsActiveObject[(msg.name || "") as ToolCallsKey];
      return !!config?.output;
    }
    return true;
  }, []);

  const toggleMessageContent = useCallback((messageId: string) => {
    setExpandedMessages((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  }, []);

  const isMessageContentExpanded = useCallback(
    (messageId: string) => !!expandedMessages[messageId],
    [expandedMessages]
  );

  const handleSendToKnowledgeBase = useCallback(
    (content: string) => {
      const key = `知识库/${getFirstLineContent(content, true)}.md`;
      onSendToKnowledgeBase?.({ [key]: content });
    },
    [onSendToKnowledgeBase]
  );

  const hasEditFileToolCall = useCallback((msg: AgentCustomMessageItem): boolean => {
    return (msg.tool_calls || []).some(
      (tc) => (tc as ToolCallItemForRender).name === "edit_file"
    );
  }, []);

  const hasToolCalls = useCallback((msg: AgentCustomMessageItem): boolean => {
    return !!(msg.tool_calls && msg.tool_calls.length > 0);
  }, []);

  /** 从消息中最后一个 write_todos 的 args.todos 推导出外层卡片用的列表（当父级未设置 msg.hiltTodos 时） */
  const getDerivedHiltTodosFromWriteTodos = useCallback((msg: AgentCustomMessageItem): HiltTodoItem[] | undefined => {
    const list = msg.tool_calls ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      const tc = list[i] as ToolCallItemForRender;
      if (tc.name !== "write_todos" || !tc.args) continue;
      const todos = tc.args.todos;
      if (!Array.isArray(todos) || todos.length === 0) continue;
      return todos.map((t: unknown) => {
        const o = t as { content?: string; status?: string };
        return { content: o.content ?? "", status: (o.status as HiltTodoItem["status"]) ?? "pending" };
      });
    }
    return undefined;
  }, []);

  /** 当前消息用于外层卡片与互斥逻辑的待办列表：优先 msg.hiltTodos，否则从 write_todos 推导 */
  const getEffectiveHiltTodos = useCallback(
    (msg: AgentCustomMessageItem): HiltTodoItem[] | undefined => {
      if (msg.hiltTodos && msg.hiltTodos.length > 0) return msg.hiltTodos;
      return getDerivedHiltTodosFromWriteTodos(msg);
    },
    [getDerivedHiltTodosFromWriteTodos]
  );

  /** 当前消息的 hilt 状态：本地点击优先，否则用 msg.hiltStatus，推导场景默认为 in_progress */
  const getEffectiveHiltStatus = useCallback(
    (msg: AgentCustomMessageItem, effectiveTodos: HiltTodoItem[] | undefined): "in_progress" | "approved" | "rejected" => {
      if (!effectiveTodos?.length) return "in_progress";
      const local = localHiltStatusByMessageId[msg.id];
      if (local) return local;
      return msg.hiltStatus ?? "in_progress";
    },
    [localHiltStatusByMessageId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_HILT_STATUS_STORAGE_KEY, JSON.stringify(localHiltStatusByMessageId));
    } catch {
      // ignore
    }
  }, [localHiltStatusByMessageId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DISMISSED_HILT_CARD_KEY_STORAGE_KEY, JSON.stringify(dismissedHiltCardKeyByMessageId));
    } catch {
      // ignore
    }
  }, [dismissedHiltCardKeyByMessageId]);

  const getHiltTodosProgressKey = useCallback((effectiveTodos: HiltTodoItem[] | undefined): string => {
    if (!effectiveTodos?.length) return "";
    return effectiveTodos
      .map((todo) => `${todo.status ?? "pending"}:${todo.content ?? ""}`)
      .join("||");
  }, []);

  const handleHiltRejectForMessage = useCallback(
    (msg: AgentCustomMessageItem) => {
      setLocalHiltStatusByMessageId((prev) => ({ ...prev, [msg.id]: "rejected" }));
      const effectiveTodos = getEffectiveHiltTodos(msg);
      const currentTodosKey = getHiltTodosProgressKey(effectiveTodos);
      if (currentTodosKey) {
        setDismissedHiltCardKeyByMessageId((prev) => ({ ...prev, [msg.id]: currentTodosKey }));
      }
      onHiltReject?.({ ...msg, hiltStatus: "rejected" });
    },
    [getEffectiveHiltTodos, getHiltTodosProgressKey, onHiltReject]
  );

  const handleHiltApproveForMessage = useCallback(
    (msg: AgentCustomMessageItem) => {
      if (hiltActionLoadingByMessageId[msg.id]) return;
      const effectiveTodos = getEffectiveHiltTodos(msg);
      const currentTodosKey = getHiltTodosProgressKey(effectiveTodos);
      setHiltActionLoadingByMessageId((prev) => ({ ...prev, [msg.id]: true }));
      // 仅收起当前 todo 快照的卡片，避免重复点击；下一个 todo 会因 key 变化重新展示
      if (currentTodosKey) {
        setDismissedHiltCardKeyByMessageId((prev) => ({ ...prev, [msg.id]: currentTodosKey }));
      }
      onHiltApprove?.({ ...msg, hiltStatus: "approved" });
      queueMicrotask(() => {
        setHiltActionLoadingByMessageId((prev) => ({ ...prev, [msg.id]: false }));
      });
    },
    [getEffectiveHiltTodos, getHiltTodosProgressKey, hiltActionLoadingByMessageId, onHiltApprove]
  );

  const visibleToolCallsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!customMessage?.length) return map;
    let inEditFileGroup = false;
    const editFileGroupToolCalls: { msgId: string; toolIndex: number; toolName: string }[] = [];
    const processEditFileGroup = () => {
      if (editFileGroupToolCalls.length === 0) return;
      const lastIdx = editFileGroupToolCalls.length - 1;
      editFileGroupToolCalls.forEach((item, idx) => {
        map.set(`${item.msgId}:${item.toolIndex}`, idx === lastIdx);
      });
    };
    for (let msgIndex = 0; msgIndex < customMessage.length; msgIndex++) {
      const msg = customMessage[msgIndex];
      const hasEditFile = hasEditFileToolCall(msg);
      const hasToolCalls_ = hasToolCalls(msg);
      const msgName = (msg as { name?: string }).name || "";
      if (hasEditFile && !inEditFileGroup) {
        inEditFileGroup = true;
        editFileGroupToolCalls.length = 0;
      }
      if (!hasToolCalls_ && inEditFileGroup) {
        const isResultMessage = msgName === "edit_file" || msgName === "read_file";
        const hasContent = (msg.content || "").trim().length > 0;
        if (!isResultMessage && hasContent) {
          processEditFileGroup();
          inEditFileGroup = false;
        }
      }
      if (msg.tool_calls?.length) {
        msg.tool_calls.forEach((tc, toolIndex) => {
          const toolName = (tc as ToolCallItemForRender).name || "";
          if (inEditFileGroup) {
            editFileGroupToolCalls.push({ msgId: msg.id, toolIndex, toolName });
          } else {
            map.set(`${msg.id}:${toolIndex}`, true);
          }
        });
      }
    }
    if (inEditFileGroup) processEditFileGroup();
    return map;
  }, [customMessage, hasEditFileToolCall, hasToolCalls]);

  const shouldShowToolCall = useCallback(
    (msgId: string, toolIndex: number) => visibleToolCallsMap.get(`${msgId}:${toolIndex}`) ?? true,
    [visibleToolCallsMap]
  );

  const getVisibleToolCalls = useCallback(
    (msg: AgentCustomMessageItem) => {
      if (!msg.tool_calls?.length) return [];
      return msg.tool_calls
        .map((toolCall, toolIndex) => ({ toolCall, toolIndex, shouldShow: shouldShowToolCall(msg.id, toolIndex) }))
        .filter((x) => x.shouldShow)
        .map((x) => ({ toolCall: x.toolCall as ToolCallItemForRender, toolIndex: x.toolIndex }));
    },
    [shouldShowToolCall]
  );

  const shouldShowExpand = useCallback((toolCall: ToolCallItemForRender): boolean => {
    const config = toolCallsActiveObject[(toolCall.name || "") as ToolCallsKey];
    return !!config?.input?.is_expend;
  }, []);

  const getToolCallDisplayText = useCallback((toolCall: ToolCallItemForRender): string => {
    const config = toolCallsActiveObject[(toolCall.name || "") as ToolCallsKey];
    const baseName = config?.input?.name || "正在执行工具";
    if (!config?.input) return baseName;
    const inputConfig = config.input;
    const spliceFields = [
      { key: "file_path", value: toolCall.args?.file_path },
      { key: "keyword", value: toolCall.args?.keyword },
      { key: "file_type", value: toolCall.args?.file_type },
      { key: "query", value: toolCall.args?.query },
      { key: "subagent_type", value: getSubagentName(toolCall.args?.subagent_type as string) },
    ];
    for (const field of spliceFields) {
      if (inputConfig[field.key as keyof typeof inputConfig] && field.value)
        return `${baseName} ${String(field.value)}`;
    }
    if (inputConfig.default_splice_value) return `${baseName} ${inputConfig.default_splice_value}`;
    return baseName;
  }, []);

  const getToolCallArgs = useCallback((toolCall: ToolCallItemForRender) => toolCall.args, []);

  const formatToolCallArgs = useCallback((toolCall: ToolCallItemForRender, args: unknown): string => {
    if (args == null) return "无参数";
    const config = toolCallsActiveObject[(toolCall.name || "") as ToolCallsKey];
    const needShow = config?.input?.need_show || [];
    // 与 Vue 一致：write_todos 仅展示格式化后的待办列表，不展示原始 JSON（避免出现 "todos" key）
    if (toolCall.name === "write_todos") {
      if (typeof args === "object" && args !== null && "todos" in args && Array.isArray((args as { todos: unknown[] }).todos)) {
        return formatTodosDisplay((args as { todos: unknown[] }).todos);
      }
      return "无待办事项";
    }
    if (needShow.length === 0) return formatFullArgs(args);
    if (needShow.includes("old_string") && needShow.includes("new_string")) {
      return formatOldNewString(args as Record<string, unknown>);
    }
    const result: string[] = [];
    for (const field of needShow) {
      const v = (args as Record<string, unknown>)[field];
      if (v !== undefined && v !== null) result.push(String(v));
    }
    return result.length > 0 ? result.join("\n\n") : "无相关参数";
  }, []);

  const toggleToolCall = useCallback((messageId: string, toolIndex: number) => {
    setExpandedToolCalls((prev) => {
      const next = new Map<string, Set<number>>(Object.entries(prev));
      const set = next.get(messageId) ?? new Set<number>();
      const newSet = new Set(set);
      if (newSet.has(toolIndex)) newSet.delete(toolIndex);
      else newSet.add(toolIndex);
      next.set(messageId, newSet);
      return Object.fromEntries(next) as Record<string, Set<number>>;
    });
  }, []);

  const isToolCallExpanded = useCallback(
    (messageId: string, toolIndex: number): boolean => {
      const set = expandedToolCalls[messageId];
      return set?.has(toolIndex) ?? false;
    },
    [expandedToolCalls]
  );

  const getToolCallIconStatus = useCallback(
    (msg: AgentCustomMessageItem, msgIndex: number, _toolCall: ToolCallItemForRender, toolIndex: number): "completed" | "in_progress" => {
      const isLastToolCall = toolIndex === (msg.tool_calls?.length ?? 0) - 1;
      const isLastMessage = msgIndex === customMessage.length - 1;
      if (!isLastToolCall || (isLastToolCall && !isLastMessage)) return "completed";
      return "in_progress";
    },
    [customMessage.length]
  );

  if (!customMessage?.length) return null;

  return (
    <TooltipProvider>
      <div className="agent-custom-message-container">
        <div className="custom-messages">
          {customMessage.map((msg, index) => (
            <div key={msg.id || index} className="custom-message-item">
              {(msg.type === "ai" || msg.type === "tool" || msg.type === "human") && (
                <>
                  {/* AI 消息内容 - 与 Vue 一致：message-content */}
                  {msg.content && shouldShowMessageContent(msg) && (
                    <div className="message-content">
                      {shouldCollapseMessageContent(msg) ? (
                        <div className="collapsible-wrapper">
                          <div
                            className={clsx("collapsible-content", isMessageContentExpanded(msg.id) && "expanded")}
                          >
                            <div className="triangle-icon" aria-hidden />
                            <div
                              className={clsx("collapsible-header", isMessageContentExpanded(msg.id) && "with-border")}
                            >
                              <div
                                className="header-left"
                                onClick={() => toggleMessageContent(msg.id)}
                                onKeyDown={(e) => e.key === "Enter" && toggleMessageContent(msg.id)}
                                role="button"
                                tabIndex={0}
                              >
                                <span className="header-icon">
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--bg-editor-save)]" />
                                </span>
                                <div className="header-text">{getFirstLineContent(msg.content)}</div>
                              </div>
                              <div className="header-right">
                                {isMessageContentExpanded(msg.id) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="send-to-kb-icon"
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSendToKnowledgeBase(msg.content!);
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handleSendToKnowledgeBase(msg.content!)}
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">发送到知识库</TooltipContent>
                                  </Tooltip>
                                )}
                                <span
                                  className="header-toggle-icon"
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMessageContent(msg.id);
                                  }}
                                  onKeyDown={(e) => e.key === "Enter" && toggleMessageContent(msg.id)}
                                >
                                  {isMessageContentExpanded(msg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </span>
                              </div>
                            </div>
                            {isMessageContentExpanded(msg.id) && (
                              <div className="collapsible-body">
                                <div className="body-content">
                                  <MarkdownRenderer content={msg.content} onFileNameClick={onFileNameClick} />
                                </div>
                                <div className="body-footer">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="send-to-kb-icon footer-kb-icon"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSendToKnowledgeBase(msg.content!)}
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">发送到知识库</TooltipContent>
                                  </Tooltip>
                                  <span
                                    className="footer-icon"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleMessageContent(msg.id)}
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          {!isMessageContentExpanded(msg.id) && (
                            <span
                              className="send-to-kb-text-external"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendToKnowledgeBase(msg.content!);
                              }}
                            >
                              发送到知识库
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <MarkdownRenderer content={msg.content} onFileNameClick={onFileNameClick} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Calls - 与 Vue 一致：tool-calls-container */}
                  {msg.tool_calls &&
                    Array.isArray(msg.tool_calls) &&
                    msg.tool_calls.length > 0 &&
                    getVisibleToolCalls(msg).length > 0 && (
                      <div className="tool-calls-container">
                        {getVisibleToolCalls(msg).map(({ toolCall, toolIndex }) => {
                          const showExpand = shouldShowExpand(toolCall);
                          const expanded = isToolCallExpanded(msg.id, toolIndex);
                          const iconStatus = getToolCallIconStatus(msg, index, toolCall, toolIndex);
                          return (
                            <div
                              key={toolCall.id ?? toolIndex}
                              className={clsx("tool-call-item", !showExpand && "no-expand")}
                            >
                              <div
                                className={clsx("tool-call-header", showExpand && "clickable")}
                                onClick={() => showExpand && toggleToolCall(msg.id, toolIndex)}
                                onKeyDown={(e) => showExpand && (e.key === "Enter" || e.key === " ") && toggleToolCall(msg.id, toolIndex)}
                                role={showExpand ? "button" : undefined}
                                tabIndex={showExpand ? 0 : undefined} 
                              >
                                <div className="tool-call-name">
                                  <span className="tool-icon">
                                    {iconStatus === "completed" && <div className="w-[12px] h-[12px] rounded-full bg-[#F2B735] flex items-center justify-center">
                                      <Check className="h-2.5 w-2.5 text-white" />
                                    </div>}
                                    {iconStatus === "in_progress" && streamingStatus === "streaming" && currentMessageId === streamingMessageId && (
                                      <Loader className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--bg-editor-save)]" />
                                    )}
                                    {iconStatus === "in_progress" && (streamingStatus !== "streaming" || currentMessageId !== streamingMessageId) && (
                                      <PauseCircle className="h-3.5 w-3.5 shrink-0 text-[var(--bg-editor-save)]" />
                                    )}
                                  </span>
                                  <span>{getToolCallDisplayText(toolCall)}</span>
                                </div>
                                {showExpand && (
                                  <span className={clsx("expand-icon-tool-call", expanded && "expanded")}>
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  </span>
                                )}
                              </div>
                              {showExpand && expanded && (
                                <div className="tool-call-args">
                                  <div className="args-content">
                                    <MarkdownRenderer
                                      content={formatToolCallArgs(toolCall, getToolCallArgs(toolCall))}
                                      onFileNameClick={onFileNameClick}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* 评价图标 + 联想提示词 - 与 Vue 一致：与人在回路互斥，未点击拒绝/接受时不调 guide 接口，不展示 rating-icons 与 suggestions-container */}
                  {(() => {
                    const effectiveTodos = getEffectiveHiltTodos(msg);
                    const effectiveStatus = getEffectiveHiltStatus(msg, effectiveTodos);
                    const isHiltInProgress = !!(effectiveTodos && effectiveTodos.length > 0 && effectiveStatus === "in_progress");
                    return (
                      msg.suggestions &&
                      msg.suggestions.length > 0 &&
                      isLastMessage &&
                      !isHiltInProgress && (
                    <div className="suggestions-container">
                      <div className="rating-icons">
                        <span
                          className={clsx("thumb-mask", getEffectiveRating(msg) === "like" && "active")}
                          title="好评"
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleToggleLike(msg)}
                          onKeyDown={(e) => e.key === "Enter" && void handleToggleLike(msg)}
                        >
                          <ThumbsUp className="thumb-icon" aria-hidden style={{ width: 14, height: 14 }} />
                        </span>
                        <span
                          className={clsx("thumb-mask", getEffectiveRating(msg) === "dislike" && "active")}
                          title="差评"
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleToggleDislike(msg)}
                          onKeyDown={(e) => e.key === "Enter" && void handleToggleDislike(msg)}
                        >
                          <ThumbsDown className="thumb-icon" aria-hidden style={{ width: 14, height: 14 }} />
                        </span>
                        <span
                          className="thumb-mask"
                          title="重新生成"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleReload(msg)}
                          onKeyDown={(e) => e.key === "Enter" && handleReload(msg)}
                        >
                          <RefreshCw className="thumb-icon" aria-hidden style={{ width: 14, height: 14 }} />
                        </span>
                      </div>
                      <div className="suggestions-list">
                        {msg.suggestions.map((suggestion, suggestionIndex) => (
                          <div
                            key={suggestionIndex}
                            className={clsx("suggestion-item", suggestionIndex === msg.suggestions!.length - 1 && "suggestion-item-last")}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSendMessage?.(suggestion, false)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSendMessage?.(suggestion, false);
                              }
                            }}
                          >
                            <span className="suggestion-text">{suggestion}</span>
                            <span className="suggestion-arrow">
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    ));
                  })()}

                  {/* 人在回路：write_todos 内层为 tool-call 展开的待办列表，外层为确认卡片（与 Vue 207-245 一致），控制是否按当前 todo list 执行；无 msg.hiltTodos 时从 write_todos 推导并展示外层卡片 */}
                  {(() => {
                    const effectiveTodos = getEffectiveHiltTodos(msg);
                    const effectiveStatus = getEffectiveHiltStatus(msg, effectiveTodos);
                    const currentTodosKey = getHiltTodosProgressKey(effectiveTodos);
                    const isDismissedForCurrentTodos =
                      !!currentTodosKey &&
                      dismissedHiltCardKeyByMessageId[msg.id] === currentTodosKey;
                    const showOuterCard =
                      effectiveTodos &&
                      effectiveTodos.length > 0 &&
                      isLastMessage &&
                      streamingStatus !== "streaming" &&
                      effectiveStatus === "in_progress" &&
                      !isDismissedForCurrentTodos;
                    if (!showOuterCard) return null;
                    return (
                      <div className="hilt-todos-container">
                        <div className="hilt-todos-display">
                          <div className="hilt-todos-header">将帮您执行以下任务，是否确认？</div>
                          <div className="hilt-todos-list">
                            {effectiveTodos.map((todo, todoIndex) => {
                              const status = todo.status || "pending";
                              return (
                                <div
                                  key={todoIndex}
                                  className={clsx("hilt-todo-item", status)}
                                >
                                  <div className="hilt-todo-icon">
                                    {status === "completed" && <span>✓</span>}
                                    {status === "in_progress" && <span>→</span>}
                                    {status === "pending" && <span>○</span>}
                                  </div>
                                  <div className="hilt-todo-content">{todo.content || ""}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="hilt-todos-actions">
                            <button
                              type="button"
                              className="hilt-reject-btn"
                              onClick={() => handleHiltRejectForMessage(msg)}
                            >
                              <span className="hilt-btn-icon" aria-hidden>
                                <X className="h-3.5 w-3.5" />
                              </span>
                              <span>拒绝</span>
                            </button>
                            <button
                              type="button"
                              className="hilt-approve-btn"
                              disabled={!!hiltActionLoadingByMessageId[msg.id]}
                              onClick={() => handleHiltApproveForMessage(msg)}
                            >
                              <span className="hilt-btn-icon" aria-hidden>
                                <Check className="h-3.5 w-3.5" />
                              </span>
                              <span>接受</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AgentCustomMessageRenderer;
