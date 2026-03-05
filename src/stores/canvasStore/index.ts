import { create } from "zustand";

const createCanvasSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
};

interface CanvasStoreState {
  sessionIdByWorkId: Record<string, string>;
}

interface CanvasStoreActions {
  getOrCreateCanvasSessionId: (workId: string) => string;
  createNewCanvasSessionId: (workId: string) => string;
  clearCanvasSessionId: (workId: string) => void;
}

export const useCanvasStore = create<CanvasStoreState & CanvasStoreActions>((set, get) => ({
  sessionIdByWorkId: {},

  getOrCreateCanvasSessionId: (workId) => {
    console.log(workId, 'workId')
    if (!workId) return "";
    const existing = get().sessionIdByWorkId[workId];
    if (existing) return existing;
    const nextId = createCanvasSessionId();
    set((state) => ({
      sessionIdByWorkId: {
        ...state.sessionIdByWorkId,
        [workId]: nextId,
      },
    }));
    return nextId;
  },

  createNewCanvasSessionId: (workId) => {
    if (!workId) return "";
    const nextId = createCanvasSessionId();
    set((state) => ({
      sessionIdByWorkId: {
        ...state.sessionIdByWorkId,
        [workId]: nextId,
      },
    }));
    return nextId;
  },

  clearCanvasSessionId: (workId) => {
    if (!workId) return;
    set((state) => {
      const next = { ...state.sessionIdByWorkId };
      delete next[workId];
      return { sessionIdByWorkId: next };
    });
  },
}));
