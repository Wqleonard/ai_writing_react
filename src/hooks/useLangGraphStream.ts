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
  const currentWriteOrEditorFilePathRef = useRef<string>("");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isMainAgentEvent = (event: string): boolean => {
    return event === "updates" || !event.includes("|tools:");
  };

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
      setTodos([]);
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
              const isCompleteEvent =
                eventType === "messages/complete" ||
                eventType?.startsWith("messages/complete");
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
                  // 与 Vue 行为一致：过滤掉后端内部用于更新待办的提示语和 error 状态的消息，避免展示类似 “Updated todo list to ...”
                  if (content && typeof content === "string" && content.includes("Updated todo list to")) {
                    continue;
                  }
                  if ((item as { status?: string }).status === "error") {
                    continue;
                  }
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
                    // 与 Vue 对齐：messages/complete 视为 output，messages/partial 视为 input
                    // 这样 edit_file 等工具输出（如 "Successfully updated file ..."）会走 output 展示规则，不会作为普通内容直出。
                    // 与 Vue 对齐：messages/partial 中 type=tool 的消息按 output 处理，
                    // 避免将工具执行结果（如 Successfully updated file ...）当作普通消息渲染。
                    resultType:
                      isTool || isCompleteEvent
                        ? "output"
                        : (((item as { resultType?: "input" | "output" }).resultType as "input" | "output" | undefined) ?? "input"),
                  };
                  const toolCalls = (item as { tool_calls?: { name?: string; args?: { file_path?: string } }[] }).tool_calls;
                  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                      const filePath = tc?.args?.file_path;
                      if (
                        (tc?.name === "write_file" || tc?.name === "edit_file") &&
                        typeof filePath === "string" &&
                        filePath.endsWith(".md")
                      ) {
                        currentWriteOrEditorFilePathRef.current = filePath;
                      }
                    }
                  }
                  if (idx >= 0) next[idx] = msg;
                  else next.push(msg);
                }
                optionsRef.current.onMessagesUpdate?.(next, false);
                return next;
              });
            }
            // 与 Vue 一致：处理 updates 事件中的 todos，用于 input 上方任务列表展示
            if ((eventType === "updates" || eventType?.startsWith("updates")) && eventData != null) {
              const isMainAgent = isMainAgentEvent(eventType);
              const d = (eventData as { data?: Record<string, { todos?: { content?: string; status?: string }[] }> })?.data ?? eventData;
              if (d && typeof d === "object") {
                for (const key of Object.keys(d)) {
                  if (key === "SummarizationMiddleware.before_model") continue;
                  const val = d[key];
                  if (!val || typeof val !== "object") continue;
                  if (
                    (val as { files?: Record<string, string> }).files &&
                    typeof (val as { files?: Record<string, string> }).files === "object"
                  ) {
                    const nextFiles = {
                      ...(val as { files: Record<string, string> }).files,
                    };
                    setFiles(nextFiles);
                    optionsRef.current.onUpdateFiles?.(
                      nextFiles,
                      currentWriteOrEditorFilePathRef.current
                    );
                    currentWriteOrEditorFilePathRef.current = "";
                  }
                  if (isMainAgent && Array.isArray((val as { todos?: { content?: string; status?: string }[] }).todos)) {
                    const todosData = (val as { todos: { content?: string; status?: string }[] }).todos.map((todo) => ({
                      content: todo.content ?? "",
                      status: todo.status ?? "pending",
                    }));
                    setTodos(todosData);
                    optionsRef.current.onUpdateTodos?.(todosData);
                  }
                }
              }
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
