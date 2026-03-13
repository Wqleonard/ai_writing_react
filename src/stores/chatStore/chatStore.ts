/**
 * Chat 全局 Store（workspace 与 editor 共享会话列表、当前会话等）
 * 与 Vue useDualTabChat 行为对齐
 */

import { create } from "zustand";
import {
  getWorksByIdReq,
  getSessionHistoryReq,
  deleteSessionReq,
} from "@/api/works";
import type { ChatMessage, ChatSession, ChatTabType } from "./types";
import {
  getTabCurrentSessionKey,
  generateSessionId,
  generateSessionTitle,
  convertBackendSessionsToFrontend,
  convertBackendHistoryToFrontend,
} from "./utils";

const STORAGE_PREFIX = "chatStore_";

export interface ChatStoreState {
  workId: string | null;
  cachedSessions: ChatSession[];
  needRefreshSessions: boolean;
  chatCurrentSession: ChatSession | null;
  faqCurrentSession: ChatSession | null;
  chatMessages: ChatMessage[];
  faqMessages: ChatMessage[];
}

export interface ChatStoreActions {
  setWorkId: (workId: string | null) => void;
  setCachedSessions: (sessions: unknown[]) => void;
  getTabSessions: (tabType: ChatTabType) => Promise<ChatSession[]>;
  refreshSessionsFromAPI: () => Promise<void>;
  markNeedRefreshSessions: () => void;
  getTabCurrentSessionId: (tabType: ChatTabType) => string | null;
  setTabCurrentSessionId: (tabType: ChatTabType, sessionId: string) => void;
  createNewSession: (tabType: ChatTabType) => ChatSession;
  saveCurrentSession: (tabType: ChatTabType) => void;
  loadSession: (tabType: ChatTabType, sessionId: string) => Promise<boolean>;
  loadLatestSession: (tabType: ChatTabType) => Promise<ChatSession | null>;
  addMessage: (tabType: ChatTabType, message: ChatMessage) => void;
  startNewChat: (tabType: ChatTabType) => ChatSession;
  deleteSession: (tabType: ChatTabType, sessionId: string) => Promise<void>;
  clearMessages: (tabType: ChatTabType) => void;
}

export type ChatStore = ChatStoreState & ChatStoreActions;

function getStorageKey(tabType: ChatTabType): string | null {
  const workId = useChatStore.getState().workId;
  if (!workId) return null;
  return `${STORAGE_PREFIX}${getTabCurrentSessionKey(workId, tabType)}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  workId: null,
  cachedSessions: [],
  needRefreshSessions: false,
  chatCurrentSession: null,
  faqCurrentSession: null,
  chatMessages: [],
  faqMessages: [],

  setWorkId: (workId) => {
    const prev = get().workId;
    if (prev !== workId) {
      set({
        workId,
        cachedSessions: [],
        chatCurrentSession: null,
        faqCurrentSession: null,
        chatMessages: [],
        faqMessages: [],
      });
    } else {
      set({ workId });
    }
  },

  setCachedSessions: (sessions) => {
    const list = Array.isArray(sessions)
      ? convertBackendSessionsToFrontend(sessions)
      : [];
    set({ cachedSessions: list });
  },

  getTabSessions: async (tabType) => {
    const { workId, cachedSessions, needRefreshSessions } = get();
    if (!workId) return [];
    if (needRefreshSessions) {
      await get().refreshSessionsFromAPI();
      set({ needRefreshSessions: false });
    }
    return cachedSessions.filter((s) => s.type === tabType);
  },

  refreshSessionsFromAPI: async () => {
    const workId = get().workId;
    if (!workId) return;
    try {
      const req = await getWorksByIdReq(workId) as { sessions?: unknown[] };
      get().setCachedSessions(req?.sessions ?? []);
    } catch (e) {
      console.error("[chatStore] refreshSessionsFromAPI failed:", e);
    }
  },

  markNeedRefreshSessions: () => set({ needRefreshSessions: true }),

  getTabCurrentSessionId: (tabType) => {
    const key = getStorageKey(tabType);
    if (!key) return null;
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === "string" ? parsed : value;
      } catch {
        return value;
      }
    } catch {
      return null;
    }
  },

  setTabCurrentSessionId: (tabType, sessionId) => {
    const key = getStorageKey(tabType);
    if (!key) return;
    try {
      const existing = localStorage.getItem(key);
      if (existing !== null) localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify(sessionId));
    } catch (e) {
      console.error("[chatStore] setTabCurrentSessionId failed:", e);
    }
  },

  createNewSession: (tabType) => {
    const session: ChatSession = {
      id: generateSessionId(),
      title: `新建${tabType === "faq" ? "问答" : "创作"}`,
      messages: [],
      type: tabType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    get().setTabCurrentSessionId(tabType, session.id);
    if (tabType === "faq") {
      set({ faqCurrentSession: session, faqMessages: [] });
    } else {
      set({ chatCurrentSession: session, chatMessages: [] });
    }
    return session;
  },

  saveCurrentSession: (tabType) => {
    const state = get();
    const currentSession =
      tabType === "faq" ? state.faqCurrentSession : state.chatCurrentSession;
    const messages =
      tabType === "faq" ? state.faqMessages : state.chatMessages;
    if (!currentSession || messages.length === 0) return;
    const updated: ChatSession = {
      ...currentSession,
      messages: [...messages],
      title: generateSessionTitle(messages, tabType),
      updatedAt: Date.now(),
    };
    if (tabType === "faq") {
      set({ faqCurrentSession: updated });
    } else {
      set({ chatCurrentSession: updated });
    }
  },

  loadSession: async (tabType, sessionId) => {
    const workId = get().workId;
    if (!workId) return false;
    try {
      const historyData = await getSessionHistoryReq(workId, sessionId);
      const list = Array.isArray(historyData) ? historyData : [];
      const messages = convertBackendHistoryToFrontend(list);
      const sessions = await get().getTabSessions(tabType);
      const sessionInfo = sessions.find((s) => s.id === sessionId);
      const session: ChatSession = sessionInfo ?? {
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
      get().setTabCurrentSessionId(tabType, sessionId);
      if (tabType === "faq") {
        set({ faqCurrentSession: session, faqMessages: [...messages] });
      } else {
        set({ chatCurrentSession: session, chatMessages: [...messages] });
      }
      return true;
    } catch (e) {
      console.error("[chatStore] loadSession failed:", e);
      return false;
    }
  },

  loadLatestSession: async (tabType) => {
    const currentSessionId = get().getTabCurrentSessionId(tabType);
    const sessions = await get().getTabSessions(tabType);
    if (sessions.length === 0) return null;
    let sessionToLoad: ChatSession | null = null;
    if (currentSessionId) {
      sessionToLoad = sessions.find((s) => s.id === currentSessionId) ?? null;
    }
    if (!sessionToLoad) {
      const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
      sessionToLoad = sorted[0] ?? null;
    }
    if (!sessionToLoad) return null;
    const ok = await get().loadSession(tabType, sessionToLoad.id);
    if (!ok) return null;
    return tabType === "faq"
      ? get().faqCurrentSession
      : get().chatCurrentSession;
  },

  addMessage: (tabType, message) => {
    if (tabType === "faq") {
      set((s) => ({ faqMessages: [...s.faqMessages, message] }));
    } else {
      set((s) => ({ chatMessages: [...s.chatMessages, message] }));
    }
    get().saveCurrentSession(tabType);
  },

  startNewChat: (tabType) => {
    get().saveCurrentSession(tabType);
    return get().createNewSession(tabType);
  },

  deleteSession: async (tabType, sessionId) => {
    const workId = get().workId;
    if (!workId) return;
    await deleteSessionReq(workId, sessionId);
    set((s) => ({
      cachedSessions: s.cachedSessions.filter(
        (x) => !(x.id === sessionId && x.type === tabType)
      ),
    }));
    const current =
      tabType === "faq" ? get().faqCurrentSession : get().chatCurrentSession;
    if (current?.id === sessionId) {
      if (tabType === "faq") {
        set({ faqCurrentSession: null, faqMessages: [] });
      } else {
        set({ chatCurrentSession: null, chatMessages: [] });
      }
      try {
        const key = getStorageKey(tabType);
        if (key) localStorage.removeItem(key);
      } catch {}
    }
  },

  clearMessages: (tabType) => {
    if (tabType === "faq") {
      set({ faqMessages: [] });
    } else {
      set({ chatMessages: [] });
    }
  },
}));
