import React, { useState } from "react";
import type { PromptItem } from "./types";

export interface WritingStyleDialogProps {
  open: boolean;
  onClose: () => void;
  prompt?: PromptItem | null;
  appendToBody?: boolean;
  onAdd?: () => void;
}

export const WritingStyleDialog = ({ open, onClose, prompt, onAdd }: WritingStyleDialogProps) => {
  const [fileConfirmed, setFileConfirmed] = useState(false);
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownEditing, setMarkdownEditing] = useState(false);

  const handleConfirm = () => {
    if (!fileConfirmed) {
      setFileConfirmed(true);
      setMarkdownContent("（文风提炼结果占位，需接入上传+流式 API）");
    } else {
      onAdd?.();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="writing-style-dialog-overlay" role="dialog">
      <div className="writing-style-dialog-backdrop" onClick={onClose} />
      <div className="writing-style-dialog">
        <div style={{ width: "100%", textAlign: "center", fontSize: 32, position: "relative" }}>
          <span>文风提炼</span>
          {fileConfirmed && (
            <button type="button" style={{ position: "absolute", left: 0, top: -32, background: "none", border: "none", cursor: "pointer", fontSize: 24 }} onClick={() => setFileConfirmed(false)}>
              &#xe62a;
            </button>
          )}
        </div>
        <div style={{ marginTop: 20, minHeight: 320 }}>
          {!fileConfirmed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 18 }}>提示词</div>
                <div style={{ marginTop: 6, padding: 16, background: "#f7f7f7", borderRadius: 8, height: 80 }}>
                  官方提供-专业短篇小说评价30年 · 文风提炼
                </div>
              </div>
              <div>
                <div style={{ fontSize: 18 }}>上传内容</div>
                <div style={{ marginTop: 8, border: "1px dashed #d9d9d9", borderRadius: 8, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
                  上传 .txt 文件（占位，需接入 FileUploader）
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginTop: 8, maxHeight: 440, overflow: "auto", padding: 12, background: "#f6f6f6", borderRadius: 8, minHeight: 300 }}>
                <textarea value={markdownContent} onChange={(e) => setMarkdownContent(e.target.value)} readOnly={!markdownEditing} style={{ width: "100%", minHeight: 280, border: "none", background: "transparent", resize: "none" }} />
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 16 }}>
                <button type="button">重新生成</button>
                <button type="button" onClick={() => setMarkdownEditing(!markdownEditing)}>{markdownEditing ? "完成" : "编辑"}</button>
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "row-reverse", gap: 16, marginTop: 24 }}>
          <button type="button" onClick={handleConfirm} style={{ padding: "8px 16px", background: "var(--theme-color, #409eff)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
            {fileConfirmed ? "添加文风" : "开始提炼"}
          </button>
          <button type="button" onClick={onClose}>退出</button>
        </div>
      </div>
      <style>{`
        .writing-style-dialog-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .writing-style-dialog-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
        .writing-style-dialog { position: relative; width: 1020px; max-width: 90vw; background: #fff; border-radius: 10px; padding: 44px 140px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
      `}</style>
    </div>
  );
};
