import React, { useEffect, useState } from "react";
import type { InspirationVersion } from "@/components/InsCanvasV2/types";

interface InspirationHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  workId: string;
  inspirationDrawId?: string | number;
  onRestore: (version: InspirationVersion) => void;
  loadVersions?: (workId: string) => Promise<InspirationVersion[]>;
}

/** 将后端返回的 UTC 时间字符串解析为 Date（无时区时按 UTC 处理） */
function parseUtcDate(utcTime: string): Date {
  const s = utcTime.trim();
  if (!s) return new Date(NaN);
  if (/Z$|[-+]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  return new Date(s.endsWith("Z") ? s : `${s.replace(/\s+/, "T")}Z`);
}

const getTimeAgo = (saveTime: string | undefined): string => {
  if (!saveTime) return "刚刚";
  const now = new Date();
  const saveDate = parseUtcDate(saveTime);
  if (Number.isNaN(saveDate.getTime())) return "刚刚";
  const diffMs = now.getTime() - saveDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return saveDate.toLocaleDateString("zh-CN");
};

const InspirationHistoryDialog = ({
  open,
  onClose,
  workId,
  onRestore,
  loadVersions: loadVersionsProp,
}: InspirationHistoryDialogProps) => {
  const [versions, setVersions] = useState<InspirationVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVersions = async () => {
    if (!workId) return;
    setLoading(true);
    try {
      if (loadVersionsProp) {
        const list = await loadVersionsProp(workId);
        setVersions(list);
      } else {
        const { getWorksByIdReq } = await import("@/api/works");
        const res: any = await getWorksByIdReq(workId);
        if (res?.inspirationDraws && Array.isArray(res.inspirationDraws)) {
          setVersions(
            res.inspirationDraws.map((item: any) => ({
              id: String(item.id),
              inspirationDrawId: item.id,
              saveTime: item?.updatedTime,
              content: item?.content,
            }))
          );
        }
      }
    } catch (e) {
      console.error("加载版本列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && workId) loadVersions();
  }, [open, workId]);

  if (!open) return null;

  return (
    <div className="history-dialog-overlay" onClick={onClose}>
      <div
        className="history-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="history-dialog-header">
          <h3>历史版本</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="history-dialog-body">
          {loading ? (
            <div className="loading">加载中...</div>
          ) : versions.length === 0 ? (
            <div className="empty">暂无历史版本</div>
          ) : (
            <ul className="version-list">
              {versions.map((v) => (
                <li key={v.id} className="version-item">
                  <span className="time">{getTimeAgo(v.saveTime)}</span>
                  <button
                    className="restore-btn"
                    onClick={() => {
                      onRestore(v);
                      onClose();
                    }}
                  >
                    恢复
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style>{`
        .history-dialog-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        .history-dialog {
          width: 400px; max-height: 80vh; background: white; border-radius: 8px; overflow: hidden;
        }
        .history-dialog-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; border-bottom: 1px solid #eee;
        }
        .history-dialog-header h3 { margin: 0; font-size: 18px; }
        .close-btn { font-size: 24px; background: none; border: none; cursor: pointer; }
        .history-dialog-body { padding: 16px; overflow-y: auto; max-height: 400px; }
        .version-list { list-style: none; margin: 0; padding: 0; }
        .version-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px; border-bottom: 1px solid #f0f0f0;
        }
        .restore-btn { padding: 4px 12px; background: #409eff; color: white; border: none; border-radius: 4px; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default InspirationHistoryDialog;
