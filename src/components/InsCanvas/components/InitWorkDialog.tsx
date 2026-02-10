import React from "react";

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
        <div className="init-work-dialog-title">确定使用当前链路写作?</div>
        <div className="init-work-dialog-btns">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={onCreateHere}>
            确定并覆盖当前作品
          </button>
          <button className="primary" onClick={onCreateNew}>
            确定并创建新作品
          </button>
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
          padding: 24px;
        }
        .init-work-dialog-title {
          font-size: 26px;
          color: #333;
          text-align: center;
        }
        .init-work-dialog-btns {
          margin-top: 26px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          padding: 20px 0;
        }
        .init-work-dialog-btns button {
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid #dcdfe6;
          background: white;
          cursor: pointer;
          font-size: 14px;
        }
        .init-work-dialog-btns button.primary {
          background: #409eff;
          color: white;
          border-color: #409eff;
        }
        .init-work-dialog-btns button.primary:hover {
          background: #66b1ff;
        }
      `}</style>
    </div>
  );
}
