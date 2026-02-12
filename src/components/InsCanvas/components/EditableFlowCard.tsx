import React, { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { RefreshCw, Trash2, Pencil, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { CustomNodeData } from "@/components/InsCanvas/types";
import type { PostStreamData } from "@/api";
import { postInspirationStream, saveInspirationCanvasReq } from "@/api/works";

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
  onGenerate,
  onAdd,
  onDelete,
  onUpdate,
  onExpand,
}: EditableFlowCardProps) {
  const { updateNode, updateNodeData, setEdges, getEdges, getNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(data.content || "");
  const [streamContent, setStreamContent] = useState("");
  const streamContentRef = useRef("");
  const editContentRef = useRef(editContent);
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamingStartedRef = useRef(false);

  const displayContent = isStreaming && streamContent ? streamContent : editContent;
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
    setStreamContent("");
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
    if (isEditing || !textRef.current || !wrapperRef.current) {
      setShowExpandBtn(false);
      return;
    }
    const el = textRef.current;
    const wrapper = wrapperRef.current;
    const origMax = wrapper.style.maxHeight;
    wrapper.style.maxHeight = "none";
    const overflow = el.scrollHeight > 150;
    wrapper.style.maxHeight = origMax;
    setShowExpandBtn(overflow);
  };

  useEffect(() => {
    checkOverflow();
  }, [displayContent, isExpanded, isEditing]);

  const handleBlur = () => {
    if (isEditing) {
      updateNodeData(id, { content: editContent });
      onUpdate(id, editContent);
      setIsEditing(false);
    }
  };

  const commitFinalContent = (finalText: string) => {
    if (!finalText) return;
    pendingCommitRef.current = finalText;
    setEditContent(finalText);
    streamContentRef.current = finalText;
    setStreamContent("");
    setIsStreaming(false);
    updateNodeData(id, { content: finalText, isStreaming: false });
    onUpdate(id, finalText);
  };

  const handleEdit = () => {
    setIsEditing(true);
    editDirtyRef.current = false;
    setEditContent(data.content || "");
  };

  useEffect(() => {
    if (isEditing) {
      // 下一帧聚焦，避免 textarea 尚未挂载
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [isEditing]);

  const handleCancel = () => {
    editDirtyRef.current = false;
    setEditContent(data.content || "");
    setIsEditing(false);
  };

  const toggleExpand = () => {
    setIsExpanded((v) => !v);
    onExpand?.(id);
  };

  // 处理滚轮事件，阻止冒泡到 ReactFlow（避免触发缩放/平移）
  const handleWheel = (event: React.WheelEvent) => {
    // 滚轮进入卡片区域时，优先滚动 textarea（编辑态），否则滚动正文容器
    // 同时阻止事件传递到画布，避免触发 zoom/pan
    const scrollEl: HTMLElement | null = isEditing
      ? (textareaRef.current as any)
      : (wrapperRef.current as any);

    if (!scrollEl) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    const isScrollable = scrollEl.scrollHeight > scrollEl.clientHeight + 1;
    if (!isScrollable) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    const isAtTop = scrollEl.scrollTop <= 0;
    const isAtBottom =
      scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;

    // 到达边界时也要拦截，避免滚轮“穿透”到画布
    if ((event.deltaY < 0 && isAtTop) || (event.deltaY > 0 && isAtBottom)) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // 手动驱动滚动：即便鼠标不在 textarea 上也能滚动 textarea
    scrollEl.scrollTop += event.deltaY;
    event.stopPropagation();
    event.preventDefault();
  };

  const children = useMemo(() => {
    const edges = getEdges() || [];
    return edges.filter((e: any) => e.source === id).map((e: any) => e.target);
  }, [getEdges, id]);

  const startStream = async () => {
    try {
      const reqData = {
        inspirationWord: String(data.inspirationWord ?? ""),
        inspirationTheme: String(data.inspirationTheme ?? ""),
        shortSummary: data.shortSummary ? String(data.shortSummary) : undefined,
        storySetting: data.storySetting ? String(data.storySetting) : undefined,
        modelEndpoint: "KIMI_K2_ENDPOINT",
      };

      setIsStreaming(true);
      setStreamContent("");
      streamContentRef.current = "";

      const onData = (streamData: PostStreamData) => {
        switch (streamData.event) {
          case "messages/partial": {
            // 沿用原逻辑，同时做一个轻量兜底（仍只针对 partial 本身）
            const d: any = (streamData as any)?.data;
            const msg = d?.[0]?.content?.[0]?.text ?? '';
            if (msg) {
              streamContentRef.current = msg;
              setStreamContent(msg);
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

      const onError = () => {
        // 保持 UI 可恢复
        setIsStreaming(false);
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
    } catch {
      setIsStreaming(false);
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
    setStreamContent("");
    setEditContent("");
    pendingCommitRef.current = null;
    startedStreamNodeIds.delete(id);
    streamingStartedRef.current = false;
    void startStream();
  };

  return (
    <div
      className={cn(
        "vue-flow-card nowheel w-[250px] min-h-[200px] rounded-2xl relative overflow-visible",
        "bg-card shadow-sm border border-border",
        "group"
      )}
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

      {/* Body */}
      <div className="px-4 py-3 pb-4 min-h-20">
        {(bodyContent || isEditing) ? (
          <div
            ref={wrapperRef}
            className={cn(
              "w-full max-h-[150px] overflow-y-auto cursor-pointer transition-[max-height]",
              isExpanded && "max-h-none"
            )}
            onWheel={handleWheel}
          >
            {!isEditing ? (
              <div
                ref={textRef}
                className="text-sm leading-[1.8] text-foreground whitespace-pre-wrap"
              >
                {bodyContent}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className={cn(
                  "w-full min-h-20 p-2 rounded-md text-sm leading-[1.8] resize-y box-border",
                  "border border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  "bg-background text-foreground"
                )}
                value={editContent}
                onChange={(e) => {
                  editDirtyRef.current = true;
                  setEditContent(e.target.value);
                }}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleCancel();
                  }
                }}
                autoFocus
              />
            )}
          </div>
        ) : (
          <div className="py-2 space-y-2">
            <div className="h-3.5 bg-muted rounded" />
            <div className="h-3.5 bg-muted rounded" />
          </div>
        )}
        {!isEditing && showExpandBtn && (
          <button
            type="button"
            onClick={toggleExpand}
            className="text-xs text-blue-500 cursor-pointer mt-1 hover:underline"
          >
            {`< ${isExpanded ? "折叠" : "展开"} >`}
          </button>
        )}
      </div>

      {/* Generate */}
      {!children.length && !isStreaming && (
        <div className="absolute right-[-164px] top-1/2 -translate-y-1/2 flex items-center gap-3 pl-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerate();
            }}
            className="rounded-full bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90 hover:shadow-md size-7"
          >
            <Sparkles className="size-4" />
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
      <Button
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          handleAdd();
        }}
        className={cn(
          "absolute bottom-[-40px] left-1/2 -translate-x-1/2 z-10",
          "rounded-full bg-[#ff6b35] text-white hover:bg-[#ff6b35]/90 hover:scale-110 hover:shadow-md",
          "size-8 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all"
        )}
      >
        <Plus className="size-4" />
      </Button>

      <Handle
        type="target"
        position={Position.Left}
        id="left-handle"
        style={{ ...handleStyle, background: "#22c55e" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-handle"
        style={{ ...handleStyle, background: "#007bff" }}
      />
    </div>
  );
}
