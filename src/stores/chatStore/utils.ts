/**
 * Chat 状态工具函数（与 Vue useDualTabChat 逻辑对齐）
 */

import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, ChatSession, ChatTabType, ToolCallItemForRender } from "./types";

const getTabStorageKey = (workId: string, tabType: ChatTabType) =>
  `chatSessions_${workId}_${tabType}`;
const getTabCurrentSessionKey = (workId: string, tabType: ChatTabType) =>
  `currentSession_${workId}_${tabType}`;

export { getTabStorageKey, getTabCurrentSessionKey };

export const generateSessionId = (): string => uuidv4().replace(/-/g, "");

export const generateSessionTitle = (
  messages: ChatMessage[],
  tabType: ChatTabType
): string => {
  if (messages.length === 0) return `新建${tabType === "faq" ? "问答" : "创作"}`;
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser?.content?.trim()) {
    const t = firstUser.content.trim();
    return t.length > 20 ? t.slice(0, 20) + "..." : t;
  }
  return `新建${tabType === "faq" ? "问答" : "创作"}`;
};

/** 后端 sessions 转为前端 ChatSession[] */
export const convertBackendSessionsToFrontend = (
  backendSessions: unknown[]
): ChatSession[] => {
  if (!Array.isArray(backendSessions)) return [];
  return backendSessions.map((s: unknown) => {
    const row = s as Record<string, unknown>;
    return {
      id: (row.sessionId ?? row.id ?? "") as string,
      title: (row.title ?? "未命名会话") as string,
      messages: [],
      type: ((row.type ?? "chat") as ChatTabType),
      createdAt: row.createdTime
        ? new Date(row.createdTime as string | number).getTime()
        : Date.now(),
      updatedAt: row.updatedTime
        ? new Date(row.updatedTime as string | number).getTime()
        : Date.now(),
    };
  });
};

function extractContent(content: unknown): string {
  if (content == null) return "";
  if (Array.isArray(content)) {
    for (const item of content as Array<{ type?: string; text?: string }>) {
      if (item?.type === "text" && item.text) return String(item.text);
    }
    return "";
  }
  if (typeof content === "string") return content;
  if (typeof content === "object" && "text" in content)
    return String((content as { text: unknown }).text);
  return JSON.stringify(content);
}

function shouldFilterMessage(backendMsg: Record<string, unknown>): boolean {
  const content = extractContent(backendMsg.content);
  if (content.includes("Updated todo list to")) return true;
  if (backendMsg.status === "error") return true;
  return false;
}

/** 后端 history 转为前端 ChatMessage[]（简化版，支持 human/ai 与 content 提取） */
export const convertBackendHistoryToFrontend = (
  backendHistory: unknown[]
): ChatMessage[] => {
  if (!Array.isArray(backendHistory) || backendHistory.length === 0)
    return [];
  const messages: ChatMessage[] = [];
  for (const backendMsg of backendHistory as Record<string, unknown>[]) {
    const msgRole = (backendMsg.role ?? "ai") as string;
    if (msgRole === "remove") continue;

    if (msgRole === "human") {
      const content = extractContent(backendMsg.content);
      if (!content?.trim() || content === "...") continue;
      messages.push({
        id:
          (backendMsg.messageId as string) ||
          `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        role: "user",
        content,
        createdAt: backendMsg.updatedTime
          ? new Date(backendMsg.updatedTime as string | number)
          : new Date(),
        messageType: "normal",
        mode: "chat",
      });
      continue;
    }

    if (msgRole === "ai") {
      let parsedContent: unknown[] = [];
      try {
        const raw = backendMsg.content;
        if (typeof raw === "string") parsedContent = JSON.parse(raw) as unknown[];
        else if (Array.isArray(raw)) parsedContent = raw;
        else parsedContent = [raw];
      } catch {
        continue;
      }
      const parts: { content: string; tool_calls?: unknown[] }[] = [];
      for (const sub of parsedContent as Record<string, unknown>[]) {
        if (shouldFilterMessage(sub)) continue;
        const type = (sub.type ?? "ai") as string;
        if (type === "ai") {
          const content = extractContent(sub.content);
          const toolCalls = Array.isArray(sub.tool_calls) ? sub.tool_calls : [];
          if (!content && toolCalls.length === 0) continue;
          parts.push({
            content,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          });
        }
      }
      if (parts.length === 0) continue;
      const first = parts[0];
      messages.push({
        id:
          (backendMsg.messageId as string) ||
          `assistant_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        role: "assistant",
        content: first?.content ?? "",
        createdAt: backendMsg.updatedTime
          ? new Date(backendMsg.updatedTime as string | number)
          : new Date(),
        customMessage:
          parts.length > 1 || first?.tool_calls
            ? parts.map((p, idx) => ({
                id: `ai_${idx}_${Date.now()}`,
                type: "ai" as const,
                content: p.content,
                tool_calls: p.tool_calls as ToolCallItemForRender[] | undefined,
              }))
            : undefined,
        messageType: "normal",
        mode: "chat",
      });
    }
  }
  return messages;
};
