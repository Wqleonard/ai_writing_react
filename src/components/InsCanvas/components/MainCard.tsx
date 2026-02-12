import { Handle, Position } from "@xyflow/react";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";
import { Button } from "@/components/ui/Button";

interface MainCardProps {
  data: {
    label: string
    content: string
    image: string
    isMain?: boolean
    hasIdea?: boolean
    children?: any[]
  };
  id: string;
}

export default function MainCard({ data, id }: MainCardProps) {
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
      data-id={id}
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
        <div className="flex flex-col gap-3">
          <div className="skeleton-image h-[230px] rounded-2xl bg-muted animate-pulse" />
        </div>
      )}

      {data.content ? (
        <div className="mt-4 min-h-12">
          <div className="min-h-12 line-clamp-2 break-words text-base font-medium leading-normal text-foreground">
            {data.content}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="h-3.5 rounded bg-muted animate-pulse" />
          <div className="skeleton-line-short h-3.5 w-[30%] rounded bg-muted animate-pulse" />
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
