import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Iconfont } from "@/components/Iconfont";
import { useEditorStore } from "@/stores/editorStore";
import { WorkspaceHeader } from "@/layout/WorkspaceLayout/WorkspaceHeader";
import { QuickExportDialog } from "./QuickExportDialog";
import "./QuickEditorTopToolBar.css";

export interface QuickEditorTopToolBarProps {
  hideFeedback?: boolean;
  isScript?: boolean;
  onBackClick?: () => void;
  onSaveClick?: () => void;
  onUpdateTitle?: (value: string) => void;
  onNotesConfirm?: (notes: unknown[]) => void;
}

export const QuickEditorTopToolBar = ({
  hideFeedback = false,
  isScript = false,
  onBackClick,
  onSaveClick,
  onUpdateTitle,
}: QuickEditorTopToolBarProps) => {
  const workInfo = useEditorStore((s) => s.workInfo);
  const workId = useEditorStore((s) => s.workId);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState(workInfo?.title || "");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const exportBtnRef = useRef<HTMLDivElement | null>(null);

  const displayTitle = useMemo(() => {
    const title = workInfo?.title || "";
    if (title === "未命名作品" && workInfo?.workId) {
      return `${title}${workInfo.workId}`;
    }
    if (title === "未命名作品" && workId) {
      return `${title}${workId}`;
    }
    return title;
  }, [workInfo?.title, workInfo?.workId, workId]);

  useEffect(() => {
    if (!isEditingTitle) {
      setEditingTitleValue(workInfo?.title || "");
    }
  }, [isEditingTitle, workInfo?.title]);

  useEffect(() => {
    if (!showExportDialog) return;
    const onWindowClick = (event: MouseEvent) => {
      if (!exportBtnRef.current) return;
      if (!exportBtnRef.current.contains(event.target as Node)) {
        setShowExportDialog(false);
      }
    };
    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, [showExportDialog]);

  const startEditTitle = () => {
    setIsEditingTitle(true);
    setEditingTitleValue(workInfo?.title || "");
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  };

  const finishEditTitle = () => {
    const nextTitle = editingTitleValue.trim();
    if (!nextTitle) {
      setEditingTitleValue(workInfo?.title || "");
      setIsEditingTitle(false);
      return;
    }
    if (nextTitle !== (workInfo?.title || "")) {
      onUpdateTitle?.(nextTitle);
    }
    setIsEditingTitle(false);
  };

  const cancelEditTitle = () => {
    setEditingTitleValue(workInfo?.title || "");
    setIsEditingTitle(false);
  };

  return (
    <div className="top-tool-container">
      <div className="left-top-content">
        <div className="left-content">
          <Button variant="ghost" className="back-link" onClick={onBackClick}>
            <Iconfont unicode="&#xe62a;" className="back-icon mr-2" />
            <span className="back-text">返回</span>
          </Button>
          <span className="divider">|</span>
          <Button variant="ghost" className="save-link" onClick={onSaveClick}>
            保存
          </Button>

          {!isEditingTitle ? (
            <Button
              variant="ghost"
              className="work-title-display"
              title="点击编辑作品名称"
              onClick={startEditTitle}
            >
              {displayTitle}
            </Button>
          ) : (
            <input
              ref={titleInputRef}
              value={editingTitleValue}
              className="work-title-input"
              type="text"
              onBlur={finishEditTitle}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finishEditTitle();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditTitle();
                }
              }}
            />
          )}
        </div>
      </div>

      <div className="right-top-content">
        <div className="export-btn-container" ref={exportBtnRef}>
          <Button
            className="export-btn bg-white"
            onClick={(e) => {
              e.stopPropagation();
              setShowExportDialog((v) => !v);
            }}
            title="导出"
          >
            导出
            <ChevronDown className="export-icon" />
          </Button>
          <QuickExportDialog
            visible={showExportDialog}
            isScript={isScript}
            onClose={() => setShowExportDialog(false)}
          />
        </div>

        <WorkspaceHeader />
      </div>
    </div>
  );
};

export default QuickEditorTopToolBar;

