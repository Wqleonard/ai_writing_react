import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import clsx from "clsx";
import MainEditor, { type MarkdownEditorRef } from "@/components/MainEditor";
import { StepWorkflow, type StepWorkflowRef } from "@/components/StepWorkflow";
import type { Template as StepTemplate } from "@/components/StepWorkflow/types";
import IconFont from "@/components/IconFont/Iconfont";
import {
  EditorTopToolbar,
  EditorTreeSidebar,
  EditorResizeHandle,
  EditChangesPanel,
  type EditorChangeItem,
} from "./components";
import { ProChatContainer, ProChatPanel } from "@/components/ProChatContainer";
import { emitCreationInputSubmit } from "@/services/chatSubmitBridge";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { FileMessageDisplay } from "@/components/FileMessageDisplay";
import { SelectedTextDisplay } from "@/components/SelectedTextDisplay";
import { AgentCustomMessageRenderer } from "@/components/AgentCustomMessageRenderer";
import { TodosFixedPanel } from "@/components/TodosFixedPanel/TodosFixedPanel";
import { AssociationSelectorDialog } from "@/components/AssociationSelectorDialog";
import { ChatHeader, type ChatHeaderRef } from "@/components/ChatHeader";
import InsCanvas, { type InsCanvasApi } from "@/components/InsCanvas/InsCanvas";
import { Button } from "@/components/ui/Button";
import { useDualTabChat } from "@/hooks/useDualTabChat";
import { useLangGraphStream, type EditFileArgsType } from "@/hooks/useLangGraphStream";
import { resetLLMState, useLLM } from "@/hooks/useLLM";
import type {
  ChatMessage,
  FileItem as FileItemType,
} from "@/stores/chatStore";
import type { ChatMessage as DualTabChatMessage } from "@/types/chat";
import type { ChatTabType } from "@/types/chat";
import { useChatInputStore } from "@/stores/chatInputStore";
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
import { serverDataToTree, findNodeLabelById } from "@/stores/editorStore/utils";
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
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { CircleAlert } from "lucide-react";

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

type EditorInitialParams = {
  message?: string;
  autoSubmitInitialMessage?: boolean;
  isAnswerOnly?: boolean;
  modelLLM?: string;
  selectedWritingStyle?: string;
  template?: StepTemplate | string;
  skipRecommendDialog?: boolean;
  associationTags?: string[];
  selectedNotes?: import("@/api/notes").Note[];
  selectedFiles?: FileItemType[];
  selectedTexts?: import("@/stores/chatStore").SelectedText[];
  selectedTools?: import("@/stores/chatInputStore/types").AgentTalkToolValue[];
  isShowAnswerTip?: boolean;
};

const EDITOR_INITIAL_PARAMS_KEY = "editorInitialParams";
const RANKING_LIST_TRANSMISSION_KEY = "rankingListTransmission";

type RankingListTransmissionParams = {
  content?: string;
  message?: string;
  disableAutoSubmit?: boolean;
};

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

type FileChangesMap = Record<string, EditorChangeItem[]>;

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
                       }: {
  api: InsCanvasApi | null
}) {
  if (!api) return null;
  const canSaveCanvas = !!api.inspirationDrawId;
  const addCanvasTitle = api.isLoading ? "生成选题中，请稍候" : "新增画布";
  const saveCanvasTitle = canSaveCanvas ? "保存画布" : "请先创建画布";
  return (
    <div className="flex h-10 items-center gap-1 px-1.5">
      <Button
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
      </Button>
    </div>
  );
}

function MermaidRelationPreview({ markdown }: { markdown: string }) {
  const [svgs, setSvgs] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let disposed = false;
    const fencedBlocks = Array.from(
      markdown.matchAll(/```mermaid\s*([\s\S]*?)```/g)
    ).map((m) => (m[1] || "").trim()).filter(Boolean);
    const plainText = markdown.trim();
    const looksLikeMermaid = /(^|\n)\s*(graph|flowchart|erDiagram|classDiagram|sequenceDiagram|stateDiagram|mindmap|journey|gantt|pie|timeline|gitGraph)\b/.test(plainText);
    const blocks = fencedBlocks.length > 0
      ? fencedBlocks
      : looksLikeMermaid
        ? [plainText]
        : [];
    if (blocks.length === 0) {
      setSvgs([]);
      setError("未检测到 Mermaid 关系图代码块");
      return;
    }

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "default",
        });
        const rendered: string[] = [];
        for (let i = 0; i < blocks.length; i++) {
          const id = `relation-${Date.now()}-${i}`;
          const { svg } = await mermaid.render(id, blocks[i]);
          rendered.push(svg);
        }
        if (!disposed) {
          setSvgs(rendered);
          setError("");
        }
      } catch {
        if (!disposed) {
          setSvgs([]);
          setError("关系图渲染失败，请检查 Mermaid 语法");
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [markdown]);

  if (error) {
    return (
      <div className="h-full w-full overflow-auto rounded-md border bg-background p-4 text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto rounded-md border bg-background p-4 space-y-4">
      {svgs.map((svg, idx) => (
        <div
          key={idx}
          className="w-full overflow-auto [&>svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ))}
    </div>
  );
}

function RoleTablePreview({ markdown }: { markdown: string }) {
  return (
    <div className="h-full w-full overflow-auto rounded-md border bg-background p-4">
      <MarkdownRenderer content={markdown}/>
    </div>
  );
}

const MarkdownEditorPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { workId } = useParams<{ workId: string }>();
  const stepWorkflowRef = useRef<StepWorkflowRef>(null);
  const [pendingStepTemplate, setPendingStepTemplate] = useState<StepTemplate | null>(null);
  const [disableRecommendAutoOpen, setDisableRecommendAutoOpen] = useState(() => {
    try {
      const stateParams = (location.state as { skipRecommendDialog?: boolean } | null) ?? null;
      if (stateParams?.skipRecommendDialog) return true;
      const paramsStr =
        typeof window !== "undefined"
          ? sessionStorage.getItem(EDITOR_INITIAL_PARAMS_KEY)
          : null;
      if (!paramsStr) return false;
      const parsed = JSON.parse(paramsStr) as { skipRecommendDialog?: boolean } | null;
      return !!parsed?.skipRecommendDialog;
    } catch {
      return false;
    }
  });
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
    setWorkId,
    createNewSession,
    loadSession,
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
  const guideRequestRef = useRef<{ sessionId: string; workId: number | string } | null>(null);
  const stoppedByUserRef = useRef(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [todosExpanded, setTodosExpanded] = useState(true);

  const langGraphStream = useLangGraphStream({
    onMessagesUpdate: (messages) => {
      setStreamingMessage((prev) => {
        const id = (prev?.id ?? streamingMessageIdRef.current) || `assistant_${Date.now()}`;
        if (!streamingMessageIdRef.current) streamingMessageIdRef.current = id;
        const msg: ChatMessage = {
          id,
          role: "assistant",
          content: "",
          createdAt: prev?.createdAt ?? new Date(),
          messageType: "normal",
          mode: "chat",
          customMessage: messages,
        };
        streamingMessageRef.current = msg;
        return msg;
      });
    },
    onUpdateFiles: (files, fileId, editInfoList) => {
      const mergedFiles = { ...useEditorStore.getState().serverData, ...files };
      setServerData(mergedFiles);
      const targetFileId =
        fileId && mergedFiles[fileId] !== undefined
          ? fileId
          : currentEditingId && mergedFiles[currentEditingId] !== undefined
            ? currentEditingId
            : "";
      if (targetFileId) {
        setServerDataFile(targetFileId, mergedFiles[targetFileId] ?? "");
      }
      if (Array.isArray(editInfoList) && editInfoList.length > 0) {
        const grouped = editInfoList.reduce<Record<string, EditFileArgsType[]>>((acc, item) => {
          const path = item.file_path;
          if (!path) return acc;
          if (!acc[path]) acc[path] = [];
          acc[path].push(item);
          return acc;
        }, {});
        setFileChangesMap((prev) => {
          const next = { ...prev };
          Object.keys(grouped).forEach((path) => {
            const existing = next[path] ?? [];
            const appended: EditorChangeItem[] = grouped[path].map((item, idx) => ({
              index: Date.now() + idx + Math.floor(Math.random() * 1000),
              oldString: item.old_string ?? "",
              newString: item.new_string ?? "",
              status: "pending",
            }));
            next[path] = [...existing, ...appended];
          });
          return next;
        });
      }
    },
    onComplete: async () => {
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

      // 流式结束后调用 guide 接口，将联想提示词展示在最后一条消息下方（与 Vue 一致）
      // 若最后一条消息存在 write_todos 且人在回路未确认（需先展示外层卡片），则不请求 guide，等用户点击拒绝后再请求
      const pending = guideRequestRef.current;
      guideRequestRef.current = null;
      const customMsg = finalized?.customMessage;
      const lastCustom = Array.isArray(customMsg) ? customMsg[customMsg.length - 1] : undefined;
      const hiltStatus = (lastCustom as { hiltStatus?: string } | undefined)?.hiltStatus;
      const hasHiltPending =
        lastCustom &&
        hiltStatus !== "rejected" &&
        hiltStatus !== "approved" &&
        ((lastCustom as { hiltTodos?: unknown[] }).hiltTodos?.length
          ? hiltStatus === "in_progress"
          : ((lastCustom as { tool_calls?: { name?: string; args?: { todos?: unknown[] } }[] }).tool_calls ?? []).some(
            (tc) => tc.name === "write_todos" && Array.isArray(tc.args?.todos) && tc.args.todos.length > 0
          ));
      if (pending?.sessionId && pending?.workId && !hasHiltPending) {
        const { sessionId, workId: wid } = pending;
        try {
          const res = await generateGuideReq(sessionId, Number(wid)) as { guides?: string[] | string } | undefined;
          const raw = res?.guides;
          const guides = Array.isArray(raw)
            ? raw
            : typeof raw === "string"
              ? (() => {
                try {
                  const parsed = JSON.parse(raw) as string[] | unknown;
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
              : [];
          if (guides.length > 0) {
            updateLastChatMessage((prev) => {
              const existing = prev.customMessage ?? [];
              const guideItem: import("@/types/chat").AgentCustomMessage = {
                id: `guide_${Date.now()}`,
                type: "ai",
                content: "",
                name: null,
                example: false,
                tool_calls: [],
                invalid_tool_calls: [],
                usage_metadata: null,
                additional_kwargs: {},
                response_metadata: { finish_reason: "", model_name: "", service_tier: "" },
                suggestions: guides,
              };
              return { ...prev, customMessage: [...existing, guideItem] };
            });
          }
        } catch (_) {
          // 联想提示词失败不打断交互，静默忽略
        }
      }
    },
    onError: (err, needSendErrorMsg) => {
      if (stoppedByUserRef.current) {
        stoppedByUserRef.current = false;
        return;
      }
      if (needSendErrorMsg) toast.error(err.message);
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

  const handleStopStreaming = useCallback(() => {
    stoppedByUserRef.current = true;
    finalizeStreamingMessageWithSuffix("\n智能体已暂停\n");
    langGraphStream.stop();
  }, [finalizeStreamingMessageWithSuffix, langGraphStream]);

  const chatInputStatus = useMemo((): "ready" | "error" | "submitted" | "streaming" => {
    if (langGraphStream.error) return "error";
    if (langGraphStream.isStreaming) return "streaming";
    return "ready";
  }, [langGraphStream.error, langGraphStream.isStreaming]);
  const isStreamingOverlayVisible = chatInputStatus === "streaming";
  const associationTags = useChatInputStore((s) => s.associationTags);
  const selectedNotes = useChatInputStore((s) => s.selectedNotes);
  const selectedFiles = useChatInputStore((s) => s.selectedFiles);
  const selectedTexts = useChatInputStore((s) => s.selectedTexts);
  const selectedTools = useChatInputStore((s) => s.selectedTools);
  const addSelectedText = useChatInputStore((s) => s.addSelectedText);
  const clearAssociationTags = useChatInputStore((s) => s.clearAssociationTags);
  const clearSelectedNotes = useChatInputStore((s) => s.clearSelectedNotes);
  const clearSelectedFiles = useChatInputStore((s) => s.clearSelectedFiles);
  const clearSelectedTexts = useChatInputStore((s) => s.clearSelectedTexts);
  const resetSelectedTools = useChatInputStore((s) => s.resetSelectedTools);
  const setShowAnswerTip = useChatInputStore((s) => s.setShowAnswerTip);
  const setShowWritingStyleTip = useChatInputStore((s) => s.setShowWritingStyleTip);
  const initializeChatInputFromParams = useChatInputStore((s) => s.initializeFromParams);
  const setAssociationTags = useChatInputStore((s) => s.setAssociationTags);
  const [pendingInitialMessage, setPendingInitialMessage] = useState("");
  const [shouldAutoSubmitInitialMessage, setShouldAutoSubmitInitialMessage] = useState(false);
  const [isAnswerOnly, setIsAnswerOnly] = useState(true);

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
    (text: string, options?: { reload?: boolean; command?: string; addUserMessage?: boolean }) => {
      const message = text.trim();
      if (!message && !options?.command) return;
      let sessionId = chatCurrentSession?.id ?? "";
      if (!chatCurrentSession) {
        const session = createNewSession("chat");
        sessionId = session.id;
      }

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
      }

      if (workId && sessionId) {
        guideRequestRef.current = { sessionId, workId };
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
        const attachments =
          selectedFiles.length > 0
            ? selectedFiles.map((file) => ({
              name: file.serverFileName,
              remoteAddress: file.putFilePath,
            }))
            : undefined;
        langGraphStream.submit(
          message,
          sessionId,
          workId,
          isAnswerOnly ? "chat" : "agent",
          selectedTools,
          attachments,
          options?.reload,
          options?.command,
          modelLLM,
          selectedWritingStyle
        );
        // 请求发出后清空当前已选引用内容，避免继续展示在输入区
        clearSelectedNotes();
        clearSelectedFiles();
      }
    },
    [
      addMessageToDualTab,
      chatCurrentSession,
      createNewSession,
      isAnswerOnly,
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

  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const activeRemarkHighlightRef = useRef<HTMLElement | null>(null);
  const [activeChangeIndex, setActiveChangeIndex] = useState<number | null>(null);
  const [changesPanelHeight, setChangesPanelHeight] = useState(0);
  const [isEditorActuallyEmpty, setIsEditorActuallyEmpty] = useState(true);
  const insCanvasRef = useRef<InsCanvasApi | null>(null);
  const [, setCanvasReadyKey] = useState(0);
  const onCanvasReady = useCallback(() => setCanvasReadyKey((k) => k + 1), []);

  // editor 相关
  const workInfo = useEditorStore((s) => s.workInfo);
  const serverData = useEditorStore((s) => s.serverData);
  const currentEditingId = useEditorStore((s) => s.currentEditingId);
  const initEditorData = useEditorStore((s) => s.initEditorData);
  const saveEditorData = useEditorStore((s) => s.saveEditorData);
  const setServerData = useEditorStore((s) => s.setServerData);
  const setServerDataFile = useEditorStore((s) => s.setServerDataFile);
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo);
  const renameServerDataPath = useEditorStore((s) => s.renameServerDataPath);
  const initEditorStore = useEditorStore((s) => s.initEditorStore);

  const [leftPanelWidthRem, setLeftPanelWidthRem] = useState(LEFT_DEFAULT_REM);
  const dragStartLeftRem = useRef(LEFT_DEFAULT_REM);
  const [rightPanelWidthRem, setRightPanelWidthRem] = useState(RIGHT_DEFAULT_REM);
  const preCanvasRightWidthRemRef = useRef<number | null>(null);
  const dragStartRightRem = useRef(RIGHT_DEFAULT_REM);
  const dragStartRightPx = useRef(RIGHT_DEFAULT_REM * REM_BASE);
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const [showAssociationSelector, setShowAssociationSelector] = useState(false);
  const [relationViewMode, setRelationViewMode] = useState<"edit" | "preview">("edit");
  const [showSearchReplaceDialog, setShowSearchReplaceDialog] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showTimeMachineDialog, setShowTimeMachineDialog] = useState(false);
  const [workVersionList, setWorkVersionList] = useState<WorkVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string>("");
  const [isChangesPanelVisible, setIsChangesPanelVisible] = useState(false);
  const centerRequiredRem = CENTER_EDITOR_MIN_REM + (isChangesPanelVisible ? CHANGES_PANEL_WIDTH_REM : 0);
  const [fileChangesMap, setFileChangesMap] = useState<FileChangesMap>({});

  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    try {
      const raw = localStorage.getItem(EDITOR_SETTINGS_STORAGE_KEY);
      if (!raw) return DEFAULT_EDITOR_SETTINGS;
      return { ...DEFAULT_EDITOR_SETTINGS, ...(JSON.parse(raw) as Partial<EditorSettings>) };
    } catch {
      return DEFAULT_EDITOR_SETTINGS;
    }
  });

  const sidebarTreeData = useMemo(
    () => serverDataToTree(serverData),
    [serverData]
  );

  // 避免在 React StrictMode 下重复请求作品详情
  const lastInitWorkIdRef = useRef<string | null>(null);

  // 标题（当前文件名）编辑：与 Vue startEditingLabel / saveLabelEdit / cancelLabelEdit 对齐
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const isSavingLabelRef = useRef(false);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!workId) return;
    if (lastInitWorkIdRef.current === workId) return;
    lastInitWorkIdRef.current = workId;
    void initEditorData(workId);
  }, [workId, initEditorData]);

  // 页面卸载时再重置 editor store，避免点击返回瞬间 currentLabel 闪空
  useEffect(() => {
    return () => {
      initEditorStore();
    };
  }, [initEditorStore]);

  useEffect(() => {
    let storageParams: EditorInitialParams | null = null;
    let rankingParams: RankingListTransmissionParams | null = null;
    if (typeof window !== "undefined") {
      const paramsStr = sessionStorage.getItem(EDITOR_INITIAL_PARAMS_KEY);
      if (paramsStr) {
        try {
          storageParams = JSON.parse(paramsStr) as EditorInitialParams;
        } catch (e) {
          console.error("解析 editorInitialParams 失败:", e);
        } finally {
          sessionStorage.removeItem(EDITOR_INITIAL_PARAMS_KEY);
        }
      }

      const rankingParamsStr = sessionStorage.getItem(RANKING_LIST_TRANSMISSION_KEY);
      if (rankingParamsStr) {
        try {
          rankingParams = JSON.parse(rankingParamsStr) as RankingListTransmissionParams;
        } catch (e) {
          console.error("解析 rankingListTransmission 失败:", e);
        } finally {
          sessionStorage.removeItem(RANKING_LIST_TRANSMISSION_KEY);
        }
      }
    }
    const stateParams = (location.state as EditorInitialParams | null) ?? null;
    const mergedParams = { ...(stateParams ?? {}), ...(storageParams ?? {}) };
    const rankingContent = rankingParams?.content?.trim() ?? "";
    const rankingMessage = rankingParams?.message?.trim() ?? "";
    const rankingDisableAutoSubmit = !!rankingParams?.disableAutoSubmit;
    const initialParams: EditorInitialParams = {
      ...mergedParams,
      selectedTexts: rankingContent
        ? [
          ...(mergedParams.selectedTexts ?? []),
          {
            id: `ranking-transmission-${Date.now()}`,
            file: "",
            content: rankingContent,
          },
        ]
        : mergedParams.selectedTexts,
      message: rankingMessage || mergedParams.message,
    };
    setDisableRecommendAutoOpen(
      !!initialParams.skipRecommendDialog ||
      !!((location.state as { skipRecommendDialog?: boolean } | null) ?? null)?.skipRecommendDialog
    );
    const initialTemplate = parseStepTemplate(initialParams.template);
    if (initialTemplate) {
      setPendingStepTemplate(initialTemplate);
    }

    if (initialParams.modelLLM) setModelLLM(initialParams.modelLLM);
    if (initialParams.selectedWritingStyle) setSelectedWritingStyle(initialParams.selectedWritingStyle);
    if (typeof initialParams.isAnswerOnly === "boolean") {
      setIsAnswerOnly(initialParams.isAnswerOnly);
    }
    initializeChatInputFromParams({
      associationTags: initialParams.associationTags,
      selectedNotes: initialParams.selectedNotes,
      selectedFiles: initialParams.selectedFiles,
      selectedTexts: initialParams.selectedTexts,
      selectedTools: initialParams.selectedTools,
      isShowAnswerTip: initialParams.isShowAnswerTip,
    });
    if (initialParams.message?.trim()) {
      const msg = initialParams.message.trim();
      setPendingInitialMessage(msg);
      if (!rankingDisableAutoSubmit) {
        // 通过桥接触发 QuillChatInput 的提交逻辑（兼容“仅回答”场景）
        emitCreationInputSubmit(msg);
      }
      // 避免与 ProChatContainer 的自动提交重复触发
      setShouldAutoSubmitInitialMessage(false);
    } else {
      setShouldAutoSubmitInitialMessage(false);
    }
  }, [location.state, setModelLLM, setSelectedWritingStyle, initializeChatInputFromParams]);

  useEffect(() => {
    if (!pendingStepTemplate) return;
    const opened = stepWorkflowRef.current?.startTemplateCreate(pendingStepTemplate) ?? false;
    if (opened) {
      setPendingStepTemplate(null);
    }
  }, [pendingStepTemplate, serverData, currentEditingId]);

  // 进入编辑器后，默认选中「第一章」：优先选正文目录下的首个 .md 文件
  useEffect(() => {
    // serverData 还未加载完成
    if (!serverData || Object.keys(serverData).length === 0) return;
    // 用户已经有当前编辑文件且存在于 serverData，则不干预
    if (currentEditingId && serverData[currentEditingId] !== undefined) return;

    const allMdKeys = Object.keys(serverData).filter((k) => k.endsWith(".md"));
    if (allMdKeys.length === 0) return;

    // 优先正文目录下的章节，例如 "正文/第一章.md"
    const chapterCandidates = allMdKeys
      .filter((k) => k.startsWith("正文/"))
      .sort();

    const targetKey =
      chapterCandidates[0] ??
      allMdKeys.sort()[0] ??
      DEFAULT_EDITING_FILE_KEY;

    const setCurrentEditingId = useEditorStore.getState().setCurrentEditingId;
    setCurrentEditingId(targetKey);
  }, [serverData, currentEditingId]);

  const handleBackClick = useCallback(() => {
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

      .page-editor-panel .markdown-editor .markdown-editor-content .ProseMirror {
        --tiptap-prosemirror-font-size: ${remFontSize}rem !important;
        --tiptap-prosemirror-line-height: ${settings.lineHeight} !important;
        font-weight: ${settings.fontWeight} !important;
      }

      .page-editor-panel .markdown-editor .markdown-editor-content .ProseMirror p:not(.mermaid-container):not(.mermaid-container *) {
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

  const searchMatches = useMemo(() => {
    if (!searchText.trim()) return [];
    const source = serverData[currentEditingId || DEFAULT_EDITING_FILE_KEY] || "";
    const target = searchText.toLowerCase();
    const sourceLower = source.toLowerCase();
    const list: Array<{ actualIndex: number; preview: string }> = [];
    let idx = 0;
    while ((idx = sourceLower.indexOf(target, idx)) !== -1) {
      const start = Math.max(0, idx - 20);
      const end = Math.min(source.length, idx + target.length + 20);
      list.push({
        actualIndex: idx,
        preview: source.slice(start, end),
      });
      idx += 1;
    }
    return list;
  }, [serverData, currentEditingId, searchText]);

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
    if (searchMatches.length === 0) {
      toast.warning("未找到匹配的内容");
      return;
    }
    const targetFileKey = currentEditingId || DEFAULT_EDITING_FILE_KEY;
    let nextContent = serverData[targetFileKey] || "";
    const sorted = [...searchMatches].sort((a, b) => b.actualIndex - a.actualIndex);
    for (const match of sorted) {
      const before = nextContent.slice(0, match.actualIndex);
      const after = nextContent.slice(match.actualIndex + searchText.length);
      nextContent = before + replaceText + after;
    }
    setServerDataFile(targetFileKey, nextContent);
    toast.success(`已替换 ${sorted.length} 处内容`);
  }, [searchText, searchMatches, replaceText, setServerDataFile, currentEditingId, serverData]);

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
      const allMdKeys = Object.keys(parsed).filter((k) => k.endsWith(".md")).sort();
      if (allMdKeys.length > 0) {
        useEditorStore.getState().setCurrentEditingId(allMdKeys[0]);
      }
      toast.success("版本恢复成功");
      setShowTimeMachineDialog(false);
    } catch {
      toast.error("恢复版本失败");
    } finally {
      setRestoringVersionId("");
    }
  }, [workId, setServerData]);

  const helpWriteClick = useCallback(() => {
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
  }, [rightPanelWidthRem, isChangesPanelVisible]);

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
    const maxRightPx =
      contentWidthPx > 0
        ? Math.max(0, contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase)
        : Number.POSITIVE_INFINITY;
    // 视口过窄时，右栏最小宽不应强行占位，否则中间区无法压到 0
    const effectiveMinRightPx =
      contentWidthPx > 0
        ? Math.min(RIGHT_MIN_REM * remBase, maxRightPx)
        : RIGHT_MIN_REM * remBase;
    const rawPx = dragStartRightPx.current + adjustedDeltaX;
    const newWidthPx = Math.max(effectiveMinRightPx, Math.min(maxRightPx, rawPx));
    setRightPanelWidthRem(newWidthPx / remBase);
  }, [leftPanelWidthRem]);

  const maximizeRightPanel = useCallback(() => {
    const el = resizeContainerRef.current;
    const contentWidthPx = el ? el.clientWidth - CONTAINER_PADDING_PX : 0;
    if (contentWidthPx <= 0) return;
    const remBase = getRootRemPx();
    const leftWidthPx = leftPanelRef.current?.offsetWidth ?? leftPanelWidthRem * remBase;
    const maxRightPx = Math.max(
      0,
      contentWidthPx - leftWidthPx - HANDLES_WIDTH_REM * remBase
    );
    setRightPanelWidthRem(maxRightPx / remBase);
  }, [leftPanelWidthRem]);

  const handleChatHeaderTabChange = useCallback(
    (tab: ChatTabType) => {
      if (tab === "canvas") {
        if (activeTab !== "canvas" && preCanvasRightWidthRemRef.current == null) {
          preCanvasRightWidthRemRef.current = rightPanelWidthRem;
        }
        maximizeRightPanel();
      } else if (tab === "chat" && activeTab === "canvas") {
        if (preCanvasRightWidthRemRef.current != null) {
          setRightPanelWidthRem(preCanvasRightWidthRemRef.current);
          preCanvasRightWidthRemRef.current = null;
        }
      }
      setActiveTab(tab);
    },
    [activeTab, maximizeRightPanel, rightPanelWidthRem]
  );

  const fileKey = currentEditingId || DEFAULT_EDITING_FILE_KEY;
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

  const clearRemarkHighlight = useCallback(() => {
    const active = activeRemarkHighlightRef.current;
    if (!active) return;
    active.classList.remove("remark-highlight-paragraph");
    activeRemarkHighlightRef.current = null;
  }, []);

  const highlightChangeInEditor = useCallback(
    (oldText: string, newText?: string) => {
      clearRemarkHighlight();
      const editorRoot = (markdownEditorRef.current?.editor as { view?: { dom?: HTMLElement } } | null)?.view?.dom;
      if (!editorRoot) return;
      const normalize = (input: string) =>
        input
          .replace(/[`*_#>\-()!~]|\[|\]/g, " ")
          .replace(/[，。！？；：“”‘’、,.!?;:'"()（）【】{}]|\[|\]/g, " ")
          .replace(/\s+/g, "")
          .trim();
      const buildTargets = (input: string) => {
        const normalized = normalize(input);
        const lines = input
          .split("\n")
          .map((line) => normalize(line))
          .filter((line) => line.length >= 4);
        return [normalized, ...lines].filter(Boolean);
      };
      const targets = [...buildTargets(newText ?? ""), ...buildTargets(oldText)]
        .sort((a, b) => b.length - a.length)
        .slice(0, 14);
      if (targets.length === 0) return;
      const blocks = Array.from(
        editorRoot.querySelectorAll("p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th")
      ) as HTMLElement[];
      let matchedBlock: HTMLElement | null = null;
      let bestScore = 0;
      for (const block of blocks) {
        const blockText = normalize(block.textContent ?? "");
        if (!blockText) continue;
        for (const target of targets) {
          const hit = blockText.includes(target) || target.includes(blockText);
          if (!hit) continue;
          const score = Math.min(blockText.length, target.length) + (target.length > 18 ? 8 : 0);
          if (score > bestScore) {
            bestScore = score;
            matchedBlock = block;
          }
        }
      }
      if (!matchedBlock) return;
      matchedBlock.classList.add("remark-highlight-paragraph");
      activeRemarkHighlightRef.current = matchedBlock;
      try {
        matchedBlock.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        // ignore smooth scroll failure
      }
    },
    [clearRemarkHighlight]
  );

  const applyChangeToFile = useCallback(
    (targetFileKey: string, oldString: string, newString: string): boolean => {
      const current = useEditorStore.getState().serverData[targetFileKey] ?? "";
      if (!oldString) return false;
      const exactIndex = current.indexOf(oldString);
      if (exactIndex >= 0) {
        const updated =
          current.slice(0, exactIndex) +
          newString +
          current.slice(exactIndex + oldString.length);
        setServerDataFile(targetFileKey, updated);
        return true;
      }

      const looseRange = findRangeIgnoringWhitespace(current, oldString);
      if (looseRange) {
        const updated =
          current.slice(0, looseRange.start) +
          newString +
          current.slice(looseRange.endExclusive);
        setServerDataFile(targetFileKey, updated);
        return true;
      }

      // 当后端已先行写入新内容时，不再误报“找不到原文片段”
      if (!newString) return false;
      if (current.includes(newString)) return true;
      const alreadyApplied = findRangeIgnoringWhitespace(current, newString);
      return alreadyApplied !== null;
    },
    [setServerDataFile]
  );

  const updateChangeStatus = useCallback(
    (targetFileKey: string, changeIndex: number, status: "accepted" | "rejected") => {
      setFileChangesMap((prev) => {
        const list = prev[targetFileKey] ?? [];
        const nextList = list.map((item) =>
          item.index === changeIndex ? { ...item, status } : item
        );
        return { ...prev, [targetFileKey]: nextList };
      });
    },
    []
  );

  const handleAcceptChange = useCallback(
    (changeIndex: number) => {
      const target = (fileChangesMap[fileKey] ?? []).find((c) => c.index === changeIndex);
      if (!target || target.status !== "pending") return;
      const applied = applyChangeToFile(fileKey, target.oldString, target.newString);
      if (!applied) {
        toast.warning("未找到可替换的原文片段，无法应用该修改");
        return;
      }
      updateChangeStatus(fileKey, changeIndex, "accepted");
    },
    [applyChangeToFile, fileChangesMap, fileKey, updateChangeStatus]
  );

  const handleRejectChange = useCallback(
    (changeIndex: number) => {
      const target = (fileChangesMap[fileKey] ?? []).find((c) => c.index === changeIndex);
      if (!target || target.status !== "pending") return;
      updateChangeStatus(fileKey, changeIndex, "rejected");
    },
    [fileChangesMap, fileKey, updateChangeStatus]
  );

  const handleCurrentPageAcceptAll = useCallback(() => {
    const list = fileChangesMap[fileKey] ?? [];
    let appliedCount = 0;
    for (const item of list) {
      if (item.status !== "pending") continue;
      const applied = applyChangeToFile(fileKey, item.oldString, item.newString);
      if (!applied) continue;
      updateChangeStatus(fileKey, item.index, "accepted");
      appliedCount += 1;
    }
    if (appliedCount > 0) toast.success(`已接受 ${appliedCount} 处修改`);
    else toast.warning("当前页面没有可接受的修改");
    clearRemarkHighlight();
  }, [applyChangeToFile, fileChangesMap, fileKey, updateChangeStatus, clearRemarkHighlight]);

  const handleCurrentPageRejectAll = useCallback(() => {
    const list = fileChangesMap[fileKey] ?? [];
    const pending = list.filter((item) => item.status === "pending");
    pending.forEach((item) => updateChangeStatus(fileKey, item.index, "rejected"));
    if (pending.length > 0) toast.success(`已撤销 ${pending.length} 处修改`);
    else toast.warning("当前页面没有可撤销的修改");
    clearRemarkHighlight();
  }, [fileChangesMap, fileKey, updateChangeStatus, clearRemarkHighlight]);

  useEffect(() => {
    setIsChangesPanelVisible(currentFilePendingCount > 0);
  }, [currentFilePendingCount]);

  useEffect(() => {
    const hasActive = currentFilePendingChanges.some((item) => item.index === activeChangeIndex);
    if (hasActive) return;
    setActiveChangeIndex(currentFilePendingChanges[0]?.index ?? null);
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
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    const contentEl = el.querySelector(".markdown-editor-content") as HTMLElement | null;
    const proseMirrorEl = contentEl?.querySelector(".ProseMirror") as HTMLElement | null;
    if (contentEl) ro.observe(contentEl);
    if (proseMirrorEl) ro.observe(proseMirrorEl);
    const mo = new MutationObserver(updateHeight);
    if (proseMirrorEl) {
      mo.observe(proseMirrorEl, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    window.addEventListener("resize", updateHeight);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [fileKey, relationViewMode, currentFilePendingCount]);

  useEffect(() => {
    if (!shouldShowRemarkOverlay) {
      clearRemarkHighlight();
      return;
    }
    const activeChange =
      currentFilePendingChanges.find((item) => item.index === activeChangeIndex) ??
      currentFilePendingChanges[0];
    if (!activeChange) {
      clearRemarkHighlight();
      return;
    }
    highlightChangeInEditor(activeChange.oldString, activeChange.newString);
  }, [
    shouldShowRemarkOverlay,
    currentFilePendingChanges,
    activeChangeIndex,
    clearRemarkHighlight,
    highlightChangeInEditor,
  ]);

  // 仅当 serverData 的 key 列表变化时重建树，避免每次输入都跑 serverDataToTree
  const serverDataKeysSig = useMemo(
    () => Object.keys(serverData ?? {}).sort().join(","),
    [serverData]
  );
  const treeData = useMemo(() => serverDataToTree(serverData ?? {}), [serverData]);

  const currentLabel = useMemo(
    () => (currentEditingId ? findNodeLabelById(treeData, currentEditingId) : ""),
    [treeData, currentEditingId]
  );

  const currentContent = serverData[fileKey] ?? "";

  const wordCount = useMemo(() => getWordCount(currentContent), [currentContent]);
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
      const merged = ensureCanvasTreeSkeleton({
        ...useEditorStore.getState().serverData,
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

      setActiveTab("chat");
      const prompt = "现在根据故事简介、故事设定和大纲，使用内容创作代理开始逐章写小说正文。";
      setPendingInitialMessage(prompt);
      setShouldAutoSubmitInitialMessage(false);
    },
    [
      workId,
      setServerData,
      setWorkInfo,
      saveEditorData,
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

  return (
    <div className="page-editor-panel flex h-screen w-full flex-col overflow-hidden bg-(--bg-primary)">
      <EditorTopToolbar
        onBackClick={handleBackClick}
        onSaveClick={handleSaveClick}
        onUpdateTitle={handleTitleUpdate}
        onHelpWriteClick={helpWriteClick}
        updatedTime={workInfo.updatedTime}
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
          <EditorTreeSidebar className="h-full"/>
        </div>

        <EditorResizeHandle
          position="left"
          onDragStart={onLeftResizeStart}
          onDrag={onLeftResize}
          className="shrink-0"
        />

        {/* 中间编辑面板 */}
        <div
          className="flex-1 min-w-0 flex flex-col h-full rounded-[20px] border border-(--border-color) overflow-hidden bg-(--bg-editor)"
          style={{ minWidth: "0rem" }}
        >
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
            {/* 字数栏 */}
            <div className="flex flex-row-reverse h-[38px] px-6 items-center shrink-0 min-w-0">
              <div className="flex h-full items-center gap-0 min-w-0">
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
                        <Checkbox
                          checked={editorSettings.textIndentEnabled}
                          onCheckedChange={(checked) =>
                            setEditorSettings((prev) => ({ ...prev, textIndentEnabled: checked === true }))
                          }
                        />
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 编辑区主体 */}
            <div className="flex flex-1 min-h-0 min-w-0 relative">
              <div className="relative flex flex-1 min-h-0 min-w-0 flex-col"
                   style={{ minWidth: `${CENTER_EDITOR_MIN_REM}rem`, }}>
                <div
                  ref={editorMainScrollRef}
                  className={clsx(
                    "editor-main-scroll-area h-full min-h-0 relative overflow-x-hidden overflow-y-auto",
                    !isEditorEditable && "cursor-not-allowed-all",
                    isStreamingOverlayVisible && "cursor-not-allowed"
                  )}
                >
                  <div className="min-h-full flex flex-col relative overflow-x-hidden">
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
                              key={fileKey}
                              className="editor-outer-scroll-mode"
                              fontClassName="font-KaiTi"
                              value={currentContent}
                              onChange={(markdown) => setServerDataFile(fileKey, markdown)}
                              placeholder={EDITOR_PLACEHOLDER}
                              readonly={!isEditorEditable}
                              btns={["edit", "expand", "add", "note"]}
                              onSelectionAdd={handleEditorSelectionAdd}
                              onSelectionNote={handleEditorSelectionNote}
                              needSelectionToolbar
                            />
                          </div>
                        </div>
                        <StepWorkflow
                          ref={stepWorkflowRef}
                          totalMdContentLength={wordCount}
                          isEditorEmpty={isEditorActuallyEmpty}
                          hasTemplateContent={!!pendingStepTemplate}
                          disableRecommendAutoOpen={disableRecommendAutoOpen}
                          currentEditingId={currentEditingId}
                        />
                      </div>
                    </div>
                    {!isEditorEditable && (
                      <div className="absolute inset-0 z-20 bg-white/35 cursor-not-allowed pointer-events-none"/>
                    )}
                  </div>
                </div>
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
                      highlightChangeInEditor(change.oldString, change.newString);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <EditorResizeHandle
          position="right"
          onDragStart={onRightResizeStart}
          onDrag={onRightResize}
          className="shrink-0"
        />

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
            checkStreamingStatusAndConfirm={async () => true}
            canvasActionsSlot={
              activeTab === "canvas" ? (
                <CanvasToolbar
                  api={insCanvasRef.current}
                />
              ) : null
            }
          />
          <div className="flex-1 min-h-0 p-2 flex flex-col overflow-hidden">
            {activeTab === "canvas" ? (
              workId ? (
                <InsCanvas
                  ref={insCanvasRef}
                  workId={workId}
                  onCreateHere={handleCanvasCreateHere}
                  onCreateNew={handleCanvasCreateNew}
                  onMessage={(type, msg) => {
                    if (type === "success") toast.success(msg);
                    else if (type === "error") toast.error(msg);
                    else toast(msg);
                  }}
                  onCanvasReady={onCanvasReady}
                />
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
                  messages={
                    streamingMessage
                      ? [...chatMessages, streamingMessage]
                      : chatMessages
                  }
                  sessionId={chatCurrentSession?.id ?? ""}
                  onSendMessage={(msg: ChatMessage) => {
                    sendChatText(msg.content ?? "", { addUserMessage: true });
                  }}
                  onSaveCurrentSession={() => saveCurrentSession("chat")}
                  checkStreamingStatusAndConfirm={async () => true}
                  isHomePage={false}
                  hideAssociationFeature={false}
                  onOpenAssociationSelector={() => setShowAssociationSelector(true)}
                  isAnswerOnly={isAnswerOnly}
                  onAnswerOnlyChange={setIsAnswerOnly}
                  slots={{
                    todos: (
                      <TodosFixedPanel
                        todos={langGraphStream.todos}
                        expanded={todosExpanded}
                        onToggleExpand={() => setTodosExpanded((e) => !e)}
                        isStreaming={chatInputStatus === "streaming"}
                      />
                    ),
                    renderMessage: (msg: ChatMessage, options?: { isLastMessage?: boolean }) => {
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
                                onFileNameClick={(_fileName: string) => {
                                  // TODO: 与编辑器联动定位到文件
                                }}
                                onHiltReject={async (rejectedMsg) => {
                                  const sessionId = chatCurrentSession?.id ?? "";
                                  if (!sessionId || !workId) return;
                                  updateLastChatMessage((prev) => {
                                    const custom = prev.customMessage ?? [];
                                    return {
                                      ...prev,
                                      customMessage: custom.map((item) =>
                                        item.id === rejectedMsg.id ? { ...item, hiltStatus: "rejected" as const } : item
                                      ),
                                    };
                                  });
                                  try {
                                    const res = await generateGuideReq(sessionId, Number(workId)) as {
                                      guides?: string[] | string
                                    } | undefined;
                                    const raw = res?.guides;
                                    const guides = Array.isArray(raw)
                                      ? raw
                                      : typeof raw === "string"
                                        ? (() => {
                                          try {
                                            const parsed = JSON.parse(raw) as string[] | unknown;
                                            return Array.isArray(parsed) ? parsed : [];
                                          } catch {
                                            return [];
                                          }
                                        })()
                                        : [];
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
                                }}
                                onHiltApprove={(approvedMsg) => {
                                  updateLastChatMessage((prev) => {
                                    const custom = prev.customMessage ?? [];
                                    return {
                                      ...prev,
                                      customMessage: custom.map((item) =>
                                        item.id === approvedMsg.id ? { ...item, hiltStatus: "approved" as const } : item
                                      ),
                                    };
                                  });
                                  sendChatText("", { command: "approve", addUserMessage: false });
                                }}
                                onSendMessage={(text, reload = false) => {
                                  sendChatText(text, { reload, addUserMessage: !reload });
                                }}
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
                                        onFileNameClick={() => {
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {!hasFilesOrSelected && (
                                  <div className="message-content-wrapper whitespace-pre-wrap wrap-break-word">
                                    <MarkdownRenderer
                                      content={msg.content || ""}
                                      onFileNameClick={() => {
                                      }}
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    },
                    footer: (
                      <div className="text-center px-4 text-[11px] text-[#ccc] w-full">
                        {`<内容由AI生成，仅供参考>`}
                      </div>
                    ),
                  }}
                >
                  <ProChatPanel/>
                </ProChatContainer>
                <AssociationSelectorDialog
                  open={showAssociationSelector}
                  onOpenChange={setShowAssociationSelector}
                  treeData={sidebarTreeData}
                  selectedIds={associationTags}
                  onConfirm={(ids) => {
                    const filtered = ids.filter(
                      (id) =>
                        !ids.some(
                          (other) =>
                            other !== id && (id.startsWith(`${other}/`) || id === `${other}/`)
                        )
                    );
                    setAssociationTags(filtered);
                  }}
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
    </div>
  );
};

export default MarkdownEditorPage;
