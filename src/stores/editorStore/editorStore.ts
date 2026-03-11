import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { toast } from "sonner";
import { debounce } from "lodash-es";
import {
  serverDataToTree,
  findFirstMdNode,
  findNodeById,
  fileTreeData2ServerData,
} from "@/stores/editorStore/utils";
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
import { trackEvent } from "@/matomo/trackingMatomoEvent";

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
  /** 当前编辑中的node  */
  currentEditingNode: FileTreeNode | null;
}

interface EditorActions {
  setWorkId: (workId: string) => void;
  setWorkInfo: (
    info: Partial<WorkInfo> | ((prev: WorkInfo) => WorkInfo),
  ) => void;
  setServerData: (data: ServerData) => void;
  /** 更新单个文件内容（对应 Vue updateNodeContentById 的简化） */
  setServerDataFile: (path: string, content: string) => void;
  setTreeData: (treeData: FileTreeNode[]) => void;
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
  setCurrentEditingId: (id: string, node?: FileTreeNode | null) => void;
  /** 初始化编辑器数据：拉取作品详情并写入 workInfo、serverData（对应 Vue initEditorData） */
  initEditorData: (workId: string) => Promise<void>;
  /** 重新拉取并更新 workInfo（对应 Vue updateWorkInfo） */
  updateWorkInfo: () => Promise<void>;
  /** 保存编辑器数据到服务端（对应 Vue saveEditorData） */
  saveEditorData: (
    saveStatus?: EditorSaveStatus,
    _needLocalCache?: boolean,
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
  currentEditingNode: null,
};

let htmlEntityDecoder: HTMLTextAreaElement | null = null;
const decodeHtmlEntities = (text: string): string => {
  if (!text) return "";
  if (typeof document === "undefined") return text;
  if (!htmlEntityDecoder)
    htmlEntityDecoder = document.createElement("textarea");
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

const getDefaultEditorServerData = (): ServerData => ({
  "大纲.md": "",
  "知识库/": "",
  "设定/角色设定.md": "",
  "设定/故事设定.md": "",
  "正文/第一章.md": "",
});

const mapWorkTags = (rawWorkTags: unknown): WorkInfo["workTags"] => {
  if (!Array.isArray(rawWorkTags)) return [];
  return (rawWorkTags as Array<{ tags?: Array<{ id: number; name: string; userId: string }> }>)
    .flatMap((wt) => wt.tags ?? [])
    .map((tag) => ({ id: tag.id, name: tag.name, userId: tag.userId }));
};

const mergeWorkInfoFromReq = (
  current: WorkInfo,
  req: Record<string, unknown>,
): WorkInfo => {
  const nextWorkInfo = { ...current };

  if (req?.id !== undefined && req?.id !== null) {
    nextWorkInfo.workId = String(req.id);
  }
  if (req?.title !== undefined && req?.title !== null) {
    nextWorkInfo.title = String(req.title);
  }
  if (req?.createdTime !== undefined && req?.createdTime !== null) {
    nextWorkInfo.createdTime = String(req.createdTime);
  }
  if (req?.updatedTime !== undefined && req?.updatedTime !== null) {
    nextWorkInfo.updatedTime = String(req.updatedTime);
  }
  if (req?.stage !== undefined && req?.stage !== null) {
    nextWorkInfo.stage = String(req.stage);
  }
  if (req?.introduction !== undefined && req?.introduction !== null) {
    nextWorkInfo.introduction = String(req.introduction);
  }
  if (req?.description !== undefined && req?.description !== null) {
    nextWorkInfo.description = String(req.description);
  }
  if (req?.workTags !== undefined) {
    nextWorkInfo.workTags = mapWorkTags(req.workTags);
  }

  return nextWorkInfo;
};

const isSameWorkTag = (
  a: WorkInfo["workTags"][number],
  b: WorkInfo["workTags"][number],
): boolean =>
  a.id === b.id &&
  a.name === b.name &&
  a.userId === b.userId &&
  a.categoryId === b.categoryId;

const isSameWorkInfo = (a: WorkInfo, b: WorkInfo): boolean => {
  if (
    a.workId !== b.workId ||
    a.title !== b.title ||
    a.introduction !== b.introduction ||
    a.createdTime !== b.createdTime ||
    a.updatedTime !== b.updatedTime ||
    a.description !== b.description ||
    a.stage !== b.stage ||
    a.chapterNum !== b.chapterNum ||
    a.wordNum !== b.wordNum
  ) {
    return false;
  }
  if ((a.tagIds?.length ?? 0) !== (b.tagIds?.length ?? 0)) {
    return false;
  }
  if (
    (a.tagIds?.length ?? 0) > 0 &&
    a.tagIds?.some((id, idx) => id !== b.tagIds?.[idx])
  ) {
    return false;
  }
  if (a.workTags.length !== b.workTags.length) {
    return false;
  }
  for (let i = 0; i < a.workTags.length; i++) {
    if (!isSameWorkTag(a.workTags[i], b.workTags[i])) {
      return false;
    }
  }
  return true;
};

const updateTreeNodeContent = (
  nodes: FileTreeNode[],
  nodeId: string,
  content: string,
): FileTreeNode[] => {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === nodeId) {
      changed = true;
      return { ...node, content };
    }
    if (!node.children?.length) return node;
    const children = updateTreeNodeContent(node.children, nodeId, content);
    if (children === node.children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : nodes;
};

export const useEditorStore = create<EditorState & EditorActions>()(
  devtools(
    (set, get) => {
      const pendingSaveResolves: Array<() => void> = [];
      let latestSaveStatus: EditorSaveStatus = "0";
      let initEditorDataInFlight: Promise<void> | null = null;
      let initEditorDataInFlightWorkId = "";
      let workInfoRefreshInFlight: Promise<void> | null = null;

      const resolvePendingSaves = () => {
        while (pendingSaveResolves.length > 0) {
          const resolve = pendingSaveResolves.shift();
          resolve?.();
        }
      };

      const performSaveEditorData = async (saveStatus: EditorSaveStatus) => {
        const { workId, workInfo, treeData, serverData } = get();
        const targetWorkId = workId || workInfo.workId;
        if (!targetWorkId) {
          console.warn("[editorStore] no workId, skip save");
          return;
        }
        if (!workId && workInfo.workId) {
          set({ workId: workInfo.workId });
        }
        try {
          const saveData: FileTreeNode = {
            id: "root",
            key: "root",
            label: "root",
            content: "",
            isDirectory: true,
            path: [],
            children: treeData,
          };
          const saveParseServerData = fileTreeData2ServerData(saveData);
          // 某些链路（如流式文件更新兜底）可能导致 treeData 尚未完整，
          // 这里以 serverData 兜底，避免错误提交 "{}" 覆盖作品内容。
          const hasTreePayload = Object.keys(saveParseServerData).length > 0;
          const hasServerPayload = Object.keys(serverData ?? {}).length > 0;
          const payloadToSave =
            hasTreePayload || !hasServerPayload ? saveParseServerData : serverData;
          await updateWorkVersionReq(
            targetWorkId,
            JSON.stringify(payloadToSave),
            saveStatus,
          );
          set({
            workInfo: {
              ...workInfo,
              updatedTime: new Date().toISOString(),
            },
          });
          if (saveStatus === "0") {
            trackEvent("Content", "Save", "Draft");
            toast.success("保存成功");
          }
        } catch (e) {
          console.error("[editorStore] saveEditorData failed:", e);
          toast.error("保存失败");
        }
      };

      const debouncedSaveEditorData = debounce(
        async () => {
          await performSaveEditorData(latestSaveStatus);
          resolvePendingSaves();
        },
        300,
        { leading: false, trailing: true },
      );

      return {
        ...initialState,

        setWorkId: (workId) => set({ workId }),

        setWorkInfo: (info) => {
          let prevWorkInfo: WorkInfo | null = null;
          let nextWorkInfo: WorkInfo | null = null;

          set((state) => {
            prevWorkInfo = state.workInfo;
            nextWorkInfo =
              typeof info === "function"
                ? info(state.workInfo)
                : { ...state.workInfo, ...info };
            return { workInfo: nextWorkInfo };
          });

          const { workId, workInfo } = get();
          const targetWorkId = workId || workInfo.workId;
          if (!targetWorkId || !prevWorkInfo || !nextWorkInfo) return;
          if (!workId && workInfo.workId) {
            set({ workId: workInfo.workId });
          }

          updateWorkInfoReq(targetWorkId, workInfo).catch((error) => {
            console.error("[editorStore] setWorkInfo sync failed:", error);
          });
        },

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
            const nextServerData = {
              ...state.serverData,
              [path]: normalizedContent,
            };
            return {
              serverData: nextServerData,
              treeData: updateTreeNodeContent(
                state.treeData,
                path,
                normalizedContent,
              ),
              currentContent:
                path === state.currentEditingId
                  ? normalizedContent
                  : state.currentContent,
            };
          }),

        setTreeData: (treeData) => set({ treeData }),

        setCurrentContent: (content) =>
          set((state) => {
            const normalizedContent = normalizeServerContent(content ?? "");

            const fileKey = state.currentEditingId;
            const editingNode =
              state.currentEditingNode?.id === fileKey
                ? state.currentEditingNode
                : findNodeById(state.treeData, fileKey);
            const shouldSyncFileNode = !!editingNode && !editingNode.isDirectory;

            return {
              currentContent: normalizedContent,
              currentEditingNode: shouldSyncFileNode
                ? {
                    ...editingNode,
                    content: normalizedContent,
                  }
                : editingNode,
              treeData: shouldSyncFileNode
                ? updateTreeNodeContent(state.treeData, fileKey, normalizedContent)
                : state.treeData,
            };
          }),

        setNewNodeIds: (ids) =>
          set({
            newNodeIdMap: Array.from(new Set(ids)).reduce<
              Record<string, boolean>
            >((acc, id) => {
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
              treeData: serverDataToTree({
                ...state.serverData,
                [path]: normalizedContent,
              }),
              currentContent:
                path === state.currentEditingId
                  ? normalizedContent
                  : state.currentContent,
            };
          }),

        deleteServerDataPath: (path) =>
          set((state) => {
            const prefix = path.endsWith("/") ? path : path + "/";
            const next: ServerData = {};
            Object.keys(state.serverData).forEach((k) => {
              if (k !== path && k !== path + "/" && !k.startsWith(prefix))
                next[k] = state.serverData[k];
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
              currentEditingId =
                newPrefix + state.currentEditingId.slice(oldPrefix.length);
            const newNodeIdMap = Object.keys(state.newNodeIdMap).reduce<
              Record<string, boolean>
            >((acc, nodeId) => {
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
            }, {});
            const nextTreeData = serverDataToTree(next);
            return {
              serverData: next,
              treeData: nextTreeData,
              currentEditingId,
              currentEditingNode: findNodeById(nextTreeData, currentEditingId),
              newNodeIdMap,
              currentContent: next[currentEditingId] ?? "",
            };
          }),

        setCurrentEditingId: (id, node) => {
          set((state) => {
            if(id == ''){
              return {
                currentEditingId: '',
                currentEditingNode: null,
                currentContent: '',
              };
            }
            const nextCurrentEditingNode = node ?? findNodeById(state.treeData, id);
            return {
              currentEditingId: id,
              currentEditingNode: nextCurrentEditingNode,
              currentContent: nextCurrentEditingNode?.content ?? "",
            };
          });
        },

        initEditorData: async (workId) => {
          if (
            initEditorDataInFlight &&
            initEditorDataInFlightWorkId === workId
          ) {
            return initEditorDataInFlight;
          }
          initEditorDataInFlightWorkId = workId;
          initEditorDataInFlight = (async () => {
            set({ workId });
            console.log("initEditorData", workId);
            const { useChatStore } = await import("@/stores/chatStore");
            useChatStore.getState().setWorkId(workId);
            try {
              const req = (await getWorksByIdReq(workId)) as Record<
                string,
                unknown
              >;
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
                workInfo.workTags = (
                  req.workTags as Array<{
                    tags?: Array<{ id: number; name: string; userId: string }>;
                  }>
                )
                  .flatMap((wt) => wt.tags ?? [])
                  .map((t) => ({ id: t.id, name: t.name, userId: t.userId }));
              }
              set({ workInfo });

              const latest = req?.latestWorkVersion as
                | { content?: string }
                | undefined;
              let serverData: ServerData = {};
              if (latest?.content && typeof latest.content === "string") {
                try {
                  serverData = JSON.parse(latest.content) as ServerData;
                } catch {
                  serverData = {};
                }
              }
              let normalizedServerData = normalizeServerData(serverData);
              // 新建作品后端可能返回空对象，补默认目录骨架，避免侧边栏 treeData 为空
              if (Object.keys(normalizedServerData).length === 0) {
                normalizedServerData = getDefaultEditorServerData();
              }
              const treeData = serverDataToTree(normalizedServerData);
              set({
                serverData: normalizedServerData,
                treeData,
              });
              set({ newNodeIdMap: {} });
              // 在初始化状态落库后，再基于初始化后的 treeData/currentEditingId 计算目标文件
              const initializedState = get();
              const firstMdNode = findFirstMdNode(
                initializedState.treeData,
                initializedState.currentEditingId,
              );
              const fileKey =
                firstMdNode?.id ??
                initializedState.currentEditingId ??
                DEFAULT_EDITING_FILE_KEY;
              const findNode = findNodeById(initializedState.treeData, fileKey,);
              set({
                currentEditingId: fileKey,
                currentEditingNode: findNode,
                currentContent: findNode?.content || "",
              });
              const sessions = req?.sessions;
              if (Array.isArray(sessions)) {
                useChatStore.getState().setCachedSessions(sessions);
              }
            } catch (e) {
              console.error("[editorStore] initEditorData failed:", e);
              // toast.error("加载作品失败");
            } finally {
              initEditorDataInFlight = null;
              initEditorDataInFlightWorkId = "";
            }
          })();
          return initEditorDataInFlight;
        },
        updateWorkInfo: async () => {
          if (workInfoRefreshInFlight) {
            return workInfoRefreshInFlight;
          }

          const { workId: storeWorkId, workInfo } = get();
          const targetWorkId = workInfo.workId || storeWorkId;
          if (!targetWorkId) return;

          workInfoRefreshInFlight = (async () => {
            try {
              const req = (await getWorksByIdReq(targetWorkId)) as Record<
                string,
                unknown
              >;
              const {
                workId: latestStoreWorkId,
                workInfo: latestWorkInfo,
              } = get();
              const latestTargetWorkId =
                latestWorkInfo.workId || latestStoreWorkId;
              // 请求返回前若已切换作品，丢弃旧请求结果，避免状态回写错位。
              if (latestTargetWorkId !== targetWorkId) return;
              const nextWorkInfo = mergeWorkInfoFromReq(latestWorkInfo, req);
              // 仅同步作品信息，避免变更 store.workId 触发全局依赖链路。
              if (!isSameWorkInfo(latestWorkInfo, nextWorkInfo)) {
                set({ workInfo: nextWorkInfo });
              }
            } catch (e) {
              console.error("[editorStore] updateWorkInfo failed:", e);
            } finally {
              workInfoRefreshInFlight = null;
            }
          })();

          return workInfoRefreshInFlight;
        },
        saveEditorData: (saveStatus = "0", _needLocalCache = true) => {
          void _needLocalCache;
          const { workInfo, setWorkInfo } = get();
          if (workInfo.stage !== "final") {
            setWorkInfo({ stage: "final" });
          }
          latestSaveStatus = saveStatus;
          return new Promise<void>((resolve) => {
            pendingSaveResolves.push(resolve);
            debouncedSaveEditorData();
          });
        },
        initEditorStore: () => set(initialState),
      };
    },
    {
      name: "editor-store",
      enabled: import.meta.env.DEV,
    },
  ),
);
