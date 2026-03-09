import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import { serverDataToTree } from "@/stores/editorStore/utils";
import {
  getWorksByIdReq,
  updateWorkVersionReq,
  updateWorkInfoReq,
} from "@/api/works";
import type {
  WorkInfo,
  ServerData,
  EditorSaveStatus,
  FileTreeNode,
} from "@/stores/editorStore/types";

const defaultWorkInfo: WorkInfo = {
  workId: "",
  title: "",
  introduction: "",
  createdTime: "",
  updatedTime: "",
  description: "",
  stage: "final",
  chapterNum: 10,
  wordNum: 1000,
  workTags: [],
};

/** 默认当前编辑文件 key（单文件最简版） */
export const DEFAULT_EDITING_FILE_KEY = "大纲.md";

interface EditorState {
  workId: string;
  workInfo: WorkInfo;
  /** 服务端文件数据：路径 -> 内容，与 Vue serverData 一致 */
  serverData: ServerData;
  /** 侧边栏树数据（由 serverData 手动同步更新） */
  treeData: FileTreeNode[];
  /** 当前编辑文件内容（与 currentEditingId 对应） */
  currentContent: string;
  /** 树节点 new 标记：id -> true */
  newNodeIdMap: Record<string, boolean>;
  /** 当前编辑中的文件路径 key */
  currentEditingId: string;
}

interface EditorActions {
  setWorkId: (workId: string) => void;
  setWorkInfo: (info: Partial<WorkInfo> | ((prev: WorkInfo) => WorkInfo)) => void;
  setServerData: (data: ServerData) => void;
  /** 更新单个文件内容（对应 Vue updateNodeContentById 的简化） */
  setServerDataFile: (path: string, content: string) => void;
  setCurrentContent: (content: string) => void;
  setNewNodeIds: (ids: string[]) => void;
  markNewNodeId: (id: string) => void;
  clearNewNodeId: (id: string) => void;
  /** 新增路径（文件或目录）。目录 path 需以 / 结尾，内容传空；文件为完整路径如 "正文/正文.md" */
  addServerDataPath: (path: string, content?: string) => void;
  /** 删除路径及其下所有键 */
  deleteServerDataPath: (path: string) => void;
  /** 重命名路径（更新所有以 oldPath 为前缀的 key） */
  renameServerDataPath: (oldPath: string, newPath: string) => void;
  setCurrentEditingId: (id: string) => void;
  /** 初始化编辑器数据：拉取作品详情并写入 workInfo、serverData（对应 Vue initEditorData） */
  initEditorData: (workId: string) => Promise<void>;
  /** 保存编辑器数据到服务端（对应 Vue saveEditorData） */
  saveEditorData: (
    saveStatus?: EditorSaveStatus,
    _needLocalCache?: boolean
  ) => Promise<void>;
  /** 重置 store 状态（对应 Vue initEditorStore） */
  initEditorStore: () => void;
}

const initialState: EditorState = {
  workId: "",
  workInfo: defaultWorkInfo,
  serverData: {},
  treeData: [],
  currentContent: "",
  newNodeIdMap: {},
  currentEditingId: DEFAULT_EDITING_FILE_KEY,
};

let htmlEntityDecoder: HTMLTextAreaElement | null = null;
const decodeHtmlEntities = (text: string): string => {
  if (!text) return "";
  if (typeof document === "undefined") return text;
  if (!htmlEntityDecoder) htmlEntityDecoder = document.createElement("textarea");
  htmlEntityDecoder.innerHTML = text;
  return htmlEntityDecoder.value;
};

const normalizeServerContent = (content: string): string => {
  if (typeof content !== "string") return "";
  const compact = decodeHtmlEntities(content)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "");
  return compact.length === 0 ? "" : content;
};

const normalizeServerData = (data: ServerData): ServerData => {
  const next: ServerData = {};
  Object.keys(data ?? {}).forEach((key) => {
    const value = data[key];
    next[key] = typeof value === "string" ? normalizeServerContent(value) : "";
  });
  return next;
};

export const useEditorStore = create<EditorState & EditorActions>()(
  devtools((set, get) => ({
    ...initialState,

  setWorkId: (workId) => set({ workId }),

  setWorkInfo: (info) =>
    set((state) => ({
      workInfo:
        typeof info === "function" ? info(state.workInfo) : { ...state.workInfo, ...info },
    })),

  setServerData: (data) =>
    set((state) => {
      const normalized = normalizeServerData(data);
      const fileKey = state.currentEditingId || DEFAULT_EDITING_FILE_KEY;
      return {
        serverData: normalized,
        treeData: serverDataToTree(normalized),
        currentContent: normalized[fileKey] ?? "",
      };
    }),

  setServerDataFile: (path, content) =>
    set((state) => {
      const normalizedContent = normalizeServerContent(content);
      const nextServerData = { ...state.serverData, [path]: normalizedContent };
      return {
        serverData: nextServerData,
        treeData: serverDataToTree(nextServerData),
        currentContent: path === state.currentEditingId ? normalizedContent : state.currentContent,
      };
    }),

  setCurrentContent: (content) =>
    set((state) => {
      const normalizedContent = normalizeServerContent(content);
      const node = get().serverData[state.currentEditingId]
      if(!node) {
        return {
          currentContent: normalizedContent,
        } 
      } else{
        const fileKey = state.currentEditingId
        return {
          currentContent: normalizedContent,
          serverData: { ...state.serverData, [fileKey]: normalizedContent },
          treeData: serverDataToTree({ ...state.serverData, [fileKey]: normalizedContent }),
        };
      }
    }),

  setNewNodeIds: (ids) =>
    set({
      newNodeIdMap: Array.from(new Set(ids)).reduce<Record<string, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {}),
    }),

  markNewNodeId: (id) =>
    set((state) => ({
      newNodeIdMap: {
        ...state.newNodeIdMap,
        [id]: true,
      },
    })),

  clearNewNodeId: (id) =>
    set((state) => {
      if (!state.newNodeIdMap[id]) return state;
      const next = { ...state.newNodeIdMap };
      delete next[id];
      return { newNodeIdMap: next };
    }),

  addServerDataPath: (path, content = "") =>
    set((state) => {
      const normalizedContent = normalizeServerContent(content);
      return {
        serverData: { ...state.serverData, [path]: normalizedContent },
        treeData: serverDataToTree({ ...state.serverData, [path]: normalizedContent }),
        currentContent: path === state.currentEditingId ? normalizedContent : state.currentContent,
      };
    }),

  deleteServerDataPath: (path) =>
    set((state) => {
      const prefix = path.endsWith("/") ? path : path + "/";
      const next: ServerData = {};
      Object.keys(state.serverData).forEach((k) => {
        if (k !== path && k !== path + "/" && !k.startsWith(prefix)) next[k] = state.serverData[k];
      });
      const nextNewNodeIdMap: Record<string, boolean> = {};
      Object.keys(state.newNodeIdMap).forEach((nodeId) => {
        if (nodeId !== path && !nodeId.startsWith(prefix)) {
          nextNewNodeIdMap[nodeId] = true;
        }
      });
      return {
        serverData: next,
        treeData: serverDataToTree(next),
        newNodeIdMap: nextNewNodeIdMap,
        currentContent: next[state.currentEditingId] ?? "",
      };
    }),

  renameServerDataPath: (oldPath, newPath) =>
    set((state) => {
      const next = { ...state.serverData };
      const oldPrefix = oldPath.endsWith("/") ? oldPath : oldPath + "/";
      const newPrefix = newPath.endsWith("/") ? newPath : newPath + "/";
      Object.keys(state.serverData).forEach((k) => {
        if (k === oldPath) {
          delete next[k];
          next[newPath] = state.serverData[k];
        } else if (k.startsWith(oldPrefix)) {
          const suffix = k.slice(oldPrefix.length);
          delete next[k];
          next[newPrefix + suffix] = state.serverData[k];
        }
      });
      let currentEditingId = state.currentEditingId;
      if (state.currentEditingId === oldPath) currentEditingId = newPath;
      else if (state.currentEditingId.startsWith(oldPrefix))
        currentEditingId = newPrefix + state.currentEditingId.slice(oldPrefix.length);
      const newNodeIdMap = Object.keys(state.newNodeIdMap).reduce<Record<string, boolean>>(
        (acc, nodeId) => {
          if (nodeId === oldPath) {
            acc[newPath] = true;
            return acc;
          }
          if (nodeId.startsWith(oldPrefix)) {
            acc[newPrefix + nodeId.slice(oldPrefix.length)] = true;
            return acc;
          }
          acc[nodeId] = true;
          return acc;
        },
        {}
      );
      return {
        serverData: next,
        treeData: serverDataToTree(next),
        currentEditingId,
        newNodeIdMap,
        currentContent: next[currentEditingId] ?? "",
      };
    }),

  setCurrentEditingId: (id) =>
    set((state) => ({
      currentEditingId: id,
      currentContent: state.serverData[id] ?? "",
    })),

  initEditorData: async (workId) => {
    set({ workId });
    console.log('initEditorData', workId)
    const { useChatStore } = await import("@/stores/chatStore");
    useChatStore.getState().setWorkId(workId);
    try {
      const req = (await getWorksByIdReq(workId)) as Record<string, unknown>;
      const workInfo: WorkInfo = {
        ...defaultWorkInfo,
        workId: workId,
        title: (req?.title as string) ?? "",
        introduction: (req?.introduction as string) ?? "",
        createdTime: (req?.createdTime as string) ?? "",
        updatedTime: (req?.updatedTime as string) ?? "",
        description: (req?.description as string) ?? "",
        stage: (req?.stage as string) ?? "final",
        chapterNum: (req?.chapterNum as number) ?? 10,
        wordNum: (req?.wordNum as number) ?? 1000,
        workTags: [],
      };
      if (req?.workTags && Array.isArray(req.workTags)) {
        workInfo.workTags = (req.workTags as Array<{ tags?: Array<{ id: number; name: string; userId: string }> }>)
          .flatMap((wt) => wt.tags ?? [])
          .map((t) => ({ id: t.id, name: t.name, userId: t.userId }));
      }
      set({ workInfo });

      const latest = req?.latestWorkVersion as { content?: string } | undefined;
      let serverData: ServerData = {};
      if (latest?.content && typeof latest.content === "string") {
        try {
          serverData = JSON.parse(latest.content) as ServerData;
        } catch {
          serverData = {};
        }
      }
      const normalizedServerData = normalizeServerData(serverData);
      const fileKey = get().currentEditingId || DEFAULT_EDITING_FILE_KEY;
      set({
        serverData: normalizedServerData,
        treeData: serverDataToTree(normalizedServerData),
        currentContent: normalizedServerData[fileKey] ?? "",
      });
      set({ newNodeIdMap: {} });

      const sessions = req?.sessions;
      if (Array.isArray(sessions)) {
        useChatStore.getState().setCachedSessions(sessions);
      }
      console.log('initEditorData success', workId)
    } catch (e) {
      console.error("[editorStore] initEditorData failed:", e);
      // toast.error("加载作品失败");
    }
  },

  saveEditorData: async (saveStatus = "0", _needLocalCache = true) => {
    const { workId, workInfo, serverData } = get();
    console.log('saveEditorData', workId, workInfo, serverData)
    if (!workId) {
      toast.error("无作品 ID，无法保存");
      return;
    }
    try {
      const content = JSON.stringify(serverData);
      await updateWorkVersionReq(workId, content, saveStatus);
      set({
        workInfo: {
          ...workInfo,
          updatedTime: new Date().toISOString(),
        },
      });
      if (saveStatus === "0") {
        toast.success("保存成功");
      }
    } catch (e) {
      console.error("[editorStore] saveEditorData failed:", e);
      toast.error("保存失败");
    }
  },

    initEditorStore: () => set(initialState),
  }),
  {
    name: "editor-store",
    enabled: import.meta.env.DEV,
  })
);
