/**
 * useLangGraphStream - React 实现
 * 与 Vue 版对齐：发送消息时调用 api/works/chat 流式接口，解析 SSE 并回调。
 */
import { useCallback, useRef, useState } from "react";
import type { AgentCustomMessage } from "../types/chat";
import { apiClient, STREAM_CHAT_URL } from "@/api";
import { useChatInputStore } from "@/stores/chatInputStore";

type TodoStatus = "pending" | "in_progress" | "completed";
type StreamTodo = { content: string; status: TodoStatus };

type InterruptTodosPayload = {
  interruptId: string;
  actionName: string;
  todos: StreamTodo[];
};

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
  const currentEditInfoListRef = useRef<EditFileArgsType[]>([]);
  const messagesRef = useRef<AgentCustomMessage[]>([]);
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

  const normalizeTodos = (rawTodos: unknown): StreamTodo[] | null => {
    if (!Array.isArray(rawTodos) || rawTodos.length === 0) return null;
    return rawTodos.map((todo) => {
      const item = todo as { content?: string; status?: string } | null | undefined;
      const rawStatus = item?.status;
      const status: TodoStatus =
        rawStatus === "in_progress" || rawStatus === "completed" || rawStatus === "pending"
          ? rawStatus
          : "pending";
      return {
        content: item?.content ?? "",
        status,
      };
    });
  };

  // 不绑定固定路径，递归查找携带 action_requests + args.todos 的中断结构
  const extractInterruptTodos = (source: unknown): InterruptTodosPayload | null => {
    const queue: Array<{ node: unknown; interruptId: string | null }> = [
      { node: source, interruptId: null },
    ];
    const visited = new Set<object>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      const { node, interruptId } = current;
      if (!node || typeof node !== "object") continue;
      if (visited.has(node)) continue;
      visited.add(node);

      if (Array.isArray(node)) {
        for (const item of node) {
          queue.push({ node: item, interruptId });
        }
        continue;
      }

      const record = node as Record<string, unknown>;
      const currentId = typeof record.id === "string" ? record.id : interruptId;
      const actionRequests = record.action_requests;
      if (Array.isArray(actionRequests)) {
        for (const request of actionRequests) {
          if (!request || typeof request !== "object") continue;
          const req = request as { name?: string; args?: { todos?: unknown } };
          const todos = normalizeTodos(req.args?.todos);
          if (!todos || todos.length === 0) continue;
          return {
            interruptId: currentId ?? `hilt_${Date.now()}`,
            actionName: req.name ?? "tool_call",
            todos,
          };
        }
      }

      for (const [key, value] of Object.entries(record)) {
        if (!value || typeof value !== "object") continue;
        const nextId = key === "value" ? currentId : interruptId;
        queue.push({ node: value, interruptId: nextId });
      }
    }
    return null;
  };

  const emitMessages = (next: AgentCustomMessage[], isSuggestions = false) => {
    messagesRef.current = next;
    setMessages(next);
    optionsRef.current.onMessagesUpdate?.(next, isSuggestions);
  };

  const emitTodos = (next: StreamTodo[]) => {
    setTodos(next);
    optionsRef.current.onUpdateTodos?.(next);
  };

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
      messagesRef.current = [];
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

      const {
        associationTags = [],
        selectedNotes = [],
        selectedTexts = [],
        selectedFiles = [],
      } = useChatInputStore.getState();

      const quotedFiles = associationTags;
      const quotedContents = selectedTexts.map((t) => ({
        file: t.file,
        content: t.content,
      }));
      const notes = selectedNotes.map((note) => ({
        name: note.title,
        content: note.content,
      }));
      const requestAttachments =
        attachments && attachments.length > 0
          ? attachments
          : selectedFiles.map((file) => ({
              name: file.serverFileName,
              remoteAddress: file.putFilePath,
            }));

      const body = {
        query: message,
        workId: String(workId),
        sessionId,
        writingStyleId: writingStyleIdNum,
        stream_mode: ["messages", "updates"],
        stream_subgraphs: true,
        model: model ?? "",
        // tools暂时传空，后续真正扩展了再传
        tools: [],
        quotedFiles,
        quotedContents,
        notes,
        attachments: requestAttachments,
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
              const next = [...messagesRef.current];
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
              emitMessages(next, false);
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
                  if (Array.isArray((val as { messages?: unknown[] }).messages)) {
                    for (const msg of (val as { messages: unknown[] }).messages) {
                      if (!msg || typeof msg !== "object") continue;
                      const toolMsg = msg as {
                        type?: string;
                        name?: string;
                        status?: string;
                        content?: string;
                      };
                      if (
                        toolMsg.type !== "tool" ||
                        toolMsg.name !== "edit_file" ||
                        toolMsg.status !== "success" ||
                        typeof toolMsg.content !== "string" ||
                        toolMsg.content.startsWith("Error:")
                      ) {
                        continue;
                      }
                      try {
                        const filePathMatch = toolMsg.content.match(
                          /Successfully replaced content between start and end strings in '([^']+)'/
                        );
                        const oldStringMatch = toolMsg.content.match(/Old_string:\s*\+{5}([\s\S]*?)\+{5}/);
                        const newStringMatch = toolMsg.content.match(/New_string:\s*\+{5}([\s\S]*?)\+{5}/);
                        if (filePathMatch && oldStringMatch && newStringMatch) {
                          const filePath = filePathMatch[1];
                          const oldString = oldStringMatch[1];
                          const newString = newStringMatch[1];
                          currentEditInfoListRef.current.push({
                            file_path: filePath,
                            old_string: oldString,
                            new_string: newString,
                            start_string: "",
                            end_string: "",
                          });
                          if (filePath.endsWith(".md")) {
                            currentWriteOrEditorFilePathRef.current = filePath;
                          }
                        }
                      } catch {
                        // 解析失败时忽略，不中断主流程
                      }
                    }
                  }
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
                      currentWriteOrEditorFilePathRef.current,
                      currentEditInfoListRef.current
                    );
                    currentWriteOrEditorFilePathRef.current = "";
                    currentEditInfoListRef.current = [];
                  } else if (currentEditInfoListRef.current.length > 0) {
                    // 某些响应仅返回 edit_file messages，不带 files；这里兜底触发更新链路。
                    optionsRef.current.onUpdateFiles?.(
                      {},
                      currentWriteOrEditorFilePathRef.current,
                      currentEditInfoListRef.current
                    );
                    currentWriteOrEditorFilePathRef.current = "";
                    currentEditInfoListRef.current = [];
                  }
                  if (isMainAgent && Array.isArray((val as { todos?: { content?: string; status?: string }[] }).todos)) {
                    const todosData = normalizeTodos((val as { todos: unknown }).todos) ?? [];
                    emitTodos(todosData);
                  }
                }
                const interrupt = extractInterruptTodos(d);
                if (interrupt && interrupt.todos.length > 0) {
                  emitTodos(interrupt.todos);
                  const prev = messagesRef.current;
                  let nextMessages: AgentCustomMessage[];
                  if (prev.length > 0) {
                    const last = prev[prev.length - 1];
                    nextMessages = [
                      ...prev.slice(0, -1),
                      {
                        ...last,
                        hiltTodos: interrupt.todos,
                        hiltStatus:
                          last.hiltStatus === "approved" || last.hiltStatus === "rejected"
                            ? last.hiltStatus
                            : "in_progress",
                      },
                    ];
                  } else {
                    nextMessages = [
                      {
                        id: interrupt.interruptId,
                        type: "tool",
                        content: "",
                        name: interrupt.actionName,
                        example: false,
                        tool_calls: [],
                        invalid_tool_calls: [],
                        additional_kwargs: {},
                        response_metadata: { finish_reason: "", model_name: "", service_tier: "" },
                        usage_metadata: null,
                        resultType: "output",
                        hiltTodos: interrupt.todos,
                        hiltStatus: "in_progress",
                      },
                    ];
                  }
                  emitMessages(nextMessages, false);
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
    isStreamingRef.current = false;
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
