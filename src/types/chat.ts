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
  createdAt?: Date;
  customMessage?: AgentCustomMessage[];
  messageType?: "outline" | "detailed_outline" | "chapter" | "edit" | "normal";
  mode?: ChatTabType;
}
