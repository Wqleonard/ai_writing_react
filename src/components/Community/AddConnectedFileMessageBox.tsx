import React, { useCallback, useEffect, useRef, useState } from "react";
import { getWorksByIdReq, getWorksListReq } from "../../api/works";
import { serverData2FileTreeData } from "../../utils/aiTreeNodeConverter";
import type { FileTreeNode } from "../../utils/aiTreeNodeConverter";
import type { WorkItem } from "./types";
import { FileTree, getCheckedNodesFromIds } from "./FileTree";

const PAGE_SIZE = 20;

export interface AddConnectedFileMessageBoxProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (work: WorkItem | null, files: FileTreeNode[]) => void;
  onCancel?: () => void;
}

export const AddConnectedFileMessageBox = ({
  open,
  onClose,
  onConfirm,
  onCancel,
}: AddConnectedFileMessageBoxProps) => {
  const [loading, setLoading] = useState(false);
  const [workList, setWorkList] = useState<WorkItem[]>([]);
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [treeData, setTreeData] = useState<FileTreeNode[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isConfirmed, setIsConfirmed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMoreWorks = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const req: any = await getWorksListReq(nextPage, PAGE_SIZE);
      if (!req || typeof req !== "object") {
        setHasMore(false);
        return;
      }
      const newWorks: WorkItem[] = Array.isArray(req.content) ? req.content : [];
      if (req.totalElements !== undefined) setHasMore(!req.last);
      if (newWorks.length > 0) {
        setWorkList((prev) => [...prev, ...newWorks]);
        setPage(nextPage);
      } else setHasMore(false);
    } catch (e) {
      console.error("加载作品列表失败:", e);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore, hasMore]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el || showTree) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 50) loadMoreWorks();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, showTree, loadMoreWorks]);

  useEffect(() => {
    if (open) {
      setPage(-1);
      setWorkList([]);
      setHasMore(true);
      setShowTree(false);
      setSelectedWork(null);
      setCheckedIds(new Set());
      setIsConfirmed(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && !showTree && page === -1 && hasMore && !isLoadingMore) {
      loadMoreWorks();
    }
  }, [open, showTree, page, hasMore, isLoadingMore, loadMoreWorks]);

  const handleWorkItemClick = useCallback(async (work: WorkItem) => {
    setSelectedWork(work);
    setShowTree(true);
    setLoading(true);
    try {
      const req: any = await getWorksByIdReq(String(work.id));
      const files = req?.latestWorkVersion?.content;
      if (files) {
        const root = serverData2FileTreeData(JSON.parse(files));
        setTreeData(root?.children ?? []);
      }
      setCheckedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmFile = useCallback(() => {
    const nodes = getCheckedNodesFromIds(treeData, checkedIds, false);
    setIsConfirmed(true);
    onConfirm?.(selectedWork, nodes);
    onClose();
  }, [selectedWork, treeData, checkedIds, onConfirm, onClose]);

  useEffect(() => {
    if (!open && !isConfirmed && onCancel) onCancel();
  }, [open, isConfirmed, onCancel]);

  if (!open) return null;

  return (
    <div className="add-connected-file-message-box-overlay" role="dialog">
      <div className="add-connected-file-message-box-backdrop" onClick={onClose} />
      <div className="add-connected-file-message-box">
        <div className="add-connected-file-content">
          <div className="flex justify-between items-center text-black">
            <div className="text-sm font-semibold">选择关联作品</div>
            <button type="button" className="close-btn" onClick={onClose}>
              &#xea81;
            </button>
          </div>
          {!showTree ? (
            <div ref={scrollRef} style={{ maxHeight: 156, overflow: "auto" }}>
              <div className="work-list">
                {workList.length === 0 && !isLoadingMore && <div className="empty-state">暂无作品</div>}
                {workList.map((work) => (
                  <div key={work.id} className="work-item" onClick={() => handleWorkItemClick(work)}>
                    <div className="work-title truncate">{work.title}</div>
                  </div>
                ))}
                {isLoadingMore && <div className="loading-more">加载中...</div>}
              </div>
            </div>
          ) : (
            <div className="max-h-65">
              <div style={{ maxHeight: 156, overflow: "auto" }}>
                {loading ? (
                  <div className="loading-more">加载中...</div>
                ) : (
                  <>
                    <button type="button" className="back-btn" onClick={() => setShowTree(false)}>
                      <span className="iconfont mr-1">&#xeaa2;</span>
                      <span>上一步</span>
                    </button>
                    <FileTree data={treeData} checkedIds={checkedIds} onCheckedChange={setCheckedIds} />
                  </>
                )}
              </div>
              <div className="flex flex-row-reverse h-4">
                <button type="button" className="confirm-btn" onClick={confirmFile}>
                  确认
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .add-connected-file-message-box-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .add-connected-file-message-box-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
        .add-connected-file-message-box { position: relative; width: 440px; max-width: 90vw; background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 16px; }
        .add-connected-file-content { display: flex; flex-direction: column; gap: 4px; max-height: 400px; }
        .close-btn { width: 20px; height: 20px; cursor: pointer; background: none; border: none; }
        .close-btn:hover { background: #f1f1f1; border-radius: 2px; }
        .work-list .empty-state { text-align: center; padding: 40px 0; color: #909399; font-size: 14px; }
        .work-item { height: 26px; line-height: 26px; border-radius: 8px; cursor: pointer; padding: 0 4px; }
        .work-item:hover { background: #f1f1f1; }
        .work-title { font-size: 14px; font-weight: 500; color: #303133; }
        .loading-more { text-align: center; padding: 12px 0; font-size: 12px; color: #909399; }
        .back-btn { background: none; border: none; cursor: pointer; font-size: 12px; padding: 4px 0; }
        .confirm-btn { font-size: 12px; padding: 0 8px; height: 24px; background: var(--theme-color, #409eff); color: #fff; border: none; border-radius: 4px; cursor: pointer; }
      `}</style>
    </div>
  );
};
