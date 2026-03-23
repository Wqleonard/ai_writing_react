import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { Trash2, Pencil, Plus, Copy, MessageSquarePlus, Sparkles, Notebook } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import MarkdownEditor, { type MarkdownEditorRef } from "@/components/MainEditor";
import type { CustomNodeData } from "@/components/InsCanvasV2/types";
import type { PostStreamData } from "@/api";
import { postInspirationStream, saveInspirationCanvasReq } from "@/api/works";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";
import { addNote } from "@/api/notes";
// React 18 StrictMode / ReactFlow 更新可能导致节点组件重挂载，
// 进而让“挂载即拉流”的逻辑重复触发。用 nodeId 做一次性去重（刷新时会清除）。
const startedStreamNodeIds = new Set<string>();

interface EditableFlowCardProps {
  id: string;
  data: CustomNodeData;
  cardLabel: string;
  generateLabel: string;
  type: string;
  onGenerate: (id: string) => void;
  onAdd: (id: string) => void;
  onDelete: (id: string, options?: { skipLayout?: boolean }) => void;
  onUpdate: (id: string, content: string) => void;
  onExpand?: (id: string) => void;
  msg: (type: "success" | "error" | "warning", msg: string) => void;
}

type FloatingAction = {
  key: string;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
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

export default function EditableFlowCard({
  id,
  data,
  cardLabel,
  generateLabel,
  type = '',
  msg,
  onGenerate,
  onAdd,
  onDelete,
  onUpdate,
  onExpand,
}: EditableFlowCardProps) {
  const { updateNode, updateNodeData, setNodes, setEdges, getEdges, getNodes } = useReactFlow();
  const canvasHandlers = useInsCanvasHandlers();
  const { getCanvasSessionId } = canvasHandlers;
  const { confirm, confirmDialog } = useConfirmDialog();
  const allowTitleEdit = Boolean((data as any)?.allowTitleEdit);
  const allowImageUpload = Boolean((data as any)?.allowImageUpload);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || "[写作思路]");
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
  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

  useEffect(() => {
    editLabelRef.current = editLabel;
  }, [editLabel]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // 骨架：只在“接口创建且处于流式/加载、且尚无内容”时展示
  // 手动创建卡片：isStreaming=false，不展示骨架
  const isFromApi = Boolean((data as any)?.fromApi);
  const hasAnyApiData =
    Boolean(titleText.trim()) || Boolean(String(data.content || "").trim()) || images.length > 0;
  const showApiSkeleton = isFromApi && !isEditing && !hasAnyApiData;
  const apiProgressRaw = (data as any)?.progress;
  const apiProgress =
    typeof apiProgressRaw === "number" && Number.isFinite(apiProgressRaw)
      ? Math.max(0, Math.min(100, Math.round(apiProgressRaw)))
      : 0;
  const showContentSkeleton =
    !isEditing &&
    !String(data.content || "").trim() &&
    (
      // 流式创建（接口拉流）
      (Boolean(isStreaming) && (!editContent || editContent === "生成中...")) ||
      // 接口创建（非拉流）：在内容未落盘前也需要骨架占位
      showApiSkeleton
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
    // 节点切换时，重置本地 streaming 状态
    setIsStreaming(Boolean(data.isStreaming));
    streamingStartedRef.current = false;
    streamContentRef.current = "";
    pendingCommitRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // 仅在编辑状态切换时更新 draggable，避免每次 render 都触发 updateNode 导致循环更新
    updateNode(id, { draggable: !isEditing });
  }, [id, isEditing, updateNode]);

  useEffect(() => {
    // 仅在 isStreaming 与节点 data 不一致时才同步，避免 updateNodeData -> 触发 props.data 引用变化 -> effect 再跑
    const next = Boolean(isStreaming);
    const prev = Boolean(data.isStreaming);
    if (next === prev) return;
    updateNodeData(id, { isStreaming: next });
  }, [id, isStreaming, data.isStreaming, updateNodeData]);

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

  const handleBlur = () => {
    if (isEditing) {
      if (realtimeSaveTimerRef.current) {
        clearTimeout(realtimeSaveTimerRef.current);
        realtimeSaveTimerRef.current = null;
      }
      // 以编辑器实例为准；ref 可能在 IME 组合时未更新，仅作兜底
      const finalContent =
        editorRef.current?.getMarkdown() ?? (editingContentRef.current || editContent);
      const finalTitle = (allowTitleEdit ? editLabelRef.current : (data as any)?.title ?? "") ?? "";
      if (allowTitleEdit) updateNodeData(id, { title: String(finalTitle) });
      updateNodeData(id, { content: finalContent });
      onUpdate(id, finalContent);
      setEditContent(finalContent);
      setIsEditing(false);
    }
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
      handleBlur();
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
    const initial = data.content || "";
    setEditContent(initial);
    editingContentRef.current = initial;
    setEditLabel(String((data as any)?.title ?? ""));
    // 等 React 提交更新、MarkdownEditor 收到 readonly=false 后，再强制 setEditable+focus 兜底
    setTimeout(() => {
      editorRef.current?.editor?.setEditable(true);
      editorRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => editorRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  // 点击卡片外区域时退出编辑（TipTap 在点击非可聚焦元素时可能不触发 blur）
  useEffect(() => {
    if (!isEditing) return;
    const onMouseDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        handleBlur();
      }
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [isEditing, handleBlur]);

  const handleCancel = () => {
    if (realtimeSaveTimerRef.current) {
      clearTimeout(realtimeSaveTimerRef.current);
      realtimeSaveTimerRef.current = null;
    }
    editDirtyRef.current = false;
    setEditContent(data.content || "");
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
        else setIsStreaming(false);
        await saveCanvas();
      };

      await postInspirationStream(reqData, onData, onError, onComplete);
    } catch (err: any) {
      streamingStartedRef.current = false;
      startedStreamNodeIds.delete(id);
      setIsStreaming(false);
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

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: "删除卡片",
      message: "此操作不可逆，确认删除卡片？",
      cancelText: "取消",
      confirmText: "确认",
      confirmVariant: "destructive",
    });
    if (!confirmed) return;
    onDelete(id, { skipLayout: true });
  }, [confirm, id, onDelete]);

  const handleRefresh = () => {
    setEditContent("");
    pendingCommitRef.current = null;
    startedStreamNodeIds.delete(id);
    streamingStartedRef.current = false;
    void startStream();
  };

  const contextNodes = useMemo(() => {
    const nodes = (getNodes() || []) as any[];
    const edges = (getEdges() || []) as any[];
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const ordered: any[] = [];
    const visit = (nodeId: string) => {
      if (!nodeId || visited.has(nodeId)) return;
      visited.add(nodeId);
      const current = nodeMap.get(nodeId);
      if (!current) return;
      if (current.parentId) visit(current.parentId);
      edges.filter((edge) => edge.target === nodeId).forEach((edge) => visit(edge.source));
      ordered.push(current);
    };
    visit(id);
    return ordered;
  }, [getEdges, getNodes, id]);

  const hasUpstreamSummaryCard = useMemo(
    () =>
      contextNodes.some(
        (node) => node.id !== id && String(node?.data?.label ?? "").includes("梗概")
      ),
    [contextNodes, id]
  );
  const hasUpstreamOutlineCard = useMemo(
    () =>
      contextNodes.some(
        (node) => node.id !== id && String(node?.data?.label ?? "").includes("大纲")
      ),
    [contextNodes, id]
  );
  const normalizedCardLabel = useMemo(
    () => String(cardLabel ?? data?.label ?? ""),
    [cardLabel, data?.label]
  );
  const isRoleCard = useMemo(() => normalizedCardLabel === "角色", [normalizedCardLabel]);
  const isBrainstormCard = useMemo(() => normalizedCardLabel === "脑洞", [normalizedCardLabel]);
  const isInfoCard = useMemo(() => normalizedCardLabel === "信息", [normalizedCardLabel]);
  const isSummaryCard = useMemo(
    () => normalizedCardLabel === "故事梗概" || normalizedCardLabel === "梗概",
    [normalizedCardLabel]
  );
  const isImageCard = useMemo(
    () => normalizedCardLabel === "脑洞" || normalizedCardLabel === "角色",
    [normalizedCardLabel]
  );
  const isRoleMermaidCard = useMemo(
    () => isRoleCard && displayedContent.includes("mermaid"),
    [displayedContent, isRoleCard]
  );
  const isLargeSummaryCard = isSummaryCard || isInfoCard;
  const isBlankBrainstormDraft = Boolean((data as any)?.isBlankBrainstormDraft);
  const isBrainstormAiMode = Boolean((data as any)?.brainstormAiMode);
  const isPendingGenerate = Boolean((data as any)?.pendingGenerate);
  const isHighlighted = Boolean((data as any)?.highlighted);
  const isTextOnlyCard = !isImageCard;
  const collapsedContentMaxHeight = isRoleMermaidCard
    ? 330
    : isImageCard
      ? 50
      : isLargeSummaryCard
        ? 720
        : 168;
  const expandedContentMaxHeight = isRoleMermaidCard
    ? 380
    : isImageCard
      ? 270
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
  const handleAddNote = useCallback(async () => {
    const content = String(data.content || "").trim();
    if (!content) {
      msg("warning", "当前卡片内容为空，无法添加笔记");
      return;
    }
    const title = `【${noteCardTypeLabel}】${titleText.trim() || "未命名卡片"}`;
    try {
      await addNote(title, String(data.content || ""), "PC_INSPIRATION_DRAW");
      msg("success", "笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      msg("error", "添加笔记失败，请重试");
    }
  }, [data.content, msg, noteCardTypeLabel, titleText]);

  const floatingActions = useMemo(() => {
    const infoAction: FloatingAction = {
      key: "generate-info",
      label: "我想用它生成...",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        canvasHandlers.handleGenerateIns?.(id, "info");
      },
    };

    if (isBrainstormCard) {
      return [
        {
          key: "generate-role",
          label: "以此生成角色",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "role");
          },
        },
        {
          key: "generate-summary",
          label: "以此生成故事梗概",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "summary");
          },
        },
        infoAction,
      ] as FloatingAction[];
    }

    if (isSummaryCard) {
      return [
        {
          key: "expand-role",
          label: "以此扩充随机角色",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "role");
          },
        },
        {
          key: "generate-outline",
          label: "以此生成大纲",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateOutlineFromContext?.(id);
          },
        },
        infoAction,
      ] as FloatingAction[];
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
            canvasHandlers.handleGenerateIns?.(id, "role");
          },
        },
      ];
      if (!hasUpstreamSummaryCard) {
        actions.push({
          key: "generate-summary",
          label: "以此生成故事梗概",
          onClick: (e) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateIns?.(id, "summary");
          },
        });
      } else if (!hasUpstreamOutlineCard) {
        actions.push({
          key: "generate-outline",
          label: "以此生成大纲",
          onClick: (e) => {
            e.stopPropagation();
            canvasHandlers.handleGenerateOutlineFromContext?.(id);
          },
        });
      }
      actions.push(infoAction);
      return actions;
    }

    return [] as FloatingAction[];
  }, [
    canvasHandlers,
    hasUpstreamOutlineCard,
    hasUpstreamSummaryCard,
    id,
    isBrainstormCard,
    isInfoCard,
    isRoleCard,
    isSummaryCard,
  ]);
  const visibleFloatingActions = useMemo(() => floatingActions.slice(0, 3), [floatingActions]);

  const handleCopyCard = useCallback(() => {
    const currentNode = getNodes().find((node) => node.id === id);
    if (!currentNode) {
      msg("warning", "未找到当前卡片");
      return;
    }

    const roleGroupId = String((currentNode.data as any)?.roleGroupId ?? "");
    const outlineGroupId = String((currentNode.data as any)?.outlineGroupId ?? "");
    const groupId = roleGroupId || outlineGroupId;

    setNodes((prev) => {
      const baseDuplicatedNode = {
        ...currentNode,
        id: `${currentNode.type || "card"}-${Date.now()}`,
        selected: false,
        dragging: false,
        data: {
          ...currentNode.data,
          isStreaming: false,
          highlighted: false,
          openOutlinePopover: false,
        },
      } as any;

      if (!groupId) {
        return [
          ...prev,
          {
            ...baseDuplicatedNode,
            position: {
              x: (currentNode.position?.x ?? 0) + 32,
              y: (currentNode.position?.y ?? 0) + 32,
            },
          },
        ];
      }

      const cols = 3;
      const cardWidth = 300;
      const cardHeight = outlineGroupId ? 260 : 450;
      const gapX = 20;
      const gapY = 24;
      const groupPaddingTop = 56;
      const groupPadding = 20;
      const minGroupWidth = 340;
      const groupedNodes = prev.filter(
        (node) =>
          String((node.data as any)?.roleGroupId ?? "") === groupId ||
          String((node.data as any)?.outlineGroupId ?? "") === groupId
      );
      const nextIndex = groupedNodes.length;
      const col = nextIndex % cols;
      const row = Math.floor(nextIndex / cols);
      const totalCount = nextIndex + 1;
      const rows = Math.max(1, Math.ceil(totalCount / cols));
      const colsUsed = Math.min(cols, totalCount);
      const nextGroupWidth = Math.max(
        minGroupWidth,
        groupPadding * 2 + colsUsed * cardWidth + Math.max(0, colsUsed - 1) * gapX
      );
      const nextGroupHeight =
        groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding;

      return [
        ...prev.map((node) =>
          node.id !== groupId
            ? node
            : {
                ...node,
                style: {
                  ...((node as any)?.style ?? {}),
                  width: Math.max(Number((node as any)?.style?.width ?? 0), nextGroupWidth),
                  height: Math.max(Number((node as any)?.style?.height ?? 0), nextGroupHeight),
                },
              }
        ),
        {
          ...baseDuplicatedNode,
          position: {
            x: groupPadding + col * (cardWidth + gapX),
            y: groupPaddingTop + row * (cardHeight + gapY),
          },
        },
      ];
    });
    msg("success", "已复制当前卡片");
  }, [getNodes, id, msg, setNodes]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "vue-flow-card nowheel relative overflow-visible",
        "rounded-[20px] bg-white border",
        isBlankBrainstormDraft && !isBrainstormAiMode
          ? "border-dashed border-[#EFAF00]"
          : "border-solid border-[#e5e7eb]",
        (isBrainstormAiMode || isHighlighted) &&
          "border-solid border-[#EFAF00] shadow-[0px_0px_0px_2px_rgba(239,175,0,0.18),0px_14px_36px_0px_rgba(0,0,0,0.14)]",
        "shadow-[0px_10px_28px_0px_rgba(0,0,0,0.10)] hover:shadow-[0px_14px_36px_0px_rgba(0,0,0,0.14)]",
        "group transition-shadow duration-200 ease-out",
        isImageCard
          ? (isExpanded ? "w-[750px] h-[500px]" : "w-[300px] min-h-[450px]")
          : isLargeSummaryCard
            ? (isExpanded ? "w-[680px] min-h-[960px]" : "w-[600px] min-h-[900px]")
            : (isExpanded ? "w-[520px] min-h-[420px]" : "w-[300px] min-h-[240px]"),
        isEditing && "nodrag nopan"
      )}
      onMouseEnter={showFloatingButtonsNow}
      onMouseLeave={scheduleHideFloatingButtons}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 text-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-[#efaf00]" />
          <span className="font-semibold text-[#111] text-sm">
            {isRoleCard
              ? (titleText.trim() ? titleText : `【${cardLabel}】请输入标题`)
              : (data.label || cardLabel)}
          </span>
          {isPendingGenerate ? (
            <span className="rounded-full border border-[#FEF08A] bg-[#FEFCE8] px-2 py-0.5 text-[11px] text-[#854D0E]">
              待生成
            </span>
          ) : null}
        </div>
        {!isStreaming && (
          <div className="flex items-center gap-1.5 z-20 transition-opacity">
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
                    // reset so selecting same file again still triggers
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
              title="添加到对话"
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
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
              className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}
      </div>
      {confirmDialog}

      {/* Body：使用 MarkdownEditor 展示/编辑 md，展开按钮居中；折叠时在展开按钮上方显示渐变蒙层 */}
      <div
        className={cn(
          "flex min-h-20 flex-col items-center pb-4",
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
          ) : isEditing && allowTitleEdit ? (
            <input
              value={editLabel}
              onChange={(e) => {
                setEditLabel(e.target.value);
              }}
              placeholder="请输入标题"
              className={cn(
                "w-full rounded-[14px] px-3 py-2 text-[15px] font-medium text-[#111] outline-none",
                "focus:bg-white"
              )}
            />
          ) : !isRoleCard ? (
            <div
              className={cn(
                "flex w-full items-start gap-2 rounded-[14px] px-3 py-2 font-semibold",
                isLargeSummaryCard ? "text-[24px] leading-8" : "text-[18px] leading-6",
                titleText.trim() ? "text-[#111]" : "text-[#9CA3AF]"
              )}
            >
              <span className="min-w-0 flex-1">
                {titleText.trim() ? titleText : `【${cardLabel}】请输入标题`}
              </span>
              {isBrainstormCard && isBlankBrainstormDraft && !isPendingGenerate ? (
                <button
                  type="button"
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[#EFAF00] bg-[#FFF7DB] text-[#EFAF00] transition-colors hover:bg-[#FFE9A8] hover:text-[#B7791F]"
                  onClick={(e) => {
                    e.stopPropagation();
                    canvasHandlers.handlePrepareBrainstormCard?.(id);
                  }}
                  title="进入 AI 模式"
                  aria-label="进入 AI 模式"
                >
                  <Sparkles className="size-3.5" />
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
            isImageCard ? "mt-2" : isLargeSummaryCard ? "mt-4" : "mt-3",
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
                isTextOnlyCard && "rounded-[14px] bg-[#fafafa] px-3 py-3",
                isLargeSummaryCard && "min-h-[720px] rounded-[16px] border border-[#f1f5f9] bg-[#fcfcfc] px-4 py-4",
                isRoleMermaidCard && (isExpanded ? "min-h-[380px]" : "min-h-[330px]"),
                isEditing && "cursor-text bg-white"
              )}
              onWheel={handleWheel}
            >
              <div ref={textRef} className="w-full min-h-0">
                <MarkdownEditor
                  ref={editorRef}
                  className="min-h-0"
                  fontClassName="!text-sm"
                  readonly={!isEditing}
                  value={displayedContent}
                  placeholder={data.fromApi ? '' : '[写作思路]'}
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
                  onBlur={isEditing && !allowTitleEdit && !allowImageUpload ? handleBlur : undefined}
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
              className={cn(
                "relative w-full overflow-hidden rounded-[14px]",
                isExpanded ? "h-[320px]" : "h-[260px]"
              )}
            >
              {showApiSkeleton ? (
                <>
                  <div className="h-full w-full bg-[#E5E7EB] animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={cn(
                        "rounded-full bg-white px-3 py-1 text-[12px] font-medium shadow-sm",
                        apiProgress >= 100 ? "text-[#111]" : "text-[#EFAF00]"
                      )}
                    >
                      脑洞概念生成中 {apiProgress}%
                    </div>
                  </div>
                </>
              ) : images.length ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={decodeURIComponent(images[0])} alt="" className="h-full w-full object-cover" />
                  {images.length > 1 && (
                    <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[12px] text-white">
                      +{images.length - 1}
                    </div>
                  )}
                </>
              ) : (
                data.fromApi ? null : (
                  <div className="flex h-full w-full items-center justify-center bg-white text-[12px] text-[#9CA3AF]">
                    {"[可上传脑洞概念图]"}
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
      <span
        className={cn(
          "absolute bottom-[-15px] left-1/2 -translate-x-1/2 z-10",
          // 不做淡入淡出，避免 hover 时出现“半透明”过渡帧
          showFloatingButtons ? "visible" : "invisible"
        )}
        onMouseEnter={showFloatingButtonsNow}
        onMouseLeave={scheduleHideFloatingButtons}
      >
        <div className="relative">
          {/* options */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              // 同上：直接显示/隐藏，不做 opacity 过渡
              showFloatingButtons ? "block" : "hidden"
            )}
            aria-hidden={!showFloatingButtons}
          >
            {visibleFloatingActions.map((action, index) => (
              <div
                key={action.key}
                className={cn(
                  "pointer-events-none absolute",
                  index === 0 && "-top-15 left-15 -translate-x-1/2",
                  index === 1 && "top-1/2 left-15 ml-2 -translate-y-1/2",
                  index === 2 && "top-full mt-2 left-20 -translate-x-1/2"
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
      </span>

      {/* Invisible handles: provide edge anchor points */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}
 