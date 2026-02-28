/**
 * Chat 全局状态类型（与 Vue useDualTabChat 对齐，workspace 与 editor 共享）
 */

export type ChatTabType = "chat" | "faq" | "canvas";

/** 会话（会话列表项 + 当前会话） */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  type: ChatTabType;
  createdAt: number;
  updatedAt: number;
}

/** 文件项（与 Vue FileItem 兼容） */
export interface FileItem {
  id: string;
  originalName: string;
  serverFileName: string;
  putFilePath: string;
  displayUrl: string;
  type: string;
  size: number;
  extension: string;
}

/** 划词文本（与 Vue SelectedText 兼容） */
export interface SelectedText {
  id: string;
  file: string;
  content: string;
}

/** 单条消息（简化版，与 Vue ChatMessage 兼容） */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  createdAt?: Date;
  customMessage?: AgentCustomMessageItem[];
  messageType?: "outline" | "detailed_outline" | "chapter" | "edit" | "normal";
  mode?: ChatTabType;
  taskId?: string;
  isTaskCompleted?: boolean;
  files?: FileItem[];
  selectedTexts?: SelectedText[];
}

/** Agent 自定义消息项（与 Vue AgentCustomMessage 简化兼容） */
export interface AgentCustomMessageItem {
  id: string;
  type: "ai" | "tool" | "human";
  content?: string;
  tool_calls?: unknown[];
  suggestions?: string[];
}
