import React, { useCallback, useEffect, useRef, useState } from "react";
import { addFavoritePrompt, cancelFavoritePrompt, getPublicPrompts } from "../../api/community-prompt";
import type { PromptItem } from "./types";

export interface PromptsMarketDialogProps {
  open: boolean;
  onClose: () => void;
  selectedCategory: string;
  onSelectedCategoryChange: (id: string) => void;
  onUse: (prompt: PromptItem | null) => void;
}

const PAGE_SIZE = 20;

const PromptCard = ({
  data,
  onUse,
  onFavorite,
}: {
  data: PromptItem;
  onUse: () => void;
  onFavorite: () => void;
}) => (
    <div className="prompt-market-card" style={{ background: "#f5f5f5", borderRadius: 8, padding: 16, height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, background: "#e0e0e0", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title" style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{data.name}</div>
          <div style={{ fontSize: 12, color: "#909399", marginTop: 4 }}>{data.categories?.[0]?.name}</div>
          <div style={{ fontSize: 12, color: "#909399", marginTop: 2 }}>@{data.authorName}</div>
        </div>
      </div>
      <div style={{ flex: 1, fontSize: 12, color: "#606266", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {data.description}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onUse} style={{ padding: "4px 12px", background: "var(--theme-color, #409eff)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
          使用
        </button>
        <button type="button" onClick={onFavorite} style={{ padding: "4px 12px", background: "transparent", border: "1px solid #dcdfe6", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
          {data.isFavorited ? "已收藏" : "收藏"} {data.favoritesCount}
        </button>
      </div>
    </div>
);

export const PromptsMarketDialog = ({
  open,
  onClose,
  selectedCategory,
  onSelectedCategoryChange,
  onUse,
}: PromptsMarketDialogProps) => {
  const [promptsList, setPromptsList] = useState<PromptItem[]>([]);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMorePrompts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const req: any = await getPublicPrompts(nextPage, PAGE_SIZE, "updatedTime", selectedCategory || undefined);
      if (!req || typeof req !== "object") {
        setHasMore(false);
        return;
      }
      const newPrompts: PromptItem[] = Array.isArray(req.content) ? req.content : [];
      if (req.last === true) setHasMore(false);
      if (newPrompts.length > 0) {
        setPromptsList((prev) => [...prev, ...newPrompts]);
        setPage(nextPage);
      } else setHasMore(false);
    } catch (e) {
      console.error("加载提示词列表失败:", e);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, selectedCategory, isLoadingMore, hasMore]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 50) loadMorePrompts();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, loadMorePrompts]);

  useEffect(() => {
    if (open) {
      setPage(-1);
      setPromptsList([]);
      setHasMore(true);
      setIsInitialLoading(true);
    }
  }, [open, selectedCategory]);

  useEffect(() => {
    if (open && hasMore && !isLoadingMore && isInitialLoading) {
      loadMorePrompts().finally(() => setIsInitialLoading(false));
    }
  }, [open, hasMore, isLoadingMore, isInitialLoading, loadMorePrompts]);

  const handleFavorite = useCallback(async (data: PromptItem) => {
    const wasFavorited = data.isFavorited;
    try {
      if (wasFavorited) await cancelFavoritePrompt(data.id);
      else await addFavoritePrompt(data.id);
      setPromptsList((prev) =>
        prev.map((p) =>
          p.id === data.id
            ? { ...p, isFavorited: !wasFavorited, favoritesCount: wasFavorited ? Math.max(0, p.favoritesCount - 1) : p.favoritesCount + 1 }
            : p
        )
      );
    } catch {}
  }, []);

  if (!open) return null;

  const categories = [
    { id: "", label: "全部" },
    { id: "1", label: "脑洞到粗纲" },
    { id: "2", label: "粗纲到细纲" },
    { id: "3", label: "细纲到正文" },
  ];

  return (
    <div className="prompts-market-dialog-overlay" role="dialog">
      <div className="prompts-market-dialog-backdrop" onClick={onClose} />
      <div className="prompts-market-dialog">
        <div className="prompts-market-dialog-content">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 24, marginRight: 20 }}>提示词工具</div>
              <select
                value={selectedCategory}
                onChange={(e) => onSelectedCategoryChange(e.target.value)}
                style={{ width: 120, padding: "6px 8px", borderRadius: 6, border: "1px solid #dcdfe6" }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div ref={scrollRef} style={{ marginTop: 16, maxHeight: 580, overflow: "auto" }}>
            <div className="prompts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, paddingBottom: 24 }}>
              {isInitialLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ height: 180, background: "#f5f5f5", borderRadius: 8 }} />
                ))
              ) : (
                <>
                  {promptsList.map((prompt) => (
                    <PromptCard
                      key={prompt.id}
                      data={prompt}
                      onUse={() => onUse(prompt)}
                      onFavorite={() => handleFavorite(prompt)}
                    />
                  ))}
                  {isLoadingMore && Array.from({ length: 3 }).map((_, i) => <div key={`loading-${i}`} style={{ height: 180, background: "#f5f5f5", borderRadius: 8 }} />)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .prompts-market-dialog-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; }
        .prompts-market-dialog-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
        .prompts-market-dialog { position: relative; width: 1020px; max-width: 90vw; min-height: 712px; background: var(--bg-editor, #fff); border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 30px 60px; }
      `}</style>
    </div>
  );
};
