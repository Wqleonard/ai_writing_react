/**
 * useLangGraphStream - React 占位实现
 *
 * Vue 版依赖：Pinia (useEditorStore, useChatInputStore, useLoginStore)、
 * ElMessage、Vue Router、useLLM、useSuggestionsController、tracking 等。
 * 完整迁移需在 React 中提供对应的 Context/Store 与 toast 等后再实现。
 * 当前仅导出类型与占位 hook，便于先接入再逐步替换。
 */
import { useCallback, useState } from "react";
import type { AgentCustomMessage } from "../types/chat";

export interface EditFileArgsType {
  file_path: string;
  old_string?: string;
  new_string?: string;
  start_string?: string;
  end_string?: string;
}

export interface LangGraphStreamOptions {
  apiUrl: string;
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
  _options: LangGraphStreamOptions
): LangGraphStreamState & {
  submit: (
    _message: string,
    _sessionId: string,
    _workId: number | string,
    _chatMode?: string,
    _tools?: string[],
    _attachments?: Array<{ name: string; remoteAddress: string }>,
    _reload?: boolean,
    _command?: string
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

  const submit = useCallback(async () => {
    setError(new Error("useLangGraphStream: 未实现，需在 React 中接入完整逻辑"));
  }, []);

  const stop = useCallback(() => {}, []);

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
