import { Handle, Position, } from "@xyflow/react";
import { useInsCanvasHandlers } from "@/components/InsCanvas/InsCanvasContext";

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
  // const showButton = !children.length && data?.image && data?.content;
  const showButton = true;

  return (
    // 整个节点都标记为 nodrag/nopan，避免 XYFlow 在节点上抢 pointer 事件导致内部按钮无法点击
    <div className="main-card vue-flow-card nodrag nopan" data-id={id}>
      {data.image ? (
        <div className="card-image">
          <img src={data.image} alt="主卡片图片" />
        </div>
      ) : (
        <div className="main-card-skeleton">
          <div className="skeleton-image" />
        </div>
      )}

      {data.content ? (
        <div className="card-content">
          <div className="card-text">{data.content}</div>
        </div>
      ) : (
        <div className="main-card-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )}

      {showButton && (
        // XYFlow 会在节点上监听 pointerdown 以实现拖拽/平移；交互元素需要加 nodrag/nopan
        <div
          className="card-btn nodrag nopan"
          // data-no-drag 是 XYFlow 的“内部白名单标记”，可以避免 XYFlow 在节点上抢 pointer 事件导致内部按钮无法点击
          data-no-drag
          style={{ pointerEvents: 'all' }}
          // capture 阶段阻断，防止父层先处理拖拽/平移
          onPointerDownCapture={(e) => e.stopPropagation()}
          onMouseDownCapture={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="primary-btn nodrag nopan"
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
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="right-handle"
        style={{
          background: "#007bff",
          width: 12,
          height: 12,
          border: "2px solid white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          opacity: children.length > 0 ? 1 : 0,
          pointerEvents: children.length > 0 ? "all" : "none",
        }}
      />
      <style>{`
        .main-card {
          width: 250px;
          background: var(--bg-card, #fff);
          border-radius: 16px;
          position: relative;
          padding: 12px;
        }
        .main-card .card-image {
          width: 100%;
          height: 230px;
          border-radius: 16px;
          overflow: hidden;
        }
        .main-card .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .main-card .card-content { margin-top: 16px; min-height: 48px; }
        .main-card .card-text {
          font-size: 16px;
          line-height: 1.5;
          color: #333;
          font-weight: 500;
          min-height: 48px;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-word;
        }
        .main-card .card-btn { display: flex; flex-direction: row-reverse; }
        .main-card .primary-btn {
          padding: 8px 16px;
          background: #409eff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .main-card-skeleton { display: flex; flex-direction: column; gap: 12px; }
        .skeleton-image { height: 230px; border-radius: 16px; background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .skeleton-line { height: 14px; border-radius: 4px; background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        .skeleton-line.short { width: 30%; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
