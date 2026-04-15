/**
 * Chat types for useDualTabChat (aligned with Vue @/utils/interfaces)
 */
export type ChatTabType = "chat" | "faq" | "canvas";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  type: ChatTabType;
  createdAt: number;
  updatedAt: number;
}

export interface ResponseMetadata {
  finish_reason: string;
  model_name: string;
  service_tier: string;
}

export interface ToolCallItem {
  name: string;
  args: Record<string, unknown>;
  id: string;
  type: string;
}

export interface AdditionalKwargs {
  tool_calls?: unknown[];
}

export interface AgentCustomMessage {
  content: string;
  additional_kwargs: AdditionalKwargs;
  response_metadata: ResponseMetadata;
  type: "ai" | "tool" | "human";
  resultType?: "input" | "output";
  /** 人在回路状态 */
  hiltStatus?: "in_progress" | "approved" | "rejected";
  /** 人在回路待办列表 */
  hiltTodos?: Array<{
    content?: string;
    status?: "pending" | "in_progress" | "completed";
  }>;
  /** 人在回路表单（type=form 中断） */
  hiltForm?: {
    id?: string;
    title?: string;
    intro?: string;
    questions: Array<{
      id: number;
      type: "single" | "mutiple";
      question: string;
      options: string[];
    }>;
  };
  name: string | null;
  id: string;
  example: boolean;
  tool_calls: ToolCallItem[];
  invalid_tool_calls: unknown[];
  usage_metadata: null;
  /** 联想提示词（guide 接口返回），展示在流式内容下方 */
  suggestions?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  /** 命中敏感词时标记用户消息（与 Vue 对齐） */
  hasSensitiveWord?: boolean;
  createdAt?: Date;
  customMessage?: AgentCustomMessage[];
  messageType?: "outline" | "detailed_outline" | "chapter" | "edit" | "normal";
  mode?: ChatTabType;
}
