import { Button } from "@/components/ui/Button";

interface InitWorkDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateHere: () => void;
  onCreateNew: () => void;
}

export default function InitWorkDialog({
  open,
  onClose,
  onCreateHere,
  onCreateNew,
}: InitWorkDialogProps) {
  if (!open) return null;

  return (
    <div className="init-work-dialog-overlay" onClick={onClose}>
      <div
        className="init-work-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          className="init-work-dialog-close"
          size="icon-xs"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </Button>
        <div className="init-work-dialog-title">确定使用当前链路写作?</div>
        <div className="init-work-dialog-btns">
          <Button onClick={onClose}>取消</Button>
          <Button className="primary" onClick={onCreateHere}>
            确定并覆盖当前作品
          </Button>
          <Button className="primary" onClick={onCreateNew}>
            确定并创建新作品
          </Button>
        </div>
      </div>
      <style>{`
        .init-work-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .init-work-dialog {
          width: 420px;
          background: white;
          border-radius: 8px;
          padding: 24px 24px 20px;
          position: relative;
        }
        .init-work-dialog-title {
          font-size: 26px;
          color: #333;
          text-align: center;
        }
        .init-work-dialog-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: #999;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .init-work-dialog-close:hover {
          background: #f3f4f6;
          color: #666;
        }
        .init-work-dialog-btns {
          margin-top: 26px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px;
          padding: 16px 0 4px;
        }
        .init-work-dialog-btns button {
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid #dcdfe6;
          background: white;
          cursor: pointer;
          font-size: 13px;
          line-height: 1.4;
          white-space: nowrap;
        }
        .init-work-dialog-btns button.primary {
          background: var(--primary);
          color: white;
         border-color: var(--primary);
        }
        .init-work-dialog-btns button.primary:hover {
           filter: brightness(1.05);
        }
      `}</style>
    </div>
  );
}
