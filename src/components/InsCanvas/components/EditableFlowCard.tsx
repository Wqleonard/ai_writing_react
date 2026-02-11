import React, { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
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
  background: "#007bff",
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
    const target = event.target as HTMLElement | null;
    const textarea = target?.closest("textarea") as HTMLTextAreaElement | null;

    if (textarea) {
      const isScrollable = textarea.scrollHeight > textarea.clientHeight;
      if (isScrollable) {
        const isAtTop = textarea.scrollTop <= 0;
        const isAtBottom =
          textarea.scrollTop + textarea.clientHeight >= textarea.scrollHeight - 1;

        // 在边界位置阻止默认行为，避免滚轮穿透到画布
        if ((event.deltaY < 0 && isAtTop) || (event.deltaY > 0 && isAtBottom)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        // 可滚动：允许 textarea 自己滚，但阻止冒泡到画布
        event.stopPropagation();
        return;
      }
    }

    // 不可滚动：阻止冒泡和默认行为，避免触发画布缩放
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
    <div className="editable-flow-card vue-flow-card">
      <div className="card-header">
        <div className="card-header-left">
          <div className="header-title">{data.label || cardLabel}</div>
        </div>
        {!isStreaming && (
          <div className="card-actions">
            <div className="action-btn iconfont" onClick={(e) => { e.stopPropagation(); handleRefresh(); }} title="刷新">
              &#xe60c;
            </div>
            <div className="action-btn iconfont" onClick={(e) => { e.stopPropagation(); handleDelete(); }} title="删除">
              &#xe60e;
            </div>
            <div className="action-btn iconfont" onClick={(e) => { e.stopPropagation(); handleEdit(); }} title="编辑">
              &#xe60d;
            </div>
          </div>
        )}
      </div>
      <div className="card-body">
        {(bodyContent || isEditing) ? (
          <div
            ref={wrapperRef}
            className={`card-text-wrapper ${isExpanded ? "expanded" : ""}`}
            onWheel={handleWheel}
          >
            {!isEditing ? (
              <div ref={textRef} className="card-text-show">
                {bodyContent}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                className="card-text-input"
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
          <div className="card-placeholder">
            <div className="placeholder-line" />
            <div className="placeholder-line" />
          </div>
        )}
        {!isEditing && showExpandBtn && (
          <div className="expand-btn" onClick={toggleExpand}>
            {`< ${isExpanded ? "折叠" : "展开"} >`}
          </div>
        )}
      </div>
      {(!children.length) && !isStreaming && (
        <div className="generate-btn-layout">
          <div className="generate-btn iconfont" onClick={(e) => { e.stopPropagation(); handleGenerate(); }}>
            &#xe605;
          </div>
          <div className="generate-desc" onClick={(e) => { e.stopPropagation(); handleGenerate(); }}>
            {generateLabel}
          </div>
        </div>
      )}
      <div className="add-btn iconfont" onClick={(e) => { e.stopPropagation(); handleAdd(); }}>
        &#xea7f;
      </div>
      <Handle type="target" position={Position.Left} id="left-handle" style={{ ...handleStyle, background: "#28a745" }} />
      <Handle type="source" position={Position.Right} id="right-handle" style={handleStyle} />
      <style>{`
        .editable-flow-card {
          width: 250px;
          min-height: 200px;
          background: var(--bg-card, #fff);
          border-radius: 16px;
          position: relative;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          overflow: visible;
        }
        .editable-flow-card .card-header {
          font-size: 14px;
          padding: 12px 16px 0 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: none;
        }
        .editable-flow-card .card-header-left { display: flex; gap: 6px; align-items: center; }
        .editable-flow-card .header-title { font-weight: 600; color: #333; font-size: 14px; }
        .editable-flow-card .card-actions {
          display: flex;
          gap: 8px;
          z-index: 20;
          opacity: 0;
          visibility: hidden;
        }
        .editable-flow-card .action-btn {
          width: 12px;
          height: 12px;
          color: #666;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .editable-flow-card .action-btn:hover { color: #333; transform: scale(1.1); }
        .editable-flow-card .card-body { padding: 12px 16px 16px 16px; min-height: 80px; }
        .editable-flow-card .card-text-wrapper { max-height: 150px; overflow-y: auto; cursor: pointer; width: 100%; }
        .editable-flow-card .card-text-wrapper.expanded { max-height: none; }
        .editable-flow-card .card-text-show { font-size: 14px; line-height: 1.8; color: #333; white-space: pre-wrap; }
        .editable-flow-card .card-text-input {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #007bff;
          border-radius: 6px;
          font-size: 14px;
          line-height: 1.8;
          resize: vertical;
          box-sizing: border-box;
        }
        .editable-flow-card .card-placeholder { padding: 8px 0; }
        .editable-flow-card .placeholder-line { height: 14px; background: #f0f0f0; border-radius: 4px; margin-bottom: 8px; }
        .editable-flow-card .expand-btn { font-size: 12px; color: #007bff; cursor: pointer; margin-top: 4px; }
        .editable-flow-card .generate-btn-layout {
          position: absolute;
          right: -164px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding-left: 12px;
          visibility: hidden;
          opacity: 0;
          transition: all 0.3s ease;
        }
        .editable-flow-card .generate-btn {
          width: 28px;
          height: 28px;
          padding-left: 3px;
          border-radius: 28px;
          line-height: 28px;
          background: #ff6b35;
          color: white;
          font-size: 20px;
          cursor: pointer;
          white-space: nowrap;
          z-index: 10;
        }
        .editable-flow-card .generate-btn:hover { box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4); }
        .editable-flow-card .generate-desc {
          background: #ff6b35;
          border-radius: 8px;
          color: #fff;
          height: 28px;
          padding: 0 8px;
          cursor: pointer;
        }
        .editable-flow-card .generate-desc:hover { box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4); }

        .editable-flow-card .add-btn {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          width: 30px;
          height: 30px;
          background: #ff6b35;
          color: white;
          border-radius: 50%;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          visibility: hidden;
          opacity: 0;
        }
        .editable-flow-card .add-btn:hover { transform: translateX(-50%) scale(1.1); box-shadow: 0 6px 16px rgba(255, 107, 53, 0.4); }

        .editable-flow-card:hover .generate-btn-layout { opacity: 1; visibility: visible; }
        .editable-flow-card:hover .add-btn { opacity: 1; visibility: visible; }
        .editable-flow-card:hover .card-actions { opacity: 1; visibility: visible; }
      `}</style>
    </div>
  );
}
