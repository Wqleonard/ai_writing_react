import { useCallback, useMemo, useSyncExternalStore } from "react";
import { v4 as uuidv4 } from "uuid";
import type {
  ChatMessage,
  ChatSession,
  ChatTabType,
  AgentCustomMessage,
} from "../types/chat";

export type { ChatMessage, ChatSession, ChatTabType, AgentCustomMessage };
import {
  getSessionHistoryReq,
  deleteSessionReq,
  getWorksByIdReq,
} from "../api/works";

// 为每个tab创建独立的存储键
const getTabStorageKey = (workId: string, tabType: ChatTabType) =>
  `chatSessions_${workId}_${tabType}`;
const getTabCurrentSessionKey = (workId: string, tabType: ChatTabType) =>
  `currentSession_${workId}_${tabType}`;

const generateSessionId = (): string => {
  return uuidv4().replace(/-/g, "");
};

const generateSessionTitle = (
  messages: ChatMessage[],
  tabType: ChatTabType
): string => {
  if (messages.length === 0)
    return `新建${tabType === "faq" ? "问答" : "创作"}`;
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  if (firstUserMessage) {
    const content = firstUserMessage.content || "";
    const trimmedContent = content.trim();
    if (trimmedContent) {
      const title =
        trimmedContent.length > 20
          ? trimmedContent.substring(0, 20) + "..."
          : trimmedContent;
      return title;
    }
  }
  return `新建${tabType === "faq" ? "问答" : "创作"}`;
};

const convertBackendSessionsToFrontend = (
  backendSessions: unknown[]
): ChatSession[] => {
  if (!Array.isArray(backendSessions)) {
    console.warn(
      "[useDualTabChat] Invalid backend sessions data, expected array"
    );
    return [];
  }
  const converted = backendSessions.map((session: any) => ({
    id: session.sessionId || session.id || "",
    title: session.title || "未命名会话",
    messages: [],
    type: (session.type || "chat") as ChatTabType,
    createdAt: session.createdTime
      ? new Date(session.createdTime).getTime()
      : Date.now(),
    updatedAt: session.updatedTime
      ? new Date(session.updatedTime).getTime()
      : Date.now(),
  }));
  return converted;
};

const extractContent = (content: unknown): string => {
  if (!content) return "";
  if (Array.isArray(content)) {
    for (const item of content as any[]) {
      if (item.type === "text") return item.text || "";
    }
    return "";
  }
  if (typeof content === "string") return content;
  if (typeof content === "object" && content !== null && "text" in content) {
    return (content as { text: string }).text;
  }
  return JSON.stringify(content);
};

const shouldFilterMessage = (backendMsg: any): boolean => {
  const content = extractContent(backendMsg.content);
  if (content.includes("Updated todo list to")) return true;
  if (backendMsg.status === "error") return true;
  return false;
};

const convertBackendHistoryToFrontend = (
  backendHistory: unknown[]
): ChatMessage[] => {
  if (!Array.isArray(backendHistory) || backendHistory.length === 0) {
    console.warn(
      "Invalid backend history data, expected non-empty array"
    );
    return [];
  }
  const messages: ChatMessage[] = [];
  let currentAIMessage: ChatMessage | null = null;

  for (const backendMsg of backendHistory as any[]) {
    const msgRole = backendMsg.role || "ai";
    if (msgRole === "remove") continue;

    if (msgRole === "human") {
      if (currentAIMessage) {
        messages.push(currentAIMessage);
        currentAIMessage = null;
      }
      const content = extractContent(backendMsg.content);
      if (
        !content ||
        content.trim() === "" ||
        content === "..."
      )
        continue;
      const userMessage: ChatMessage = {
        id:
          backendMsg.messageId ||
          `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: "user",
        content,
        createdAt: backendMsg.updatedTime
          ? new Date(backendMsg.updatedTime)
          : new Date(),
        messageType: "normal",
        mode: "chat",
      };
      messages.push(userMessage);
    } else if (msgRole === "ai") {
      let parsedContent: any[] = [];
      try {
        if (typeof backendMsg.content === "string") {
          parsedContent = JSON.parse(backendMsg.content);
        } else {
          parsedContent = Array.isArray(backendMsg.content)
            ? backendMsg.content
            : [backendMsg.content];
        }
      } catch (err) {
        console.error(
          "[convertBackendHistoryToFrontend] ❌ 解析 AI content 失败:",
          err
        );
        continue;
      }

      for (const subMsg of parsedContent) {
        if (shouldFilterMessage(subMsg)) continue;
        const msgType = subMsg.type || "ai";

        if (msgType === "ai") {
          const content = extractContent(subMsg.content);
          const toolCalls = Array.isArray(subMsg.tool_calls)
            ? subMsg.tool_calls.map((toolCall: any) => ({
                name: toolCall.name || "",
                args: toolCall.args || {},
                id: toolCall.id || "",
                type: toolCall.type || "function",
              }))
            : [];

          if (!content && toolCalls.length === 0) continue;

          let resultType: "input" | "output" | undefined = undefined;
          if ("resultType" in subMsg && subMsg.resultType) {
            const backendResultType = subMsg.resultType;
            if (
              backendResultType === "input" ||
              backendResultType === "output"
            ) {
              resultType = backendResultType;
            }
          } else {
            resultType = "input";
          }

          const agentCustomMessage: AgentCustomMessage = {
            content,
            type: "ai",
            id:
              subMsg.id ||
              `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: subMsg.name || null,
            example: false,
            tool_calls: toolCalls,
            invalid_tool_calls: subMsg.invalid_tool_calls || [],
            usage_metadata: subMsg.usage_metadata || null,
            additional_kwargs: subMsg.additional_kwargs || {},
            response_metadata: {
              finish_reason:
                subMsg.response_metadata?.finish_reason || "stop",
              model_name: subMsg.response_metadata?.model_name || "",
              service_tier: subMsg.response_metadata?.service_tier || "",
            },
            resultType,
          };

          if (currentAIMessage) {
            currentAIMessage.customMessage!.push(agentCustomMessage);
          } else {
            currentAIMessage = {
              id:
                backendMsg.messageId ||
                `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              role: "assistant",
              content: "",
              createdAt: backendMsg.updatedTime
                ? new Date(backendMsg.updatedTime)
                : new Date(),
              messageType: "normal",
              mode: "chat",
              customMessage: [agentCustomMessage],
            };
          }
        } else if (msgType === "tool") {
          if (!currentAIMessage) {
            console.warn(
              "[convertBackendHistoryToFrontend] ⚠️ 遇到孤立的 tool 子消息，跳过:",
              subMsg.id
            );
            continue;
          }
          const content = extractContent(subMsg.content);
          let resultType: "input" | "output" | undefined = undefined;
          if ("resultType" in subMsg && subMsg.resultType) {
            const backendResultType = subMsg.resultType;
            if (
              backendResultType === "input" ||
              backendResultType === "output"
            ) {
              resultType = backendResultType;
            }
          }
          const toolCustomMessage: AgentCustomMessage = {
            content,
            type: "tool",
            id:
              subMsg.id ||
              `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: subMsg.name || null,
            example: false,
            tool_calls: [],
            invalid_tool_calls: [],
            usage_metadata: null,
            additional_kwargs: subMsg.additional_kwargs || {},
            response_metadata: {
              finish_reason: subMsg.status || "stop",
              model_name: "",
              service_tier: "",
            },
            resultType: resultType || "output",
          };
          currentAIMessage.customMessage!.push(toolCustomMessage);
        }
      }
    } else if (msgRole === "tool") {
      let parsedContent: any[] = [];
      try {
        if (typeof backendMsg.content === "string") {
          parsedContent = JSON.parse(backendMsg.content);
        } else {
          parsedContent = Array.isArray(backendMsg.content)
            ? backendMsg.content
            : [backendMsg.content];
        }
      } catch (err) {
        console.error(
          "[convertBackendHistoryToFrontend] ❌ 解析 Tool content 失败:",
          err
        );
        continue;
      }

      for (const subMsg of parsedContent) {
        if (shouldFilterMessage(subMsg)) continue;
        if (!currentAIMessage) {
          console.warn(
            "[convertBackendHistoryToFrontend] ⚠️ 遇到孤立的 tool 消息，跳过:",
            subMsg.id
          );
          continue;
        }
        const content = extractContent(subMsg.content);
        let resultType: "input" | "output" | undefined = "output";
        if ("resultType" in subMsg && subMsg.resultType) {
          const backendResultType = subMsg.resultType;
          if (
            backendResultType === "input" ||
            backendResultType === "output"
          ) {
            resultType = backendResultType;
          }
        }
        const toolCustomMessage: AgentCustomMessage = {
          content,
          type: "tool",
          id:
            subMsg.id ||
            `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: subMsg.name || null,
          example: false,
          tool_calls: [],
          invalid_tool_calls: [],
          usage_metadata: null,
          additional_kwargs: subMsg.additional_kwargs || {},
          response_metadata: {
            finish_reason: subMsg.status || "stop",
            model_name: "",
            service_tier: "",
          },
          resultType,
        };
        currentAIMessage.customMessage!.push(toolCustomMessage);
      }
    }
  }

  if (currentAIMessage) {
    messages.push(currentAIMessage);
  }
  return messages;
};

let hasCleanedSessionCache = false;
const clearLocalStorageSessionCache = (): void => {
  if (hasCleanedSessionCache) return;
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith("chatSessions_") ||
        key.startsWith("currentSession_")
      ) {
        keysToRemove.push(key);
      }
    }
    let removedCount = 0;
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
        removedCount++;
      } catch (error) {
        console.error(
          `[useDualTabChat] Failed to remove cache key: ${key}`,
          error
        );
      }
    });
    if (removedCount > 0) {
      console.log(
        `[useDualTabChat] ✅ Cleared ${removedCount} legacy session caches from all works`
      );
    } else {
      console.log("[useDualTabChat] No legacy session caches found");
    }
    hasCleanedSessionCache = true;
  } catch (error) {
    console.error("[useDualTabChat] Error clearing session cache:", error);
  }
};

// ---------- Singleton store (React: useSyncExternalStore) ----------
interface DualTabChatState {
  currentWorkId: string | null;
  faqMessages: ChatMessage[];
  faqCurrentSession: ChatSession | null;
  chatMessages: ChatMessage[];
  chatCurrentSession: ChatSession | null;
  cachedSessions: ChatSession[];
  hasLoadedSessions: boolean;
  needRefreshSessions: boolean;
}

const initialState: DualTabChatState = {
  currentWorkId: null,
  faqMessages: [],
  faqCurrentSession: null,
  chatMessages: [],
  chatCurrentSession: null,
  cachedSessions: [],
  hasLoadedSessions: false,
  needRefreshSessions: false,
};

let state: DualTabChatState = { ...initialState };
let refreshSessionsInFlight: Promise<void> | null = null;
let refreshSessionsInFlightWorkId: string | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): DualTabChatState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((l) => l());
}

function setStoreState(partial: Partial<DualTabChatState>): void {
  state = { ...state, ...partial };
  emit();
}

// ---------- Hook ----------
export function useDualTabChat() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setWorkId = useCallback((workId: string | null) => {
    if (state.currentWorkId !== workId) {
      setStoreState({
        currentWorkId: workId,
        faqMessages: [],
        faqCurrentSession: null,
        chatMessages: [],
        chatCurrentSession: null,
        cachedSessions: [],
        hasLoadedSessions: false,
      });
    } else {
      setStoreState({ currentWorkId: workId });
    }
  }, []);

  const setCachedSessions = useCallback((sessions: unknown[]) => {
    if (!Array.isArray(sessions)) {
      console.warn(
        "[useDualTabChat] ⚠️ Invalid sessions data, expected array, got:",
        typeof sessions
      );
      setStoreState({ cachedSessions: [], hasLoadedSessions: true });
      return;
    }
    setStoreState({
      cachedSessions: convertBackendSessionsToFrontend(sessions),
      hasLoadedSessions: true,
    });
  }, []);

  const refreshSessionsFromAPI = useCallback(async () => {
    const workId = state.currentWorkId;
    if (!workId) {
      console.warn(
        "[useDualTabChat] Cannot refresh sessions: workId is null"
      );
      return;
    }
    if (
      refreshSessionsInFlight &&
      refreshSessionsInFlightWorkId === workId
    ) {
      return refreshSessionsInFlight;
    }
    refreshSessionsInFlightWorkId = workId;
    refreshSessionsInFlight = (async () => {
      try {
        const req: any = await getWorksByIdReq(workId);
        const sessions = req?.sessions || [];
        // workId 已切换时，丢弃旧请求结果
        if (state.currentWorkId !== workId) return;
        setCachedSessions(sessions);
      } catch (error) {
        console.error(
          "[useDualTabChat] Failed to refresh sessions from API:",
          error
        );
      } finally {
        refreshSessionsInFlight = null;
        refreshSessionsInFlightWorkId = null;
      }
    })();
    return refreshSessionsInFlight;
  }, [setCachedSessions]);

  const markNeedRefreshSessions = useCallback(() => {
    setStoreState({ needRefreshSessions: true });
  }, []);

  const getTabCurrentSessionId = useCallback((tabType: ChatTabType): string | null => {
    if (!state.currentWorkId) return null;
    const storageKey = getTabCurrentSessionKey(
      state.currentWorkId,
      tabType
    );
    try {
      const value = localStorage.getItem(storageKey);
      if (!value) return null;
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "string" ? parsed : value;
      } catch {
        return value;
      }
    } catch (error) {
      console.error(
        `Failed to get current session ID for ${tabType}:`,
        error
      );
      return null;
    }
  }, []);

  const setTabCurrentSessionId = useCallback(
    (tabType: ChatTabType, sessionId: string): void => {
      if (!state.currentWorkId) return;
      const storageKey = getTabCurrentSessionKey(
        state.currentWorkId,
        tabType
      );
      try {
        const existingValue = localStorage.getItem(storageKey);
        if (existingValue !== null) {
          localStorage.removeItem(storageKey);
        }
        localStorage.setItem(storageKey, sessionId);
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "QuotaExceededError"
        ) {
          console.warn(
            "[useDualTabChat] localStorage quota exceeded, clearing all legacy session caches..."
          );
          try {
            clearLocalStorageSessionCache();
            localStorage.setItem(storageKey, sessionId);
          } catch (retryError) {
            console.error(
              "[useDualTabChat] Failed to set current session ID after clearing cache:",
              retryError
            );
          }
        } else {
          console.error(
            "[useDualTabChat] Failed to set current session ID:",
            error
          );
        }
      }
    },
    []
  );

  const getTabSessions = useCallback(
    async (tabType: ChatTabType): Promise<ChatSession[]> => {
      if (!state.currentWorkId) return [];
      try {
        if (state.needRefreshSessions || !state.hasLoadedSessions) {
          await refreshSessionsFromAPI();
          setStoreState({ needRefreshSessions: false });
        }
        return state.cachedSessions.filter(
          (session) => session.type === tabType
        );
      } catch (error) {
        console.error(
          `[useDualTabChat] ❌ Failed to get sessions for ${tabType}:`,
          error
        );
        return [];
      }
    },
    [refreshSessionsFromAPI]
  );

  const createNewSession = useCallback(
    (tabType: ChatTabType): ChatSession => {
      const session: ChatSession = {
        id: generateSessionId(),
        title: `新建${tabType === "faq" ? "问答" : "创作"}`,
        messages: [],
        type: tabType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setTabCurrentSessionId(tabType, session.id);
      if (tabType === "faq") {
        setStoreState({
          faqCurrentSession: session,
          faqMessages: [],
        });
      } else {
        setStoreState({
          chatCurrentSession: session,
          chatMessages: [],
        });
      }
      return session;
    },
    [setTabCurrentSessionId]
  );

  const saveCurrentSession = useCallback((tabType: ChatTabType): void => {
    const currentSession =
      tabType === "faq"
        ? state.faqCurrentSession
        : state.chatCurrentSession;
    const messages =
      tabType === "faq" ? state.faqMessages : state.chatMessages;
    if (!currentSession || messages.length === 0) return;
    const updatedSession: ChatSession = {
      ...currentSession,
      messages: [...messages],
      title: generateSessionTitle(messages, tabType),
      updatedAt: Date.now(),
    };
    if (tabType === "faq") {
      setStoreState({ faqCurrentSession: updatedSession });
    } else {
      setStoreState({ chatCurrentSession: updatedSession });
    }
  }, []);

  const loadSession = useCallback(
    async (tabType: ChatTabType, sessionId: string): Promise<boolean> => {
      if (!state.currentWorkId) {
        console.warn(
          "[useDualTabChat] Cannot load session: workId is null"
        );
        return false;
      }
      try {
        clearLocalStorageSessionCache();
        const historyData: any = await getSessionHistoryReq(
          state.currentWorkId,
          sessionId
        );
        if (!historyData || !Array.isArray(historyData)) {
          console.warn(
            `[useDualTabChat] No history data found for session: ${sessionId}`
          );
          return false;
        }
        const messages = convertBackendHistoryToFrontend(
          historyData as any[]
        );
        const sessions = await getTabSessions(tabType);
        const sessionInfo = sessions.find((s) => s.id === sessionId);
        const session: ChatSession = sessionInfo || {
          id: sessionId,
          title:
            messages.length > 0
              ? generateSessionTitle(messages, tabType)
              : "未命名会话",
          messages: [],
          type: tabType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        session.messages = messages;
        if (
          session.title === "未命名会话" &&
          messages.length > 0
        ) {
          const newTitle = generateSessionTitle(messages, tabType);
          session.title = newTitle;
          const sessionIndex = state.cachedSessions.findIndex(
            (s) => s.id === sessionId
          );
          if (sessionIndex !== -1) {
            const nextCached = [...state.cachedSessions];
            nextCached[sessionIndex] = { ...nextCached[sessionIndex], title: newTitle };
            setStoreState({ cachedSessions: nextCached });
          }
        }
        setTabCurrentSessionId(tabType, sessionId);
        if (tabType === "faq") {
          setStoreState({
            faqCurrentSession: session,
            faqMessages: [...messages],
          });
        } else {
          setStoreState({
            chatCurrentSession: session,
            chatMessages: [...messages],
          });
        }
        return true;
      } catch (error) {
        console.error(
          `[useDualTabChat] Failed to load session ${sessionId}:`,
          error
        );
        return false;
      }
    },
    [getTabSessions, setTabCurrentSessionId]
  );

  const loadLatestSession = useCallback(
    async (tabType: ChatTabType): Promise<ChatSession | null> => {
      try {
        const currentSessionId = getTabCurrentSessionId(tabType);
        const sessions = await getTabSessions(tabType);
        if (sessions.length === 0) return null;
        let sessionToLoad: ChatSession | null = null;
        if (currentSessionId) {
          sessionToLoad =
            sessions.find((s) => s.id === currentSessionId) || null;
        }
        if (!sessionToLoad) {
          const sortedSessions = [...sessions].sort(
            (a, b) => b.updatedAt - a.updatedAt
          );
          sessionToLoad = sortedSessions[0];
        }
        if (!sessionToLoad) {
          console.warn(
            `[useDualTabChat] No valid session to load for ${tabType}`
          );
          return null;
        }
        const loadSuccess = await loadSession(tabType, sessionToLoad.id);
        if (!loadSuccess) {
          console.warn(
            `[useDualTabChat] Failed to load session: ${sessionToLoad.id}`
          );
          return null;
        }
        return tabType === "faq"
          ? state.faqCurrentSession
          : state.chatCurrentSession;
      } catch (error) {
        console.error(
          `[useDualTabChat] Failed to load latest session for ${tabType}:`,
          error
        );
        return null;
      }
    },
    [getTabCurrentSessionId, getTabSessions, loadSession]
  );

  const addMessage = useCallback(
    (tabType: ChatTabType, message: ChatMessage): void => {
      const currentSession =
        tabType === "faq"
          ? state.faqCurrentSession
          : state.chatCurrentSession;
      const prevMessages =
        tabType === "faq" ? state.faqMessages : state.chatMessages;
      const nextMessages = [...prevMessages, message];

      if (tabType === "faq") {
        setStoreState({ faqMessages: nextMessages });
      } else {
        setStoreState({ chatMessages: nextMessages });
      }

      if (currentSession && nextMessages.length > 0) {
        const updatedSession: ChatSession = {
          ...currentSession,
          messages: nextMessages,
          title: generateSessionTitle(nextMessages, tabType),
          updatedAt: Date.now(),
        };
        if (tabType === "faq") {
          setStoreState({ faqCurrentSession: updatedSession });
        } else {
          setStoreState({ chatCurrentSession: updatedSession });
        }
      }
    },
    []
  );

  /** 更新最后一条聊天消息（用于流式结束后合并 guide 联想提示词等） */
  const updateLastChatMessage = useCallback(
    (updater: (prev: ChatMessage) => ChatMessage): void => {
      const prev = state.chatMessages;
      if (prev.length === 0) return;
      const last = prev[prev.length - 1];
      const next = updater(last);
      const nextMessages = [...prev.slice(0, -1), next];
      setStoreState({ chatMessages: nextMessages });
      const currentSession = state.chatCurrentSession;
      if (currentSession && nextMessages.length > 0) {
        setStoreState({
          chatCurrentSession: {
            ...currentSession,
            messages: nextMessages,
            updatedAt: Date.now(),
          },
        });
      }
    },
    []
  );

  const deleteSession = useCallback(
    async (tabType: ChatTabType, sessionId: string): Promise<void> => {
      if (!state.currentWorkId) {
        console.warn(
          "[useDualTabChat] Cannot delete session: workId is null"
        );
        return;
      }
      try {
        await deleteSessionReq(state.currentWorkId, sessionId);
        const sessionIndex = state.cachedSessions.findIndex(
          (s) => s.id === sessionId && s.type === tabType
        );
        if (sessionIndex !== -1) {
          const nextCached = [...state.cachedSessions];
          nextCached.splice(sessionIndex, 1);
          setStoreState({ cachedSessions: nextCached });
        }
        const currentSession =
          tabType === "faq"
            ? state.faqCurrentSession
            : state.chatCurrentSession;
        if (currentSession?.id === sessionId) {
          if (tabType === "faq") {
            setStoreState({ faqCurrentSession: null, faqMessages: [] });
          } else {
            setStoreState({ chatCurrentSession: null, chatMessages: [] });
          }
          try {
            localStorage.removeItem(
              getTabCurrentSessionKey(state.currentWorkId, tabType)
            );
          } catch (error) {
            console.error(
              "[useDualTabChat] Failed to remove current session key:",
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `[useDualTabChat] Failed to delete session ${sessionId}:`,
          error
        );
        throw error;
      }
    },
    []
  );

  const startNewChat = useCallback(
    (tabType: ChatTabType): ChatSession => {
      saveCurrentSession(tabType);
      return createNewSession(tabType);
    },
    [saveCurrentSession, createNewSession]
  );

  const clearMessages = useCallback((tabType: ChatTabType): void => {
    const currentSession =
      tabType === "faq"
        ? state.faqCurrentSession
        : state.chatCurrentSession;
    if (tabType === "faq") {
      setStoreState({ faqMessages: [] });
    } else {
      setStoreState({ chatMessages: [] });
    }
    if (currentSession) {
      const updatedSession: ChatSession = {
        ...currentSession,
        messages: [],
        title: generateSessionTitle([], tabType),
        updatedAt: Date.now(),
      };
      if (tabType === "faq") {
        setStoreState({ faqCurrentSession: updatedSession });
      } else {
        setStoreState({ chatCurrentSession: updatedSession });
      }
    }
  }, []);

  const faqHasMessages = useMemo(
    () => snapshot.faqMessages.length > 0,
    [snapshot.faqMessages.length]
  );
  const chatHasMessages = useMemo(
    () => snapshot.chatMessages.length > 0,
    [snapshot.chatMessages.length]
  );

  return {
    currentWorkId: snapshot.currentWorkId,
    faqMessages: snapshot.faqMessages,
    faqCurrentSession: snapshot.faqCurrentSession,
    chatMessages: snapshot.chatMessages,
    chatCurrentSession: snapshot.chatCurrentSession,
    faqHasMessages,
    chatHasMessages,
    setWorkId,
    setCachedSessions,
    markNeedRefreshSessions,
    getTabSessions,
    createNewSession,
    saveCurrentSession,
    loadSession,
    loadLatestSession,
    addMessage,
    updateLastChatMessage,
    deleteSession,
    startNewChat,
    clearMessages,
  };
}
