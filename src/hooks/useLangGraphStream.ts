/**
 * useLangGraphStream - React 实现
 * 与 Vue 版对齐：发送消息时调用 api/works/chat 流式接口，解析 SSE 并回调。
 */
import { useCallback, useRef, useState } from "react";
import type { AgentCustomMessage } from "../types/chat";
import { apiClient, STREAM_CHAT_URL } from "@/api";

export interface EditFileArgsType {
  file_path: string;
  old_string?: string;
  new_string?: string;
  start_string?: string;
  end_string?: string;
}

export interface LangGraphStreamOptions {
  /** 可选，未传则使用 apiClient 默认 baseURL + STREAM_CHAT_URL */
  apiUrl?: string;
  onMessagesUpdate?: (
    messages: AgentCustomMessage[],
    isSuggestions?: boolean
  ) => void;
  onUpdateFiles?: (
    files: { [key: string]: string },
    fileId: string,
    editInfoList?: EditFileArgsType[]
  ) => void;
  onUpdateTodos?: (todos: { content: string; status: string }[]) => void;
  onUpdateEditorContent?: (filePath: string, content: string) => void;
  onError?: (error: Error, needSendErrorMsg?: boolean) => void;
  onComplete?: () => void;
  onSensitiveWord?: () => void;
  onAbnormalTermination?: () => void;
}

export interface LangGraphStreamState {
  messages: AgentCustomMessage[];
  files: { [key: string]: string };
  todos: { content: string; status: string }[];
  isStreaming: boolean;
  error: Error | null;
  suggestionsIsFetching: boolean;
  abortSuggestions: () => void;
}

export function useLangGraphStream(
  options: LangGraphStreamOptions
): LangGraphStreamState & {
  submit: (
    message: string,
    sessionId: string,
    workId: number | string,
    chatMode?: string,
    tools?: string[],
    attachments?: Array<{ name: string; remoteAddress: string }>,
    reload?: boolean,
    command?: string,
    model?: string,
    writingStyleId?: string | number
  ) => Promise<void>;
  stop: () => void;
  fetchSuggestions: (
    _sessionId: string,
    _workId: number | string
  ) => Promise<void>;
} {
  const [messages, setMessages] = useState<AgentCustomMessage[]>([]);
  const [files, setFiles] = useState<{ [key: string]: string }>({});
  const [todos, setTodos] = useState<{ content: string; status: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  function extractContent(data: unknown): string {
    if (data == null) return "";
    if (typeof data === "string") return data;
    if (Array.isArray(data)) {
      for (const item of data as { type?: string; text?: string }[]) {
        if (item?.type === "text" && typeof item.text === "string") return item.text;
      }
      return "";
    }
    return "";
  }

  const submit = useCallback(
    async (
      message: string,
      sessionId: string,
      workId: number | string,
      chatMode?: string,
      tools?: string[],
      attachments?: Array<{ name: string; remoteAddress: string }>,
      reload?: boolean,
      command?: string,
      model?: string,
      writingStyleId?: string | number
    ) => {
      if (isStreamingRef.current) return;
      setError(null);
      setMessages([]);
      setIsStreaming(true);
      isStreamingRef.current = true;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const writingStyleIdNum =
        writingStyleId != null && writingStyleId !== ""
          ? Number(writingStyleId) || 1
          : 1;

      const body = {
        query: message,
        workId: String(workId),
        sessionId,
        writingStyleId: writingStyleIdNum,
        stream_mode: ["messages", "updates"],
        stream_subgraphs: true,
        model: model ?? "",
        tools: tools ?? [],
        quotedFiles: [],
        quotedContents: [],
        notes: [],
        attachments: attachments ?? [],
        chatMode: chatMode ?? "agent",
        reload: reload ?? false,
        auto: false,
        command: command ?? "",
      };

      const url = optionsRef.current.apiUrl ?? STREAM_CHAT_URL;

      try {
        await apiClient.postLangGraphStream(
          url,
          body,
          (eventType, eventData) => {
            if ((eventType === "messages" || eventType?.startsWith("messages/")) && eventData != null) {
              const rawList = Array.isArray(eventData) ? eventData : [eventData];
              setMessages((prev) => {
                const next = [...prev];
                for (const item of rawList) {
                  if (!item || typeof item !== "object") continue;
                  const itemType = (item as { type?: string }).type;
                  const isAI = itemType === "ai" || itemType === "AIMessageChunk";
                  const isTool = itemType === "tool";
                  if (!isAI && !isTool) continue;
                  const content = extractContent((item as { content?: unknown }).content);
                  const id = (item as { id?: string }).id ?? "";
                  const idx = next.findIndex((m) => m.id === id);
                  const meta = (item as { response_metadata?: { finish_reason?: string; model_name?: string; service_tier?: string } }).response_metadata;
                  const msg: AgentCustomMessage = {
                    id,
                    type: isTool ? "tool" : "ai",
                    content,
                    name: (item as { name?: string }).name ?? null,
                    example: (item as { example?: boolean }).example ?? false,
                    tool_calls: ((item as { tool_calls?: { name?: string; args?: Record<string, unknown>; id?: string; type?: string }[] }).tool_calls ?? []) as AgentCustomMessage["tool_calls"],
                    invalid_tool_calls: (item as { invalid_tool_calls?: unknown[] }).invalid_tool_calls ?? [],
                    additional_kwargs: (item as { additional_kwargs?: Record<string, unknown> }).additional_kwargs ?? {},
                    response_metadata: {
                      finish_reason: meta?.finish_reason ?? "",
                      model_name: meta?.model_name ?? "",
                      service_tier: meta?.service_tier ?? "",
                    },
                    usage_metadata: null,
                    resultType: ((item as { resultType?: "input" | "output" }).resultType as "input" | "output" | undefined) ?? "input",
                  };
                  if (idx >= 0) next[idx] = msg;
                  else next.push(msg);
                }
                optionsRef.current.onMessagesUpdate?.(next, false);
                return next;
              });
            }
          },
          (err) => {
            setError(err);
            optionsRef.current.onError?.(err, true);
          },
          () => {
            setIsStreaming(false);
            isStreamingRef.current = false;
            abortControllerRef.current = null;
            optionsRef.current.onComplete?.();
          },
          { signal: controller.signal }
        );
      } catch (e) {
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        optionsRef.current.onError?.(err, true);
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const fetchSuggestions = useCallback(async () => {}, []);

  const abortSuggestions = useCallback(() => {}, []);

  return {
    messages,
    files,
    todos,
    isStreaming,
    error,
    suggestionsIsFetching: false,
    abortSuggestions,
    submit,
    stop,
    fetchSuggestions,
  };
}
