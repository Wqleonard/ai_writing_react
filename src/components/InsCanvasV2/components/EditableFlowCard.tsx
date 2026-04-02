import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeToolbar, Position, useEdges, useNodes, useReactFlow } from "@xyflow/react";
import { Trash2, Pencil, Plus, Copy, MessageSquarePlus, Sparkles, Notebook } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import MarkdownEditor, { type MarkdownEditorRef } from "@/components/MainEditor";
import type { CustomNodeData } from "@/components/InsCanvasV2/types";
import type { PostStreamData } from "@/api";
import { postInspirationStream, saveInspirationCanvasReq } from "@/api/works";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";
import { addNote } from "@/api/notes";
import { Iconfont } from "@/components/Iconfont";
import ConfirmDeleteDialog from "@/components/InsCanvasV2/components/ConfirmDeleteDialog";
import canvasErrorImg from "@/assets/images/canvas/canvas_error_img.jpeg";
import type {
  CanvasFloatingAction as FloatingAction,
  EditableFlowCardProps,
} from "@/components/InsCanvasV2/types";
import { getCanvasNodeLayoutSize as getCanvasNodeLayoutSizeFromUtils } from "@/components/InsCanvasV2/canvasUtils";
// React 18 StrictMode / ReactFlow 更新可能导致节点组件重挂载，
// 进而让“挂载即拉流”的逻辑重复触发。用 nodeId 做一次性去重（刷新时会清除）。
const startedStreamNodeIds = new Set<string>();

const sanitizeContextFileName = (value: string, fallback: string) => {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return normalized || fallback;
};

const normalizeImageSrc = (value: string): string => {
  const raw = String(value || "").trim().replace(/^['"]|['"]$/g, "").replace(/&amp;/g, "&");
  if (!raw) return "";

  try {
    const decoded = decodeURI(raw);
    const url = new URL(decoded);
    if (
      /(?:^|\.)pollinations\.ai$/i.test(url.hostname) &&
      url.pathname.startsWith("/prompt/")
    ) {
      const prompt = url.pathname.replace(/^\/prompt\//, "");
      return `${url.origin}/prompt/${encodeURIComponent(prompt)}${url.search}`;
    }
    return url.toString();
  } catch {
    return raw;
  }
};

const normalizeTitleMarkdown = (value: string): string => {
  const firstMeaningfulLine = String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstMeaningfulLine) return "";

  return firstMeaningfulLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
};

const convertRichTextToPlainText = (value: string): string => {
  const normalized = String(value || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) return "";

  return normalized
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
};

const SUMMARY_DRAFT_TEMPLATE = `### 内容梗概
> [内容梗概]

### 关键节点
> [关键节点]`;

const getDefaultDraftContent = (label: string, fromApi: boolean): string => {
  if (fromApi) return "";
  if (label === "故事梗概" || label === "梗概") return SUMMARY_DRAFT_TEMPLATE;
  return "";
};

const isPlaceholderDraftContent = (label: string, fromApi: boolean, content: string): boolean => {
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) return false;
  const defaultContent = getDefaultDraftContent(label, fromApi).trim();
  return Boolean(defaultContent) && normalizedContent === defaultContent;
};

export default function EditableFlowCard({
  id,
  data,
  cardLabel,
  generateLabel,
  type = '',
  dragging = false,
  msg,
  onGenerate,
  onAdd,
  onDelete,
  onUpdate,
  onExpand,
}: EditableFlowCardProps) {
  const allNodes = useNodes();
  const allEdges = useEdges();
  const { updateNode, updateNodeData, setNodes, setEdges, getEdges, getNodes, getNode, setCenter } = useReactFlow();
  const canvasHandlers = useInsCanvasHandlers();
  const { getCanvasSessionId } = canvasHandlers;
  const normalizedCardLabel = useMemo(
    () => String(cardLabel ?? data?.label ?? ""),
    [cardLabel, data?.label]
  );
  const defaultDraftContent = useMemo(
    () => getDefaultDraftContent(normalizedCardLabel, Boolean(data.fromApi)),
    [data.fromApi, normalizedCardLabel]
  );
  const allowTitleEdit = Boolean((data as any)?.allowTitleEdit);
  const canFocusTitleEditor =
    allowTitleEdit &&
    !Boolean((data as any)?.outlineGroupId) &&
    !["大纲", "故事大纲"].includes(String(cardLabel ?? data?.label ?? ""));
  const allowImageUpload = Boolean((data as any)?.allowImageUpload);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState(() => String(data.content || defaultDraftContent));
  const [editLabel, setEditLabel] = useState<string>(() => String((data as any)?.title ?? ""));
  const editLabelRef = useRef(editLabel);
  const streamContentRef = useRef("");
  const editContentRef = useRef(editContent);
  /** 编辑态下由 onChange 写入，仅作缓存不触发重渲染；onBlur 时以 getMarkdown() 为准，此 ref 作兜底 */
  const editingContentRef = useRef("");
  /** 编辑态实时写回（debounce），避免“保存按钮读取到旧 content” */
  const realtimeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 进入编辑后，若接口回写 data.content，且用户未改动（dirty=false），允许同步到输入框
  const editDirtyRef = useRef(false);
  const titleDirtyRef = useRef(false);
  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

  useEffect(() => {
    editLabelRef.current = editLabel;
  }, [editLabel]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (realtimeSaveTimerRef.current) {
        clearTimeout(realtimeSaveTimerRef.current);
        realtimeSaveTimerRef.current = null;
      }
    };
  }, []);

  // 流式结束时我们会先 setEditContent 再写回节点数据；在父层回写前避免被旧 props 覆盖
  const pendingCommitRef = useRef<string | null>(null);
  // 以组件内部状态为准，避免 props.data.isStreaming <-> setState <-> updateNodeData 的循环
  const [isStreaming, setIsStreaming] = useState<boolean>(() => Boolean(data.isStreaming));
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpandBtn, setShowExpandBtn] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MarkdownEditorRef>(null);
  const titleEditorRef = useRef<MarkdownEditorRef>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  /** 编辑态下在「编辑」按钮上按下鼠标，用于区分「同一次点击退出」与「再次点击进入」，避免 blur + click 导致退出后立刻又进入 */
  const editButtonMousedownRef = useRef(false);
  const streamingStartedRef = useRef(false);
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const hideFloatingButtonsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 记录当前这次生成过程里已经展示过的错误文案
  const shownErrorMessagesRef = useRef<Set<string>>(new Set());

  const showFloatingButtonsNow = useCallback(() => {
    if (hideFloatingButtonsTimerRef.current) {
      clearTimeout(hideFloatingButtonsTimerRef.current);
      hideFloatingButtonsTimerRef.current = null;
    }
    setShowFloatingButtons(true);
  }, []);

  const scheduleHideFloatingButtons = useCallback(() => {
    if (hideFloatingButtonsTimerRef.current) clearTimeout(hideFloatingButtonsTimerRef.current);
    hideFloatingButtonsTimerRef.current = setTimeout(() => {
      hideFloatingButtonsTimerRef.current = null;
      setShowFloatingButtons(false);
    }, 400);
  }, []);

  const notifyError = (err: any) => {
    const message =
      (err && typeof err.message === "string" && err.message) ||
      "生成失败，请稍后重试";

    const bag = shownErrorMessagesRef.current;
    // 同一次生成流程中，相同文案只展示一次
    if (bag.has(message)) return;
    bag.add(message);

    msg("error", message);
  };

  useEffect(() => {
    return () => {
      if (hideFloatingButtonsTimerRef.current) {
        clearTimeout(hideFloatingButtonsTimerRef.current);
        hideFloatingButtonsTimerRef.current = null;
      }
    };
  }, []);

  // 非流式时由 React 渲染；流式时仅用 ref，不触发重渲染，用户可正常滚动内容区
  const bodyContent = editContent || (isStreaming ? "生成中..." : "");

  const displayedContent = isEditing ? editContent : bodyContent;
  const titleText = String((data as any)?.title ?? "");
  const normalizedTitleText = titleText.trim();
  const images: string[] = useMemo(() => {
    const imgs = (data as any)?.images;
    if (Array.isArray(imgs)) {
      return imgs
        .filter(Boolean)
        .map((item) => normalizeImageSrc(String(item)))
        .filter(Boolean);
    }
    if (data.image) return [normalizeImageSrc(String(data.image))].filter(Boolean);
    return [];
  }, [data]);
  const primaryImageSrc = images[0] ?? "";
  const normalizedFilePath = useMemo(
    () => String((data as any)?.filePath ?? "").trim().replace(/\\/g, "/").replace(/^\/+/, ""),
    [data]
  );
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const displayImageSrc = imageLoadFailed ? canvasErrorImg : primaryImageSrc;
  useEffect(() => {
    setImageLoadFailed(false);
  }, [primaryImageSrc]);

  const handleCardDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) return;

    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        "button,input,textarea,select,a,[role='button'],[contenteditable='true']"
      )
    ) {
      return;
    }

    canvasHandlers.requestOpenFileByPath(normalizedFilePath || id);
  }, [canvasHandlers, data, id, isEditing, normalizedFilePath]);

  // 骨架：只在“接口创建且处于流式/加载、且尚无内容”时展示
  // 手动创建卡片：isStreaming=false，不展示骨架
  const isFromApi = Boolean((data as any)?.fromApi);
  const hasAnyApiData =
    Boolean(titleText.trim()) || Boolean(String(data.content || "").trim()) || images.length > 0;
  const hasCardContent = Boolean(String(data.content || "").trim());
  const showApiSkeleton = isFromApi && !isEditing && !hasAnyApiData;
  const apiProgressRaw = (data as any)?.progress;
  const apiProgress =
    typeof apiProgressRaw === "number" && Number.isFinite(apiProgressRaw)
      ? Math.max(0, Math.min(100, Math.round(apiProgressRaw)))
      : 0;
  const [simulatedApiProgress, setSimulatedApiProgress] = useState(apiProgress);
  const apiProgressDisplay = apiProgress >= 100 ? 100 : Math.max(apiProgress, simulatedApiProgress);
  const isPendingGenerate = Boolean((data as any)?.pendingGenerate);
  const isServerStreaming = Boolean(data.isStreaming);
  const hasCompletedApiData = isFromApi && hasAnyApiData && !isPendingGenerate && apiProgress >= 100;
  const showContentSkeleton =
    !isEditing &&
    !String(data.content || "").trim() &&
    (
      // 流式创建（接口拉流）
      (isServerStreaming && (!editContent || editContent === "生成中...")) ||
      // 接口创建（非拉流）：在内容未落盘前也需要骨架占位
      showApiSkeleton
    );
  const isPlaceholderCard =
    !hasCompletedApiData &&
    (
      showApiSkeleton ||
      showContentSkeleton ||
      (isFromApi && (isServerStreaming || isPendingGenerate))
    );

  // 同步外部内容：仅在 data.content 变化时更新本地；避免流式结束时用空串覆盖本地最终内容
  useEffect(() => {
    const prop = data.content || "";

    // 编辑中：如果用户尚未修改（dirty=false），允许把接口回写的数据同步到输入框
    if (isEditing) {
      if (!editDirtyRef.current) {
        setEditContent((prev) => (prop !== prev ? prop : prev));
      }
      return;
    }

    setEditContent((prev) => {
      if (pendingCommitRef.current) {
        if (prop !== pendingCommitRef.current) return prev;
        pendingCommitRef.current = null;
      }
      // 外部回写为空时，不覆盖本地已有内容（常见于“手动创建但尚未保存到 data.content”）
      if (!prop && prev) return prev;
      return prop === prev ? prev : prop;
    });
  }, [data.content, isEditing]);

  useEffect(() => {
    if (isEditing) return;
    const nextTitle = titleText;
    setEditLabel((prev) => (prev === nextTitle ? prev : nextTitle));
  }, [isEditing, titleText]);

  useEffect(() => {
    if (!isPlaceholderCard) return;
    setShowFloatingButtons(false);
  }, [isPlaceholderCard]);

  useEffect(() => {
    // 节点切换时，重置本地 streaming 状态
    setIsStreaming(Boolean(data.isStreaming));
    streamingStartedRef.current = false;
    streamContentRef.current = "";
    pendingCommitRef.current = null;
    setSimulatedApiProgress(apiProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // 概念图占位阶段：用随机速度推进展示进度，避免长时间停在同一数值。
    const isImageLikeCard = normalizedCardLabel === "脑洞" || normalizedCardLabel === "角色";
    const shouldAnimateProgress = isImageLikeCard && showApiSkeleton && apiProgress < 100;
    if (!shouldAnimateProgress) {
      setSimulatedApiProgress(apiProgress);
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextTick = () => {
      const delay = 120 + Math.floor(Math.random() * 460); // 120~579ms
      timer = setTimeout(() => {
        if (disposed) return;
        setSimulatedApiProgress((prev) => {
          const floor = Math.max(prev, apiProgress);
          if (floor >= 99) return floor;
          // 偶尔停顿一下，让速度更自然。
          if (Math.random() < 0.2) return floor;
          const stepMax = floor < 60 ? 6 : floor < 85 ? 4 : 2;
          const step = 1 + Math.floor(Math.random() * stepMax);
          return Math.min(99, floor + step);
        });
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [apiProgress, normalizedCardLabel, showApiSkeleton]);

  useEffect(() => {
    // 外部将同一节点的流式状态置为 false 时，同步收敛本地状态，
    // 避免占位卡完成替换/回写后仍被本地旧状态卡在“生成中”。
    if (data.isStreaming || !isStreaming) return;
    setIsStreaming(false);
  }, [data.isStreaming, isStreaming]);

  useEffect(() => {
    // 仅在编辑状态切换时更新 draggable，避免每次 render 都触发 updateNode 导致循环更新
    updateNode(id, { draggable: !isEditing });
  }, [id, isEditing, updateNode]);

  // 更新与该节点相关的入边动画状态（父 -> 当前）
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => (e.target === id ? { ...e, animated: isStreaming } : e))
    );
  }, [id, isStreaming, setEdges]);

  const checkOverflow = () => {
    if (isEditing) {
      setShowExpandBtn(false);
      return;
    }
    // 展开态不重算「是否显示展开按钮」，避免因宽度变大导致内容高度变小而把按钮错误隐藏
    if (isExpanded) return;
    const el = textRef.current;
    if (!el) return;
    const viewport = el.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    // 优先使用真实滚动容器高度判断，避免内容高度临界值在折叠/动画时误判
    const overflow = viewport
      ? viewport.scrollHeight > viewport.clientHeight + 1
      : el.scrollHeight > collapsedContentMaxHeight;
    setShowExpandBtn(overflow);
  };

  const checkOverflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isEditing) {
      checkOverflow();
      return;
    }
    if (isExpanded) return;
    // 退出编辑后只读视图可能尚未完成布局，延迟执行 checkOverflow 以正确显示「展开/折叠」按钮
    const rafId = requestAnimationFrame(() => {
      checkOverflowTimerRef.current = setTimeout(() => {
        checkOverflowTimerRef.current = null;
        checkOverflow();
      }, 200);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (checkOverflowTimerRef.current) {
        clearTimeout(checkOverflowTimerRef.current);
        checkOverflowTimerRef.current = null;
      }
    };
  }, [editContent, isExpanded, isEditing]);

  useEffect(() => {
    if (isEditing || isExpanded) return;
    const el = textRef.current;
    if (!el) return;
    const viewport = el.closest('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    const target = viewport ?? el;
    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [isEditing, isExpanded, editContent]);

  const clearRealtimeSaveTimer = () => {
    if (realtimeSaveTimerRef.current) {
      clearTimeout(realtimeSaveTimerRef.current);
      realtimeSaveTimerRef.current = null;
    }
  };

  const getFinalContent = () =>
    editDirtyRef.current
      ? (editorRef.current?.getMarkdown() ?? (editingContentRef.current || editContent))
      : String(data.content ?? "");

  const getFinalTitle = () => {
    const finalTitleMarkdown =
      allowTitleEdit
        ? titleEditorRef.current?.getMarkdown() ?? editLabelRef.current
        : String((data as any)?.title ?? "");
    return allowTitleEdit
      ? normalizeTitleMarkdown(finalTitleMarkdown)
      : String((data as any)?.title ?? "");
  };

  const saveTitle = () => {
    if (!allowTitleEdit || !titleDirtyRef.current) return;
    const finalTitle = getFinalTitle();
    const currentContent = editDirtyRef.current ? getFinalContent() : String(data.content ?? "");
    updateNodeData(id, { title: finalTitle });
    onUpdate(id, currentContent, { title: finalTitle });
    setEditLabel(finalTitle);
    titleDirtyRef.current = false;
  };

  const saveContent = () => {
    clearRealtimeSaveTimer();
    const finalContent = getFinalContent();
    updateNodeData(id, { content: finalContent });
    onUpdate(id, finalContent);
    setEditContent(finalContent);
    editDirtyRef.current = false;
  };

  const exitEditing = (options?: { saveTitle?: boolean; saveContent?: boolean }) => {
    if (!isEditing) return;
    const shouldSaveTitle = options?.saveTitle ?? true;
    const shouldSaveContent = options?.saveContent ?? true;

    if (shouldSaveTitle) {
      saveTitle();
    }
    if (shouldSaveContent) {
      saveContent();
    } else {
      clearRealtimeSaveTimer();
    }

    titleDirtyRef.current = false;
    editDirtyRef.current = false;
    setIsEditing(false);
  };

  const handleTitleEditorBlur = () => {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement && cardRef.current?.contains(activeElement)) {
        saveTitle();
        return;
      }
      exitEditing({ saveTitle: true, saveContent: false });
    });
  };

  const handleContentEditorBlur = () => {
    requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement && cardRef.current?.contains(activeElement)) {
        return;
      }
      exitEditing({ saveTitle: true, saveContent: true });
    });
  };

  const commitFinalContent = (finalText: string) => {
    if (!finalText) return;
    pendingCommitRef.current = finalText;
    setEditContent(finalText);
    streamContentRef.current = finalText;
    setIsStreaming(false);
    updateNodeData(id, { content: finalText, isStreaming: false });
    onUpdate(id, finalText);
  };

  const handleEdit = () => {
    if (isEditing) {
      exitEditing({ saveTitle: true, saveContent: true });
      return;
    }
    // 所有卡片均可进入编辑（不依赖 showExpandBtn）
    // 本次 click 前在编辑按钮上 mousedown 过说明是「点编辑退出」后的同一次点击，不要再次进入编辑
    if (editButtonMousedownRef.current) {
      editButtonMousedownRef.current = false;
      return;
    }
    setIsEditing(true);
    editDirtyRef.current = false;
    titleDirtyRef.current = false;
    const initial = data.content || "";
    setEditContent(initial);
    editingContentRef.current = initial;
    setEditLabel(String((data as any)?.title ?? ""));
    // 等 React 提交更新、MarkdownEditor 收到 readonly=false 后，再强制 setEditable+focus 兜底
    setTimeout(() => {
      if (canFocusTitleEditor) {
        titleEditorRef.current?.editor?.setEditable(true);
        titleEditorRef.current?.focus();
        return;
      }
      editorRef.current?.editor?.setEditable(true);
      editorRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => {
        if (canFocusTitleEditor) {
          titleEditorRef.current?.focus();
          return;
        }
        editorRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [canFocusTitleEditor, isEditing]);

  // 点击卡片外区域时退出编辑（TipTap 在点击非可聚焦元素时可能不触发 blur）
  useEffect(() => {
    if (!isEditing) return;
    const onMouseDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        exitEditing({ saveTitle: true, saveContent: true });
      }
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [isEditing]);

  const handleCancel = () => {
    clearRealtimeSaveTimer();
    editDirtyRef.current = false;
    titleDirtyRef.current = false;
    setEditContent(data.content || "");
    setEditLabel(String((data as any)?.title ?? ""));
    setIsEditing(false);
  };

  const toggleExpand = () => {
    // 流式输出期间不允许展开，避免内容区域被撑高遮挡下方节点
    if (isStreaming) return;
    setIsExpanded((v) => {
      // 从展开切回折叠时，先保留按钮显示，等待折叠态测量结果回写
      if (v) setShowExpandBtn(true);
      return !v;
    });
    onExpand?.(id);
  };

  // 处理滚轮事件：仅阻止冒泡到 ReactFlow（避免画布缩放/平移），不阻止默认滚动，由 MarkdownEditor / AutoScrollArea 内部处理
  const handleWheel = (event: React.WheelEvent) => {
    event.stopPropagation();
  };

  // 获取当前节点的子节点
  const children = (getEdges() || []).filter((e: any) => e.source === id).map((e: any) => e.target);
  const startStream = async () => {
    shownErrorMessagesRef.current = new Set();
    // 先占位，避免 handleRefresh 后 effect 再跑一次导致重复请求
    streamingStartedRef.current = true;
    startedStreamNodeIds.add(id);
    try {
      const sessionId = getCanvasSessionId() || undefined;
      const reqData = {
        inspirationWord: String(data.inspirationWord ?? ""),
        inspirationTheme: String(data.inspirationTheme ?? ""),
        shortSummary: data.shortSummary ? String(data.shortSummary) : undefined,
        storySetting: data.storySetting ? String(data.storySetting) : undefined,
        modelEndpoint: "KIMI_K2_ENDPOINT",
        sessionId,
      };

      setIsStreaming(true);
      updateNodeData(id, { isStreaming: true });
      streamContentRef.current = "";
      setEditContent("生成中...");

      const onData = (streamData: PostStreamData) => {
        switch (streamData.event) {
          case "messages/partial": {
            const d: any = (streamData as any)?.data;
            const msg = d?.[0]?.content?.[0]?.text ?? '';
            if (msg) {
              streamContentRef.current = msg;
              setEditContent(msg);
            }
            break;
          }
          case "updates": {
            const d: any = (streamData as any)?.data;
            const finalMsg = d?.generate_short_summary?.short_summary;

            // 只有拿到最终内容时才结束流式，否则忽略（有些后端会在过程中发 updates 元数据）
            if (finalMsg) {
              commitFinalContent(finalMsg);
              return;
            }
            break;
          }
        }
      };

      const onError = (err: any) => {
        // 流式接口报错：弹出错误提示，保持 UI 可恢复，并在“新空节点且无子节点”时自动移除该节点
        notifyError(err);
        setIsStreaming(false);
        updateNodeData(id, { isStreaming: false });
        if (!children.length && !data.content) {
          onDelete(id);
        }

      };

      const saveCanvas = async () => {
        const drawId = (data as any)?.inspirationDrawId;
        if (!drawId) return;
        try {
          await saveInspirationCanvasReq(drawId, {
            nodes: getNodes() || [],
            edges: getEdges() || [],
          });
        } catch {
          // ignore
        }
      };

      const onComplete = async () => {
        // 如果流式内容存在但未在 updates 中更新，则使用流式内容更新节点
        const finalContent = streamContentRef.current;
        if (finalContent) commitFinalContent(finalContent);
        else {
          setIsStreaming(false);
          updateNodeData(id, { isStreaming: false });
        }
        await saveCanvas();
      };

      await postInspirationStream(reqData, onData, onError, onComplete);
    } catch (err: any) {
      streamingStartedRef.current = false;
      startedStreamNodeIds.delete(id);
      setIsStreaming(false);
      updateNodeData(id, { isStreaming: false });
      // 请求级别的异常（如网络错误）同样视为生成失败，弹出错误并清理“新空节点”
      notifyError(err);
      if (!children.length && !data.content) {
        onDelete(id);
      }

    }
  };

  // 自动拉流：只允许每个节点启动一次（避免 StrictMode / ReactFlow 重挂载导致重复触发接口）
  useEffect(() => {
    if (!data?.isStreaming) return;
    if ((data as any)?.skipAutoStream) return;
    if (streamingStartedRef.current) return;
    if (startedStreamNodeIds.has(id)) return;
    streamingStartedRef.current = true;
    startedStreamNodeIds.add(id);
    void startStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.isStreaming]);

  const handleGenerate = () => {
    // 保持 InsCanvas 的“生成逻辑”（例如：生成下一层节点/边）
    onGenerate(id);
  };

  const handleAdd = () => {
    onAdd(id)
  };

  const handleDelete = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    onDelete(id, { skipLayout: true });
  }, [id, onDelete]);

  const handleRefresh = () => {
    setEditContent("");
    pendingCommitRef.current = null;
    startedStreamNodeIds.delete(id);
    streamingStartedRef.current = false;
    void startStream();
  };

  const chainNodes = useMemo(() => {
    const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
    const upstreamByNodeId = new Map<string, Set<string>>();
    const connectUpstream = (targetId: string, sourceId: string) => {
      if (!targetId || !sourceId || targetId === sourceId) return;
      if (!upstreamByNodeId.has(targetId)) upstreamByNodeId.set(targetId, new Set());
      upstreamByNodeId.get(targetId)?.add(sourceId);
    };

    allEdges.forEach((edge) => {
      connectUpstream(String(edge.target ?? ""), String(edge.source ?? ""));
    });

    const visited = new Set<string>();
    const ordered: any[] = [];
    const stack = [id];

    while (stack.length > 0) {
      const currentId = stack.pop() as string;
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      const current = nodeMap.get(currentId);
      if (current) {
        ordered.push(current);
      }

      upstreamByNodeId.get(currentId)?.forEach((upstreamId) => {
        if (!visited.has(upstreamId)) {
          stack.push(upstreamId);
        }
      });
    }

    return ordered;
  }, [allEdges, allNodes, id]);

  const chainMeta = useMemo(() => {
    const relatedNodes = chainNodes.filter((node) => node.id !== id);
    return {
      hasSummaryCard: relatedNodes.some((node) =>
        String(node?.data?.label ?? "").includes("梗概")
      ),
      hasOutlineCardOrGroup: relatedNodes.some((node) => {
        const label = String(node?.data?.label ?? "");
        return (
          label.includes("大纲") ||
          Boolean((node.data as any)?.outlineGroupId)
        );
      }),
      hasRoleCardGroup: relatedNodes.some((node) =>
        node.type === "roleGroup" && String(node?.data?.label ?? "") === "角色"
      ),
    };
  }, [chainNodes, id]);
  const contextGenerateOptions = useMemo(() => {
    const files = chainNodes.reduce<Record<string, string>>((acc, node, index) => {
      const content = String(node.data?.content ?? "").trim();
      if (!content) return acc;

      const filePath = String((node.data as any)?.filePath ?? "").trim();
      const title = String((node.data as any)?.title ?? "").trim();
      const label = String(node.data?.label ?? "").trim();
      const fromApi = Boolean((node.data as any)?.fromApi);
      if (isPlaceholderDraftContent(label, fromApi, content)) {
        return acc;
      }
      const fallbackBaseName = sanitizeContextFileName(
        title || label || `卡片${index + 1}`,
        `卡片${index + 1}`
      );
      const fallbackPath = label.includes("梗概")
        ? "故事设定/故事简介.md"
        : label.includes("大纲")
          ? "大纲.md"
          : label === "角色"
            ? `角色设定/${fallbackBaseName}.md`
            : label === "脑洞"
              ? `脑洞/${fallbackBaseName}.md`
              : label === "信息"
                ? `信息/${fallbackBaseName}.md`
                : `上下文/${fallbackBaseName}.md`;

      acc[filePath || fallbackPath] = content;
      return acc;
    }, {});

    const explicitTitle =
      titleText.trim() || String((data as any)?.title ?? "").trim();
    const currentContent = String(data.content ?? "").trim();
    const fallbackTitle =
      !isPlaceholderDraftContent(normalizedCardLabel, Boolean(data.fromApi), currentContent) &&
      currentContent
        ? normalizeTitleMarkdown(currentContent)
        : "";

    return {
      files,
      title: explicitTitle || fallbackTitle,
    };
  }, [chainNodes, data, normalizedCardLabel, titleText]);
  const isGroupedRoleCard = Boolean((data as any)?.roleGroupId);
  const isGroupedOutlineCard = Boolean((data as any)?.outlineGroupId);
  const isGroupedCard = isGroupedRoleCard || isGroupedOutlineCard;
  const isGroupedCardDragging = isGroupedCard && dragging;
  const isRoleCard = useMemo(
    () => isGroupedRoleCard || normalizedCardLabel === "角色",
    [isGroupedRoleCard, normalizedCardLabel]
  );
  const roleCardIndex = useMemo(() => {
    if (!isRoleCard) return 1;

    const currentRoleGroupId = String((data as any)?.roleGroupId ?? "").trim();
    const siblingRoleCards = allNodes
      .filter((node) => {
        if (currentRoleGroupId) {
          return String((node.data as any)?.roleGroupId ?? "").trim() === currentRoleGroupId;
        }
        return (
          String(node.data?.label ?? "").trim() === "角色" &&
          !String((node.data as any)?.roleGroupId ?? "").trim() &&
          !String((node.data as any)?.outlineGroupId ?? "").trim()
        );
      })
      .sort((a, b) => {
        const ay = Number(a.position?.y ?? 0);
        const by = Number(b.position?.y ?? 0);
        if (ay !== by) return ay - by;
        return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
      });

    const currentIndex = siblingRoleCards.findIndex((node) => node.id === id);
    return currentIndex >= 0 ? currentIndex + 1 : 1;
  }, [allNodes, data, id, isRoleCard]);
  const hasTitleText = normalizedTitleText.length > 0;
  const isBlankDraft = Boolean((data as any)?.isBlankDraft ?? (data as any)?.isBlankBrainstormDraft);
  const isOutlineCard = useMemo(
    () => normalizedCardLabel === "大纲" || normalizedCardLabel === "故事大纲",
    [normalizedCardLabel]
  );
  const shouldShowInlineTitle = !isOutlineCard && !isGroupedOutlineCard;
  const shouldShowReadonlyTitle = shouldShowInlineTitle && !isEditing;
  const visibleContent = useMemo(() => {
    if (isEditing || !shouldShowInlineTitle || !hasTitleText) {
      return displayedContent;
    }

    const content = String(displayedContent || "");
    const headingMatch = content.match(/^\s*#{1,6}\s+(.+?)\s*(?:\r?\n|$)/);
    const headingText = String(headingMatch?.[1] ?? "").trim();
    if (!headingText || headingText !== normalizedTitleText) {
      return content;
    }

    return content
      .replace(/^\s*#{1,6}\s+.+?(?:\r?\n|$)/, "")
      .replace(/^(?:\s*\r?\n)+/, "");
  }, [displayedContent, hasTitleText, isEditing, normalizedTitleText, shouldShowInlineTitle]);

  const isBrainstormCard = useMemo(() => normalizedCardLabel === "脑洞", [normalizedCardLabel]);
  const isInfoCard = useMemo(() => normalizedCardLabel === "信息", [normalizedCardLabel]);
  const isSummaryCard = useMemo(
    () => normalizedCardLabel === "故事梗概" || normalizedCardLabel === "梗概",
    [normalizedCardLabel]
  );
  useEffect(() => {
    if (Boolean(data.fromApi)) return;
    if (!isSummaryCard) return;
    if (String(data.content || "").trim()) return;
    if (!defaultDraftContent.trim()) return;

    updateNodeData(id, { content: defaultDraftContent });
    onUpdate(id, defaultDraftContent);
  }, [data.content, data.fromApi, defaultDraftContent, id, isSummaryCard, onUpdate, updateNodeData]);
  const isImageCard = useMemo(
    () => normalizedCardLabel === "脑洞" || normalizedCardLabel === "角色",
    [normalizedCardLabel]
  );
  const isRoleMermaidCard = useMemo(
    () => isRoleCard && displayedContent.includes("mermaid"),
    [displayedContent, isRoleCard]
  );
  const isLargeSummaryCard = isSummaryCard || isInfoCard;
  const titleAreaHeightClass = isLargeSummaryCard ? "h-[92px]" : "h-[54px]";
  const isBrainstormAiMode = Boolean((data as any)?.brainstormAiMode);
  const isHighlighted = Boolean((data as any)?.highlighted);
  const shouldShowPendingBadge =
    isBlankDraft &&
    isPendingGenerate &&
    isBrainstormAiMode &&
    !isServerStreaming;
  const hasPendingApiResponse = !hasCompletedApiData && (isServerStreaming || isPendingGenerate);
  const hasAnyPendingCanvasOutput = useMemo(
    () =>
      allNodes.some((node) => {
        const content = String(node.data?.content ?? "").trim();
        return (
          Boolean((node.data as any)?.isStreaming) ||
          (Boolean((node.data as any)?.fromApi) && !content)
        );
      }),
    [allNodes]
  );
  const shouldShowCardFloatingControls =
    !isPlaceholderCard &&
    !hasPendingApiResponse &&
    !hasAnyPendingCanvasOutput &&
    !isRoleCard &&
    !isGroupedOutlineCard;
  const shouldDisableToolbarActions = hasAnyPendingCanvasOutput;
  useEffect(() => {
    if (!shouldShowCardFloatingControls) {
      setShowFloatingButtons(false);
    }
  }, [shouldShowCardFloatingControls]);

  const isTextOnlyCard = !isImageCard;
  const collapsedContentMaxHeight = isRoleMermaidCard
    ? 330
    : isImageCard
      ? 96
      : isLargeSummaryCard
        ? 720
        : 168;
  const expandedContentMaxHeight = isRoleMermaidCard
    ? 380
    : isImageCard
      ? 160
      : isLargeSummaryCard
        ? 820
        : 320;
  const noteCardTypeLabel = useMemo(() => {
    if (normalizedCardLabel === "角色") return "角色卡";
    if (normalizedCardLabel === "信息") return "信息卡";
    if (normalizedCardLabel === "故事梗概" || normalizedCardLabel === "梗概") return "梗概卡";
    if (normalizedCardLabel === "大纲" || normalizedCardLabel === "故事大纲") return "大纲卡";
    return "脑洞卡";
  }, [normalizedCardLabel]);
  const displayCardLabel = useMemo(() => {
    if (normalizedCardLabel === "故事梗概") return "梗概";
    return normalizedCardLabel;
  }, [normalizedCardLabel]);
  const readonlyTitleText = useMemo(() => {
    if (hasTitleText) {
      if (hasTitleText) return normalizedTitleText;
    } else {
      if (isRoleCard) {
        return `[${cardLabel}名称]`;
      }
      if (isSummaryCard) {
        return `[作品名称]`;
      }
      if (isInfoCard) {
        return `[标题]`
      }
    }
   
    return `[${cardLabel}]`;
  }, [cardLabel, hasTitleText, isRoleCard, normalizedTitleText, isSummaryCard]);
  const editorPlaceholder = useMemo(() => {
    if (data.fromApi) return "";
    if (isBrainstormCard) return "[写作思路]";
    if (isRoleCard) return "[角色描述]";
    if (isOutlineCard || isGroupedOutlineCard) return "[章纲内容]";
    if (isInfoCard) return "[内容]";
    return "[写作思路]";
  }, [data.fromApi, isBrainstormCard, isGroupedOutlineCard, isInfoCard, isOutlineCard, isRoleCard]);

  const headerLabelBackground = useMemo(() => {
    if (isSummaryCard) {
      return "linear-gradient(90deg, #BCDEFF 0%, rgba(188,222,255,0) 100%)";
    }
    if (isInfoCard) {
      return "linear-gradient(90deg, #DEDEDE 0%, rgba(222,222,222,0) 100%)";
    }
    if (isBrainstormCard) {
      return "linear-gradient(90deg, #FEF9C3 0%, rgba(254,249,195,0) 100%)";
    }
    return undefined;
  }, [isBrainstormCard, isInfoCard, isSummaryCard]);
  const headerLabelText = isGroupedCard || isRoleCard
    ? (titleText.trim() ? titleText : `[${displayCardLabel || cardLabel}]`)
    : (displayCardLabel || data.label || cardLabel);
  const shouldShowHeaderIcon = !isRoleCard && !isOutlineCard;
  const handleAddNote = useCallback(async () => {
    const content = convertRichTextToPlainText(String(data.content || ""));
    if (!content) {
      msg("warning", "当前卡片内容为空，无法添加笔记");
      return;
    }
    const title = `【${noteCardTypeLabel}】${titleText.trim() || "未命名卡片"}`;
    try {
      await addNote(title, content, "PC_INSPIRATION_DRAW");
      msg("success", "笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      msg("error", "添加笔记失败，请重试");
    }
  }, [data.content, msg, noteCardTypeLabel, titleText]);

  const floatingActions = useMemo(() => {
    if (isPlaceholderCard) {
      return [] as FloatingAction[];
    }

    if (isGroupedCard) {
      return [] as FloatingAction[];
    }

    const infoAction: FloatingAction = {
      key: "generate-info",
      label: "我想用它生成...",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        canvasHandlers.handlePrepareGenerateToDialog?.(id, "auto", {
          files: contextGenerateOptions.files,
          title: "信息",
          actionLabel: "我想用它生成...",
          includeDialogReferences: true,
        });
      },
    };

    if (isBrainstormCard) {
      const actions: FloatingAction[] = [];
      if (!chainMeta.hasRoleCardGroup) {
        actions.push({
          key: "generate-role",
          label: "以此生成角色",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "role", {
              files: contextGenerateOptions.files,
              title: "角色",
              actionLabel: "以此生成角色",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      if (!chainMeta.hasSummaryCard) {
        actions.push({
          key: "generate-summary",
          label: "以此生成故事梗概",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "summary", {
              files: contextGenerateOptions.files,
              title: "故事梗概",
              actionLabel: "以此生成故事梗概",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      actions.push(infoAction);
      return actions;
    }

    if (isSummaryCard) {
      const actions: FloatingAction[] = [];
      if (!chainMeta.hasRoleCardGroup) {
        actions.push({
          key: "generate-role",
          label: "以此生成角色",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "role", {
              files: contextGenerateOptions.files,
              title: "角色",
              actionLabel: "以此生成角色",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      if (!chainMeta.hasOutlineCardOrGroup) {
        actions.push({
          key: "generate-outline",
          label: "以此生成大纲",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateOutlineFromContext?.(id, {
              files: contextGenerateOptions.files,
              title: "大纲",
              actionLabel: "以此生成大纲",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      actions.push(infoAction);
      return actions;
    }

    if (isInfoCard) {
      return [infoAction] as FloatingAction[];
    }

    if (isRoleCard) {
      const actions: FloatingAction[] = [
        {
          key: "expand-role",
          label: "以此扩充随机角色",
          onClick: (e) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "role", {
              files: contextGenerateOptions.files,
              title: "角色",
              actionLabel: "以此扩充随机角色",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        },
      ];
      if (!chainMeta.hasSummaryCard) {
        actions.push({
          key: "generate-summary",
          label: "以此生成故事梗概",
          onClick: (e) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "summary", {
              files: contextGenerateOptions.files,
              title: "故事梗概",
              actionLabel: "以此生成故事梗概",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      if (!chainMeta.hasOutlineCardOrGroup) {
        actions.push({
          key: "generate-outline",
          label: "以此生成大纲",
          onClick: (e) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateOutlineFromContext?.(id, {
              files: contextGenerateOptions.files,
              title: "大纲",
              actionLabel: "以此生成大纲",
              includeDialogReferences: false,
              clearDialogPreviewsAfterRequest: false,
            });
          },
        });
      }
      actions.push(infoAction);
      return actions;
    }

    return [] as FloatingAction[];
  }, [
    canvasHandlers,
    chainMeta,
    id,
    isBrainstormCard,
    isGroupedCard,
    isInfoCard,
    isRoleCard,
    isSummaryCard,
    isPlaceholderCard,
    contextGenerateOptions,
  ]);
  const visibleFloatingActions = useMemo(
    () => (shouldShowCardFloatingControls ? floatingActions : []),
    [floatingActions, shouldShowCardFloatingControls]
  );
  const hasThirdFloatingAction = visibleFloatingActions.length > 2;

  const getCanvasNodeLayoutSize = useCallback(
    (node: any) => getCanvasNodeLayoutSizeFromUtils(node),
    []
  );

  const getAbsoluteCanvasNodePosition = useCallback((nodeId: string) => {
    const normalizedNodeId = String(nodeId || "").trim();
    if (!normalizedNodeId) return { x: 0, y: 0 };

    const latestNodes = getNodes();
    const nodeMap = new Map(latestNodes.map((node) => [node.id, node]));
    const visit = (currentId: string): { x: number; y: number } => {
      const currentNode = nodeMap.get(currentId) as any;
      if (!currentNode) return { x: 0, y: 0 };

      const parentId =
        String(currentNode.parentId ?? "") ||
        String(currentNode.data?.roleGroupId ?? "") ||
        String(currentNode.data?.outlineGroupId ?? "");
      if (!parentId) {
        return {
          x: Number(currentNode.position?.x ?? 0),
          y: Number(currentNode.position?.y ?? 0),
        };
      }

      const parentPosition = visit(parentId);
      return {
        x: parentPosition.x + Number(currentNode.position?.x ?? 0),
        y: parentPosition.y + Number(currentNode.position?.y ?? 0),
      };
    };

    return visit(normalizedNodeId);
  }, [getNodes]);

  const focusCopiedNode = useCallback((nodeId: string) => {
    const normalizedNodeId = String(nodeId || "").trim();
    if (!normalizedNodeId) return;

    const attemptFocus = (attempt: number) => {
      const targetNode = getNodes().find((node) => node.id === normalizedNodeId);
      const internalNode = getNode(normalizedNodeId) as any;
      if (!targetNode && !internalNode && attempt < 12) {
        requestAnimationFrame(() => attemptFocus(attempt + 1));
        return;
      }
      if (!targetNode && !internalNode) return;

      const absolutePosition =
        internalNode?.internals?.positionAbsolute ||
        internalNode?.positionAbsolute ||
        getAbsoluteCanvasNodePosition(normalizedNodeId);
      const { width, height } = getCanvasNodeLayoutSize(internalNode || targetNode);

      setNodes((prev) =>
        prev.map((node) =>
          node.id === normalizedNodeId
            ? { ...node, data: { ...node.data, highlighted: true } as any }
            : node
        )
      );

      if (copyHighlightTimerRef.current) {
        clearTimeout(copyHighlightTimerRef.current);
      }
      copyHighlightTimerRef.current = setTimeout(() => {
        copyHighlightTimerRef.current = null;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === normalizedNodeId
              ? { ...node, data: { ...node.data, highlighted: false } as any }
              : node
          )
        );
      }, 1800);

      void setCenter(
        (absolutePosition?.x ?? 0) + width / 2,
        (absolutePosition?.y ?? 0) + height / 2,
        { zoom: 0.95, duration: 500 } as any
      );
    };

    requestAnimationFrame(() => attemptFocus(0));
  }, [getAbsoluteCanvasNodePosition, getCanvasNodeLayoutSize, getNode, getNodes, setCenter, setNodes]);

  const handleCopyCard = useCallback(() => {
    const currentNode = getNodes().find((node) => node.id === id);
    if (!currentNode) {
      msg("warning", "未找到当前卡片");
      return;
    }

    const roleGroupId = String((currentNode.data as any)?.roleGroupId ?? "");
    const outlineGroupId = String((currentNode.data as any)?.outlineGroupId ?? "");
    const groupId = roleGroupId || outlineGroupId;
    const duplicatedNodeId = `${currentNode.type || "card"}-${Date.now()}`;
    const duplicatedCardSize = getCanvasNodeLayoutSize(currentNode);
    const CARD_GAP_X = 28;
    const CARD_GAP_Y = 36;
    const ROLE_GROUP_MAX_COLS = 3;
    const ROLE_GROUP_PADDING = 24;
    const ROLE_GROUP_PADDING_TOP = 64;
    const ROLE_GROUP_GAP_X = 24;
    const ROLE_GROUP_GAP_Y = 28;
    const ROLE_GROUP_MIN_HEIGHT = 580;
    const OUTLINE_GROUP_MAX_COLS = 3;
    const OUTLINE_GROUP_PADDING = 20;
    const OUTLINE_GROUP_CARD_WIDTH = 300;
    const OUTLINE_GROUP_CARD_HEIGHT = 260;
    const OUTLINE_GROUP_GAP_X = 24;
    const OUTLINE_GROUP_GAP_Y = 28;
    const OUTLINE_GROUP_SETTINGS_TOP = 56;
    const OUTLINE_GROUP_SETTINGS_BOTTOM_GAP = 24;
    const OUTLINE_GROUP_SETTINGS_CARD_WIDTH = 600;
    const OUTLINE_GROUP_SETTINGS_CARD_HEIGHT = 420;
    const OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT = 56;
    const isGroupedOutlineCard = Boolean(outlineGroupId);

    setNodes((prev) => {
      const baseDuplicatedNode = {
        ...currentNode,
        id: duplicatedNodeId,
        selected: false,
        dragging: false,
        data: {
          ...currentNode.data,
          isStreaming: false,
          highlighted: false,
          openOutlinePopover: false,
        },
      } as any;

      const getNodeRect = (node: any) => {
        const size = getCanvasNodeLayoutSize(node);
        const x = Number(node.position?.x ?? 0);
        const y = Number(node.position?.y ?? 0);
        return {
          left: x,
          top: y,
          right: x + size.width,
          bottom: y + size.height,
          width: size.width,
          height: size.height,
        };
      };

      const hasOverlapAtPosition = (x: number, y: number, nodes: any[]) =>
        nodes.some((node) => {
          const rect = getNodeRect(node);
          return !(
            x + duplicatedCardSize.width <= rect.left ||
            x >= rect.right ||
            y + duplicatedCardSize.height <= rect.top ||
            y >= rect.bottom
          );
        });

      if (!groupId) {
        const currentX = Number(currentNode.position?.x ?? 0);
        const currentY = Number(currentNode.position?.y ?? 0);
        const topLevelNodes = prev.filter((node) => !node.parentId && node.id !== currentNode.id);
        const candidatePositions = [
          { x: currentX + duplicatedCardSize.width + CARD_GAP_X, y: currentY },
          { x: currentX - duplicatedCardSize.width - CARD_GAP_X, y: currentY },
          { x: currentX, y: currentY - duplicatedCardSize.height - CARD_GAP_Y },
          { x: currentX, y: currentY + duplicatedCardSize.height + CARD_GAP_Y },
        ];
        const emptyPosition = candidatePositions.find(
          (candidate) => !hasOverlapAtPosition(candidate.x, candidate.y, topLevelNodes)
        );

        if (emptyPosition) {
          return [
            ...prev,
            {
              ...baseDuplicatedNode,
              position: emptyPosition,
            },
          ];
        }

        const insertionX = currentX + duplicatedCardSize.width + CARD_GAP_X;
        const sameRowThreshold = duplicatedCardSize.height / 2;
        const affectedNodeIds = new Set(
          prev
            .filter((node) => {
              if (node.parentId || node.id === currentNode.id) return false;
              const nodeX = Number(node.position?.x ?? 0);
              const nodeY = Number(node.position?.y ?? 0);
              return nodeX >= insertionX && Math.abs(nodeY - currentY) <= sameRowThreshold;
            })
            .map((node) => node.id)
        );

        return [
          ...prev.map((node) =>
            affectedNodeIds.has(node.id)
              ? {
                  ...node,
                  position: {
                    ...node.position,
                    x: Number(node.position?.x ?? 0) + duplicatedCardSize.width + CARD_GAP_X,
                  },
                }
              : node
          ),
          {
            ...baseDuplicatedNode,
            position: {
              x: insertionX,
              y: currentY,
            },
          },
        ];
      }

      const groupedNodes = prev
        .filter((node) =>
          isGroupedOutlineCard
            ? String((node.data as any)?.outlineGroupId ?? "") === groupId
            : String((node.data as any)?.roleGroupId ?? "") === groupId
        )
        .sort((a, b) => {
          const ay = Number(a.position?.y ?? 0);
          const by = Number(b.position?.y ?? 0);
          if (ay !== by) return ay - by;
          return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
        });
      const groupNode = prev.find((node) => node.id === groupId);
      const currentIndex = groupedNodes.findIndex((node) => node.id === currentNode.id);
      const maxCols = isGroupedOutlineCard ? OUTLINE_GROUP_MAX_COLS : ROLE_GROUP_MAX_COLS;
      const rowStartIndex = currentIndex >= 0 ? Math.floor(currentIndex / maxCols) * maxCols : groupedNodes.length;
      const currentRowNodes = groupedNodes.slice(rowStartIndex, rowStartIndex + maxCols);
      const rowIsFull = currentRowNodes.length >= maxCols;
      const insertionIndex =
        currentIndex < 0
          ? groupedNodes.length
          : rowIsFull
            ? Math.min(rowStartIndex + maxCols, groupedNodes.length)
            : currentIndex + 1;
      const orderedNodes = [
        ...groupedNodes.slice(0, insertionIndex),
        baseDuplicatedNode,
        ...groupedNodes.slice(insertionIndex),
      ];

      const nextPositionById = new Map<string, { x: number; y: number }>();
      let nextGroupWidth = Number((groupNode as any)?.style?.width ?? 0);
      let nextGroupHeight = Number((groupNode as any)?.style?.height ?? 0);

      if (isGroupedOutlineCard) {
        const settingsNode = prev.find(
          (node) => node.parentId === groupId && node.type === "outlineSettingCard"
        ) as any;
        const settingsHeight = settingsNode
          ? Number(settingsNode?.style?.height ?? settingsNode?.measured?.height ?? 0) ||
            (Boolean(settingsNode.data?.outlineSettingCollapsed)
              ? OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT
              : OUTLINE_GROUP_SETTINGS_CARD_HEIGHT)
          : 0;
        const cardsTop =
          settingsHeight > 0
            ? OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_SETTINGS_BOTTOM_GAP
            : OUTLINE_GROUP_SETTINGS_TOP;

        orderedNodes.forEach((node, index) => {
          const col = index % OUTLINE_GROUP_MAX_COLS;
          const row = Math.floor(index / OUTLINE_GROUP_MAX_COLS);
          nextPositionById.set(node.id, {
            x: OUTLINE_GROUP_PADDING + col * (OUTLINE_GROUP_CARD_WIDTH + OUTLINE_GROUP_GAP_X),
            y: cardsTop + row * (OUTLINE_GROUP_CARD_HEIGHT + OUTLINE_GROUP_GAP_Y),
          });
        });

        const rows = Math.max(1, Math.ceil(orderedNodes.length / OUTLINE_GROUP_MAX_COLS));
        const colsUsed = Math.min(OUTLINE_GROUP_MAX_COLS, orderedNodes.length);
        nextGroupWidth = Math.max(
          OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_PADDING * 2,
          OUTLINE_GROUP_PADDING * 2 +
            colsUsed * OUTLINE_GROUP_CARD_WIDTH +
            Math.max(0, colsUsed - 1) * OUTLINE_GROUP_GAP_X
        );
        nextGroupHeight = Math.max(
          OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_PADDING,
          cardsTop +
            rows * OUTLINE_GROUP_CARD_HEIGHT +
            Math.max(0, rows - 1) * OUTLINE_GROUP_GAP_Y +
            OUTLINE_GROUP_PADDING
        );
      } else {
        let rowStartY = ROLE_GROUP_PADDING_TOP;
        for (let start = 0; start < orderedNodes.length; start += ROLE_GROUP_MAX_COLS) {
          const rowNodes = orderedNodes.slice(start, start + ROLE_GROUP_MAX_COLS);
          const rowHeight = rowNodes.reduce((max, node) => {
            const { height } = getCanvasNodeLayoutSize(node);
            return Math.max(max, height);
          }, 0);

          let nextRowX = ROLE_GROUP_PADDING;
          rowNodes.forEach((node) => {
            const { width } = getCanvasNodeLayoutSize(node);
            nextPositionById.set(node.id, {
              x: nextRowX,
              y: rowStartY,
            });
            nextRowX += width + ROLE_GROUP_GAP_X;
          });
          rowStartY += rowHeight + ROLE_GROUP_GAP_Y;
        }

        const maxRight = orderedNodes.reduce((max, node) => {
          const nextPosition = nextPositionById.get(node.id);
          const { width } = getCanvasNodeLayoutSize(node);
          return Math.max(max, Number(nextPosition?.x ?? 0) + width);
        }, 0);
        const maxBottom = orderedNodes.reduce((max, node) => {
          const nextPosition = nextPositionById.get(node.id);
          const { height } = getCanvasNodeLayoutSize(node);
          return Math.max(max, Number(nextPosition?.y ?? 0) + height);
        }, 0);
        nextGroupWidth = Math.max(340, maxRight + ROLE_GROUP_PADDING);
        nextGroupHeight = Math.max(ROLE_GROUP_MIN_HEIGHT, maxBottom + ROLE_GROUP_PADDING);
      }

      const nextNodes = prev.map((node) => {
        if (node.id === groupId) {
          return {
            ...node,
            style: {
              ...((node as any)?.style ?? {}),
              width: nextGroupWidth,
              height: nextGroupHeight,
            },
          };
        }

        if (
          isGroupedOutlineCard &&
          node.parentId === groupId &&
          node.type === "outlineSettingCard"
        ) {
          return {
            ...node,
            style: {
              ...((node as any)?.style ?? {}),
              width: Math.max(nextGroupWidth - OUTLINE_GROUP_PADDING * 2, OUTLINE_GROUP_SETTINGS_CARD_WIDTH),
            },
          };
        }

        const nextPosition = nextPositionById.get(node.id);
        if (!nextPosition) return node;
        return {
          ...node,
          position: nextPosition,
        };
      });

      return [
        ...nextNodes,
        {
          ...baseDuplicatedNode,
          position: nextPositionById.get(duplicatedNodeId) ?? currentNode.position,
        },
      ];
    });
    focusCopiedNode(duplicatedNodeId);
    msg("success", "已复制当前卡片");
  }, [focusCopiedNode, getCanvasNodeLayoutSize, getNodes, id, msg, setNodes]);

  useEffect(() => {
    return () => {
      if (copyHighlightTimerRef.current) {
        clearTimeout(copyHighlightTimerRef.current);
        copyHighlightTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "vue-flow-card nowheel relative overflow-visible",
        "rounded-[20px] bg-white border",
        isBlankDraft && !isBrainstormAiMode && !isPendingGenerate && !isServerStreaming
          ? "border-dashed border-[#EFAF00]"
          : "border-solid border-[#e5e7eb]",
        (isBrainstormAiMode || isHighlighted) &&
          "border-solid border-[#EFAF00] shadow-[0px_0px_0px_2px_rgba(239,175,0,0.18),0px_14px_36px_0px_rgba(0,0,0,0.14)]",
        isGroupedCardDragging &&
          "z-30 scale-[1.035] -rotate-[1deg] border-solid border-[#2563EB] shadow-[0px_0px_0px_3px_rgba(59,130,246,0.22),0px_24px_56px_0px_rgba(37,99,235,0.24)]",
        isHighlighted &&
          "after:pointer-events-none after:absolute after:inset-[-6px] after:rounded-[24px] after:border after:border-[#EFAF00]/70 after:content-[''] after:animate-ping",
        "shadow-[0px_10px_28px_0px_rgba(0,0,0,0.10)] hover:shadow-[0px_14px_36px_0px_rgba(0,0,0,0.14)]",
        "group transition-[box-shadow,transform,border-color] duration-200 ease-out",
        isImageCard
          ? (isExpanded ? "w-[750px] h-[500px]" : "w-[300px] min-h-[450px]")
          : isLargeSummaryCard
            ? (isExpanded ? "w-[680px] min-h-[960px]" : "w-[600px] min-h-[900px]")
            : (isExpanded ? "w-[520px] min-h-[420px]" : "w-[300px] min-h-[240px]"),
        isGroupedCard && !isEditing && "cursor-grab active:cursor-grabbing",
        isEditing && "nodrag nopan"
      )}
      onMouseEnter={shouldShowCardFloatingControls ? showFloatingButtonsNow : undefined}
      onMouseLeave={shouldShowCardFloatingControls ? scheduleHideFloatingButtons : undefined}
      onDoubleClick={handleCardDoubleClick}
    >
      {isGroupedCardDragging ? (
        <div className="pointer-events-none absolute right-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-2.5 py-1 text-[11px] font-medium text-white shadow-[0px_8px_20px_0px_rgba(37,99,235,0.28)]">
          <span className="size-2 rounded-full bg-white/95 animate-pulse" />
          拖动中
        </div>
      ) : null}
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2 pt-4 pb-2 text-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            title={isRoleCard ? `角色${roleCardIndex}` : hasTitleText ? normalizedTitleText : ``}
            className="min-w-0 inline-flex max-w-[min(100%,calc(100%-1.5rem))] gap-1 rounded-[6px] px-2 py-0.5 font-semibold text-[#111] text-sm"
            style={{
              backgroundImage: headerLabelBackground,
            }}
          >
            {shouldShowHeaderIcon ? (
              <Iconfont unicode="&#xe664;" className="text-[#854D0E] size-4" />
            ) : null}
            <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {isRoleCard ? `` :  headerLabelText }
            </span>
          </span>
          {shouldShowPendingBadge ? (
            <span className="rounded-full border border-[#FEF08A] bg-[#FEFCE8] px-2 py-0.5 text-[11px] text-[#854D0E]">
              待生成
            </span>
          ) : null}
        </div>
        {!isStreaming && (
          <div className="z-20 flex shrink-0 items-center transition-opacity">
            {isEditing && allowImageUpload && isImageCard ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length === 0) return;
                    e.target.value = "";

                    const toDataUrl = (file: File) =>
                      new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ""));
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(file);
                      });

                    try {
                      const urls = await Promise.all(files.map(toDataUrl));
                      const nextImages = [
                        ...images,
                        ...urls.filter(Boolean).map(String),
                      ];
                      updateNodeData(id, {
                        images: nextImages,
                        image: nextImages[0],
                      });
                      onUpdate(id, editContentRef.current || String(data.content || ""), {
                        images: nextImages,
                        image: nextImages[0],
                      });
                    } catch (err) {
                      notifyError(err);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  title="上传图片"
                  className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
                >
                  <Plus className="size-3" />
                </Button>
              </>
            ) : null}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={async (e) => {
                e.stopPropagation();
                await handleAddNote();
              }}
              title="添加到笔记"
              disabled={shouldDisableToolbarActions}
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
            >
              <Notebook className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              title="编辑"
              disabled={shouldDisableToolbarActions}
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                void handleCopyCard();
              }}
              title="复制"
              disabled={shouldDisableToolbarActions}
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
            >
              <Copy className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                canvasHandlers.handleAddCardToDialog?.(id);
              }}
              title={hasCardContent ? "添加到对话" : "卡片内容为空，无法添加到对话"}
              disabled={shouldDisableToolbarActions || !hasCardContent}
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <MessageSquarePlus className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={async (e) => {
                e.stopPropagation();
                await handleDelete();
              }}
              title="删除"
              disabled={shouldDisableToolbarActions}
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        targetLabel="卡片"
      />

      {/* Body：使用 MarkdownEditor 展示/编辑 md，展开按钮居中；折叠时在展开按钮上方显示渐变蒙层 */}
      <div
        className={cn(
          "flex min-h-20 w-full flex-1 flex-col pb-4",
          isLargeSummaryCard ? "px-5 pt-1" : "px-4"
        )}
      >
        {/* Title */}
        <div
          className={cn("w-full", isEditing && "nodrag nopan")}
          onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
          onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
        >
          {showApiSkeleton ? (
            <div className="w-full rounded-[14px] px-3 py-3">
              <div className="h-4 w-2/3 rounded bg-[#E5E7EB]" />
            </div>
          ) : isEditing && allowTitleEdit && shouldShowInlineTitle ? (
            <div className={cn("w-full overflow-hidden", titleAreaHeightClass)}>
              <MarkdownEditor
                ref={titleEditorRef}
                className={cn(
                  "h-full w-full overflow-hidden bg-white/90 px-3 py-2",
                  "[&_.editor-content]:!h-full [&_.main-editor-content]:!h-full [&_.main-editor-content]:!overflow-hidden [&_.main-editor-content]:!pb-0",
                  "[&_.main-editor-content_.ProseMirror]:!max-h-full [&_.main-editor-content_.ProseMirror]:!overflow-y-auto [&_.main-editor-content_.ProseMirror]:!overscroll-contain [&_.main-editor-content_.ProseMirror]:!whitespace-pre-wrap [&_.main-editor-content_.ProseMirror]:break-words"
                )}
                fontClassName={cn(
                  "!min-h-0 !p-0 !text-[15px] !font-medium !leading-6 !text-[#111]",
                  "[&_p]:!my-0 [&_h1]:!my-0 [&_h2]:!my-0 [&_h3]:!my-0 [&_h4]:!my-0 [&_h5]:!my-0 [&_h6]:!my-0"
                )}
                readonly={false}
                value={editLabel}
                onChange={(md) => {
                  titleDirtyRef.current = true;
                  setEditLabel(md);
                }}
                placeholder="请输入标题"
                minHeight={0}
                onBlur={isEditing ? handleTitleEditorBlur : undefined}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancel();
                  }
                }}
              />
            </div>
          ) : shouldShowReadonlyTitle ? (
            <div
              className={cn(
                "flex w-full items-start gap-2 overflow-hidden rounded-[14px] px-3 py-2 font-semibold",
                titleAreaHeightClass,
                isLargeSummaryCard ? "text-[24px] leading-8" : "text-[18px] leading-6",
                (isRoleCard && hasTitleText) || hasTitleText ? "text-[#111827]" : "text-[#9CA3AF]"
              )}
            >
              <span className="min-w-0 h-full flex-1 overflow-y-auto whitespace-pre-wrap break-words overscroll-contain pr-1">
                {readonlyTitleText}
              </span>
              {isBlankDraft && !isGroupedOutlineCard ? (
                <button
                  type="button"
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center text-black transition-colors hover:text-[#EFAF00] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-black"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (shouldDisableToolbarActions) return;
                    canvasHandlers.handlePrepareBrainstormCard?.(id);
                  }}
                  title="AI 生成"
                  aria-label="AI 生成"
                  disabled={shouldDisableToolbarActions}
                >
                  <Iconfont unicode="&#xe6d9;" className="size-3" />
                </button>
              ) : null}
            </div>
          ) : null
          }
        </div>

        {/* Content */}
        <div
          className={cn(
            "relative w-full",
            isImageCard && "flex flex-1 flex-col",
            isImageCard
              ? "mt-2"
              : isLargeSummaryCard
                ? "mt-2"
                : "mt-1",
            isEditing && "nodrag nopan"
          )}
          onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
          onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
        >
          {showContentSkeleton ? (
            <div
              className={cn(
                "w-full rounded-[14px] p-3 space-y-2",
                isLargeSummaryCard && "min-h-[720px] p-4",
                isTextOnlyCard && "min-h-[140px] bg-[#fafafa]"
              )}
            >
              <div className="h-3.5 bg-[#E5E7EB] rounded" />
              <div className="h-3.5 bg-[#E5E7EB] rounded" />
              <div className="h-3.5 bg-[#E5E7EB] rounded w-4/5" />
              {isTextOnlyCard && (
                <>
                  <div className="h-3.5 bg-[#E5E7EB] rounded" />
                  <div className="h-3.5 bg-[#E5E7EB] rounded w-3/5" />
                </>
              )}
            </div>
          ) : (
            <AutoScrollArea
              maxHeight={isExpanded ? expandedContentMaxHeight : collapsedContentMaxHeight}
              autoScroll={isStreaming && !isEditing}
              className={cn(
                "relative w-full cursor-pointer",
                isImageCard && (isExpanded ? "min-h-[160px]" : "min-h-[96px]"),
                isTextOnlyCard && "rounded-[14px] bg-[#fafafa] px-3 py-3",
                isLargeSummaryCard && "min-h-[720px] rounded-[16px] px-4 py-4",
                isRoleMermaidCard && (isExpanded ? "min-h-[380px]" : "min-h-[330px]"),
                isEditing && "cursor-text bg-white"
              )}
              onWheel={handleWheel}
            >
              <div ref={textRef} className="w-full min-h-0 p-0">
                <MarkdownEditor
                  ref={editorRef}
                  className="min-h-0"
                  fontClassName="!text-sm"
                  readonly={!isEditing}
                  value={visibleContent}
                  placeholder={editorPlaceholder}
                  minHeight={0}
                  onChange={
                    isEditing
                      ? (md) => {
                        editDirtyRef.current = true;
                        editingContentRef.current = md;
                        // 不 setEditContent，避免重渲染导致光标/IME 问题；失焦时用 getMarkdown() 回写
                        if (realtimeSaveTimerRef.current) {
                          clearTimeout(realtimeSaveTimerRef.current);
                        }
                        realtimeSaveTimerRef.current = setTimeout(() => {
                          realtimeSaveTimerRef.current = null;
                          const latest = editingContentRef.current || editContentRef.current || "";
                          updateNodeData(id, { content: latest });
                          onUpdate(id, latest);
                        }, 300);
                      }
                      : undefined
                  }
                  onBlur={isEditing ? handleContentEditorBlur : undefined}
                  onKeyDown={
                    isEditing
                      ? (e: KeyboardEvent) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          handleCancel();
                        }
                      }
                      : undefined
                  }
                />
              </div>
            </AutoScrollArea>
          )}

          {/* {!isExpanded && showExpandBtn && !isStreaming && !showContentSkeleton && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
              style={{
                background: "linear-gradient(to bottom, rgba(255,251,237,0), rgba(255,251,237,1))",
              }}
              aria-hidden
            />
          )} */}
        </div>

        {isImageCard && !isRoleMermaidCard && (
          <div className="mt-3 w-full">
            <div
              className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px]"
            >
              {showApiSkeleton ? (
                <>
                  <div className="h-full w-full bg-[#E5E7EB] animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={cn(
                        "rounded-full bg-white px-3 py-1 text-[12px] font-medium shadow-sm",
                        apiProgressDisplay >= 100 ? "text-[#111]" : "text-[#EFAF00]"
                      )}
                    >
                      {cardLabel}概念图生成中 {apiProgressDisplay}%
                    </div>
                  </div>
                </>
              ) : images.length ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImageSrc}
                    alt={`${cardLabel}概念图`}
                    className="h-full w-full object-cover"
                    onError={() => {
                      if (!imageLoadFailed) {
                        setImageLoadFailed(true);
                      }
                    }}
                  />
                  {images.length > 1 && (
                    <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[12px] text-white">
                      +{images.length - 1}
                    </div>
                  )}
                </>
              ) : (
                data.fromApi ? null : (
                  <div className="flex h-full w-full items-center justify-center bg-[#F9F9F7] text-[12px] text-[#9CA3AF]">
                    {`[${cardLabel}概念图]`}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* {!isEditing && (showExpandBtn || isExpanded) && !isStreaming && (
          <button
            type="button"
            onClick={toggleExpand}
            className={cn(
              "mt-2 inline-flex items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs text-[#6b7280] hover:bg-[#f5f5f5] hover:text-[#111] transition-colors cursor-pointer",
              // "underline underline-offset-2 decoration-current"
            )}
          >
            {isExpanded ? "< 折叠 >" : "< 展开 >"}
          </button>
        )} */}
        {/* 编辑态下保留与「展开/折叠」按钮同高的占位，避免高度塌陷 */}
        {/* {isEditing && showExpandBtn && (
          <div className="mt-2 h-8 shrink-0" aria-hidden />
        )} */}
      </div>

      {/* Add */}
      {shouldShowCardFloatingControls ? (
        <NodeToolbar
          isVisible={showFloatingButtons}
          position={Position.Bottom}
          offset={-15}
          onMouseEnter={showFloatingButtonsNow}
          onMouseLeave={scheduleHideFloatingButtons}
        >
          <div className="relative z-50">
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                showFloatingButtons ? "block" : "hidden"
              )}
              aria-hidden={!showFloatingButtons}
            >
              {visibleFloatingActions.map((action, index) => (
                <div
                  key={action.key}
                  className={cn(
                    "pointer-events-none absolute z-50",
                    index === 0 && "-top-15 left-15 -translate-x-1/2",
                    index === 1 && "top-1/2 left-15 ml-2 -translate-y-1/2",
                    index === 2 && "top-full left-20 mt-2 -translate-x-1/2",
                    index === 3 &&
                      (hasThirdFloatingAction
                        ? "-bottom-22 left-13 mt-2 -translate-x-1/2"
                        : "top-full left-20 mt-2 -translate-x-1/2")
                  )}
                >
                  <Button
                    type="button"
                    className={cn(
                      "pointer-events-auto rounded-[10px] border border-[#FEF08A] bg-[#FEFCE8] px-3 py-1 text-[12px] text-[#854D0E] shadow-sm",
                      "hover:bg-[#FEF08A]/80"
                    )}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                </div>
              ))}
            </div>

            <Button
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleAdd();
              }}
              className="rounded-full bg-[#EFAF00] text-white hover:bg-[#EFAF00]/90 hover:scale-110 hover:shadow-md size-8"
              title="添加"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </NodeToolbar>
      ) : null}

      {/* Invisible handles: provide edge anchor points */}
      <Handle
        id="target-top"
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="target-right"
        type="target"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="source-bottom"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="source-left"
        type="source"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        id="source-right"
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
 