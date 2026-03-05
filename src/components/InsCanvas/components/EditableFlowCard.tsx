import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { RefreshCw, Trash2, Pencil, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import MarkdownEditor from "@/components/MarkdownEditor";
import type { MarkdownEditorRef } from "@/components/MarkdownEditor";
import type { CustomNodeData } from "@/components/InsCanvas/types";
import type { PostStreamData } from "@/api";
import { postInspirationStream, saveInspirationCanvasReq } from "@/api/works";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";

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
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onExpand?: (id: string) => void;
  msg: (type: "success" | "error" | "warning", msg: string) => void;
}

const handleStyle = {
  width: 12,
  height: 12,
  border: "2px solid white",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
} as const;

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
  const { updateNode, updateNodeData, setEdges, getEdges, getNodes } = useReactFlow();
  const { getCanvasSessionId } = useInsCanvasHandlers();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || "");
  const streamContentRef = useRef("");
  const editContentRef = useRef(editContent);
  /** 编辑态下由 onChange 写入，仅作缓存不触发重渲染；onBlur 时以 getMarkdown() 为准，此 ref 作兜底 */
  const editingContentRef = useRef("");
  // 进入编辑后，若接口回写 data.content，且用户未改动（dirty=false），允许同步到输入框
  const editDirtyRef = useRef(false);
  useEffect(() => {
    editContentRef.current = editContent;
  }, [editContent]);

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
  const displayContent = editContent;
  const bodyContent = displayContent || (isStreaming ? "生成中..." : "");

  // 同步外部内容：仅在 data.content 变化时更新本地；避免流式结束时用空串覆盖本地最终内容
  useEffect(() => {
    const prop = data.content || "";

    // 编辑中：如果用户尚未修改（dirty=false），允许把接口回写的数据同步到输入框
    if (isEditing) {
      if (!editDirtyRef.current && prop !== editContentRef.current) {
        setEditContent(prop);
      }
      return;
    }

    if (pendingCommitRef.current) {
      if (prop !== pendingCommitRef.current) return;
      pendingCommitRef.current = null;
    }

    if (!prop && editContentRef.current) return;
    setEditContent(prop);
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
    const el = textRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > 150;
    setShowExpandBtn(overflow);
  };

  const checkOverflowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isEditing) {
      checkOverflow();
      return;
    }
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
  }, [displayContent, isExpanded, isEditing]);

  const handleBlur = () => {
    if (isEditing) {
      // 以编辑器实例为准；ref 可能在 IME 组合时未更新，仅作兜底
      const finalContent =
        editorRef.current?.getMarkdown() ?? (editingContentRef.current || editContent);
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
    editDirtyRef.current = false;
    setEditContent(data.content || "");
    setIsEditing(false);
  };

  const toggleExpand = () => {
    // 流式输出期间不允许展开，避免内容区域被撑高遮挡下方节点
    if (isStreaming) return;
    setIsExpanded((v) => !v);
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
              console.log(finalMsg, 'finalMsg')
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
    console.log(`${type} add`)
    onAdd(id)
  };

  const handleDelete = () => onDelete(id);

  const handleRefresh = () => {
    setEditContent("");
    pendingCommitRef.current = null;
    startedStreamNodeIds.delete(id);
    streamingStartedRef.current = false;
    void startStream();
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "vue-flow-card nowheel rounded-2xl relative overflow-visible",
        "bg-card shadow-sm border border-border",
        "group transition-all duration-200 ease-out",
         // 展开时加宽并适度增高，方便阅读更多内容
         isExpanded ? "w-[1120px] h-[500px]" : "w-[250px] min-h-[200px]",
        "min-h-[200px]",
        isEditing && "nodrag nopan"
      )}
      onMouseEnter={showFloatingButtonsNow}
      onMouseLeave={scheduleHideFloatingButtons}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 text-sm border-b-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground text-sm">
            {data.label || cardLabel}
          </span>
        </div>
        {!isStreaming && (
          <div className="flex items-center gap-2 z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              title="刷新"
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              title="删除"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit();
              }}
              title="编辑"
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Body：使用 MarkdownEditor 展示/编辑 md，展开按钮居中；折叠时在展开按钮上方显示渐变蒙层 */}
      <div className="flex min-h-20 flex-col items-center px-4 py-3 pb-4">
        {(bodyContent || isStreaming || isEditing) ? (
          <div
            className={cn("relative w-full", isEditing && "nodrag nopan")}
            onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
            onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
          >
            <AutoScrollArea
              maxHeight={isExpanded ? 370 : 150}
              autoScroll={isStreaming && !isEditing}
              className={cn("relative w-full cursor-pointer")}
              onWheel={handleWheel}
            >
              <div ref={textRef} className="w-full min-h-0">
                <MarkdownEditor
                  ref={editorRef}
                  className="min-h-0"
                  readonly={!isEditing}
                  value={isEditing ? editContent : bodyContent}
                  placeholder=""
                  loading={isStreaming && !isEditing}
                  minHeight={0}
                onChange={
                  isEditing
                    ? (md) => {
                        editDirtyRef.current = true;
                        editingContentRef.current = md;
                        // 不 setEditContent，避免重渲染导致光标/IME 问题；失焦时用 getMarkdown() 回写
                      }
                    : undefined
                }
                onBlur={isEditing ? handleBlur : undefined}
                onKeyDown={
                  isEditing
                    ? (e) => {
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
            {!isExpanded && showExpandBtn && !isStreaming && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
                style={{
                  background: "linear-gradient(to bottom, transparent, var(--color-card))",
                }}
                aria-hidden
              />
            )}
          </div>
        ) : (
          <div className="py-2 space-y-2 w-full">
            <div className="h-3.5 bg-muted rounded" />
            <div className="h-3.5 bg-muted rounded" />
          </div>
        )}
        {!isEditing && (showExpandBtn || isExpanded) && !isStreaming && (
          <button
            type="button"
            onClick={toggleExpand}
            className="mt-2 px-3 py-1.5 text-xs rounded-full border border-border bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground transition-colors cursor-pointer"
          >
            {isExpanded ? "折叠" : "展开"}
          </button>
        )}
        {/* 编辑态下保留与「展开/折叠」按钮同高的占位，避免高度塌陷 */}
        {isEditing && showExpandBtn && (
          <div className="mt-2 h-8 shrink-0" aria-hidden />
        )}
      </div>

      {/* Generate */}
      {!children.length && !isStreaming && (
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex items-center z-10 transition-opacity",
            type === "outlineCard" ? "right-[-132px] gap-2 pl-2" : "right-[-164px] gap-3 pl-3",
            showFloatingButtons ? "opacity-100 visible" : "opacity-0 invisible"
          )}
          onMouseEnter={showFloatingButtonsNow}
          onMouseLeave={scheduleHideFloatingButtons}
        >
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            className="rounded-full bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90 hover:shadow-md size-7"
          >
            <span className="iconfont">&#xe642;</span>
          </Button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            className="h-7 px-2 rounded-lg bg-[#ff6b35] text-white text-sm font-medium cursor-pointer hover:shadow-md"
          >
            {generateLabel}
          </button>
        </div>
      )}

      {/* Add */}
      <span
        className={cn(
          "absolute bottom-[-40px] left-1/2 -translate-x-1/2 z-10 transition-all",
          showFloatingButtons ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onMouseEnter={showFloatingButtonsNow}
        onMouseLeave={scheduleHideFloatingButtons}
      >
        <Button
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          className="rounded-full bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90 hover:scale-110 hover:shadow-md size-8"
        >
          <Plus className="size-4" />
        </Button>
      </span>

      <Handle
        type="target"
        position={Position.Left}
        id="left-handle"
        style={{ ...handleStyle, background: "#22c55e", opacity: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-handle"
        style={{ ...handleStyle, background: "#007bff", opacity: 0 }}
      />
    </div>
  );
}
