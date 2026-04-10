import { useRef, useCallback, useEffect, useState, useMemo, useDeferredValue, type WheelEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import clsx from "clsx";
import { useShallow } from "zustand/react/shallow";
import MainEditor, { type MarkdownEditorRef } from "@/components/MainEditor";
import { StepWorkflow, type StepWorkflowRef } from "@/components/StepWorkflow";
import type { Template as StepTemplate } from "@/components/StepWorkflow/types";
import { Iconfont, Iconfont as IconFont } from "@/components/Iconfont";
import {
  EditorTopToolbar,
  EditorTreeSidebar,
  EditorResizeHandle,
  EditChangesPanel,
  type EditorChangeItem,
} from "./components";
import {
  EDITOR_TREE_CANVAS_FILE_MIME,
  getActiveCanvasDragFileId,
} from "./components/EditorTreeSidebar";
import { ProChatContainer, ProChatPanel } from "@/components/ProChatContainer";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { FileMessageDisplay } from "@/components/FileMessageDisplay";
import { SelectedTextDisplay } from "@/components/SelectedTextDisplay";
import { AgentCustomMessageRenderer } from "@/components/AgentCustomMessageRenderer";
import { TodosFixedPanel } from "@/components/TodosFixedPanel/TodosFixedPanel";
import { AssociationSelectorDialog } from "@/components/AssociationSelectorDialog";
import { ChatHeader, type ChatHeaderRef } from "@/components/ChatHeader";
import InsCanvas from "@/components/InsCanvasV2/InsCanvas";
import type { InsCanvasApi } from "@/components/InsCanvasV2/types";
import { Button } from "@/components/ui/Button";
import { useDualTabChat } from "@/hooks/useDualTabChat";
import { useLangGraphStream, type EditFileArgsType } from "@/hooks/useLangGraphStream";
import { resetLLMState, useLLM } from "@/hooks/useLLM";
import useMarkdownEditor, { type HighlightMarkerInfo } from "@/hooks/useMarkdownEditor";
import { clearEditorReloadTarget } from "@/utils/editorNavigationFallback";
import type {
  AgentCustomMessageItem,
  ChatMessage,
  FileItem as FileItemType,
} from "@/stores/chatStore";
import type {
  AgentCustomMessage as DualTabAgentCustomMessage,
  ChatMessage as DualTabChatMessage,
} from "@/types/chat";
import type { ChatTabType } from "@/types/chat";
import { useChatInputStore } from "@/stores/chatInputStore";
import type { ChatInputStore } from "@/stores/chatInputStore";
import {
  getWorksByIdReq,
  getWorksByIdAndVersionReq,
  updateWorkInfoReq,
  generateGuideReq,
  createWorkReq,
  updateWorkVersionReq,
} from "@/api/works";
import { addNote } from "@/api/notes";
import {
  useEditorStore,
  DEFAULT_EDITING_FILE_KEY,
} from "@/stores/editorStore";
import type { FileTreeNode } from "@/stores/editorStore/types";
import { serverDataToTree } from "@/stores/editorStore/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/Slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { CircleAlert } from "lucide-react";
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";
import {
  findSearchMatches,
  findTreeNodeRecursive,
  filterAssociationIds,
  parseGuidesPayload,
  resolveFileNodeByPath,
  sanitizeIncomingFilePath,
  type TreeNodeLike,
} from "./utils";

/** 根据当前文件路径和新的 label 生成新路径，如 "正文/第一章.md" + "第二章" => "正文/第二章.md" */
const getNewPathFromLabel = (currentPath: string, newLabel: string): string => {
  const parts = currentPath.split("/").filter(Boolean);
  if (parts.length === 0) return newLabel;
  const last = parts[parts.length - 1] ?? "";
  const ext = last.includes(".") ? last.replace(/^.*\./, ".") : "";
  const parentPrefix = parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
  const labelWithExt = newLabel.includes(".") ? newLabel : newLabel + ext;
  return parentPrefix + labelWithExt;
};

const REM_BASE = 16;
const pxToRem = (px: number) => px / REM_BASE;
const getRootRemPx = () => {
  if (typeof document === "undefined") return REM_BASE;
  const v = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(v) && v > 0 ? v : REM_BASE;
};

const LEFT_MIN_REM = pxToRem(200);
const LEFT_MAX_REM = pxToRem(500);
const LEFT_DEFAULT_REM = pxToRem(280);

const RIGHT_DEFAULT_REM = 32.5;
const RIGHT_MIN_REM = pxToRem(280);
/** 中间主编辑区最小宽度（按需求允许被挤压到 0） */
const CENTER_EDITOR_MIN_REM = 0;
/** 中间区域内「修改详情」面板固定宽度（rem） */
const CHANGES_PANEL_WIDTH_REM = 20;
/** 两侧把手总宽度 (10px * 2)，用于右拖时计算右栏上限 */
const HANDLES_WIDTH_REM = pxToRem(20);
/** 三栏容器水平 padding (px-2.5 左右各 10px)，计算右栏上限时需扣除避免溢出 */
const CONTAINER_PADDING_PX = 20;

const EDITOR_PLACEHOLDER = `请输入内容或在右侧对话区指导AI创作...
tips:
·AI创作时将锁定该区域，读取最新内容创作。
·选中部分内容，可使用AI划词进行局部修改。`;

const EDITOR_SETTINGS_STYLE_ID = "react-editor-custom-styles";
const EDITOR_SETTINGS_STORAGE_KEY = "editorSettings";

type EditorSettings = {
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  margin: number;
  textIndentEnabled: boolean;
};

type WorkVersion = {
  versionId: string;
  isAutoSaved?: string;
  updatedTime?: string;
};

type EditorBizType = "short-story" | "short-play";
type SubmitMode = "chat" | "agent";
type ChatType = "script";

type EditorInitialParams = {
  message?: string;
  autoSubmitInitialMessage?: boolean;
  isAnswerOnly?: boolean;
  modelLLM?: string;
  selectedWritingStyle?: string;
  template?: StepTemplate | string;
  associationTags?: string[];
  selectedNotes?: import("@/api/notes").Note[];
  selectedFiles?: FileItemType[];
  selectedTexts?: import("@/stores/chatStore").SelectedText[];
  selectedTools?: import("@/stores/chatInputStore/types").AgentTalkToolValue[];
  isShowAnswerTip?: boolean;
  editorBizType?: EditorBizType;
};

const EDITOR_INITIAL_PARAMS_KEY = "editorInitialParams";
const RANKING_LIST_TRANSMISSION_KEY = "rankingListTransmission";
const EDITOR_BIZ_TYPE_CACHE_KEY_PREFIX = "editorBizTypeByWorkId:";

type RankingListTransmissionParams = {
  content?: string;
  message?: string;
  disableAutoSubmit?: boolean;
};

const normalizeEditorBizType = (value: unknown): EditorBizType =>
  value === "short-play" ? "short-play" : "short-story";

const parseStepTemplate = (input: EditorInitialParams["template"]): StepTemplate | null => {
  if (!input) return null;
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Partial<StepTemplate>;
  if (!record.title || !record.description) return null;

  return {
    id: String(record.id ?? ""),
    title: String(record.title),
    description: String(record.description),
    tags: Array.isArray(record.tags)
      ? record.tags.map((tag) => ({
        id: String((tag as { id?: string | number }).id ?? ""),
        name: String((tag as { name?: string }).name ?? ""),
        category: String((tag as { category?: string }).category ?? ""),
      }))
      : [],
    usageCount:
      typeof record.usageCount === "number"
        ? record.usageCount
        : Number(record.usageCount ?? 0) || 0,
  };
};

type EditorFileChangeItem = EditorChangeItem & {
  markerInfo?: HighlightMarkerInfo;
};
type FileChangesMap = Record<string, EditorFileChangeItem[]>;

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 22,
  lineHeight: 1.3,
  fontWeight: 400,
  margin: 40,
  textIndentEnabled: false,
};

let htmlEntityDecoder: HTMLTextAreaElement | null = null;
const decodeHtmlEntities = (text: string): string => {
  if (!text) return "";
  if (typeof document === "undefined") return text;
  if (!htmlEntityDecoder) htmlEntityDecoder = document.createElement("textarea");
  htmlEntityDecoder.innerHTML = text;
  return htmlEntityDecoder.value;
};

const getWordCount = (text: string): number => {
  if (!text || typeof text !== "string") return 0;
  const normalized = decodeHtmlEntities(text)
    .replace(/<[^>]*>/g, "")
    .replace(/\u00A0/g, " ");
  return normalized.replace(/\s/g, "").length;
};

const isEditorContentEffectivelyEmpty = (text: string): boolean => {
  if (!text || typeof text !== "string") return true;
  const compact = decodeHtmlEntities(text)
    // markdown 常见结构符号
    .replace(/```/g, "")
    .replace(/`/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^(\s{0,3}(?:[-*+]|\d+\.)\s+)/gm, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    // 零宽字符
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "");
  return compact.length === 0;
};

const WHITESPACE_RE = /\s/;

const toWhitespaceInsensitive = (input: string) => {
  const compactChars: string[] = [];
  const indexMap: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? "";
    if (WHITESPACE_RE.test(ch)) continue;
    compactChars.push(ch);
    indexMap.push(i);
  }
  return {
    compact: compactChars.join(""),
    indexMap,
  };
};

const findRangeIgnoringWhitespace = (source: string, target: string) => {
  const sourcePacked = toWhitespaceInsensitive(source);
  const targetPacked = toWhitespaceInsensitive(target);
  if (!targetPacked.compact) return null;
  const packedStart = sourcePacked.compact.indexOf(targetPacked.compact);
  if (packedStart < 0) return null;
  const packedEnd = packedStart + targetPacked.compact.length - 1;
  const start = sourcePacked.indexMap[packedStart];
  const end = sourcePacked.indexMap[packedEnd];
  if (start === undefined || end === undefined) return null;
  return { start, endExclusive: end + 1 };
};

const normalizeFilePath = (value: string) =>
  (value || "").replace(/^\.?\//, "").trim();

const shouldIgnoreServerWritePath = (value: string) => {
  const normalized = sanitizeIncomingFilePath(value);
  return /(^|\/)BaoWenAgent(\/|$)/.test(normalized);
};

const ensureCanvasTreeSkeleton = (files: Record<string, string>): Record<string, string> => {
  const normalized: Record<string, string> = { ...files };
  const hasMainDir = Object.keys(normalized).some(
    (k) => k === "正文/" || k.startsWith("正文/"),
  );
  const hasKnowledgeDir = Object.keys(normalized).some(
    (k) => k === "知识库/" || k.startsWith("知识库/"),
  );
  if (!hasMainDir) {
    normalized["正文/"] = "";
  }
  if (!hasKnowledgeDir) {
    normalized["知识库/"] = "";
  }
  const hasMainMd = Object.keys(normalized).some(
    (k) => k.startsWith("正文/") && k.endsWith(".md"),
  );
  if (!hasMainMd) {
    normalized[DEFAULT_EDITING_FILE_KEY] = normalized[DEFAULT_EDITING_FILE_KEY] ?? "";
  }
  return normalized;
};

/** 画布 tab 下与 ChatHeader tab 同一排的操作按钮，由 InsCanvas 通过 ref 提供 API */
function CanvasToolbar({
                         api,
                         autoSyncDirectory,
                         onAutoSyncDirectoryChange,
                       }: {
  api: InsCanvasApi | null
  autoSyncDirectory: boolean
  onAutoSyncDirectoryChange: (checked: boolean) => void
}) {
  if (!api) return null;
  const canSaveCanvas = !!api.inspirationDrawId;
  const addCanvasTitle = api.isLoading ? "生成选题中，请稍候" : "新增画布";
  const saveCanvasTitle = canSaveCanvas ? "保存画布" : "请先创建画布";
  return (
    <div className="flex h-10 items-center gap-1 px-1.5">
      {/* <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={api.isLoading}
        onClick={api.addNewCanvas}
        title={addCanvasTitle}
        aria-label="新增画布"
      >
        <span className="iconfont text-xs!">&#xe625;</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={api.openHistory}
        title="历史版本"
        aria-label="历史版本"
      >
        <span className="iconfont icon-BtnChatHistory" aria-hidden/>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canSaveCanvas}
        onClick={() => void api.saveCanvas()}
        title={saveCanvasTitle}
        aria-label="保存画布"
      >
        <span className="iconfont">&#xe936;</span>
      </Button> */}
      <div className="flex items-center gap-1">
        <Switch
          checked={autoSyncDirectory}
          onCheckedChange={onAutoSyncDirectoryChange}
          className="h-4 w-6 cursor-pointer"
          thumbClassName="size-2 data-[state=checked]:translate-x-3"
          title={"自动同步目录"}
        />
        <span className="text-xs text-[#6b7280]">自动同步目录</span>
      </div>
    </div>
  );
}

const MarkdownEditorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workId } = useParams<{ workId: string }>();
  const stateEditorBizType = (location.state as EditorInitialParams | null)?.editorBizType;
  const hasExplicitStateEditorBizType =
    stateEditorBizType === "short-story" || stateEditorBizType === "short-play";
  const [cachedEditorBizType, setCachedEditorBizType] = useState<EditorBizType>("short-story");
  useEffect(() => {
    if (!workId || typeof window === "undefined") return;
    if (hasExplicitStateEditorBizType) {
      const normalizedFromState = normalizeEditorBizType(stateEditorBizType);
      setCachedEditorBizType(normalizedFromState);
      sessionStorage.setItem(
        `${EDITOR_BIZ_TYPE_CACHE_KEY_PREFIX}${workId}`,
        normalizedFromState
      );
      return;
    }
    const cached = sessionStorage.getItem(`${EDITOR_BIZ_TYPE_CACHE_KEY_PREFIX}${workId}`);
    if (!cached) return;
    setCachedEditorBizType(normalizeEditorBizType(cached));
  }, [hasExplicitStateEditorBizType, stateEditorBizType, workId]);
  const editorBizType = hasExplicitStateEditorBizType
    ? normalizeEditorBizType(stateEditorBizType)
    : cachedEditorBizType;
  const isShortPlayEditor = editorBizType === "short-play";
  const showStepWorkflow = !isShortPlayEditor;
  const stepWorkflowRef = useRef<StepWorkflowRef>(null);
  const [pendingStepTemplate, setPendingStepTemplate] = useState<StepTemplate | null>(null);
  // chatheader 相关
  const [
    activeTab,
    setActiveTab,
  ] = useState<"chat" | "faq" | "canvas">("chat");
  const {
    currentWorkId,
    chatCurrentSession,
    faqCurrentSession,
    chatMessages,
    faqMessages,
    setWorkId,
    createNewSession,
    loadSession,
    loadLatestSession,
    saveCurrentSession,
    addMessage: addMessageToDualTab,
    updateLastChatMessage,
  } = useDualTabChat();
  const currentSessionId =
    activeTab === "chat"
      ? chatCurrentSession?.id ?? ""
      : activeTab === "faq"
        ? faqCurrentSession?.id ?? ""
        : chatCurrentSession?.id ?? "";

  const { modelLLM, selectedWritingStyle, setModelLLM, setSelectedWritingStyle } = useLLM();
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const streamingMessageIdRef = useRef<string>("");
  const stoppedByUserRef = useRef(false);
  const latestChatSessionIdRef = useRef("");
  const hiltApproveInFlightRef = useRef(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [isHiltApproveStreaming, setIsHiltApproveStreaming] = useState(false);
  const [todosExpanded, setTodosExpanded] = useState(false);
  const {
    findTextInMarkdown,
    insertHighlightMarkers,
    removeHighlightMarkersAt,
    removeAllHighlightMarkers,
    replaceContentAndRemoveMarkers,
    removeHtmlTags,
  } = useMarkdownEditor();
  const relabelPendingChanges = useCallback(
    (rawContent: string, pendingItems: EditorFileChangeItem[]) => {
      let contentWithMarkers = removeAllHighlightMarkers(rawContent ?? "");
      const insertedMarkers: HighlightMarkerInfo[] = [];
      const relabeledPending = pendingItems.map((item) => {
        const nextItem: EditorFileChangeItem = {
          ...item,
          markerInfo: undefined,
          markerTarget: undefined,
        };
        const candidateTexts: Array<{ text: string; target: "new" | "old" }> = [
          { text: item.newString ?? "", target: "new" },
          { text: item.oldString ?? "", target: "old" },
        ];
        let applied = false;
        for (const candidate of candidateTexts) {
          if (!candidate.text) continue;
          const targetIndex = findTextInMarkdown(contentWithMarkers, candidate.text, insertedMarkers);
          if (targetIndex === -1) continue;
          const insertResult = insertHighlightMarkers(contentWithMarkers, candidate.text, targetIndex);
          if (!insertResult) continue;
          contentWithMarkers = insertResult.newContent;
          insertedMarkers.push(insertResult.markerInfo);
          nextItem.markerInfo = insertResult.markerInfo;
          nextItem.markerTarget = candidate.target;
          applied = true;
          break;
        }
        if (!applied) {
          nextItem.markerInfo = undefined;
          nextItem.markerTarget = undefined;
        }
        return nextItem;
      });
      return { contentWithMarkers, relabeledPending };
    },
    [findTextInMarkdown, insertHighlightMarkers, removeAllHighlightMarkers]
  );

  const langGraphStream = useLangGraphStream({
    onMessagesUpdate: (messages, isSuggestions) => {
      const hasStreamingMessage = !!(streamingMessageRef.current || streamingMessageIdRef.current);
      if (isSuggestions && !hasStreamingMessage) {
        updateLastChatMessage((prev) => ({
          ...prev,
          customMessage: messages,
        }));
        return;
      }
      setStreamingMessage((prev) => {
        const base = prev ?? streamingMessageRef.current;
        if (!base) return prev;
        const id = base.id || streamingMessageIdRef.current;
        if (!id) return prev;
        const msg: ChatMessage = {
          id,
          role: "assistant",
          content: "",
          createdAt: base.createdAt ?? new Date(),
          messageType: "normal",
          mode: "chat",
          customMessage: messages,
        };
        streamingMessageRef.current = msg;
        return msg;
      });
    },
    onUpdateFiles: (files, fileId, editInfoList) => {
      const currentServerData = useEditorStore.getState().serverData;
      // 兼容后端返回的 "/path"、"./path"、"path?x=1" 等格式，避免 mergedFiles key 与 targetFileId 不一致导致正文写入空串
      const normalizedIncomingFiles = Object.entries((files ?? {}) as Record<string, string>).reduce<
        Record<string, string>
      >((acc, [rawKey, value]) => {
        const key = sanitizeIncomingFilePath(String(rawKey ?? ""));
        if (!key || shouldIgnoreServerWritePath(key)) return acc;
        acc[key] = String(value ?? "");
        return acc;
      }, {});

      let targetFileId = sanitizeIncomingFilePath(fileId || "");
      if (targetFileId && shouldIgnoreServerWritePath(targetFileId)) {
        targetFileId = "";
      }
      if (!targetFileId && currentEditingId && files[currentEditingId] !== undefined) {
        targetFileId = currentEditingId;
      }
      if (!targetFileId && Array.isArray(editInfoList) && editInfoList.length > 0) {
        const fromEditInfo = editInfoList.find(
          (item) => item?.file_path && !shouldIgnoreServerWritePath(item.file_path),
        )?.file_path;
        if (fromEditInfo) {
          targetFileId = sanitizeIncomingFilePath(fromEditInfo);
        }
      }

      // 与 Vue 链路对齐：当流式 payload 同时给出 files 且能解析出目标 fileId 时，
      // 自动请求定位该文件（树未刷新时先放入 pending，待 treeData 更新后再落地跳转）。
      const hasResolvedTargetInFiles =
        !!targetFileId &&
        Object.prototype.hasOwnProperty.call(normalizedIncomingFiles, targetFileId);
      if (hasResolvedTargetInFiles) {
        pendingFileNameClickRef.current = targetFileId;
      }

      const hasOldPendingEdits =
        !!targetFileId &&
        (fileChangesMap[targetFileId] ?? []).some((item) => item.status === "pending");

      // edit_file 场景：先保留旧正文用于高亮与人工确认，避免后端 files 直接覆盖 oldString。
      // 只有在点击“接受”后，才通过 handleAcceptChange 真正替换文本。
      const pendingEditPaths = new Set<string>();
      if (Array.isArray(editInfoList)) {
        editInfoList.forEach((item) => {
          if (item?.file_path && !shouldIgnoreServerWritePath(item.file_path)) {
            pendingEditPaths.add(normalizeFilePath(item.file_path));
          }
        });
      }
      // 与 Vue 行为对齐：即使本次没有新的 editInfoList，只要该文件仍有 pending，
      // 也不能让后端 files 直接覆盖，避免 old_string 先被替换导致无法确认与高亮。
      if (hasOldPendingEdits && targetFileId) {
        pendingEditPaths.add(targetFileId);
      }

      const safeIncomingFiles = { ...normalizedIncomingFiles };
      if (pendingEditPaths.size > 0) {
        pendingEditPaths.forEach((path) => {
          if (path in safeIncomingFiles) {
            delete safeIncomingFiles[path];
          }
        });
      }

      const mergedFiles = { ...currentServerData, ...safeIncomingFiles };
      setServerData(mergedFiles);

      if (targetFileId && !pendingEditPaths.has(targetFileId)) {
        setServerDataFile(targetFileId, mergedFiles[targetFileId] ?? "");
      }

      // 流式生成/更新文件时：对“本次新增的文件 key”打 new 标识（而不是只标 targetFileId）
      // 注意：setNewNodeIds 是覆盖式的，所以这里做增量合并，保留旧 new。
      const addedIds = Object.keys(safeIncomingFiles)
        .map((k) => normalizeFilePath(k))
        .filter(Boolean)
        .filter((id) => !(id in currentServerData))
        .filter((id) => !id.endsWith("/"));
      if (addedIds.length > 0) {
        const { newNodeIdMap, setNewNodeIds } = useEditorStore.getState();
        const mergedNewIds = Array.from(new Set([...Object.keys(newNodeIdMap ?? {}), ...addedIds]));
        setNewNodeIds(mergedNewIds);
      }
      if (Array.isArray(editInfoList) && editInfoList.length > 0) {
        const grouped = editInfoList.reduce<Record<string, EditFileArgsType[]>>((acc, item) => {
          const path = normalizeFilePath(item.file_path ?? "");
          if (!path) return acc;
          if (shouldIgnoreServerWritePath(path)) return acc;
          if (targetFileId && path !== targetFileId) return acc;
          if (!acc[path]) acc[path] = [];
          acc[path].push(item);
          return acc;
        }, {});
        const pendingMarkedContents: Record<string, string> = {};
        const nextFileChangesMap: FileChangesMap = { ...fileChangesMap };
        Object.keys(grouped).forEach((path) => {
          const existing = nextFileChangesMap[path] ?? [];
          const appended: EditorFileChangeItem[] = grouped[path].map((item, idx) => ({
            index: Date.now() + idx + Math.floor(Math.random() * 1000),
            oldString: item.old_string ?? "",
            newString: item.new_string ?? "",
            status: "pending",
          }));
          // 去重：避免流式多次返回同一条 edit_file 造成重复待确认项
          const dedup = [...existing];
          appended.forEach((candidate) => {
            const exists = dedup.some(
              (x) =>
                x.status === "pending" &&
                x.oldString === candidate.oldString &&
                x.newString === candidate.newString,
            );
            if (!exists) dedup.push(candidate);
          });
          const pendingItems = dedup.filter((item) => item.status === "pending");
          const nonPendingItems = dedup
            .filter((item) => item.status !== "pending")
            .map((item) => ({ ...item, markerInfo: undefined }));
          const baseContent = mergedFiles[path] ?? currentServerData[path] ?? "";
          const { contentWithMarkers, relabeledPending } = relabelPendingChanges(
            baseContent,
            pendingItems
          );
          pendingMarkedContents[path] = contentWithMarkers;
          nextFileChangesMap[path] = [...nonPendingItems, ...relabeledPending];
        });
        setFileChangesMap(nextFileChangesMap);
        Object.keys(pendingMarkedContents).forEach((path) => {
          setServerDataFile(path, pendingMarkedContents[path] ?? "");
        });
      }
    },
    onComplete: async () => {
      setIsHiltApproveStreaming(false);
      hiltApproveInFlightRef.current = false;
      const finalized = streamingMessageRef.current;
      if (finalized) {
        const suffix = "(内容由AI生成，仅供参考)";
        const withSuffix = { ...finalized };
        if (withSuffix.content) {
          withSuffix.content = (withSuffix.content || "").trimEnd() + suffix;
        } else if (
          Array.isArray(withSuffix.customMessage) &&
          withSuffix.customMessage.length > 0
        ) {
          const last = withSuffix.customMessage[withSuffix.customMessage.length - 1];
          if (last?.content) {
            withSuffix.customMessage = [...withSuffix.customMessage];
            (withSuffix.customMessage[withSuffix.customMessage.length - 1] as { content?: string }).content =
              (last.content || "").trimEnd() + suffix;
          }
        }
        addMessageToDualTab("chat", withSuffix as DualTabChatMessage);
      }
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    },
    onSensitiveWord: () => {
      setIsHiltApproveStreaming(false);
      hiltApproveInFlightRef.current = false;
      // 与 Vue 对齐：命中敏感词时只保留用户最后一条消息，并追加一条本地模拟回复
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";

      updateLastChatMessage((prev) => ({
        ...prev,
        hasSensitiveWord: true,
      }));

      // const simulatedAssistant: DualTabChatMessage = {
      //   id: `assistant_sensitive_${Date.now()}`,
      //   role: "assistant",
      //   content: "我无法回答你的这个问题，可以尝试下其他话题哦",
      //   createdAt: new Date(),
      //   messageType: "normal",
      //   mode: "chat",
      // };
      // addMessageToDualTab("chat", simulatedAssistant);
      toast.warning("内容包含敏感词，请尝试其他话题");
    },
    onError: (err, needSendErrorMsg) => {
      setIsHiltApproveStreaming(false);
      hiltApproveInFlightRef.current = false;
      if (stoppedByUserRef.current) {
        stoppedByUserRef.current = false;
        return;
      }
      if (needSendErrorMsg) toast.error(err.message);
      const simulatedAssistant: DualTabChatMessage = {
        id: `assistant_sensitive_${Date.now()}`,
        role: "assistant",
        content: "我无法回答你的这个问题，可以尝试下其他话题哦",
        createdAt: new Date(),
        messageType: "normal",
        mode: "chat",
      };
      addMessageToDualTab("chat", simulatedAssistant);
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    },
  });
  const finalizeStreamingMessageWithSuffix = useCallback(
    (suffix: string) => {
      const finalized = streamingMessageRef.current;
      if (!finalized) return;
      const withSuffix = { ...finalized };
      if (withSuffix.content) {
        withSuffix.content = (withSuffix.content || "").trimEnd() + suffix;
      } else if (
        Array.isArray(withSuffix.customMessage) &&
        withSuffix.customMessage.length > 0
      ) {
        const last = withSuffix.customMessage[withSuffix.customMessage.length - 1];
        withSuffix.customMessage = [...withSuffix.customMessage];
        (withSuffix.customMessage[withSuffix.customMessage.length - 1] as { content?: string }).content =
          (last?.content || "").trimEnd() ? (last?.content || "").trimEnd() + suffix : suffix;
      } else {
        withSuffix.content = suffix;
      }
      addMessageToDualTab("chat", withSuffix as DualTabChatMessage);
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    },
    [addMessageToDualTab]
  );

  const handleStopStreaming = useCallback((needAIMessage = true, needGuideRequest = true) => {
    stoppedByUserRef.current = true;
    setIsHiltApproveStreaming(false);
    hiltApproveInFlightRef.current = false;
    if (needAIMessage) {
      finalizeStreamingMessageWithSuffix("\n\n智能体已暂停");
    } else {
      setStreamingMessage(null);
      streamingMessageRef.current = null;
      streamingMessageIdRef.current = "";
    }
    langGraphStream.stop();
    if (needGuideRequest && workId) {
      const sessionId = latestChatSessionIdRef.current || chatCurrentSession?.id || "";
      if (sessionId) {
        // 与 Vue stop 链路对齐：停止后单独拉 guide，并直接绑定到最后一条消息，
        // 避免依赖 hook 内部 messagesRef 在 stop 场景下为空导致“接口调用成功但不展示”。
        void (async () => {
          try {
            const res = await generateGuideReq(sessionId, Number(workId)) as {
              guides?: string[] | string
            } | undefined;
            const guides = parseGuidesPayload(res?.guides);
            if (guides.length === 0) return;
            updateLastChatMessage((prev) => {
              const custom = Array.isArray(prev.customMessage) ? [...prev.customMessage] : [];
              if (custom.length > 0) {
                const lastIdx = custom.length - 1;
                custom[lastIdx] = {
                  ...custom[lastIdx],
                  suggestions: guides,
                };
                return {
                  ...prev,
                  customMessage: custom,
                };
              }
              const suggestionCarrier: DualTabAgentCustomMessage = {
                id: `stop_guide_${Date.now()}`,
                type: "ai",
                content: prev.content || "智能体已暂停",
                resultType: "input",
                additional_kwargs: {},
                response_metadata: { finish_reason: "", model_name: "", service_tier: "" },
                name: null,
                example: false,
                tool_calls: [],
                invalid_tool_calls: [],
                usage_metadata: null,
                suggestions: guides,
              };
              return {
                ...prev,
                customMessage: [suggestionCarrier],
              };
            });
          } catch (_) {
            // guide 获取失败不打断 stop 主流程
          }
        })();
      }
    }
  }, [chatCurrentSession?.id, finalizeStreamingMessageWithSuffix, langGraphStream, updateLastChatMessage, workId]);

  const chatInputStatus = useMemo((): "ready" | "error" | "submitted" | "streaming" => {
    if (langGraphStream.error) return "error";
    if (langGraphStream.isStreaming || isHiltApproveStreaming) return "streaming";
    return "ready";
  }, [isHiltApproveStreaming, langGraphStream.error, langGraphStream.isStreaming]);
  // 与 tree/workInfo 同理：稳定回调里通过 ref 读取实时状态
  const chatInputStatusRef = useRef(chatInputStatus);
  useEffect(() => {
    chatInputStatusRef.current = chatInputStatus;
  }, [chatInputStatus]);
  const isStreamingOverlayVisible = chatInputStatus === "streaming";
  const {
    associationTags,
    selectedNotes,
    selectedFiles,
    selectedTexts,
    selectedTools,
    addSelectedText,
    clearAssociationTags,
    clearSelectedNotes,
    clearSelectedFiles,
    clearSelectedTexts,
    resetSelectedTools,
    setShowAnswerTip,
    setShowWritingStyleTip,
    initializeChatInputFromParams,
    setAssociationTags,
  } = useChatInputStore(useShallow((s: ChatInputStore) => ({
      associationTags: s.associationTags,
      selectedNotes: s.selectedNotes,
      selectedFiles: s.selectedFiles,
      selectedTexts: s.selectedTexts,
      selectedTools: s.selectedTools,
      addSelectedText: s.addSelectedText,
      clearAssociationTags: s.clearAssociationTags,
      clearSelectedNotes: s.clearSelectedNotes,
      clearSelectedFiles: s.clearSelectedFiles,
      clearSelectedTexts: s.clearSelectedTexts,
      resetSelectedTools: s.resetSelectedTools,
      setShowAnswerTip: s.setShowAnswerTip,
      setShowWritingStyleTip: s.setShowWritingStyleTip,
      initializeChatInputFromParams: s.initializeFromParams,
      setAssociationTags: s.setAssociationTags,
    })));
  const [pendingInitialMessage, setPendingInitialMessage] = useState("");
  const [shouldAutoSubmitInitialMessage, setShouldAutoSubmitInitialMessage] = useState(false);
  const [isAnswerOnly, setIsAnswerOnly] = useState(true);
  const { confirm, confirmDialog } = useConfirmDialog();
  const lastInitialAutoSendKeyRef = useRef<string>("");
  const initialParamsApplyKeyRef = useRef<string>("");

  const handleMessageFileClick = useCallback((file: FileItemType) => {
    const fileUrl = file.displayUrl || file.putFilePath;
    if (!fileUrl) {
      toast.error("文件地址不存在，暂无法下载");
      return;
    }

    const link = document.createElement("a");
    link.href = fileUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = file.originalName || file.serverFileName || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const sendChatText = useCallback(
    async (
      text: string,
      options?: {
        reload?: boolean;
        command?: string;
        addUserMessage?: boolean;
        submitMode?: SubmitMode;
        chatType?: ChatType;
        commandOnly?: boolean;
      }
    ) => {
      const message = text.trim();
      if (!message && !options?.command) return;
      let sessionId = chatCurrentSession?.id || latestChatSessionIdRef.current || "";
      if (!sessionId) {
        const session = createNewSession("chat");
        sessionId = session.id;
      }
      latestChatSessionIdRef.current = sessionId;

      if (options?.addUserMessage !== false) {
        const userMessage: ChatMessage = {
          id: `user_${Date.now()}`,
          role: "user",
          content: message,
          createdAt: new Date(),
          messageType: "normal",
          mode: "chat",
          files: selectedFiles.length > 0 ? [...selectedFiles] : undefined,
          selectedTexts: selectedTexts.length > 0 ? [...selectedTexts] : undefined,
        };
        addMessageToDualTab("chat", userMessage as DualTabChatMessage);
        // 保存走非阻塞，避免阻塞流式请求首包。
        // 失败不打断发送链路，只记录日志便于排查。
        if (workId) {
          void useEditorStore.getState().saveEditorData("2").catch((err) => {
            console.error("saveEditorData before stream failed:", err);
          });
        }
      }

      if (workId && sessionId) {
        const shouldRenderStreamingAssistant = options?.commandOnly !== true;
        if (shouldRenderStreamingAssistant) {
          const placeholderId = `assistant_${Date.now()}`;
          streamingMessageIdRef.current = placeholderId;
          const placeholder: ChatMessage = {
            id: placeholderId,
            role: "assistant",
            content: "",
            createdAt: new Date(),
            messageType: "normal",
            mode: "chat",
            customMessage: [],
          };
          streamingMessageRef.current = placeholder;
          setStreamingMessage(placeholder);
        }
        const attachments =
          selectedFiles.length > 0
            ? selectedFiles.map((file) => ({
              name: file.serverFileName,
              remoteAddress: file.putFilePath,
            }))
            : undefined;
        const submitMode =
          options?.submitMode ?? (isAnswerOnly ? "chat" : "agent");
        const chatType = options?.chatType ?? (isShortPlayEditor ? "script" : undefined);
        langGraphStream.submit(
          message,
          sessionId,
          workId,
          submitMode,
          chatType,
          selectedTools,
          attachments,
          options?.reload,
          options?.command,
          modelLLM,
          selectedWritingStyle,
          options?.commandOnly
        );
        if (shouldRenderStreamingAssistant) {
          // 请求发出后清空当前已选引用内容，避免继续展示在输入区
          clearSelectedNotes();
          clearSelectedFiles();
        }
      }
    },
    [
      addMessageToDualTab,
      chatCurrentSession,
      createNewSession,
      isAnswerOnly,
      isShortPlayEditor,
      langGraphStream,
      modelLLM,
      clearSelectedFiles,
      clearSelectedNotes,
      selectedWritingStyle,
      selectedFiles,
      selectedTexts,
      selectedTools,
      workId,
    ]
  );

  const chatHeaderRef = useRef<ChatHeaderRef>(null);
  const markdownEditorRef = useRef<MarkdownEditorRef | null>(null);
  const editorMainScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingFileNameClickRef = useRef<string>("");
  const pendingCanvasFocusFilePathRef = useRef<string>("");

  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const [activeChangeIndex, setActiveChangeIndex] = useState<number | null>(null);
  const [changesPanelHeight, setChangesPanelHeight] = useState(0);
  const [isEditorActuallyEmpty, setIsEditorActuallyEmpty] = useState(true);
  const insCanvasRef = useRef<InsCanvasApi | null>(null);
  const [isCanvasFileDragOver, setIsCanvasFileDragOver] = useState(false);
  const [canvasReadyKey, setCanvasReadyKey] = useState(0);
  const [canvasFocusRequestSeq, setCanvasFocusRequestSeq] = useState(0);
  const [isCanvasSnapshotPending, setIsCanvasSnapshotPending] = useState(false);
  const [canvasInitialNodes, setCanvasInitialNodes] = useState<unknown[]>([]);
  const [canvasInitialEdges, setCanvasInitialEdges] = useState<unknown[]>([]);
  const [canvasInitialInspirationDrawId, setCanvasInitialInspirationDrawId] = useState("");
  const [canvasInitialSnapshotKey, setCanvasInitialSnapshotKey] = useState(0);
  const canvasSnapshotLoadingRef = useRef(false);
  const canvasSnapshotRequestSeqRef = useRef(0);
  const canvasLeaveFlushPromiseRef = useRef<Promise<void> | null>(null);
  const onCanvasReady = useCallback(() => setCanvasReadyKey((k) => k + 1), []);

  // editor 相关 - 使用 useShallow 优化订阅，避免不必要的重渲染
  const {
    workInfo,
    serverData,
    currentContent,
    currentEditingId,
    currentEditingNode,
    treeData,
    initEditorData,
    saveEditorData,
    setServerData,
    setServerDataFile,
    addServerDataPath,
    setCurrentContent,
    setWorkInfo,
    renameServerDataPath,
    initEditorStore,
  } = useEditorStore(
    useShallow((s) => ({
      workInfo: s.workInfo,
      serverData: s.serverData,
      currentContent: s.currentContent,
      currentEditingId: s.currentEditingId,
      currentEditingNode: s.currentEditingNode,
      treeData: s.treeData,
      initEditorData: s.initEditorData,
      saveEditorData: s.saveEditorData,
      setServerData: s.setServerData,
      setServerDataFile: s.setServerDataFile,
      addServerDataPath: s.addServerDataPath,
      setCurrentContent: s.setCurrentContent,
      setWorkInfo: s.setWorkInfo,
      renameServerDataPath: s.renameServerDataPath,
      initEditorStore: s.initEditorStore,
    }))
  );

  const [leftPanelWidthRem, setLeftPanelWidthRem] = useState(LEFT_DEFAULT_REM);
  const dragStartLeftRem = useRef(LEFT_DEFAULT_REM);
  const [rightPanelWidthRem, setRightPanelWidthRem] = useState(RIGHT_DEFAULT_REM);
  const preCanvasRightWidthRemRef = useRef<number | null>(null);
  const dragStartRightRem = useRef(RIGHT_DEFAULT_REM);
  const dragStartRightPx = useRef(RIGHT_DEFAULT_REM * REM_BASE);
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const [showAssociationSelector, setShowAssociationSelector] = useState(false);
  const [relationViewMode, setRelationViewMode] = useState<"edit" | "preview">("edit");
  const [isCanvasFilePreviewMode, setIsCanvasFilePreviewMode] = useState(false);
  const [isCanvasPreviewEditorClosed, setIsCanvasPreviewEditorClosed] = useState(false);
  const [showSearchReplaceDialog, setShowSearchReplaceDialog] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showTimeMachineDialog, setShowTimeMachineDialog] = useState(false);
  const [workVersionList, setWorkVersionList] = useState<WorkVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string>("");
  const [isChangesPanelVisible, setIsChangesPanelVisible] = useState(false);
  const [autoSyncCanvasDirectory, setAutoSyncCanvasDirectory] = useState(true);
  const centerRequiredRem = CENTER_EDITOR_MIN_REM + (isChangesPanelVisible ? CHANGES_PANEL_WIDTH_REM : 0);
  const [fileChangesMap, setFileChangesMap] = useState<FileChangesMap>({});
  // 用 ref 持有最新值，避免 chat 回调把这些字段放进依赖后频繁重建
  const treeDataRef = useRef<TreeNodeLike[]>(treeData as TreeNodeLike[]);
  const workInfoStageRef = useRef(workInfo.stage);
  const lastCanvasSyncedKeysRef = useRef<string[]>([]);
  const canvasSnapshotHydratingRef = useRef(false);
  const canvasTaggedFilePathSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    treeDataRef.current = treeData as TreeNodeLike[];
    workInfoStageRef.current = workInfo.stage;
  }, [treeData, workInfo.stage]);

  const normalizeCanvasFilePath = useCallback((value: string) => {
    return sanitizeIncomingFilePath(value).replace(/^\/+/, "").trim();
  }, []);

  const isLikelyCanvasGeneratedPath = useCallback((normalizedPath: string) => {
    return /^\[[^/\]]+卡\]\/.+\.md$/i.test(normalizedPath);
  }, []);

  const resolveDraggedTreeFileForCanvas = useCallback((dataTransfer?: DataTransfer | null) => {
    const draggedId =
      dataTransfer?.getData(EDITOR_TREE_CANVAS_FILE_MIME)?.trim() ||
      getActiveCanvasDragFileId().trim();
    if (!draggedId) return null;

    const hit = findTreeNodeRecursive(
      treeDataRef.current,
      (id) => id === draggedId
    ) as (TreeNodeLike & { label?: string; isDirectory?: boolean }) | null;
    if (!hit || hit.isDirectory) return null;

    const title = String(hit.label ?? draggedId.split("/").pop()?.replace(/\.[^.]+$/i, "") ?? "信息");
    const filePath = draggedId.startsWith("/") ? draggedId : `/${draggedId}`;
    const content =
      draggedId === currentEditingId
        ? currentContent
        : String(hit.content ?? "");

    return {
      title,
      filePath,
      content,
    };
  }, [currentContent, currentEditingId]);

  const handleCanvasFileDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const draggedFile = resolveDraggedTreeFileForCanvas(event.dataTransfer);
    if (!draggedFile) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsCanvasFileDragOver(true);
  }, [resolveDraggedTreeFileForCanvas]);

  const handleCanvasFileDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setIsCanvasFileDragOver(false);
  }, []);

  const handleCanvasFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const draggedFile = resolveDraggedTreeFileForCanvas(event.dataTransfer);
    setIsCanvasFileDragOver(false);
    if (!draggedFile) return;

    event.preventDefault();
    insCanvasRef.current?.addInfoCardFromExternalFile({
      ...draggedFile,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }, [resolveDraggedTreeFileForCanvas]);

  const handleCanvasAutoSyncDirectory = useCallback(
    (canvasFiles: Record<string, string>) => {
      const latestState = useEditorStore.getState();
      const currentServerData = latestState.serverData;
      const incomingCanvasKeys = Object.keys(canvasFiles);
      const beforeCanvasKeys = lastCanvasSyncedKeysRef.current;
      const isHydratingFromSnapshot = canvasSnapshotHydratingRef.current;
      const isStrictSubsetRollback =
        incomingCanvasKeys.length > 0 &&
        incomingCanvasKeys.length < beforeCanvasKeys.length &&
        incomingCanvasKeys.every((key) => beforeCanvasKeys.includes(key));
      const isEmptyRollback = incomingCanvasKeys.length === 0 && beforeCanvasKeys.length > 0;
      const shouldProtectRollback =
        isHydratingFromSnapshot && (isStrictSubsetRollback || isEmptyRollback);

      let mergedFiles: Record<string, string>;
      let nextCanvasTrackedKeys: string[];

      if (shouldProtectRollback) {
        mergedFiles = {
          ...currentServerData,
          ...canvasFiles,
        };
        nextCanvasTrackedKeys = Array.from(
          new Set([...beforeCanvasKeys, ...incomingCanvasKeys])
        );
      } else {
        const keysToRemove = new Set(beforeCanvasKeys);
        const withoutCanvasSync = Object.fromEntries(
          Object.entries(currentServerData).filter(([key]) => !keysToRemove.has(key))
        );
        mergedFiles = {
          ...withoutCanvasSync,
          ...canvasFiles,
        };
        nextCanvasTrackedKeys = incomingCanvasKeys;
      }

      const latestTreeNodeIds = new Set<string>();
      const collectTreeNodeIds = (nodes: FileTreeNode[]) => {
        nodes.forEach((node) => {
          latestTreeNodeIds.add(node.id);
          if (node.children?.length) collectTreeNodeIds(node.children);
        });
      };
      collectTreeNodeIds(latestState.treeData ?? []);
      const missingInServerBeforeSync = Array.from(latestTreeNodeIds).filter((id) => {
        if (!id) return false;
        return !(id in currentServerData) && !(`${id}/` in currentServerData);
      });
      lastCanvasSyncedKeysRef.current = nextCanvasTrackedKeys;
      canvasTaggedFilePathSetRef.current = new Set(
        nextCanvasTrackedKeys
          .map((key) => normalizeCanvasFilePath(key))
          .filter((key) => key.toLowerCase().endsWith(".md"))
      );
      setServerData(mergedFiles);
      if (isHydratingFromSnapshot) {
        canvasSnapshotHydratingRef.current = false;
      }
    },
    [normalizeCanvasFilePath, setServerData]
  );

  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    try {
      const raw = localStorage.getItem(EDITOR_SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_EDITOR_SETTINGS;
      return { ...DEFAULT_EDITOR_SETTINGS, ...(JSON.parse(raw) as Partial<EditorSettings>) };
    } catch {
      return DEFAULT_EDITOR_SETTINGS;
    }
  });

  // 避免在 React StrictMode 下重复请求作品详情
  const lastInitWorkIdRef = useRef<string | null>(null);
  const lastAutoLoadSessionKeyRef = useRef<string>("");
  const skipTreeAutoSaveRef = useRef(true);

  // 标题（当前文件名）编辑：与 Vue startEditingLabel / saveLabelEdit / cancelLabelEdit 对齐
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const isSavingLabelRef = useRef(false);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (workId) setWorkId(workId);
  }, [workId, setWorkId]);

  useEffect(() => {
    canvasSnapshotRequestSeqRef.current += 1;
    canvasSnapshotLoadingRef.current = false;
    canvasSnapshotHydratingRef.current = false;
    setIsCanvasSnapshotPending(false);
    setCanvasInitialNodes([]);
    setCanvasInitialEdges([]);
    setCanvasInitialInspirationDrawId("");
    setCanvasInitialSnapshotKey((prev) => prev + 1);
    lastCanvasSyncedKeysRef.current = [];
    canvasTaggedFilePathSetRef.current = new Set();
  }, [workId]);

  const loadLatestCanvasSnapshot = useCallback(async () => {
    if (!workId) return;
    if (canvasSnapshotLoadingRef.current) return;
    const requestSeq = canvasSnapshotRequestSeqRef.current + 1;
    canvasSnapshotRequestSeqRef.current = requestSeq;
    canvasSnapshotLoadingRef.current = true;
    setIsCanvasSnapshotPending(true);
    try {
      const req = (await getWorksByIdReq(workId)) as
        | {
            inspirationDraws?: Array<{
              id?: string | number;
              content?: string;
            }>;
          }
        | undefined;
      const inspirationDraws = Array.isArray(req?.inspirationDraws) ? req.inspirationDraws : [];
      const parseCanvasContent = (raw: unknown) => {
        if (raw && typeof raw === "object") return raw as Record<string, unknown>;
        if (typeof raw !== "string") return {};
        let parsed: unknown = raw;
        for (let i = 0; i < 2; i += 1) {
          if (typeof parsed !== "string") break;
          try {
            parsed = JSON.parse(parsed);
          } catch {
            break;
          }
        }
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      };
      const drawWithCanvas =
        [...inspirationDraws]
          .reverse()
          .find((item) => {
            const parsed = parseCanvasContent(item?.content);
            return (
              Array.isArray((parsed as any)?.nodes) &&
              Array.isArray((parsed as any)?.edges) &&
              (
                ((parsed as any).nodes as unknown[]).length > 0 ||
                ((parsed as any).edges as unknown[]).length > 0
              )
            );
          }) ?? (inspirationDraws.length > 0 ? inspirationDraws[inspirationDraws.length - 1] : undefined);
      const parsedContent = parseCanvasContent(drawWithCanvas?.content);
      const nextNodes = Array.isArray(parsedContent?.nodes) ? parsedContent.nodes : [];
      const nextEdges = Array.isArray(parsedContent?.edges) ? parsedContent.edges : [];
      if (canvasSnapshotRequestSeqRef.current !== requestSeq) {
        return;
      }
      canvasSnapshotHydratingRef.current = true;
      setCanvasInitialNodes(nextNodes);
      setCanvasInitialEdges(nextEdges);
      setCanvasInitialInspirationDrawId(String(drawWithCanvas?.id ?? ""));
      setCanvasInitialSnapshotKey((prev) => prev + 1);
    } catch {
      // ignore canvas snapshot loading errors; fallback to empty canvas
    } finally {
      canvasSnapshotLoadingRef.current = false;
      if (canvasSnapshotRequestSeqRef.current === requestSeq) {
        setIsCanvasSnapshotPending(false);
      }
    }
  }, [workId]);

  useEffect(() => {
    if (activeTab !== "canvas" || !workId) return;
    void loadLatestCanvasSnapshot();
  }, [activeTab, workId, loadLatestCanvasSnapshot]);

  useEffect(() => {
    (async ()=>{
      if (!workId) return;
      if (lastInitWorkIdRef.current === workId) return;
      lastInitWorkIdRef.current = workId;
      await initEditorData(workId);
    })()
  }, [workId, initEditorData, location]);

  // 页面卸载时再重置 editor store
  useEffect(() => {
    return () => {
      initEditorStore();
      lastInitWorkIdRef.current = null;
      lastAutoLoadSessionKeyRef.current = "";
    };
  }, [initEditorStore]);

  useEffect(() => {
    if (!workId || currentWorkId !== workId) return;
    if (activeTab === "canvas") return;
    const hasCurrentSession =
      activeTab === "chat" ? !!chatCurrentSession : !!faqCurrentSession;
    const hasCurrentMessages =
      activeTab === "chat" ? chatMessages.length > 0 : faqMessages.length > 0;
    if (hasCurrentSession && hasCurrentMessages) return;
    if (hasCurrentMessages) return;
    const loadKey = `${workId}_${activeTab}`;
    if (lastAutoLoadSessionKeyRef.current === loadKey) return;
    lastAutoLoadSessionKeyRef.current = loadKey;
    void loadLatestSession(activeTab).then((session) => {
      if (!session && lastAutoLoadSessionKeyRef.current === loadKey) {
        lastAutoLoadSessionKeyRef.current = "";
      }
    });
  }, [
    workId,
    currentWorkId,
    activeTab,
    chatCurrentSession,
    faqCurrentSession,
    chatMessages.length,
    faqMessages.length,
    loadLatestSession,
  ]);

  useEffect(() => {
    // 切换作品或首次加载后，跳过第一次 tree 变化引发的自动保存
    skipTreeAutoSaveRef.current = true;
  }, [workId]);

  // 与 Vue 编辑器行为对齐：文件树/内容有变更时触发自动保存
  useEffect(() => {
    if (skipTreeAutoSaveRef.current) {
      skipTreeAutoSaveRef.current = false;
      return;
    }
    if (workInfo?.stage === "blank") return;
    const latestState = useEditorStore.getState();
    const editingId = latestState.currentEditingId || DEFAULT_EDITING_FILE_KEY;
    void saveEditorData("1", false);
  }, [activeTab, saveEditorData, treeData, workId, workInfo?.stage]);

  // 与 Vue 对齐：生产环境每 5 分钟自动保存一次
  useEffect(() => {
    if (import.meta?.env?.DEV) return;
    const timer = window.setInterval(() => {
      const { workInfo: latestWorkInfo, saveEditorData: saveLatestEditorData } = useEditorStore.getState();
      if (latestWorkInfo?.stage !== "blank") {
        void saveLatestEditorData("1");
      }
    }, 1000 * 60 * 5);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  // 页面卸载时再重置 editor store
  useEffect(() => {
    const applyKey = `${workId ?? ""}:${location.key ?? "default"}`;
    if (initialParamsApplyKeyRef.current === applyKey) return;
    initialParamsApplyKeyRef.current = applyKey;

    let storageParams: EditorInitialParams | null = null;
    let rankingParams: RankingListTransmissionParams | null = null;
    if (typeof window !== "undefined") {
      const paramsStr = sessionStorage.getItem(EDITOR_INITIAL_PARAMS_KEY);
      if (paramsStr) {
        try {
          const parsed = JSON.parse(paramsStr);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            storageParams = parsed as EditorInitialParams;
          }
        } catch (e) {
          console.error("解析 editorInitialParams 失败:", e);
        } finally {
          sessionStorage.removeItem(EDITOR_INITIAL_PARAMS_KEY);
        }
      }

      const rankingParamsStr = sessionStorage.getItem(RANKING_LIST_TRANSMISSION_KEY);
      if (rankingParamsStr) {
        try {
          const parsed = JSON.parse(rankingParamsStr);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            rankingParams = parsed as RankingListTransmissionParams;
          }
        } catch (e) {
          console.error("解析 rankingListTransmission 失败:", e);
        } finally {
          sessionStorage.removeItem(RANKING_LIST_TRANSMISSION_KEY);
        }
      }
    }
    const stateRaw = location.state;
    const stateParams =
      stateRaw && typeof stateRaw === "object" && !Array.isArray(stateRaw)
        ? (stateRaw as EditorInitialParams)
        : null;
    const mergedParams = { ...(stateParams ?? {}), ...(storageParams ?? {}) };
    const rankingContent = typeof rankingParams?.content === "string" ? rankingParams.content.trim() : "";
    const rankingMessage = typeof rankingParams?.message === "string" ? rankingParams.message.trim() : "";
    const rankingDisableAutoSubmit = !!rankingParams?.disableAutoSubmit;
    const mergedSelectedTexts = Array.isArray(mergedParams.selectedTexts) ? mergedParams.selectedTexts : [];
    const initialParams: EditorInitialParams = {
      ...mergedParams,
      selectedTexts: rankingContent
        ? [
          ...mergedSelectedTexts,
          {
            id: `ranking-transmission-${Date.now()}`,
            file: "",
            content: rankingContent,
          },
        ]
        : (Array.isArray(mergedParams.selectedTexts) ? mergedParams.selectedTexts : undefined),
      message: rankingMessage || mergedParams.message,
    };
    const initialTemplate = parseStepTemplate(initialParams.template);
    if (initialTemplate) {
      setPendingStepTemplate(initialTemplate);
    }

    if (typeof initialParams.modelLLM === "string" && initialParams.modelLLM) {
      setModelLLM(initialParams.modelLLM);
    }
    if (typeof initialParams.selectedWritingStyle === "string" && initialParams.selectedWritingStyle) {
      setSelectedWritingStyle(initialParams.selectedWritingStyle);
    }
    if (typeof initialParams.isAnswerOnly === "boolean") {
      setIsAnswerOnly(initialParams.isAnswerOnly);
    }
    initializeChatInputFromParams({
      associationTags: Array.isArray(initialParams.associationTags) ? initialParams.associationTags : undefined,
      selectedNotes: Array.isArray(initialParams.selectedNotes) ? initialParams.selectedNotes : undefined,
      selectedFiles: Array.isArray(initialParams.selectedFiles) ? initialParams.selectedFiles : undefined,
      selectedTexts: Array.isArray(initialParams.selectedTexts) ? initialParams.selectedTexts : undefined,
      selectedTools: Array.isArray(initialParams.selectedTools) ? initialParams.selectedTools : undefined,
      isShowAnswerTip: typeof initialParams.isShowAnswerTip === "boolean" ? initialParams.isShowAnswerTip : undefined,
    });
    const initialMessage = typeof initialParams.message === "string" ? initialParams.message.trim() : "";
    if (initialMessage) {
      const msg = initialMessage;
      setPendingInitialMessage(msg);
      if (!rankingDisableAutoSubmit) {
        const submitKey = `${workId ?? ""}:${msg}`;
        if (lastInitialAutoSendKeyRef.current !== submitKey) {
          lastInitialAutoSendKeyRef.current = submitKey;
          setTimeout(() => {
            const initialSubmitMode =
              typeof initialParams.isAnswerOnly === "boolean"
                ? (initialParams.isAnswerOnly ? "chat" : "agent")
                : undefined;
            const initialChatType =
              initialParams.editorBizType === "short-play" ? "script" : undefined;
            sendChatText(msg, {
              addUserMessage: true,
              submitMode: initialSubmitMode,
              chatType: initialChatType,
            });
            setPendingInitialMessage("");
          }, 0);
        }
        setShouldAutoSubmitInitialMessage(false);
      } else {
        setShouldAutoSubmitInitialMessage(false);
      }
    } else {
      setShouldAutoSubmitInitialMessage(false);
    }
  }, [isShortPlayEditor, location.key, location.state, setModelLLM, setSelectedWritingStyle, initializeChatInputFromParams, workId, sendChatText]);


  const hasExplicitPendingHilt = useCallback((message?: ChatMessage | null): boolean => {
    if (!message || !Array.isArray(message.customMessage) || message.customMessage.length === 0) {
      return false;
    }
    const lastCustom = message.customMessage[message.customMessage.length - 1];
    const hiltStatus = (lastCustom as { hiltStatus?: string } | undefined)?.hiltStatus;
    if (hiltStatus === "approved" || hiltStatus === "rejected") return false;
    const hiltTodos = (lastCustom as { hiltTodos?: unknown[] } | undefined)?.hiltTodos;
    return hiltStatus === "in_progress" && Array.isArray(hiltTodos) && hiltTodos.length > 0;
  }, []);

  const handleBackClick = useCallback(async () => {
    const hasPendingFileChanges = Object.values(fileChangesMap).some((list) =>
      Array.isArray(list) && list.some((item) => item.status === "pending")
    );
    const lastChat = chatMessages[chatMessages.length - 1];
    const hasPendingHilt = hasExplicitPendingHilt(lastChat);

    if (langGraphStream.isStreaming) {
      const ok = await confirm({
        title: "提示",
        message: "检测到正在进行流式任务，确认操作将中断当前任务，是否继续？",
        cancelText: "取消",
        confirmText: "确认",
      });
      if (!ok) return;
      langGraphStream.stop();
    } else if (hasPendingFileChanges) {
      const ok = await confirm({
        title: "提示",
        message: "当前内容仍有未确认变更，是否接受？",
        cancelText: "取消",
        confirmText: "确认",
      });
      if (!ok) return;
    } else if (hasPendingHilt) {
      const ok = await confirm({
        title: "提示",
        message: "检测到对话中有待您确认的操作，会默认帮您拒绝，是否继续？",
        cancelText: "取消",
        confirmText: "确认",
      });
      if (!ok) return;
    }

    // 清空 QuillChatInput 相关全局状态，避免回到工作台后残留
    clearAssociationTags();
    clearSelectedNotes();
    clearSelectedFiles();
    clearSelectedTexts();
    resetSelectedTools();
    setShowAnswerTip(false);
    setShowWritingStyleTip(false);
    resetLLMState();
    setPendingInitialMessage("");
    setShouldAutoSubmitInitialMessage(false);
    setIsAnswerOnly(true);
    navigate("/workspace/my-place", { replace: true });
  }, [
    fileChangesMap,
    chatMessages,
    hasExplicitPendingHilt,
    langGraphStream,
    confirm,
    clearAssociationTags,
    clearSelectedNotes,
    clearSelectedFiles,
    clearSelectedTexts,
    resetSelectedTools,
    setShowAnswerTip,
    setShowWritingStyleTip,
    navigate,
  ]);

  const handleSaveClick = useCallback(async () => {
    const canProceed = await checkStreamingStatusAndConfirm(true);
    if (!canProceed) return;
    await saveEditorData("0", true);
  }, [saveEditorData]);

  const handleTitleUpdate = useCallback(
    async (newTitle: string) => {
      if (!workId || !newTitle?.trim()) return;
      await updateWorkInfoReq(workId, { title: newTitle.trim() });
      setWorkInfo({ title: newTitle.trim() });
    },
    [workId, setWorkInfo]
  );

  const applyEditorStyles = useCallback((settings: EditorSettings) => {
    const remFontSize = Number((settings.fontSize / 16).toFixed(4));
    let customStyle = document.getElementById(EDITOR_SETTINGS_STYLE_ID) as HTMLStyleElement | null;
    if (!customStyle) {
      customStyle = document.createElement("style");
      customStyle.id = EDITOR_SETTINGS_STYLE_ID;
      document.head.appendChild(customStyle);
    }
    customStyle.textContent = `
      .page-editor-panel .editor-content-layout {
        padding-left: ${settings.margin}px;
        padding-right: ${settings.margin}px;
      }

      .page-editor-panel .main-editor .main-editor-content .ProseMirror {
        --tiptap-prosemirror-font-size: ${remFontSize}rem !important;
        --tiptap-prosemirror-line-height: ${settings.lineHeight} !important;
        font-weight: ${settings.fontWeight} !important;
      }

      .page-editor-panel .main-editor .main-editor-content .ProseMirror p:not(.mermaid-container):not(.mermaid-container *) {
        text-indent: ${settings.textIndentEnabled ? "2em" : "0"};
      }
    `;
  }, []);

  useEffect(() => {
    applyEditorStyles(editorSettings);
    try {
      localStorage.setItem(EDITOR_SETTINGS_STORAGE_KEY, JSON.stringify(editorSettings));
    } catch {
      // ignore localStorage write error
    }
  }, [applyEditorStyles, editorSettings]);

  const handleUndo = useCallback(() => {
    if (chatInputStatus === "streaming") {
      toast.info("AI 生成中，暂不可撤销");
      return;
    }
    markdownEditorRef.current?.undo();
  }, [chatInputStatus]);

  const handleRedo = useCallback(() => {
    if (chatInputStatus === "streaming") {
      toast.info("AI 生成中，暂不可反撤销");
      return;
    }
    markdownEditorRef.current?.redo();
  }, [chatInputStatus]);

  const handleSearchReplace = useCallback(() => {
    setShowSearchReplaceDialog(true);
  }, []);

  const handleMainEditorChange = useCallback((nextContent: string) => {
    setCurrentContent(nextContent);

    const normalizedPath = normalizeCanvasFilePath(currentEditingId || "");
    if (!normalizedPath) return;

    const didSync = insCanvasRef.current?.syncFileContentByPath(normalizedPath, nextContent) ?? false;
    void didSync;
  }, [activeTab, currentEditingId, normalizeCanvasFilePath, setCurrentContent]);

  // 查找预览使用延迟值，避免每次键入都立即全量扫描正文
  const deferredSearchText = useDeferredValue(searchText);
  const searchMatches = useMemo(() => {
    const source = serverData[currentEditingId || DEFAULT_EDITING_FILE_KEY] || "";
    return findSearchMatches(source, deferredSearchText);
  }, [serverData, currentEditingId, deferredSearchText]);

  const closeSearchReplaceDialog = useCallback(() => {
    setShowSearchReplaceDialog(false);
    setSearchText("");
    setReplaceText("");
  }, []);

  const handleReplaceAll = useCallback(() => {
    if (!searchText.trim()) {
      toast.warning("请输入要查找的内容");
      return;
    }
    const targetFileKey = currentEditingId || DEFAULT_EDITING_FILE_KEY;
    let nextContent = serverData[targetFileKey] || "";
    const effectiveMatches = findSearchMatches(nextContent, searchText);
    if (effectiveMatches.length === 0) {
      toast.warning("未找到匹配的内容");
      return;
    }
    const sorted = [...effectiveMatches].sort((a, b) => b.actualIndex - a.actualIndex);
    for (const match of sorted) {
      const before = nextContent.slice(0, match.actualIndex);
      const after = nextContent.slice(match.actualIndex + searchText.length);
      nextContent = before + replaceText + after;
    }
    setServerDataFile(targetFileKey, nextContent);
    toast.success(`已替换 ${sorted.length} 处内容`);
  }, [searchText, replaceText, setServerDataFile, currentEditingId, serverData]);

  const openTimeMachine = useCallback(async () => {
    if (!workId) return;
    setLoadingVersions(true);
    try {
      const req = (await getWorksByIdReq(workId)) as { workVersionIds?: WorkVersion[] } | undefined;
      setWorkVersionList(Array.isArray(req?.workVersionIds) ? req!.workVersionIds! : []);
      setShowTimeMachineDialog(true);
    } catch {
      toast.error("获取版本列表失败");
    } finally {
      setLoadingVersions(false);
    }
  }, [workId]);

  const restoreVersion = useCallback(async (versionId: string) => {
    if (!workId || !versionId) return;
    setRestoringVersionId(versionId);
    try {
      const req = (await getWorksByIdAndVersionReq(workId, versionId)) as { content?: string } | undefined;
      if (!req?.content) {
        toast.error("版本内容为空");
        return;
      }
      const parsed = JSON.parse(req.content) as Record<string, string>;
      setServerData(parsed);
      /**  TODO 修改tree的实现后进行重新设置 setCurrentEditingId*/
      // const allMdKeys = Object.keys(parsed).filter((k) => k.endsWith(".md")).sort();
      // if (allMdKeys.length > 0) {
      //   useEditorStore.getState().setCurrentEditingId(allMdKeys[0]);
      // }
      toast.success("版本恢复成功");
      setShowTimeMachineDialog(false);
    } catch {
      toast.error("恢复版本失败");
    } finally {
      setRestoringVersionId("");
    }
  }, [workId, setServerData]);

  const helpWriteClick = useCallback(() => {
    trackEvent('AI Tool', 'Click', 'Guided Writing')
    stepWorkflowRef.current?.openStepCreateDialog();
  }, []);

  const onLeftResizeStart = useCallback(() => {
    dragStartLeftRem.current = leftPanelWidthRem;
  }, [leftPanelWidthRem]);

  const onLeftResize = useCallback((deltaX: number) => {
    const deltaRem = pxToRem(deltaX);
    const el = resizeContainerRef.current;
    const contentWidthPx = el ? el.clientWidth - CONTAINER_PADDING_PX : 0;
    const totalRem = contentWidthPx > 0 ? contentWidthPx / REM_BASE : 0;
    const maxLeft =
      totalRem > 0
        ? totalRem - rightPanelWidthRem - HANDLES_WIDTH_REM - centerRequiredRem
        : Number.POSITIVE_INFINITY;
    const effectiveMaxLeft = Math.max(LEFT_MIN_REM, Math.min(maxLeft, LEFT_MAX_REM));
    const newWidth = Math.max(
      LEFT_MIN_REM,
      Math.min(effectiveMaxLeft, dragStartLeftRem.current + deltaRem)
    );
    setLeftPanelWidthRem(newWidth);
  }, [rightPanelWidthRem, centerRequiredRem]);

  const onRightResizeStart = useCallback(() => {
    dragStartRightRem.current = rightPanelWidthRem;
    dragStartRightPx.current =
      rightPanelRef.current?.offsetWidth ?? rightPanelWidthRem * getRootRemPx();
  }, [rightPanelWidthRem]);

  const onRightResize = useCallback((adjustedDeltaX: number) => {
    // position="right" 时组件传入 -deltaX；全像素链路避免 rem 换算误差
    const el = resizeContainerRef.current;
    const contentWidthPx = el ? el.clientWidth - CONTAINER_PADDING_PX : 0;
    const remBase = getRootRemPx();
    const leftWidthPx = leftPanelRef.current?.offsetWidth ?? leftPanelWidthRem * remBase;
    // 右栏最大宽需给中间区预留空间（含修改面板固定宽），避免把聊天区挤出页面
    const centerRequiredPx = centerRequiredRem * remBase;
    const maxRightPx =
      contentWidthPx > 0
        ? Math.max(0, contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase - centerRequiredPx)
        : Number.POSITIVE_INFINITY;
    // 视口过窄时，右栏最小宽不应强行占位，否则中间区无法压到 0
    const effectiveMinRightPx =
      contentWidthPx > 0
        ? Math.min(RIGHT_MIN_REM * remBase, maxRightPx)
        : RIGHT_MIN_REM * remBase;
    const rawPx = dragStartRightPx.current + adjustedDeltaX;
    const newWidthPx = Math.max(effectiveMinRightPx, Math.min(maxRightPx, rawPx));
    setRightPanelWidthRem(newWidthPx / remBase);
  }, [leftPanelWidthRem, centerRequiredRem]);

  const maximizeRightPanel = useCallback(() => {
    const el = resizeContainerRef.current;
    const contentWidthPx = el ? el.clientWidth - CONTAINER_PADDING_PX : 0;
    if (contentWidthPx <= 0) return;
    const remBase = getRootRemPx();
    const leftWidthPx = leftPanelRef.current?.offsetWidth ?? leftPanelWidthRem * remBase;
    const centerRequiredPx = centerRequiredRem * remBase;
    const maxRightPx = Math.max(
      0,
      contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase - centerRequiredPx
    );
    setRightPanelWidthRem(maxRightPx / remBase);
  }, [leftPanelWidthRem, centerRequiredRem]);

  const setCanvasPreviewSplitLayout = useCallback(() => {
    const el = resizeContainerRef.current;
    const remBase = getRootRemPx();
    if (!el) return;

    const contentWidthPx = el.clientWidth - CONTAINER_PADDING_PX;
    const leftWidthPx = leftPanelRef.current?.offsetWidth ?? leftPanelWidthRem * remBase;
    const centerRequiredPx = centerRequiredRem * remBase;
    const maxRightPx = Math.max(
      0,
      contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase - centerRequiredPx
    );
    const effectiveMinRightPx = Math.min(RIGHT_MIN_REM * remBase, maxRightPx);
    const availableCenterAndRightPx = Math.max(
      0,
      contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase
    );
    const targetWidthPx = availableCenterAndRightPx / 2;
    const nextWidthPx = Math.max(effectiveMinRightPx, Math.min(maxRightPx, targetWidthPx));
    setRightPanelWidthRem(nextWidthPx / remBase);
  }, [leftPanelWidthRem, centerRequiredRem]);

  const requestCanvasFocusByFilePath = useCallback((rawFilePath: string) => {
    const normalizedPath = sanitizeIncomingFilePath(rawFilePath);
    if (!normalizedPath) {
      return;
    }
    pendingCanvasFocusFilePathRef.current = normalizedPath;
    if (activeTab !== "canvas" && preCanvasRightWidthRemRef.current == null) {
      preCanvasRightWidthRemRef.current = rightPanelWidthRem;
    }
    setIsCanvasFilePreviewMode(true);
    setIsCanvasPreviewEditorClosed(false);
    setCanvasPreviewSplitLayout();
    if (activeTab !== "canvas") {
      setIsCanvasSnapshotPending(true);
    }
    setActiveTab("canvas");
    setCanvasFocusRequestSeq((seq) => seq + 1);
  }, [activeTab, rightPanelWidthRem, setCanvasPreviewSplitLayout, workId]);

  const handleTreeFileSelect = useCallback((node: FileTreeNode) => {
    const pathFromTree = Array.isArray(node.path) ? node.path.join("/") : "";
    const normalizedPath = normalizeCanvasFilePath(pathFromTree || node.id);
    if (!normalizedPath) return;
    const isCanvasTaggedFile =
      canvasTaggedFilePathSetRef.current.has(normalizedPath) ||
      isLikelyCanvasGeneratedPath(normalizedPath);
    if (!isCanvasTaggedFile) return;
    requestCanvasFocusByFilePath(normalizedPath);
  }, [
    isLikelyCanvasGeneratedPath,
    normalizeCanvasFilePath,
    requestCanvasFocusByFilePath,
  ]);

  const handleCloseCanvasPreviewEditor = useCallback(() => {
    setIsCanvasPreviewEditorClosed(true);
    maximizeRightPanel();
  }, [maximizeRightPanel]);

  const flushCanvasBeforeLeave = useCallback(async () => {
    if (activeTab !== "canvas") return;
    if (canvasLeaveFlushPromiseRef.current) {
      await canvasLeaveFlushPromiseRef.current;
      return;
    }
    const flushPromise = (insCanvasRef.current?.flushPersistence?.() ?? Promise.resolve()).catch(() => undefined);
    const trackedFlushPromise = flushPromise.finally(() => {
      if (canvasLeaveFlushPromiseRef.current === trackedFlushPromise) {
        canvasLeaveFlushPromiseRef.current = null;
      }
    });
    canvasLeaveFlushPromiseRef.current = trackedFlushPromise;
    await canvasLeaveFlushPromiseRef.current;
  }, [activeTab]);

  const handleChatHeaderTabChange = useCallback(
    async (tab: ChatTabType) => {
      if (tab === "canvas") {
        if (activeTab !== "canvas") {
          if (langGraphStream.isStreaming) {
            const ok = await confirm({
              title: "提示",
              message: "检测到正在进行流式任务，确认操作将中断当前任务，是否继续？",
              cancelText: "取消",
              confirmText: "确认",
            });
            if (!ok) return;
            handleStopStreaming();
          }
        }
        setIsCanvasPreviewEditorClosed(false);
        if (activeTab !== "canvas" && preCanvasRightWidthRemRef.current == null) {
          preCanvasRightWidthRemRef.current = rightPanelWidthRem;
        }
        if (activeTab !== "canvas") {
          setIsCanvasSnapshotPending(true);
        }
        maximizeRightPanel();
      } else if (activeTab === "canvas") {
        if (insCanvasRef.current?.isLoading) {
          const ok = await confirm({
            title: "提示",
            message: "检测到正在进行流式任务，确认操作将中断当前任务，是否继续？",
            cancelText: "取消",
            confirmText: "确认",
          });
          if (!ok) return;
          await insCanvasRef.current.stopCurrentRequest();
        }
        await flushCanvasBeforeLeave();
        setIsCanvasFilePreviewMode(false);
        setIsCanvasPreviewEditorClosed(false);
        if (preCanvasRightWidthRemRef.current != null) {
          setRightPanelWidthRem(preCanvasRightWidthRemRef.current);
          preCanvasRightWidthRemRef.current = null;
        }
      }
      setActiveTab(tab);
    },
    [activeTab, confirm, flushCanvasBeforeLeave, handleStopStreaming, langGraphStream.isStreaming, maximizeRightPanel, rightPanelWidthRem]
  );

  useEffect(() => {
    if (activeTab !== "canvas") return;
    const pendingFilePath = pendingCanvasFocusFilePathRef.current;
    if (!pendingFilePath) return;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        insCanvasRef.current?.focusFileByPath(pendingFilePath, {
          zoom: 0.95,
          duration: 500,
          maxAttempts: 24,
        });
        if (pendingCanvasFocusFilePathRef.current === pendingFilePath) {
          pendingCanvasFocusFilePathRef.current = "";
        }
      });
    });
    return () => {
      if (firstFrame) cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [activeTab, canvasFocusRequestSeq, canvasReadyKey, rightPanelWidthRem, workId]);

  useEffect(() => {
    const normalizedPath = normalizeCanvasFilePath(currentEditingId || "");
    if (!normalizedPath) return;

    const didSync = insCanvasRef.current?.syncFileContentByPath(normalizedPath, currentContent) ?? false;
    void didSync;
  }, [activeTab, canvasReadyKey, currentContent, currentEditingId, normalizeCanvasFilePath]);

  const fileKey = currentEditingId || DEFAULT_EDITING_FILE_KEY;
  // ================== EDIT_FILE START ==================
  const currentFileChanges = useMemo(
    () => fileChangesMap[fileKey] ?? [],
    [fileChangesMap, fileKey]
  );
  const currentFilePendingChanges = useMemo(
    () => currentFileChanges.filter((c) => c.status === "pending"),
    [currentFileChanges]
  );
  const currentFilePendingCount = useMemo(
    () => currentFilePendingChanges.length,
    [currentFilePendingChanges]
  );
  const shouldShowRemarkOverlay = currentFilePendingCount > 0;
  const isEditorEditable = chatInputStatus !== "streaming" && !shouldShowRemarkOverlay;
  // ================== EDIT_FILE_END ==================
  const clearRemarkHighlight = useCallback(() => {
    const editor = markdownEditorRef.current?.editor as
      | { commands?: { clearActiveTokenizerHighlight?: () => boolean } }
      | null;
    editor?.commands?.clearActiveTokenizerHighlight?.();
  }, []);

  const hasAnyPendingFileChanges = useMemo(
    () =>
      Object.values(fileChangesMap).some((list) =>
        Array.isArray(list) && list.some((item) => item.status === "pending")
      ),
    [fileChangesMap]
  );

  const hasPendingHiltInChat = useMemo(() => {
    const lastChat = chatMessages[chatMessages.length - 1];
    return hasExplicitPendingHilt(lastChat);
  }, [chatMessages, hasExplicitPendingHilt]);

  type StreamingTaskStatus = "idle" | "streaming" | "pending" | "edit_pending" | "hilt_pending";
  const streamingTaskStatus = useMemo<StreamingTaskStatus>(() => {
    if (langGraphStream.isStreaming) return "streaming";
    if (hasAnyPendingFileChanges) return "edit_pending";
    if (hasPendingHiltInChat) return "hilt_pending";
    return "idle";
  }, [langGraphStream.isStreaming, hasAnyPendingFileChanges, hasPendingHiltInChat]);

  // 与 Vue 版 checkStreamingStatusAndConfirm 对齐：
  // streaming -> 二次确认后中断；pending/edit_pending/hilt_pending -> 弹确认并返回是否继续
  const checkStreamingStatusAndConfirm = useCallback(
    async (needReset = false, needCheckHilt = true, needAIMessage = true): Promise<boolean> => {
      if (streamingTaskStatus === "streaming") {
        const ok = await confirm({
          title: "提示",
          message: "检测到正在进行流式任务，确认操作将中断当前任务，是否继续？",
          cancelText: "取消",
          confirmText: "确认",
        });
        if (!ok) return false;
        handleStopStreaming(needAIMessage);
        return true;
      }
      if (streamingTaskStatus === "pending") {
        return confirm({
          title: "提示",
          message: "当前内容仍有未确认变更，是否接受？",
          cancelText: "取消",
          confirmText: "确认",
        });
      }
      if (streamingTaskStatus === "edit_pending") {
        const ok = await confirm({
          title: "提示",
          message: "当前内容仍有未确认变更，是否接受？",
          cancelText: "取消",
          confirmText: "确认",
        });
        if (!ok) return false;
        if (needReset) {
          setFileChangesMap({});
          setActiveChangeIndex(null);
          setIsChangesPanelVisible(false);
          clearRemarkHighlight();
        }
        return true;
      }
      if (streamingTaskStatus === "hilt_pending" && needCheckHilt) {
        return confirm({
          title: "提示",
          message: "检测到对话中有待您确认的操作，会默认帮您拒绝，是否继续？",
          cancelText: "取消",
          confirmText: "确认",
        });
      }
      return true;
    },
    [streamingTaskStatus, handleStopStreaming, clearRemarkHighlight, confirm]
  );

  // 浏览器关闭/刷新前的同步拦截（beforeunload 仅支持同步逻辑）
  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (streamingTaskStatus === "streaming") {
      event.preventDefault();
      event.returnValue = "检测到正在进行流式任务，确认操作将中断当前任务，是否继续？";
      return event.returnValue;
    }
    if (streamingTaskStatus === "hilt_pending") {
      event.preventDefault();
      event.returnValue = "检测到对话中有待您确认的操作，会默认帮您拒绝，是否继续？";
      return event.returnValue;
    }
    if (streamingTaskStatus === "edit_pending") {
      event.preventDefault();
      event.returnValue = "检测到当前内容仍有未确认变更，会默认帮您接受，是否继续？";
      return event.returnValue;
    }
    return undefined;
  }, [streamingTaskStatus]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const highlightChangeInEditor = useCallback(
    (highlightId?: string): boolean => {
      clearRemarkHighlight();
      if (!highlightId) return false;
      const editor = markdownEditorRef.current?.editor as
        | { commands?: { setActiveTokenizerHighlight?: (id: string) => boolean } }
        | null;
      const activateCommand = editor?.commands?.setActiveTokenizerHighlight;
      if (!activateCommand) return false;
      return activateCommand(highlightId);
    },
    [clearRemarkHighlight]
  );

  const applyChangeToContent = useCallback(
    (content: string, oldString: string, newString: string): { applied: boolean; nextContent: string } => {
      if (!oldString) return { applied: false, nextContent: content };
      const exactIndex = content.indexOf(oldString);
      if (exactIndex >= 0) {
        const updated =
          content.slice(0, exactIndex) +
          newString +
          content.slice(exactIndex + oldString.length);
        return { applied: true, nextContent: updated };
      }
      const looseRange = findRangeIgnoringWhitespace(content, oldString);
      if (looseRange) {
        const updated =
          content.slice(0, looseRange.start) +
          newString +
          content.slice(looseRange.endExclusive);
        return { applied: true, nextContent: updated };
      }
      // 当后端已先行写入新内容时，不再误报“找不到原文片段”
      if (!newString) return { applied: false, nextContent: content };
      if (content.includes(newString)) return { applied: true, nextContent: content };
      const alreadyApplied = findRangeIgnoringWhitespace(content, newString);
      return { applied: alreadyApplied !== null, nextContent: content };
    },
    []
  );

  const handleAcceptChange = useCallback(
    (changeIndex: number) => {
      const target = (fileChangesMap[fileKey] ?? []).find((c) => c.index === changeIndex);
      if (!target || target.status !== "pending") return;
      const list = fileChangesMap[fileKey] ?? [];
      let baseContent = useEditorStore.getState().serverData[fileKey] ?? "";
      const cleanBefore = removeAllHighlightMarkers(baseContent);
      // 统一接受逻辑：先移除 marker，再按 old->new 应用替换。
      // 即使 markerTarget 判断偏差，也不会出现“只去高亮但不替换正文”。
      if (target.markerInfo) {
        baseContent = removeHighlightMarkersAt(baseContent, target.markerInfo);
      }
      const { applied, nextContent } = applyChangeToContent(baseContent, target.oldString, target.newString);
      let finalContent = nextContent;
      let changed = finalContent !== baseContent;

      // 兜底：常规匹配未生效时，按 marker 强制替换该段，避免“触发了但没替换”。
      if ((!applied || !changed) && target.markerInfo) {
        const forcedContent = replaceContentAndRemoveMarkers(
          useEditorStore.getState().serverData[fileKey] ?? "",
          target.markerInfo,
          target.newString
        );
        const forcedClean = removeAllHighlightMarkers(forcedContent);
        if (forcedClean !== cleanBefore) {
          finalContent = forcedClean;
          changed = true;
        }
      }

      if (!applied && !changed) {
        toast.warning("未找到可替换的原文片段，无法应用该修改");
        return;
      }
      baseContent = finalContent;
      const statusUpdated: EditorFileChangeItem[] = list.map((item): EditorFileChangeItem =>
        item.index === changeIndex
          ? { ...item, status: "accepted" as const, markerInfo: undefined, markerTarget: undefined }
          : item
      );
      const pendingItems = statusUpdated.filter((item) => item.status === "pending");
      const settledItems: EditorFileChangeItem[] = statusUpdated
        .filter((item) => item.status !== "pending")
        .map((item) => ({ ...item, markerInfo: undefined, markerTarget: undefined }));
      if (pendingItems.length > 0) {
        const { contentWithMarkers, relabeledPending } = relabelPendingChanges(baseContent, pendingItems);
        setServerDataFile(fileKey, contentWithMarkers);
        setFileChangesMap((prev) => ({ ...prev, [fileKey]: [...settledItems, ...relabeledPending] }));
      } else {
        setServerDataFile(fileKey, removeAllHighlightMarkers(baseContent));
        setFileChangesMap((prev) => ({ ...prev, [fileKey]: settledItems }));
      }
    },
    [
      applyChangeToContent,
      fileChangesMap,
      fileKey,
      relabelPendingChanges,
      removeAllHighlightMarkers,
      removeHighlightMarkersAt,
      replaceContentAndRemoveMarkers,
      setServerDataFile,
    ]
  );

  const handleRejectChange = useCallback(
    (changeIndex: number) => {
      const target = (fileChangesMap[fileKey] ?? []).find((c) => c.index === changeIndex);
      if (!target || target.status !== "pending") return;
      const list = fileChangesMap[fileKey] ?? [];
      let baseContent = useEditorStore.getState().serverData[fileKey] ?? "";
      if (target.markerInfo) {
        if (target.markerTarget === "old") {
          baseContent = removeHighlightMarkersAt(baseContent, target.markerInfo);
        } else {
          baseContent = replaceContentAndRemoveMarkers(baseContent, target.markerInfo, target.oldString);
        }
      }
      const statusUpdated: EditorFileChangeItem[] = list.map((item): EditorFileChangeItem =>
        item.index === changeIndex
          ? { ...item, status: "rejected" as const, markerInfo: undefined, markerTarget: undefined }
          : item
      );
      const pendingItems = statusUpdated.filter((item) => item.status === "pending");
      const settledItems: EditorFileChangeItem[] = statusUpdated
        .filter((item) => item.status !== "pending")
        .map((item) => ({ ...item, markerInfo: undefined, markerTarget: undefined }));
      if (pendingItems.length > 0) {
        const { contentWithMarkers, relabeledPending } = relabelPendingChanges(baseContent, pendingItems);
        setServerDataFile(fileKey, contentWithMarkers);
        setFileChangesMap((prev) => ({ ...prev, [fileKey]: [...settledItems, ...relabeledPending] }));
      } else {
        setServerDataFile(fileKey, removeAllHighlightMarkers(baseContent));
        setFileChangesMap((prev) => ({ ...prev, [fileKey]: settledItems }));
      }
    },
    [
      fileChangesMap,
      fileKey,
      relabelPendingChanges,
      removeAllHighlightMarkers,
      replaceContentAndRemoveMarkers,
      setServerDataFile,
    ]
  );

  const handleCurrentPageAcceptAll = useCallback(() => {
    const list = fileChangesMap[fileKey] ?? [];
    const pending = list.filter((item) => item.status === "pending");
    if (pending.length === 0) {
      toast.warning("当前页面没有可接受的修改");
      clearRemarkHighlight();
      return;
    }
    let baseContent = useEditorStore.getState().serverData[fileKey] ?? "";
    let appliedCount = 0;
    pending.forEach((item) => {
      const cleanBefore = removeAllHighlightMarkers(baseContent);
      let contentForApply = baseContent;
      if (item.markerInfo) {
        contentForApply = removeHighlightMarkersAt(contentForApply, item.markerInfo);
      }
      const { applied, nextContent } = applyChangeToContent(contentForApply, item.oldString, item.newString);
      let finalContent = nextContent;
      let changed = finalContent !== contentForApply;

      if ((!applied || !changed) && item.markerInfo) {
        const forcedContent = replaceContentAndRemoveMarkers(
          baseContent,
          item.markerInfo,
          item.newString
        );
        const forcedClean = removeAllHighlightMarkers(forcedContent);
        if (forcedClean !== cleanBefore) {
          finalContent = forcedClean;
          changed = true;
        }
      }

      if (!applied) {
        // 至少保留去 marker 后/兜底替换后的内容，避免高亮残留导致后续继续失配
        baseContent = changed ? finalContent : contentForApply;
        return;
      }
      baseContent = finalContent;
      appliedCount += 1;
    });
    const settledItems: EditorFileChangeItem[] = list.map((item): EditorFileChangeItem =>
      item.status === "pending"
        ? { ...item, status: "accepted" as const, markerInfo: undefined, markerTarget: undefined }
        : item
    );
    setServerDataFile(fileKey, removeAllHighlightMarkers(baseContent));
    setFileChangesMap((prev) => ({ ...prev, [fileKey]: settledItems }));
    if (appliedCount > 0) toast.success(`已接受 ${appliedCount} 处修改`);
    else toast.warning("当前页面没有可接受的修改");
    clearRemarkHighlight();
  }, [
    applyChangeToContent,
    clearRemarkHighlight,
    fileChangesMap,
    fileKey,
    removeAllHighlightMarkers,
    removeHighlightMarkersAt,
    replaceContentAndRemoveMarkers,
    setServerDataFile,
  ]);

  const handleCurrentPageRejectAll = useCallback(() => {
    const list = fileChangesMap[fileKey] ?? [];
    const pending = list.filter((item) => item.status === "pending");
    if (pending.length === 0) {
      toast.warning("当前页面没有可撤销的修改");
      clearRemarkHighlight();
      return;
    }
    let baseContent = useEditorStore.getState().serverData[fileKey] ?? "";
    pending.forEach((item) => {
      if (!item.markerInfo) return;
      if (item.markerTarget === "old") {
        baseContent = removeHighlightMarkersAt(baseContent, item.markerInfo);
      } else {
        baseContent = replaceContentAndRemoveMarkers(baseContent, item.markerInfo, item.oldString);
      }
    });
    const settledItems: EditorFileChangeItem[] = list.map((item): EditorFileChangeItem =>
      item.status === "pending"
        ? { ...item, status: "rejected" as const, markerInfo: undefined, markerTarget: undefined }
        : item
    );
    setServerDataFile(fileKey, removeAllHighlightMarkers(baseContent));
    setFileChangesMap((prev) => ({ ...prev, [fileKey]: settledItems }));
    if (pending.length > 0) toast.success(`已撤销 ${pending.length} 处修改`);
    clearRemarkHighlight();
  }, [
    clearRemarkHighlight,
    fileChangesMap,
    fileKey,
    removeAllHighlightMarkers,
    replaceContentAndRemoveMarkers,
    setServerDataFile,
  ]);

  useEffect(() => {
    // 避免 set 同值导致的额外 render
    const nextVisible = currentFilePendingCount > 0;
    setIsChangesPanelVisible((prev) => (prev === nextVisible ? prev : nextVisible));
  }, [currentFilePendingCount]);

  useEffect(() => {
    const hasActive = currentFilePendingChanges.some((item) => item.index === activeChangeIndex);
    if (hasActive) return;
    // 仅当激活项失效时切到第一条 pending
    const nextIndex = currentFilePendingChanges[0]?.index ?? null;
    setActiveChangeIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [currentFilePendingChanges, activeChangeIndex]);

  useEffect(() => {
    if (isChangesPanelVisible) return;
    clearRemarkHighlight();
  }, [isChangesPanelVisible, clearRemarkHighlight]);

  useEffect(() => {
    clearRemarkHighlight();
  }, [fileKey, clearRemarkHighlight]);

  useEffect(() => {
    const el = editorMainScrollRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const updateHeight = () => {
      const contentEl = el.querySelector(".markdown-editor-content") as HTMLElement | null;
      const proseMirrorEl = contentEl?.querySelector(".ProseMirror") as HTMLElement | null;
      const next = Math.max(
        proseMirrorEl?.scrollHeight ?? 0,
        contentEl?.scrollHeight ?? 0,
        el.scrollHeight,
        el.clientHeight
      );
      setChangesPanelHeight((prev) => (prev === next ? prev : next));
    };
    const scheduleUpdateHeight = () => {
      // 高频 observer 回调合并到同一帧，降低 setState 频率
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateHeight();
      });
    };
    scheduleUpdateHeight();
    const ro = new ResizeObserver(scheduleUpdateHeight);
    ro.observe(el);
    const contentEl = el.querySelector(".markdown-editor-content") as HTMLElement | null;
    const proseMirrorEl = contentEl?.querySelector(".ProseMirror") as HTMLElement | null;
    if (contentEl) ro.observe(contentEl);
    if (proseMirrorEl) ro.observe(proseMirrorEl);
    const mo = new MutationObserver(scheduleUpdateHeight);
    if (proseMirrorEl) {
      mo.observe(proseMirrorEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    window.addEventListener("resize", scheduleUpdateHeight);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", scheduleUpdateHeight);
    };
  }, [fileKey, relationViewMode, currentFilePendingCount]);

  useEffect(() => {
    // if (!shouldShowRemarkOverlay) {
    //   clearRemarkHighlight();
    //   return;
    // }
    const activeChange =
      currentFilePendingChanges.find((item) => item.index === activeChangeIndex) ??
      currentFilePendingChanges[0];
    if (!activeChange) {
      clearRemarkHighlight();
      return;
    }
    // 编辑器与 DOM 在流式切换后可能延迟就绪，增加重试确保最终能高亮到位
    let cancelled = false;
    let timerId: number | null = null;
    const tryHighlight = (attempt = 0) => {
      if (cancelled) return;
      const highlighted = highlightChangeInEditor(activeChange.markerInfo?.highlightId);
      if (highlighted || attempt >= 8) return;
      timerId = window.setTimeout(() => tryHighlight(attempt + 1), 120);
    };
    const rafId = window.requestAnimationFrame(() => {
      tryHighlight(0);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [
    shouldShowRemarkOverlay,
    currentFilePendingChanges,
    activeChangeIndex,
    currentContent,
    clearRemarkHighlight,
    highlightChangeInEditor,
  ]);

  // stepWorkFlow 相关逻辑
  useEffect(() => {
    if (!showStepWorkflow) return;
    const { template, showTake2 } = location.state ?? {};
    if (!template && !showTake2) return;

    let rafId = 0;
    let attempts = 0;
    const maxAttempts = 20;

    const runWhenReady = () => {
      const stepWorkflow = stepWorkflowRef.current;
      if (!stepWorkflow) {
        attempts += 1;
        if (attempts < maxAttempts) {
          rafId = requestAnimationFrame(runWhenReady);
        }
        return;
      }

      if (template) {
        stepWorkflow.startTemplateCreate(template);
        return;
      }

      if (showTake2) {
        stepWorkflow.openStepCreateDialog();
      }
    };

    rafId = requestAnimationFrame(runWhenReady);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [location, showStepWorkflow]);

  const currentLabel = currentEditingNode?.label ?? "";

  // wordCount debounce：字数统计不需要随每次按键实时更新，300ms 后计算一次
  const [wordCount, setWordCount] = useState(() => getWordCount(currentContent));
  const wordCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current);
    wordCountTimerRef.current = setTimeout(() => {
      setWordCount(getWordCount(currentContent));
    }, 300);
    return () => {
      if (wordCountTimerRef.current) clearTimeout(wordCountTimerRef.current);
    };
  }, [currentContent]);

  const isCurrentEditorEmpty = useMemo(
    () => isEditorContentEffectivelyEmpty(currentContent),
    [currentContent]
  );

  const handleEditorSelectionAdd = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) {
        toast.warning("选中的内容为空，无法添加");
        return;
      }
      const exists = selectedTexts.some(
        (item) => item.file === fileKey && item.content.trim() === content
      );
      if (exists) {
        toast.info("该引用内容已在对话输入区");
        return;
      }
      addSelectedText({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file: fileKey || currentEditingId || "",
        content,
      });
      toast.success("已添加到对话引用");
    },
    [addSelectedText, currentEditingId, fileKey, selectedTexts]
  );

  const handleEditorSelectionNote = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content) {
        toast.warning("选中的内容为空，无法添加笔记");
        return;
      }
      const workTitle = workInfo?.title || "作品";
      const fileName = currentLabel || currentEditingId || "未命名文件";
      const noteTitle = `${workTitle}-${fileName}`;
      try {
        await addNote(noteTitle, content, "PC_WORD_HIGHLIGHT");
        toast.success("笔记添加成功");
      } catch (error) {
        console.error("添加笔记失败:", error);
        toast.error("添加笔记失败，请重试");
      }
    },
    [currentEditingId, currentLabel, workInfo?.title]
  );

  useEffect(() => {
    const editorInstance = markdownEditorRef.current?.editor;
    if (editorInstance) {
      setIsEditorActuallyEmpty(editorInstance.isEmpty);
      return;
    }
    setIsEditorActuallyEmpty(isCurrentEditorEmpty);
  }, [currentContent, fileKey, relationViewMode, isCurrentEditorEmpty]);

  useEffect(() => {
    if (!isEditorActuallyEmpty) return;
    const el = editorMainScrollRef.current;
    if (!el) return;
    if (el.scrollTop !== 0) el.scrollTop = 0;
  }, [isEditorActuallyEmpty]);

  const handleEditorMaskWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const scrollRoot = editorMainScrollRef.current;
    if (!scrollRoot) return;
    const viewport = scrollRoot.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null;
    if (!viewport) return;
    event.preventDefault();
    event.stopPropagation();
    viewport.scrollBy({
      top: event.deltaY,
      left: event.deltaX,
      behavior: "auto",
    });
  }, []);

  // 点击标题进入编辑（与 Vue startEditingLabel 一致）
  const startEditingLabel = useCallback((label: string) => {
    setEditingLabelValue(label);
    setIsEditingLabel(true);
    isSavingLabelRef.current = false;
  }, []);

  // 失焦或 Enter 保存（与 Vue saveLabelEdit 一致）
  const saveLabelEdit = useCallback(() => {
    if (isSavingLabelRef.current) return;
    isSavingLabelRef.current = true;

    const trimmed = editingLabelValue.trim();
    if (!trimmed) {
      toast.warning("文件名不能为空");
      isSavingLabelRef.current = false;
      return;
    }
    if (!currentEditingId) {
      isSavingLabelRef.current = false;
      return;
    }
    if (trimmed === currentLabel) {
      setIsEditingLabel(false);
      isSavingLabelRef.current = false;
      return;
    }

    const newPath = getNewPathFromLabel(currentEditingId, trimmed);
    renameServerDataPath(currentEditingId, newPath);
    toast.success("文件名已更新");
    setIsEditingLabel(false);
    isSavingLabelRef.current = false;
  }, [editingLabelValue, currentEditingId, currentLabel, renameServerDataPath]);

  // Esc 取消编辑（与 Vue cancelLabelEdit 一致）
  const cancelLabelEdit = useCallback(() => {
    setIsEditingLabel(false);
    setEditingLabelValue("");
    isSavingLabelRef.current = false;
  }, []);

  const handleCanvasCreateHere = useCallback(
    async (files: Record<string, string>, chain: { data?: { content?: string } } | null) => {
      if (!workId) return;
      const latestState = useEditorStore.getState();
      const editingId = latestState.currentEditingId || DEFAULT_EDITING_FILE_KEY;
      const merged = ensureCanvasTreeSkeleton({
        ...latestState.serverData,
        ...files,
      });
      setServerData(merged);

      let title = chain?.data?.content || "";
      if (title && (!title.startsWith("《") || !title.endsWith("》"))) {
        title = `《${title}》`;
      }
      try {
        await updateWorkInfoReq(workId, {
          ...(title ? { title } : {}),
          stage: "final",
        });
        setWorkInfo({
          ...(title ? { title } : {}),
          stage: "final",
        });
        await saveEditorData("1");
      } catch {
        // 后端保存失败时不打断本地继续创作
      }

      await handleChatHeaderTabChange("chat");
      const prompt = "现在根据故事简介、故事设定和大纲，使用内容创作代理开始逐章写小说正文。";
      setPendingInitialMessage(prompt);
      setShouldAutoSubmitInitialMessage(false);
    },
    [
      workId,
      setServerData,
      setWorkInfo,
      saveEditorData,
      handleChatHeaderTabChange,
    ]
  );

  const handleCanvasCreateNew = useCallback(
    async (files: Record<string, string>, chain: { data?: { content?: string } } | null) => {
      try {
        const req = (await createWorkReq("editor")) as { id?: string };
        if (!req?.id) {
          toast.error("创建作品失败，请重试");
          return;
        }
        const newWorkId = req.id;
        const rawTitle = chain?.data?.content || "";
        const title =
          rawTitle && (!rawTitle.startsWith("《") || !rawTitle.endsWith("》"))
            ? `《${rawTitle}》`
            : rawTitle;
        await updateWorkInfoReq(newWorkId, {
          ...(title ? { title } : {}),
          stage: "final",
        });
        const normalizedFiles = ensureCanvasTreeSkeleton(files);
        await updateWorkVersionReq(newWorkId, JSON.stringify(normalizedFiles), "1");
        const prompt = "现在根据故事简介、故事设定和大纲，使用内容创作代理开始逐章写小说正文。";
        sessionStorage.setItem(
          EDITOR_INITIAL_PARAMS_KEY,
          JSON.stringify({
            message: prompt,
            autoSubmitInitialMessage: false,
          }),
        );
        navigate(`/editor/${newWorkId}`);
      } catch {
        toast.error("创建作品失败，请重试");
      }
    },
    [navigate]
  );

  const handleCanvasFileContentChange = useCallback((filePath: string, content: string) => {
    const normalizedPath = normalizeCanvasFilePath(filePath);
    if (!normalizedPath) return;

    const nextContent = String(content ?? "");
    const tree = treeDataRef.current;
    const candidatePaths = Array.from(new Set([
      normalizedPath,
      normalizedPath.replace(/^角色卡\//, "[角色卡]/"),
      normalizedPath.replace(/^脑洞卡\//, "[脑洞卡]/"),
      normalizedPath.replace(/^梗概卡\//, "[梗概卡]/"),
      normalizedPath.replace(/^设定卡\//, "[设定卡]/"),
      normalizedPath.replace(/^大纲卡\//, "[大纲卡]/"),
      normalizedPath.replace(/^\[角色卡\]\//, "角色卡/"),
      normalizedPath.replace(/^\[脑洞卡\]\//, "脑洞卡/"),
      normalizedPath.replace(/^\[梗概卡\]\//, "梗概卡/"),
      normalizedPath.replace(/^\[设定卡\]\//, "设定卡/"),
      normalizedPath.replace(/^\[大纲卡\]\//, "大纲卡/"),
    ]));
    const targetNode =
      candidatePaths
        .map((candidate) => resolveFileNodeByPath(tree, candidate))
        .find(Boolean) ?? null;
    const targetNodeId = targetNode?.id ? normalizeCanvasFilePath(String(targetNode.id)) : "";

    // 首次从卡片编辑保存时，tree 中可能还没有该文件节点；
    // 用 addServerDataPath 先建路径，避免“第一次不回写编辑区，第二次才正常”。
    if (!targetNodeId) {
      addServerDataPath(normalizedPath, nextContent);
    } else {
      // 1) 先写入画布事件原始路径，保证 serverData 与画布同步
      setServerDataFile(normalizedPath, nextContent);
    }
    // 2) 再写入 tree 实际命中的节点路径，避免“路径别名”导致主编辑区不刷新
    if (targetNodeId && targetNodeId !== normalizedPath) {
      setServerDataFile(targetNodeId, nextContent);
    }

    const currentEditingPath = normalizeCanvasFilePath(currentEditingId || "");
    if (!currentEditingPath) return;
    if (
      currentEditingPath === normalizedPath ||
      (targetNodeId && currentEditingPath === targetNodeId)
    ) {
      setCurrentContent(nextContent);
    }
  }, [addServerDataPath, currentEditingId, normalizeCanvasFilePath, setCurrentContent, setServerDataFile]);

  // 与 Vue handleKnowledgeBaseUpdate 对齐：合并知识库文件、定位文件，并在 blank 阶段升级为 final
  const handleKnowledgeBaseUpdate = useCallback(
    (knowledgeBase: Record<string, string>) => {
      const keys = Object.keys(knowledgeBase ?? {});
      if (keys.length === 0) return;

      const files = ensureCanvasTreeSkeleton({
        ...useEditorStore.getState().serverData,
        ...knowledgeBase,
      });
      setServerData(files);

      const fileId =
        keys.find((k) => k !== "知识库/" && !k.endsWith("/")) ??
        keys.find((k) => !k.endsWith("/")) ??
        keys[0];
      if (fileId && files[fileId] !== undefined) {
        useEditorStore.getState().setCurrentEditingId(fileId);
        setServerDataFile(fileId, files[fileId] ?? "");
      }

      // 使用 ref 读取 stage，避免把 workInfo.stage 放进依赖触发回调重建
      if (workId && workInfoStageRef.current === "blank") {
        setWorkInfo({ stage: "final" });
      }

      toast.success("已发送到知识库");
    },
    [setServerData, setServerDataFile, workId, setWorkInfo]
  );

  const openCanvasFileByPath = useCallback((rawFileName: string, allowPending = false) => {
    const normalized = sanitizeIncomingFilePath(rawFileName);
    if (!normalized) {
      console.warn("[canvas-open-debug] open-file-empty-path", {
        rawFileName,
        allowPending,
      });
      return;
    }

    // 使用 ref 里的最新树数据，保持回调稳定引用
    const tree = treeDataRef.current;
    const normalizedCandidates = Array.from(new Set([
      normalized,
      normalized.replace(/^角色卡\//, "[角色卡]/"),
      normalized.replace(/^脑洞卡\//, "[脑洞卡]/"),
      normalized.replace(/^梗概卡\//, "[梗概卡]/"),
      normalized.replace(/^设定卡\//, "[设定卡]/"),
      normalized.replace(/^大纲卡\//, "[大纲卡]/"),
    ]));
    const targetNode =
      normalizedCandidates
        .map((candidate) => resolveFileNodeByPath(tree, candidate))
        .find(Boolean) ?? null;

    if (!targetNode) {
      // 流式生成中，目标文件/目录可能还没写入树；先记下来，等 treeData 更新后再自动跳转
      if (allowPending && chatInputStatusRef.current === "streaming") {
        pendingFileNameClickRef.current = normalized;
      }
      return;
    }
    // 与 Vue 行为一致：只定位到左侧目录并切换当前编辑文件，不在这里改写 serverData
    useEditorStore.getState().setCurrentEditingId(targetNode.id, targetNode as any);
    const normalizedTargetPath = normalizeCanvasFilePath(normalized);
    const normalizedNodePath = normalizeCanvasFilePath(String(targetNode.id ?? ""));
    const shouldOpenCanvasPreview =
      canvasTaggedFilePathSetRef.current.has(normalizedTargetPath) ||
      canvasTaggedFilePathSetRef.current.has(normalizedNodePath) ||
      isLikelyCanvasGeneratedPath(normalizedTargetPath) ||
      isLikelyCanvasGeneratedPath(normalizedNodePath);
    if (shouldOpenCanvasPreview) {
      requestCanvasFocusByFilePath(targetNode.id);
    }
    pendingFileNameClickRef.current = "";
  }, [isLikelyCanvasGeneratedPath, normalizeCanvasFilePath, requestCanvasFocusByFilePath]);

  const handleFileNameClick = useCallback((rawFileName: string) => {
    openCanvasFileByPath(rawFileName, true);
  }, [openCanvasFileByPath]);

  const handleTreePathRenameForCanvas = useCallback((oldPath: string, newPath: string) => {
    const normalizedOldPath = sanitizeIncomingFilePath(oldPath);
    const normalizedNewPath = sanitizeIncomingFilePath(newPath);
    if (!normalizedOldPath || !normalizedNewPath) return;
    insCanvasRef.current?.syncFilePathByRename(normalizedOldPath, normalizedNewPath);
  }, [sanitizeIncomingFilePath]);

  useEffect(() => {
    const pending = pendingFileNameClickRef.current;
    if (!pending) return;

    openCanvasFileByPath(pending, false);
  }, [treeData, openCanvasFileByPath]);

  // 进入编辑态后聚焦并选中输入框
  useEffect(() => {
    if (!isEditingLabel) return;
    const t = setTimeout(() => {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [isEditingLabel]);

  // 切换当前文件时退出标题编辑态
  useEffect(() => {
    if (!currentEditingId) setIsEditingLabel(false);
  }, [currentEditingId]);

  const chatSessionId = chatCurrentSession?.id ?? "";
  const isCanvasCompactMode =
    isCanvasFilePreviewMode && !isCanvasPreviewEditorClosed;
  const isEditorHiddenForCanvasPreview =
    activeTab === "canvas" && isCanvasFilePreviewMode && isCanvasPreviewEditorClosed;
  useEffect(() => {
    latestChatSessionIdRef.current = chatSessionId;
  }, [chatSessionId]);
  const displayChatMessages = useMemo(
    () => (streamingMessage ? [...chatMessages, streamingMessage] : chatMessages),
    [chatMessages, streamingMessage]
  );
  const lastUserMessageId = useMemo(() => {
    for (let i = displayChatMessages.length - 1; i >= 0; i--) {
      const m = displayChatMessages[i];
      if (m?.role === "user") return m.id;
    }
    return "";
  }, [displayChatMessages]);
  const handleOpenAssociationSelector = useCallback(() => {
    setShowAssociationSelector(true);
  }, []);
  const handleToggleTodosExpanded = useCallback(() => {
    setTodosExpanded((expanded) => !expanded);
  }, []);
  const handleChatSendMessage = useCallback(
    (msg: ChatMessage) => sendChatText(msg.content ?? "", { addUserMessage: true }),
    [sendChatText]
  );
  const handleRegenerateLastUserQuery = useCallback(
    (query: string) => {
      const text = String(query ?? "").trim();
      if (!text) return;
      if (chatInputStatusRef.current === "streaming") {
        toast.warning("正在生成中，请稍后再试");
        return;
      }
      void sendChatText(text, { reload: true, addUserMessage: false });
    },
    [sendChatText]
  );
  const handleSaveCurrentChatSession = useCallback(() => {
    saveCurrentSession("chat");
  }, [saveCurrentSession]);
  const handleAssociationConfirm = useCallback(
    (ids: string[]) => {
      setAssociationTags(filterAssociationIds(ids));
    },
    [setAssociationTags]
  );
  const handleHiltReject = useCallback(
    async (rejectedMsg: AgentCustomMessageItem) => {
      const sessionId = latestChatSessionIdRef.current || chatSessionId;
      const targetWorkId = workId;
      // 若用户在流式过程中触发“拒绝”，需要立即中断当前流式请求，避免继续输出/占用状态
      handleStopStreaming(false, false);
      if (!sessionId || !targetWorkId) return;
      updateLastChatMessage((prev) => {
        const custom = prev.customMessage ?? [];
        return {
          ...prev,
          customMessage: custom.map((item, idx) => {
            const hasHiltTodos =
              Array.isArray((item as { hiltTodos?: unknown[] } | undefined)?.hiltTodos) &&
              ((item as { hiltTodos?: unknown[] }).hiltTodos?.length ?? 0) > 0;
            const hasWriteTodos =
              Array.isArray((item as { tool_calls?: { name?: string; args?: { todos?: unknown[] } }[] } | undefined)?.tool_calls) &&
              (((item as { tool_calls?: { name?: string; args?: { todos?: unknown[] } }[] }).tool_calls ?? []).some(
                (tc) => tc.name === "write_todos" && Array.isArray(tc.args?.todos) && tc.args.todos.length > 0
              ));
            const isPendingHiltCandidate = hasHiltTodos || hasWriteTodos;
            const shouldReject =
              item.id === rejectedMsg.id ||
              (idx === custom.length - 1 && isPendingHiltCandidate);
            return shouldReject ? { ...item, hiltStatus: "rejected" as const } : item;
          }),
        };
      });
      // 拒绝后仅更新本地状态并拉取联想提示词，不再触发新的 chat query 请求
      try {
        const res = await generateGuideReq(sessionId, Number(targetWorkId)) as {
          guides?: string[] | string
        } | undefined;
        const guides = parseGuidesPayload(res?.guides);
        if (guides.length > 0) {
          updateLastChatMessage((prev) => {
            const custom = prev.customMessage ?? [];
            return {
              ...prev,
              customMessage: custom.map((item) =>
                item.id === rejectedMsg.id ? { ...item, suggestions: guides } : item
              ),
            };
          });
        }
      } catch (_) {
        // 联想提示词失败静默忽略
      }
    },
    [chatSessionId, workId, handleStopStreaming, updateLastChatMessage]
  );
  const handleHiltApprove = useCallback(
    (approvedMsg: AgentCustomMessageItem) => {
      if (hiltApproveInFlightRef.current || isHiltApproveStreaming || langGraphStream.isStreaming) {
        return;
      }
      hiltApproveInFlightRef.current = true;
      updateLastChatMessage((prev) => {
        const custom = prev.customMessage ?? [];
        return {
          ...prev,
          customMessage: custom.map((item) =>
            item.id === approvedMsg.id ? { ...item, hiltStatus: "approved" as const } : item
          ),
        };
      });
      setIsHiltApproveStreaming(true);
      sendChatText("", { command: "approve", addUserMessage: false });
    },
    [isHiltApproveStreaming, langGraphStream.isStreaming, updateLastChatMessage, sendChatText]
  );
  const handleRendererSendMessage = useCallback(
    (text: string, reload = false) =>
      sendChatText(text, { reload, addUserMessage: !reload }),
    [sendChatText]
  );
  const renderChatMessage = useCallback(
    (msg: ChatMessage, options?: { isLastMessage?: boolean }) => {
      const hasCustomMessage =
        msg.customMessage &&
        Array.isArray(msg.customMessage) &&
        msg.customMessage.length > 0;
      const hasFiles =
        msg.files && Array.isArray(msg.files) && msg.files.length > 0;
      const hasSelectedTexts =
        msg.selectedTexts &&
        Array.isArray(msg.selectedTexts) &&
        msg.selectedTexts.length > 0;
      const hasFilesOrSelected = hasFiles || hasSelectedTexts;

      return (
        <div
          className={clsx(
            "w-full flex text-sm",
            msg.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={clsx(
              hasCustomMessage
                ? "w-full max-w-none rounded-none bg-transparent px-0 py-0 text-foreground"
                : "rounded-lg px-3 py-2 max-w-[85%] bg-primary text-primary-foreground"
            )}
          >
            {hasCustomMessage ? (
              <AgentCustomMessageRenderer
                customMessage={msg.customMessage!}
                activeTab="chat"
                isLastMessage={options?.isLastMessage ?? false}
                streamingStatus={chatInputStatus === "streaming" ? "streaming" : "ready"}
                currentMessageId={msg.id}
                streamingMessageId={streamingMessageIdRef.current}
                onSendToKnowledgeBase={handleKnowledgeBaseUpdate}
                onFileNameClick={handleFileNameClick}
                onHiltReject={handleHiltReject}
                onHiltApprove={handleHiltApprove}
                onSendMessage={handleRendererSendMessage}
              />
            ) : (
              <>
                {hasFilesOrSelected && (
                  <div className="message-with-files space-y-1">
                    {hasSelectedTexts && (
                      <SelectedTextDisplay
                        texts={msg.selectedTexts!}
                      />
                    )}
                    {hasFiles && (
                      <FileMessageDisplay
                        files={msg.files as FileItemType[]}
                        onFileClick={handleMessageFileClick}
                      />
                    )}
                    <div className="message-content-wrapper text-right">
                      <MarkdownRenderer
                        content={msg.content || ""}
                        onFileNameClick={handleFileNameClick}
                      />
                    </div>
                  </div>
                )}
                {!hasFilesOrSelected && (
                  <div className="message-content-wrapper whitespace-pre-wrap wrap-break-word">
                    <div className="flex items-start">
                      {msg.role === "user" && msg.id === lastUserMessageId && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="重新生成"
                              className="shrink-0  m-[0.5em]"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRegenerateLastUserQuery(msg.content ?? "");
                              }}
                            >
                              <Iconfont
                                unicode="&#xe640;"
                                className="text-xs cursor-pointer"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">重新生成</TooltipContent>
                        </Tooltip>
                      )}
                      <MarkdownRenderer
                        content={msg.content || ""}
                        onFileNameClick={handleFileNameClick}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    },
    [
      chatInputStatus,
      handleKnowledgeBaseUpdate,
      handleFileNameClick,
      handleHiltReject,
      handleHiltApprove,
      handleRendererSendMessage,
      handleMessageFileClick,
      handleRegenerateLastUserQuery,
      lastUserMessageId,
    ]
  );
  const chatSlots = useMemo(
    () => ({
      todos: (
        <TodosFixedPanel
          todos={langGraphStream.todos}
          expanded={todosExpanded}
          onToggleExpand={handleToggleTodosExpanded}
          isStreaming={chatInputStatus === "streaming"}
        />
      ),
      renderMessage: renderChatMessage,
      footer: (
        <div className="text-center px-4 text-[11px] text-[#ccc] w-full">
          {`<内容由AI生成，仅供参考>`}
        </div>
      ),
    }),
    [
      langGraphStream.todos,
      todosExpanded,
      handleToggleTodosExpanded,
      chatInputStatus,
      renderChatMessage,
    ]
  );

  return (
    <div className="page-editor-panel flex h-screen w-full flex-col overflow-hidden bg-(--bg-primary)">
      <EditorTopToolbar
        onBackClick={handleBackClick}
        onSaveClick={handleSaveClick}
        onUpdateTitle={handleTitleUpdate}
        onHelpWriteClick={helpWriteClick}
        updatedTime={workInfo.updatedTime}
        hidePromptActions={isShortPlayEditor}
      />
      <div
        ref={resizeContainerRef}
        className="flex flex-1 min-h-0 min-w-0 overflow-hidden px-2.5 pb-2.5 pt-0 bg-(--bg-editor)"
      >
        {/* 左侧面板 */}
        <div
          ref={leftPanelRef}
          className="box-border shrink-0 h-full rounded-[20px] border border-(--border-color) overflow-hidden bg-(--bg-primary) p-2"
          style={{ width: `${leftPanelWidthRem}rem` }}
        >
          <EditorTreeSidebar
            className="h-full"
            onFileSelect={handleTreeFileSelect}
            onPathRenamed={handleTreePathRenameForCanvas}
          />
        </div>

        <EditorResizeHandle
          position="left"
          onDragStart={onLeftResizeStart}
          onDrag={onLeftResize}
          className="shrink-0"
        />

        {/* 中间编辑面板 */}
        {!isEditorHiddenForCanvasPreview && (
        <div
          className="flex-1 min-w-0 flex flex-col h-full rounded-[20px] border border-(--border-color) overflow-hidden bg-(--bg-editor) relative"
          style={{ minWidth: "0rem" }}
        >
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {/* 字数栏 */}
            <div className="flex flex-row-reverse h-[38px] px-6 items-center shrink-0 min-w-0">
              <div className="flex h-full items-center gap-0 min-w-0">
                {isCanvasCompactMode ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      title="关闭编辑区"
                      onClick={handleCloseCanvasPreviewEditor}
                    >
                      关闭编辑区
                    </Button>
                    <div className="w-px h-[14px] bg-[#9a9a9a] mx-2.5"/>
                  </>
                ) : null}
                <span className="text-sm text-(--text-primary)">字数: {wordCount}</span>
                <div className="w-px h-[14px] bg-[#9a9a9a] mx-2.5"/>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title="撤销 (Ctrl+Z)"
                  onClick={handleUndo}
                >
                  <IconFont unicode="\ue61b" className="text-base"/>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title="反撤销 (Ctrl+Y)"
                  onClick={handleRedo}
                >
                  <IconFont unicode="\ue61c" className="text-base"/>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title="查找替换"
                  onClick={handleSearchReplace}
                >
                  <IconFont unicode="\ue61e" className="text-base"/>
                </Button>
                <div className="w-px h-[14px] bg-[#9a9a9a] mx-2.5"/>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title="时光机"
                  onClick={() => void openTimeMachine()}
                >
                  <IconFont unicode="\ue61f" className="text-base"/>
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title="字体设置"
                    >
                      <IconFont unicode="\ue61d" className="text-base"/>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div
                      className="px-5 py-4 border-b border-(--el-border-color-lighter) text-sm font-semibold text-center">
                      编辑器设置
                    </div>
                    <div className="p-5 space-y-5">
                      <div className="space-y-2">
                        <div className="text-sm">字号</div>
                        <div className="flex items-center gap-3">
                          <Slider
                            className="**:data-[slot=slider-track]:bg-(--border-color) **:data-[slot=slider-range]:bg-(--bg-editor-save) **:data-[slot=slider-thumb]:border-(--bg-editor-save)"
                            value={[editorSettings.fontSize]}
                            min={12}
                            max={48}
                            step={1}
                            onValueChange={(v) =>
                              setEditorSettings((prev) => ({ ...prev, fontSize: v[0] ?? prev.fontSize }))
                            }
                          />
                          <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                            {editorSettings.fontSize}px
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm">行间距</div>
                        <div className="flex items-center gap-3">
                          <Slider
                            className="**:data-[slot=slider-track]:bg-(--border-color) **:data-[slot=slider-range]:bg-(--bg-editor-save) **:data-[slot=slider-thumb]:border-(--bg-editor-save)"
                            value={[editorSettings.lineHeight]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(v) =>
                              setEditorSettings((prev) => ({ ...prev, lineHeight: v[0] ?? prev.lineHeight }))
                            }
                          />
                          <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                            {editorSettings.lineHeight.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm">字重</div>
                        <Select
                          value={String(editorSettings.fontWeight)}
                          onValueChange={(value) =>
                            setEditorSettings((prev) => ({ ...prev, fontWeight: Number(value) }))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="请选择字重"/>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="300">细体 (300)</SelectItem>
                            <SelectItem value="400">常规 (400)</SelectItem>
                            <SelectItem value="500">中等 (500)</SelectItem>
                            <SelectItem value="600">中粗 (600)</SelectItem>
                            <SelectItem value="700">粗体 (700)</SelectItem>
                            <SelectItem value="900">特粗 (900)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm">左右边距</div>
                        <div className="flex items-center gap-3">
                          <Slider
                            className="**:data-[slot=slider-track]:bg-(--border-color) **:data-[slot=slider-range]:bg-(--bg-editor-save) **:data-[slot=slider-thumb]:border-(--bg-editor-save)"
                            value={[editorSettings.margin]}
                            min={0}
                            max={200}
                            step={10}
                            onValueChange={(v) =>
                              setEditorSettings((prev) => ({ ...prev, margin: v[0] ?? prev.margin }))
                            }
                          />
                          <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                            {editorSettings.margin}px
                          </span>
                        </div>
                      </div>
                      <label className="flex items-center justify-between">
                        <span className="text-sm">首行缩进</span>
                        <Switch
                          checked={editorSettings.textIndentEnabled}
                          onCheckedChange={(checked: boolean) =>
                            setEditorSettings((prev) => ({ ...prev, textIndentEnabled: checked }))
                          }
                        />
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 编辑区主体 */}
            <div
              className="flex flex-1 min-h-0 min-w-0 relative"
              onPointerDownCapture={(event) => {
                if (isEditorEditable) return;
                const target = event.target as HTMLElement | null;
                if (!target) return;
                // 修改面板保持可交互
                if (target.closest('[data-edit-changes-panel="true"]')) return;
                // 仅拦截编辑内容区交互，避免进入编辑态
                if (!target.closest('[data-editor-scroll-area="true"]')) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onClickCapture={(event) => {
                if (isEditorEditable) return;
                const target = event.target as HTMLElement | null;
                if (!target) return;
                if (target.closest('[data-edit-changes-panel="true"]')) return;
                if (!target.closest('[data-editor-scroll-area="true"]')) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <div className="relative flex flex-1 min-h-0 min-w-0 flex-col"
                   style={{ minWidth: `${CENTER_EDITOR_MIN_REM}rem`, }}>
                <ScrollArea
                  ref={editorMainScrollRef}
                  data-editor-scroll-area="true"
                  type={!isEditorEditable ? "always" : "hover"}
                  className={clsx(
                    "h-full relative overflow-x-hidden overflow-y-auto",
                    !isEditorEditable && "cursor-not-allowed-all",
                    isStreamingOverlayVisible && "cursor-not-allowed"
                  )}
                  key={fileKey}
                >
                  <div className="min-h-[calc(100vh-108px)] h-full flex flex-col relative overflow-x-hidden">
                    <div className="editor-content-layout flex flex-1 min-h-0 relative min-w-0 overflow-x-hidden">
                      <div className="flex flex-col flex-1 min-h-0 min-w-0 relative">
                        <div className="flex flex-col flex-1 min-h-0">
                          {currentEditingId ? (
                            isEditingLabel ? (
                              <input
                                ref={labelInputRef}
                                type="text"
                                disabled={!isEditorEditable}
                                className="px-2 py-1 h-9 w-full leading-9 text-[30px] text-(--text-primary) truncate shrink-0 border border-transparent rounded bg-transparent outline-none focus:border-primary"
                                value={editingLabelValue}
                                onChange={(e) => setEditingLabelValue(e.target.value)}
                                onBlur={saveLabelEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveLabelEdit();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelLabelEdit();
                                  }
                                }}
                              />
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                className="h-9 leading-9 text-[30px] text-(--text-primary) truncate shrink-0 cursor-pointer"
                                onClick={() => {
                                  if (!isEditorEditable) return;
                                  startEditingLabel(currentLabel);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    if (!isEditorEditable) return;
                                    startEditingLabel(currentLabel);
                                  }
                                }}
                              >
                                {currentLabel}
                              </div>
                            )
                          ) : (
                            <div className="h-9 leading-9 text-[30px] text-(--text-primary) truncate shrink-0">
                              {currentLabel}
                            </div>
                          )}
                          <div className="flex-1 min-h-[200px] flex flex-col gap-2 relative">
                            <MainEditor
                              ref={markdownEditorRef}
                              className="editor-outer-scroll-mode"
                              fontClassName="font-KaiTi"
                              value={currentContent}
                              onChange={handleMainEditorChange}
                              placeholder={EDITOR_PLACEHOLDER}
                              // readonly={!isEditorEditable}
                              btns={["edit", "expand", "add", "note"]}
                              onSelectionAdd={handleEditorSelectionAdd}
                              onSelectionNote={handleEditorSelectionNote}
                              needSelectionToolbar
                              minHeight={400}
                            />
                          </div>
                        </div>
                        {showStepWorkflow ? <StepWorkflow ref={stepWorkflowRef} /> : null}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                {shouldShowRemarkOverlay && (
                  <div className="pointer-events-none absolute bottom-3 left-2 z-40">
                    <div
                      className="pointer-events-auto flex w-fit items-center gap-2 rounded-md bg-[rgba(255,255,255,0.92)] px-2 py-1 shadow-sm">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCurrentPageAcceptAll}
                      >
                        当前页面全部接受
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCurrentPageRejectAll}
                      >
                        当前页面全部撤销
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsChangesPanelVisible((v) => !v)}
                      >
                        修改详情({currentFilePendingCount})
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {isChangesPanelVisible && (
                <div
                  data-edit-changes-panel="true"
                  className="h-full shrink-0 min-h-0 overflow-hidden border-l border-(--border-color) bg-(--bg-primary)"
                  style={{ width: `${CHANGES_PANEL_WIDTH_REM}rem` }}
                >
                  <EditChangesPanel
                    changes={currentFileChanges}
                    onAccept={handleAcceptChange}
                    onReject={handleRejectChange}
                    activeChangeIndex={activeChangeIndex}
                    onActiveChangeIndexChange={setActiveChangeIndex}
                    panelHeight={changesPanelHeight}
                    onSelectChange={(change) => {
                      if (!change) {
                        clearRemarkHighlight();
                        return;
                      }
                      highlightChangeInEditor(change.markerInfo?.highlightId);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          {!isEditorEditable && (
            <div
              className="absolute inset-0 z-20 bg-white/35 cursor-not-allowed"
              style={{ right: isChangesPanelVisible ? `${CHANGES_PANEL_WIDTH_REM}rem` : 0 }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onPointerMove={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onWheel={handleEditorMaskWheel}
            />
          )}
        </div>
        )}

        {!isEditorHiddenForCanvasPreview && (
        <EditorResizeHandle
          position="right"
          onDragStart={onRightResizeStart}
          onDrag={onRightResize}
          className="shrink-0"
        />
        )}

        {/* 右侧聊天面板：与 Vue 一致，chat-content 内仅消息区滚动、输入框固定在底部 */}
        <div
          ref={rightPanelRef}
          className="box-border shrink-0 h-full flex flex-col rounded-[20px] border border-(--border-color) overflow-hidden bg-(--bg-primary) isolate"
          style={{ width: `${rightPanelWidthRem}rem` }}
        >
          <ChatHeader
            ref={chatHeaderRef}
            activeTab={activeTab}
            currentSessionId={currentSessionId}
            workId={workId}
            onTabChange={handleChatHeaderTabChange}
            onNewChat={() => createNewSession(activeTab)}
            onSwitchSession={(id) => loadSession(activeTab, id)}
            onSaveCurrentSession={() => saveCurrentSession(activeTab)}
            checkStreamingStatusAndConfirm={checkStreamingStatusAndConfirm}
            canvasActionsSlot={
              activeTab === "canvas" ? (
                <CanvasToolbar
                  api={insCanvasRef.current}
                  autoSyncDirectory={autoSyncCanvasDirectory}
                  onAutoSyncDirectoryChange={setAutoSyncCanvasDirectory}
                />
              ) : null
            }
          />
          <div className="flex-1 min-h-0 p-2 flex flex-col overflow-hidden">
            {activeTab === "canvas" ? (
              workId ? (
                <div
                  className="relative h-full w-full"
                  onDragOverCapture={handleCanvasFileDragOver}
                  onDragLeaveCapture={handleCanvasFileDragLeave}
                  onDropCapture={handleCanvasFileDrop}
                >
                  {isCanvasSnapshotPending ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      正在加载画布...
                    </div>
                  ) : (
                    <InsCanvas
                      key={`ins-canvas-${workId}-${canvasInitialSnapshotKey}`}
                      ref={insCanvasRef}
                      workId={workId}
                      nodes={canvasInitialNodes as any}
                      edges={canvasInitialEdges as any}
                      inspirationDrawId={canvasInitialInspirationDrawId}
                      onCreateHere={handleCanvasCreateHere}
                      onCreateNew={handleCanvasCreateNew}
                      autoSyncDirectory={autoSyncCanvasDirectory}
                      onAutoSyncDirectory={handleCanvasAutoSyncDirectory}
                      onCanvasFileContentChange={handleCanvasFileContentChange}
                      onCanvasOpenFileRequest={handleFileNameClick}
                      onMessage={(type, msg) => {
                        if (type === "success") toast.success(msg);
                        else if (type === "error") toast.error(msg);
                        else toast(msg);
                      }}
                      onCanvasReady={onCanvasReady}
                    />
                  )}
                  {isCanvasFileDragOver ? (
                    <div className="pointer-events-none absolute inset-0 z-20 rounded-[20px] border-2 border-dashed border-[#8E77F0] bg-[#8E77F0]/8">
                      <div className="flex h-full items-center justify-center">
                        <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#8E77F0] shadow-sm">
                          释放后创建信息卡
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  请先选择或创建作品
                </div>
              )
            ) : (
              <>
                <ProChatContainer
                  workId={workId ?? undefined}
                  activeTab="chat"
                  initialMessage={pendingInitialMessage}
                  autoSubmitInitialMessage={shouldAutoSubmitInitialMessage}
                  initialIsAnswerOnly={isAnswerOnly}
                  inputStatus={chatInputStatus}
                  onStopStreaming={handleStopStreaming}
                  messages={displayChatMessages}
                  sessionId={chatSessionId}
                  onSendMessage={handleChatSendMessage}
                  onSaveCurrentSession={handleSaveCurrentChatSession}
                  checkStreamingStatusAndConfirm={checkStreamingStatusAndConfirm}
                  isHomePage={false}
                  hideAssociationFeature={false}
                  onOpenAssociationSelector={handleOpenAssociationSelector}
                  isAnswerOnly={isAnswerOnly}
                  onAnswerOnlyChange={setIsAnswerOnly}
                  slots={chatSlots}
                >
                  <ProChatPanel creationType={isShortPlayEditor ? "script" : "novel"} />
                </ProChatContainer>
                <AssociationSelectorDialog
                  open={showAssociationSelector}
                  onOpenChange={setShowAssociationSelector}
                  treeData={treeData}
                  selectedIds={associationTags}
                  onConfirm={handleAssociationConfirm}
                />
              </>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showSearchReplaceDialog} onOpenChange={setShowSearchReplaceDialog}>
        <DialogContent className="sm:max-w-[520px] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>查找与替换</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 w-full min-w-0">
            <div className="space-y-2 w-full min-w-0">
              <div className="text-sm font-medium">查找</div>
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="请输入要查找的内容"
              />
            </div>
            <div className="space-y-2 w-full min-w-0">
              <div className="text-sm font-medium">替换</div>
              <Input
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="请输入要替换的内容"
              />
            </div>
            {searchText.trim() && searchMatches.length > 0 && (
              <div className="w-full min-w-0 rounded-md border border-(--el-border-color-lighter) overflow-hidden">
                <div
                  className="px-3 py-2 text-xs text-(--text-secondary) bg-(--bg-secondary) border-b border-(--el-border-color-lighter)">
                  找到 {searchMatches.length} 个匹配项
                </div>
                <div className="max-h-[200px] overflow-y-auto overflow-x-hidden">
                  {searchMatches.slice(0, 10).map((m, idx) => (
                    <div
                      key={`${m.actualIndex}-${idx}`}
                      className="px-3 py-2 cursor-default text-xs border-b border-(--el-border-color-lighter) last:border-b-0 transition-colors hover:bg-(--bg-hover)"
                    >
                      <div className="text-(--text-secondary) truncate">{m.preview}</div>
                    </div>
                  ))}
                  {searchMatches.length > 10 && (
                    <div className="px-3 py-2 text-xs text-center text-muted-foreground">
                      还有 {searchMatches.length - 10} 个匹配项...
                    </div>
                  )}
                </div>
              </div>
            )}
            {searchText.trim() && searchMatches.length === 0 && (
              <div
                className="w-full flex items-center align-middle justify-center gap-2 min-w-0 rounded-md px-3 py-4 text-xs text-center text-muted-foreground">
                <CircleAlert size={12} strokeWidth={1.25}/>
                <span className="text-xs text-muted-foreground">未找到匹配的内容</span>
              </div>
            )}
          </div>
          <DialogFooter className="w-full min-w-0">
            <Button variant="outline" onClick={closeSearchReplaceDialog}>取消</Button>
            <Button onClick={handleReplaceAll} disabled={searchMatches.length === 0}>替换</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTimeMachineDialog} onOpenChange={setShowTimeMachineDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>时光机</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[460px] overflow-y-auto">
            {loadingVersions ? (
              <div className="text-sm text-muted-foreground py-8 text-center">正在加载版本...</div>
            ) : workVersionList.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">暂无版本记录</div>
            ) : (
              workVersionList.map((version, idx) => (
                <div
                  key={version.versionId}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {version.isAutoSaved === "1" ? "自动保存" : "手动保存"}
                      {idx === 0 ? <span className="ml-2 text-xs text-green-600">最新</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {version.updatedTime ? new Date(version.updatedTime).toLocaleString("zh-CN") : "-"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void restoreVersion(version.versionId)}
                    disabled={restoringVersionId === version.versionId}
                  >
                    {restoringVersionId === version.versionId ? "恢复中..." : "恢复"}
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeMachineDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
};

export default MarkdownEditorPage;
