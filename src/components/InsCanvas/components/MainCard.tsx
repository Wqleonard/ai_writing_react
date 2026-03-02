import { useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { useInsCanvasHandlers } from "../InsCanvasContext";
import { Button } from "../../ui/Button";

interface MainCardProps {
  data: {
    label: string
    content: string
    image: string
    isMain?: boolean
    hasIdea?: boolean
    children?: any[]
  };
  isCreated: boolean;
  id: string;
}

export default function MainCard({ data, id, isCreated = false }: MainCardProps) {
  const handlers = useInsCanvasHandlers();
  const children = data.children ?? [];

  const handleCreate = () => {
    handlers.handleMainCardCreate(id);
  };

  // NOTE: 调试阶段先强制显示按钮；需要恢复条件时改回下面这一行即可
  const showButton = !children.length && data?.image && data?.content;

  return (
    // 整个节点都标记为 nodrag/nopan，避免 XYFlow 在节点上抢 pointer 事件导致内部按钮无法点击
    <div
      className="main-card vue-flow-card nodrag nopan relative w-[250px] rounded-2xl bg-card p-3"
      data-id={isCreated ? id + '-created' : id}
    >
      {data.image ? (
        <div className="h-[230px] w-full overflow-hidden rounded-2xl">
          <img
            src={data.image}
            alt="主卡片图片"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-[230px] w-full overflow-hidden rounded-2xl bg-[#f4f4f5]">
          <div className="ins-skeleton h-full w-full rounded-2xl" />
        </div>
      )}

      {data.content ? (
        <div className="mt-4 min-h-12">
          <div className="min-h-12 line-clamp-2 break-words text-base font-medium leading-normal text-foreground">
            {data.content}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <div className="ins-skeleton h-3.5 w-4/5 rounded-full" />
          <div className="ins-skeleton h-3.5 w-3/5 rounded-full" />
        </div>
      )}

      {showButton && (
        <div
          className="card-btn nodrag nopan flex flex-row-reverse"
          data-no-drag
          style={{ pointerEvents: "all" }}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Button
            type="button"
            size="sm"
            className="nodrag nopan text-white"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleCreate();
            }}
          >
            立即创作
          </Button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="right-handle"
        className="!h-3 !w-3 rounded-full border-2 border-white bg-primary shadow"
        style={{
          opacity: children.length > 0 ? 1 : 0,
          pointerEvents: children.length > 0 ? "all" : "none",
        }}
      />
    </div>
  );
}
