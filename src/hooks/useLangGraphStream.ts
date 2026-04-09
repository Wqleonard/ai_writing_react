/**
 * useLangGraphStream - React 实现
 * 与 Vue 版对齐：发送消息时调用 api/works/chat 流式接口，解析 SSE 并回调。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentCustomMessage } from "../types/chat";
import { apiClient, STREAM_CHAT_URL } from "@/api";
import { useChatInputStore } from "@/stores/chatInputStore";
import {
  suggestionsControllerInstance,
  useSuggestionsController,
} from "./useSuggestionsController";

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
    chatType?: string,
    tools?: string[],
    attachments?: Array<{ name: string; remoteAddress: string }>,
    reload?: boolean,
    command?: string,
    model?: string,
    writingStyleId?: string | number,
    commandOnly?: boolean
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
  const sensitiveWordHandledRef = useRef(false);
  const currentWriteOrEditorFilePathRef = useRef<string>("");
  const currentEditInfoListRef = useRef<EditFileArgsType[]>([]);
  const messagesRef = useRef<AgentCustomMessage[]>([]);
  const currentMessageChunkRef = useRef<Partial<AgentCustomMessage> | null>(null);
  const pendingInterruptRef = useRef<{ todos: StreamTodo[]; status: "in_progress" } | null>(null);
  const streamCompletedRef = useRef(false);
  const suggestionsState = useSuggestionsController();
  const optionsRef = useRef(options);
  const currentSessionIdRef = useRef<string>("");
  const currentWorkIdRef = useRef<number | string | null>(null);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const isMainAgentEvent = (event: string): boolean => {
    return event === "updates" || !event.includes("|tools:");
  };

  const isSensitiveWordError = (errMsg: string, errorCode?: string): boolean => {
    const normalizedMsg = String(errMsg ?? "").toLowerCase();
    const normalizedCode = String(errorCode ?? "").toLowerCase();
    return (
      normalizedMsg.includes("敏感词") ||
      normalizedMsg.includes("sensitive") ||
      normalizedMsg.includes("content_safety") ||
      normalizedCode.includes("sensitive")
    );
  };

  function extractContent(data: unknown): string {
    if (data == null) return "";
    if (typeof data === "string") return data;
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === "string") return item;
          if (
            item &&
            typeof item === "object" &&
            (item as { type?: string; text?: string }).type === "text" &&
            typeof (item as { type?: string; text?: string }).text === "string"
          ) {
            return (item as { type?: string; text?: string }).text;
          }
          return "";
        })
        .join("");
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

  const isMessageExists = (messageId: string): boolean => {
    if (!messageId) return false;
    const list = messagesRef.current;
    if (list.length > 0 && list[list.length - 1]?.id === messageId) return true;
    return list.some((msg) => msg.id === messageId);
  };

  const emitTodos = (next: StreamTodo[]) => {
    setTodos(next);
    optionsRef.current.onUpdateTodos?.(next);
  };

  const attachPendingInterruptToTail = (
    list: AgentCustomMessage[]
  ): AgentCustomMessage[] => {
    if (!pendingInterruptRef.current || list.length === 0) return list;
    const next = [...list];
    const lastIndex = next.length - 1;
    const last = next[lastIndex];
    next[lastIndex] = {
      ...last,
      hiltTodos: pendingInterruptRef.current.todos,
      hiltStatus: pendingInterruptRef.current.status,
    };
    return next;
  };

  const updateWriteOrEditorFilePathFromToolCalls = (
    toolCalls: Array<{ name?: string; args?: { file_path?: string } }>
  ) => {
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return;
    for (const toolCall of toolCalls) {
      const filePath = toolCall?.args?.file_path;
      if (
        (toolCall?.name === "write_file" || toolCall?.name === "edit_file") &&
        typeof filePath === "string" &&
        filePath.endsWith(".md")
      ) {
        currentWriteOrEditorFilePathRef.current = filePath;
      }
    }
  };

  const handleMessagesPartial = (messageData: unknown) => {
    if (!messageData || typeof messageData !== "object") return;
    const message = messageData as {
      type?: string;
      id?: string;
      content?: unknown;
      additional_kwargs?: Record<string, unknown>;
      response_metadata?: Record<string, unknown> & { status?: string };
      name?: string;
      example?: boolean;
      tool_calls?: Array<{ name?: string; args?: { file_path?: string } }>;
      invalid_tool_calls?: unknown[];
      usage_metadata?: unknown;
      chunk_position?: string;
    };
    const isAIMessage = message.type === "ai" || message.type === "AIMessageChunk";
    if (!isAIMessage) return;

    const content = extractContent(message.content);
    const chunkId = String(message.id ?? "");
    const currentChunk = currentMessageChunkRef.current;
    const isLastChunk =
      message.chunk_position === "last" ||
      message.response_metadata?.status === "completed";

    if (!currentChunk || currentChunk.id !== chunkId) {
      if (!currentChunk && chunkId && isMessageExists(chunkId) && isLastChunk) {
        return;
      }
      if (currentChunk && currentChunk.id !== chunkId) {
        const prevChunkId = String(currentChunk.id ?? "").trim();
        if (prevChunkId && !isMessageExists(prevChunkId)) {
          const nextList = attachPendingInterruptToTail([
            ...messagesRef.current,
            currentChunk as AgentCustomMessage,
          ]);
          emitMessages(nextList, false);
        }
      }
      const initialToolCalls = Array.isArray(message.tool_calls)
        ? [...message.tool_calls]
        : [];
      currentMessageChunkRef.current = {
        resultType: "input",
        content,
        additional_kwargs: message.additional_kwargs ?? {},
        response_metadata: {
          finish_reason: String(message.response_metadata?.finish_reason ?? ""),
          model_name: String(message.response_metadata?.model_name ?? ""),
          service_tier: String(message.response_metadata?.service_tier ?? ""),
        },
        type: "ai",
        name: message.name ?? null,
        id: chunkId,
        example: message.example ?? false,
        tool_calls: initialToolCalls as AgentCustomMessage["tool_calls"],
        invalid_tool_calls: message.invalid_tool_calls ?? [],
        usage_metadata: null,
      };
      updateWriteOrEditorFilePathFromToolCalls(initialToolCalls);
    } else {
      currentChunk.content = content;
      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        currentChunk.tool_calls = [
          ...message.tool_calls,
        ] as AgentCustomMessage["tool_calls"];
        updateWriteOrEditorFilePathFromToolCalls(message.tool_calls);
      }
      if (message.response_metadata && Object.keys(message.response_metadata).length > 0) {
        currentChunk.response_metadata = {
          finish_reason: String(message.response_metadata.finish_reason ?? ""),
          model_name: String(message.response_metadata.model_name ?? ""),
          service_tier: String(message.response_metadata.service_tier ?? ""),
        };
      }
    }

    const activeChunk = currentMessageChunkRef.current;
    if (!activeChunk) return;

    if (isLastChunk) {
      if (!activeChunk.id && chunkId && isMessageExists(chunkId)) {
        currentMessageChunkRef.current = null;
        return;
      }
      const nextList = [...messagesRef.current];
      const existingIndex = nextList.findIndex(
        (item) => item.id && item.id === activeChunk.id
      );
      const completeMessage: AgentCustomMessage = {
        ...(activeChunk as AgentCustomMessage),
      };
      if (existingIndex >= 0) {
        nextList[existingIndex] = {
          ...nextList[existingIndex],
          ...completeMessage,
        };
      } else {
        nextList.push(completeMessage);
      }
      emitMessages(attachPendingInterruptToTail(nextList), false);
      currentMessageChunkRef.current = null;
      return;
    }

    const previewList = attachPendingInterruptToTail([
      ...messagesRef.current,
      activeChunk as AgentCustomMessage,
    ]);
    setMessages(previewList);
    optionsRef.current.onMessagesUpdate?.(previewList, false);
  };

  const handleMessagesComplete = (payload: unknown) => {
    const candidates = Array.isArray(payload) ? payload : [payload];
    for (const messageData of candidates) {
      if (!messageData || typeof messageData !== "object") continue;
      const message = messageData as {
      type?: string;
      id?: string;
      content?: unknown;
      additional_kwargs?: Record<string, unknown>;
      response_metadata?: {
        finish_reason?: string;
        model_name?: string;
        service_tier?: string;
      };
      name?: string;
      example?: boolean;
      tool_calls?: Array<{ name?: string; args?: { file_path?: string } }>;
      invalid_tool_calls?: unknown[];
      usage_metadata?: unknown;
      status?: string;
    };
      const isAIMessage =
        message.type === "ai" || message.type === "AIMessageChunk" || message.type === "tool";
      if (!isAIMessage) continue;
      const content = extractContent(message.content);
      if (content.includes("Updated todo list to") || message.status === "error") continue;

      const toolCalls = Array.isArray(message.tool_calls) ? [...message.tool_calls] : [];
      updateWriteOrEditorFilePathFromToolCalls(toolCalls);
      const msgId = String(message.id ?? "");

      if (
        currentMessageChunkRef.current &&
        String(currentMessageChunkRef.current.id ?? "") === msgId
      ) {
        currentMessageChunkRef.current = null;
      }

      const completeMessage: AgentCustomMessage = {
        id: msgId,
        type: message.type === "tool" ? "tool" : "ai",
        content,
        name: message.name ?? null,
        example: message.example ?? false,
        tool_calls: toolCalls as AgentCustomMessage["tool_calls"],
        invalid_tool_calls: message.invalid_tool_calls ?? [],
        additional_kwargs: message.additional_kwargs ?? {},
        response_metadata: {
          finish_reason: message.response_metadata?.finish_reason ?? "",
          model_name: message.response_metadata?.model_name ?? "",
          service_tier: message.response_metadata?.service_tier ?? "",
        },
        usage_metadata: null,
        resultType: "output",
      };

      const nextList = [...messagesRef.current];
      const existingIndex = nextList.findIndex((item) => item.id && item.id === msgId);
      if (existingIndex >= 0) {
        nextList[existingIndex] = {
          ...nextList[existingIndex],
          ...completeMessage,
        };
      } else {
        nextList.push(completeMessage);
      }
      emitMessages(attachPendingInterruptToTail(nextList), false);
    }
  };

  // 获取联想提示词
  const fetchSuggestions = useCallback(
    async (_sessionId: string, _workId: number | string) => {
      try {
        const response = (await suggestionsControllerInstance.fetch(_sessionId, _workId)) as
          | { guides?: string[] | string }
          | null;
        if (!response?.guides) return;
        const guides =
          Array.isArray(response.guides)
            ? response.guides
            : typeof response.guides === "string"
              ? (() => {
                  try {
                    const parsed = JSON.parse(response.guides) as unknown;
                    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
                  } catch {
                    return [];
                  }
                })()
              : [];
        if (guides.length === 0) return;
        const next = [...messagesRef.current];
        const lastIndex = next.length - 1;
        if (lastIndex < 0) return;
        next[lastIndex] = {
          ...next[lastIndex],
          suggestions: guides,
        };
        emitMessages(next, true);
      } catch {
        // 联想提示词失败不打断主流程
      }
    },
    []
  );

  const abortSuggestions = useCallback(() => {
    suggestionsControllerInstance.abort();
  }, []);

  const submit = useCallback(
    async (
      message: string,
      sessionId: string,
      workId: number | string,
      chatMode?: string,
      chatType?: string,
      tools?: string[],
      attachments?: Array<{ name: string; remoteAddress: string }>,
      reload?: boolean,
      command?: string,
      model?: string,
      writingStyleId?: string | number,
      commandOnly?: boolean
    ) => {
      if (isStreamingRef.current) return;
      const shouldTrackStreaming = !commandOnly;
      currentSessionIdRef.current = sessionId;
      currentWorkIdRef.current = workId;
      setError(null);
      // 与 Vue 一致：每次 submit 都重置本次流缓存，避免 commandOnly 沿用上轮消息导致重复堆叠
      messagesRef.current = [];
      currentMessageChunkRef.current = null;
      pendingInterruptRef.current = null;
      if (shouldTrackStreaming) {
        setMessages([]);
        setFiles({});
        setTodos([]);
        setIsStreaming(true);
      } else {
        // commandOnly 场景（如 reject/approve）不应重置展示状态，也不应占用 streaming UI。
        setIsStreaming(false);
      }
      // 与 Vue 链路保持一致：所有 submit（包括 commandOnly）都占用同一条流互斥锁，防止并发流导致重复消息。
      isStreamingRef.current = true;
      streamCompletedRef.current = false;
      sensitiveWordHandledRef.current = false;
      currentWriteOrEditorFilePathRef.current = "";
      currentEditInfoListRef.current = [];
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
        ...(chatType ? { chatType } : {}),
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
            if (eventType === "error") {
              const payload = Array.isArray(eventData) ? eventData[0] : eventData;
              let errMsg =
                typeof payload === "string"
                  ? payload
                  : (payload as { message?: string })?.message || "发生错误，请稍后重试";
              let needSendErrorMsg = false;
              const errorCode = String((payload as { error?: string })?.error ?? "");
              const isSensitiveWord = isSensitiveWordError(errMsg, errorCode);
              if (isSensitiveWord) {
                if (!sensitiveWordHandledRef.current) {
                  sensitiveWordHandledRef.current = true;
                  optionsRef.current.onSensitiveWord?.();
                }
              } else if (errorCode === "content_safety_check_failed") {
                errMsg = "AI生成的内容未通过内容安全审核";
                needSendErrorMsg = true;
              } else if (errorCode) {
                errMsg = "发生了问题，请稍后重试";
                needSendErrorMsg = true;
              }

              const errObj = new Error(errMsg);
              setError(errObj);
              optionsRef.current.onError?.(errObj, needSendErrorMsg);
              return;
            }

            if (eventData != null && eventType?.startsWith("messages/partial")) {
              const partialData = Array.isArray(eventData) ? eventData[0] : eventData;
              if (partialData && typeof partialData === "object" && (partialData as { type?: string }).type === "tool") {
                handleMessagesComplete(eventData);
              } else {
                handleMessagesPartial(partialData);
              }
            } else if (
              eventData != null &&
              (eventType === "messages/complete" ||
                eventType?.startsWith("messages/complete"))
            ) {
              handleMessagesComplete(eventData);
            }
            // 与 Vue 一致：处理 updates 事件中的 todos，用于 input 上方任务列表展示
            if ((eventType === "updates" || eventType?.startsWith("updates")) && eventData != null) {
              const isMainAgent = isMainAgentEvent(eventType);
              const d = (eventData as { data?: Record<string, { todos?: { content?: string; status?: string }[] }> })?.data ?? eventData;
              if (d && typeof d === "object") {
                let interruptHandled = false;
                for (const key of Object.keys(d)) {
                  if (key === "SummarizationMiddleware.before_model") continue;
                  const val = d[key];
                  if (!val || typeof val !== "object") continue;
                  // 与 Vue 版一致：显式处理 __interrupt__ 结构
                  if (key === "__interrupt__" && Array.isArray(val) && val.length > 0) {
                    const first = val[0] as {
                      id?: string;
                      value?: { action_requests?: Array<{ name?: string; args?: { todos?: unknown } }> };
                    };
                    const interruptId = String(first?.id ?? "").trim() || `hilt_${Date.now()}`;
                    const actionReq = first?.value?.action_requests?.[0];
                    const todos = normalizeTodos(actionReq?.args?.todos);
                    if (todos && todos.length > 0) {
                      pendingInterruptRef.current = {
                        todos,
                        status: "in_progress",
                      };
                      emitTodos(todos);
                      const prev = messagesRef.current;
                      const nextMessages: AgentCustomMessage[] =
                        prev.length > 0
                          ? [
                              ...prev.slice(0, -1),
                              {
                                ...prev[prev.length - 1],
                                hiltTodos: todos,
                                hiltStatus: "in_progress",
                              },
                            ]
                          : [
                              {
                                id: interruptId,
                                type: "tool",
                                content: "",
                                name: actionReq?.name ?? "tool_call",
                                example: false,
                                tool_calls: [],
                                invalid_tool_calls: [],
                                additional_kwargs: {},
                                response_metadata: {
                                  finish_reason: "",
                                  model_name: "",
                                  service_tier: "",
                                },
                                usage_metadata: null,
                                resultType: "output",
                                hiltTodos: todos,
                                hiltStatus: "in_progress",
                              },
                            ];
                      interruptHandled = true;
                      emitMessages(nextMessages, true);
                    }
                    continue;
                  }
                  // 与 Vue 对齐：内容安全中间件命中时回滚最后一条 AI 消息
                  if (key === "ContentSafetyMiddleware.after_model") {
                    const middlewareMessages = (val as { messages?: Array<{ type?: string }> }).messages;
                    if (Array.isArray(middlewareMessages) && middlewareMessages.length > 0) {
                      const firstMessage = middlewareMessages[0];
                      if (firstMessage?.type === "remove") {
                        const currentMessages = [...messagesRef.current];
                        for (let i = currentMessages.length - 1; i >= 0; i--) {
                          if (currentMessages[i].type === "ai") {
                            currentMessages.splice(i, 1);
                            emitMessages(currentMessages, false);
                            break;
                          }
                        }
                      }
                    }
                  }
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
                const interrupt = interruptHandled ? null : extractInterruptTodos(d);
                if (interrupt && interrupt.todos.length > 0) {
                  pendingInterruptRef.current = {
                    todos: interrupt.todos,
                    status: "in_progress",
                  };
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
                        // 与 Vue 版对齐：中断到达后统一标记为待处理
                        hiltStatus: "in_progress",
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
                  // 与 Vue 版对齐：interrupt 更新后走第二参数=true，便于外层按“中断消息更新”处理展示/滚动时机
                  emitMessages(nextMessages, true);
                }
              }
            }
          },
          (err) => {
            const errMsg = err instanceof Error ? err.message : String(err ?? "");
            const isSensitiveWord = isSensitiveWordError(errMsg);
            if (isSensitiveWord && !sensitiveWordHandledRef.current) {
              sensitiveWordHandledRef.current = true;
              optionsRef.current.onSensitiveWord?.();
            }
            setError(err);
            optionsRef.current.onError?.(err, !isSensitiveWord);
          },
          () => {
            streamCompletedRef.current = true;
            setIsStreaming(false);
            isStreamingRef.current = false;
            abortControllerRef.current = null;
            optionsRef.current.onComplete?.();
            const currentSessionId = currentSessionIdRef.current;
            const currentWorkId = currentWorkIdRef.current;
            const lastMessage =
              messagesRef.current.length > 0
                ? messagesRef.current[messagesRef.current.length - 1]
                : null;
            const hasPendingHilt =
              !!lastMessage?.hiltTodos && lastMessage.hiltTodos.length > 0;
            if (
              currentSessionId &&
              currentWorkId != null &&
              !hasPendingHilt
            ) {
              void fetchSuggestions(currentSessionId, currentWorkId);
            }
          },
          { signal: controller.signal }
        );
      } catch (e) {
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
        const err = e instanceof Error ? e : new Error(String(e));
        const isSensitiveWord = isSensitiveWordError(err.message);
        if (isSensitiveWord && !sensitiveWordHandledRef.current) {
          sensitiveWordHandledRef.current = true;
          optionsRef.current.onSensitiveWord?.();
        }
        setError(err);
        optionsRef.current.onError?.(err, !isSensitiveWord);
        if (!controller.signal.aborted && !streamCompletedRef.current) {
          optionsRef.current.onAbnormalTermination?.();
        }
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    abortSuggestions();
    setIsStreaming(false);
    isStreamingRef.current = false;
  }, [abortSuggestions]);

  return {
    messages,
    files,
    todos,
    isStreaming,
    error,
    suggestionsIsFetching: suggestionsState.isFetching,
    abortSuggestions,
    submit,
    stop,
    fetchSuggestions,
  };
}
