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
  /** 命中敏感词时标记用户消息（与 Vue 对齐） */
  hasSensitiveWord?: boolean;
  createdAt?: Date;
  customMessage?: AgentCustomMessageItem[];
  messageType?: "outline" | "detailed_outline" | "chapter" | "edit" | "normal";
  mode?: ChatTabType;
  taskId?: string;
  isTaskCompleted?: boolean;
  files?: FileItem[];
  selectedTexts?: SelectedText[];
}

/** 人在回路单条任务 */
export interface HiltTodoItem {
  content?: string;
  status?: "pending" | "in_progress" | "completed";
}

/** 人在回路表单问题 */
export interface HiltFormQuestion {
  id: number;
  type: "single" | "mutiple";
  question: string;
  options: string[];
}

/** 人在回路表单数据 */
export interface HiltFormData {
  id?: string;
  title?: string;
  intro?: string;
  questions: HiltFormQuestion[];
}

/** Agent 自定义消息项（与 Vue AgentCustomMessage 简化兼容） */
export interface AgentCustomMessageItem {
  id: string;
  type: "ai" | "tool" | "human";
  content?: string;
  /** 工具名（如 edit_file），output 类型时用于折叠配置 */
  name?: string | null;
  /** input | output，用于判断是否折叠、是否展示内容 */
  resultType?: "input" | "output";
  tool_calls?: ToolCallItemForRender[];
  suggestions?: string[];
  /** 评价状态 */
  rating?: "none" | "like" | "dislike";
  /** 人在回路任务列表 */
  hiltTodos?: HiltTodoItem[];
  /** 人在回路内层卡片标题（接口返回，如 "To-dos 6"） */
  hiltTodosTitle?: string;
  /** 人在回路状态 */
  hiltStatus?: "in_progress" | "approved" | "rejected";
  /** 人在回路表单（type=form 中断） */
  hiltForm?: HiltFormData;
}

/** 单条 tool call（与 Vue ToolCallItem 兼容） */
export interface ToolCallItemForRender {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}
