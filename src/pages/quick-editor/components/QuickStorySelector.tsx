import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getQuickStoriesReq } from "@/api/generate-quick";
import QuickStoryCard, { type QuickStoryCardData } from "./QuickStoryCard";
import { useEditorStore } from "@/stores/editorStore";
import { LinkButton } from "@/components/ui/LinkButton";
import { Iconfont } from "@/components/IconFont";

export interface StoryData extends QuickStoryCardData {
  isCustom?: boolean;
}

type Props = {
  selectedTagIds?: string;
  storyContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
  onConfirm: (storyData: string, title: string) => void;
  onRevert: () => void;
  onRevertToCurrent: () => void;
  onErrorAndRevert: (targetDir: string) => void;
};

const EMPTY_STORIES: StoryData[] = [
  { title: "", intro: "", theme: "" },
  { title: "", intro: "", theme: "" },
  { title: "", intro: "", theme: "" },
];

const MAX_TITLE_LENGTH = 30;
const MAX_INTRO_LENGTH = 300;

const QuickStorySelector = ({
  selectedTagIds = "",
  storyContent = "",
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  onConfirm,
  onRevert,
  onRevertToCurrent,
  onErrorAndRevert,
}: Props) => {
  const [stories, setStories] = useState<StoryData[]>([...EMPTY_STORIES]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customStory, setCustomStory] = useState<StoryData>({ title: "", intro: "", theme: "" });
  const [editingStoryIndex, setEditingStoryIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editPanelStyle, setEditPanelStyle] = useState<React.CSSProperties>({
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    bottom: "92px",
    transformOrigin: "top left",
  });
  const storyGridRef = useRef<HTMLDivElement | null>(null);
  const prevTriggerRef = useRef(0);
  const latestTriggerParamsRef = useRef({
    selectedTagIds,
    locked,
  });

  const workInfo = useEditorStore((s) => s.workInfo);

  useEffect(() => {
    latestTriggerParamsRef.current = { selectedTagIds, locked };
  }, [selectedTagIds, locked]);

  const hasSelectedStory = selectedStoryIndex !== null && !!stories[selectedStoryIndex]?.title;

  const displayStories = useMemo(() => {
    if (locked) return stories.filter((story) => story.title);
    return [...stories, null] as Array<StoryData | null>;
  }, [locked, stories]);

  const generateStories = useCallback(async () => {
    if (loading) return;
    if (!selectedTagIds) {
      toast.warning("请先选择标签");
      return;
    }
    setLoading(true);
    setStories([...EMPTY_STORIES]);
    setSelectedStoryIndex(null);
    try {
      const tagIds = selectedTagIds.split(",").filter((id) => id.trim());
      const description = workInfo?.workTags?.map((tag: any) => tag.name).join(",") || "";
      const tagNames = workInfo?.workTags?.map((tag: any) => `#${tag.name}`) || [];
      const res: any = await getQuickStoriesReq({} as any, description, tagIds, "doc");
      const theme = res?.theme || "";
      const stormList = Array.isArray(res?.brainStorms) ? res.brainStorms : [];
      const next = [...EMPTY_STORIES];
      for (let i = 0; i < 3; i++) {
        if (i >= stormList.length) continue;
        const item = stormList[i];
        next[i] = {
          title: item.title || item.name || "",
          intro: item.intro || item.synopsis || item.description || "",
          theme,
          tags: tagNames,
        };
      }
      setStories(next);
    } catch (error) {
      console.error("[QuickStorySelector] 获取故事梗概失败:", error);
      setStories([...EMPTY_STORIES]);
      onErrorAndRevert("标签.md");
    } finally {
      setLoading(false);
    }
  }, [loading, onErrorAndRevert, selectedTagIds, workInfo]);

  const animateFromCard = useCallback(async (cardElement: HTMLElement) => {
    if (!storyGridRef.current) return;
    const containerRect = storyGridRef.current.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();
    setEditPanelStyle({
      left: `${cardRect.left - containerRect.left}px`,
      top: `${cardRect.top - containerRect.top}px`,
      width: `${cardRect.width}px`,
      height: `${cardRect.height}px`,
      transformOrigin: "top left",
    });
    setIsAnimating(true);
    setShowEditPanel(true);
    setTimeout(() => {
      setEditPanelStyle({
        left: "0px",
        top: "0px",
        width: "100%",
        bottom: "40px",
        transformOrigin: "top left",
      });
      setTimeout(() => setIsAnimating(false), 650);
    }, 50);
  }, []);

  const handleSelectStory = useCallback(
    (story: StoryData | null, index: number) => {
      if (loading || !story || !story.title || locked) return;
      setSelectedStoryIndex(index);
    },
    [loading, locked],
  );

  const handleEditStory = useCallback(
    async (story: StoryData, index: number, event: React.MouseEvent) => {
      if (locked) return;
      setCustomStory({ ...story });
      setEditingStoryIndex(index);
      setIsCustomMode(false);
      const target = (event.currentTarget as HTMLElement).closest(".story-card-wrapper") as HTMLElement | null;
      if (target) await animateFromCard(target);
    },
    [animateFromCard, locked],
  );

  const handleShowCustomDialog = useCallback(
    async (event?: React.MouseEvent) => {
      if (locked || loading) return;
      setCustomStory({ title: "", intro: "", theme: "" });
      setEditingStoryIndex(null);
      setIsCustomMode(true);
      if (!event) {
        setShowEditPanel(true);
        return;
      }
      const target = (event.currentTarget as HTMLElement).closest(".story-card-wrapper") as HTMLElement | null;
      if (target) await animateFromCard(target);
      else setShowEditPanel(true);
    },
    [animateFromCard, loading, locked],
  );

  const closeEditPanel = useCallback(() => {
    setShowEditPanel(false);
    setIsAnimating(false);
    setEditingStoryIndex(null);
    setIsCustomMode(false);
    setCustomStory({ title: "", intro: "", theme: "" });
  }, []);

  const handleSaveCustomStory = useCallback(() => {
    const title = customStory.title?.trim();
    const intro = customStory.intro?.trim();
    if (!title || !intro) {
      toast.warning("请填写完整的书名和梗概");
      return;
    }
    const tagNames = (workInfo?.workTags ?? []).map((tag) => `#${tag.name}`);
    setStories((prev) => {
      const next = [...prev];
      if (editingStoryIndex !== null) {
        const updated = { ...customStory, tags: tagNames };
        if (next[editingStoryIndex]?.isCustom) updated.isCustom = true;
        next[editingStoryIndex] = updated;
        setSelectedStoryIndex(editingStoryIndex);
        return next;
      }
      const newStory: StoryData = { ...customStory, tags: tagNames, isCustom: true };
      const sameNameIndex = next.findIndex((s) => s.title?.trim() === title && s.isCustom);
      if (sameNameIndex !== -1) {
        next[sameNameIndex] = newStory;
        setSelectedStoryIndex(sameNameIndex);
      } else {
        const insertIndex = Math.max(0, next.length);
        next.splice(insertIndex, 0, newStory);
        setSelectedStoryIndex(insertIndex);
      }
      return next;
    });
    closeEditPanel();
  }, [closeEditPanel, customStory, editingStoryIndex, workInfo]);

  const handleConfirm = useCallback(() => {
    if (selectedStoryIndex === null || !stories[selectedStoryIndex]?.title) {
      toast.warning("请先选择一个故事");
      return;
    }
    const selectedStory = stories[selectedStoryIndex];
    const generatedCards = stories.filter((s) => s.title && s.title.trim() !== "");
    const fullData = {
      selectedData: selectedStory,
      generatedCards: generatedCards.length > 0 ? generatedCards : undefined,
    };
    onConfirm(JSON.stringify(fullData), selectedStory.title);
  }, [onConfirm, selectedStoryIndex, stories]);

  const handleRevert = useCallback(() => {
    const ok = window.confirm("回退后，该步骤后续内容将被清空不可找回，是否回退到该步骤？");
    if (ok) onRevert();
  }, [onRevert]);

  const initFromProps = useCallback(() => {
    if (!storyContent) return;
    try {
      const data = JSON.parse(storyContent);
      if (data.selectedData && data.generatedCards) {
        const cards = data.generatedCards as StoryData[];
        setStories(cards);
        const selectedIndex = cards.findIndex(
          (s) => s.title === data.selectedData.title && s.intro === data.selectedData.intro,
        );
        setSelectedStoryIndex(selectedIndex !== -1 ? selectedIndex : 0);
      } else {
        setStories([data]);
        setSelectedStoryIndex(0);
      }
    } catch (error) {
      console.error("[QuickStorySelector] Failed to parse storyContent:", error);
    }
  }, [storyContent]);

  useEffect(() => {
    if (!storyContent) {
      setStories([...EMPTY_STORIES]);
      setSelectedStoryIndex(null);
      setEditingStoryIndex(null);
      setShowEditPanel(false);
      return;
    }
    initFromProps();
  }, [initFromProps, storyContent]);

  useEffect(() => {
    if (triggerGenerate > prevTriggerRef.current && triggerGenerate > 0) {
      setTimeout(() => {
        const latest = latestTriggerParamsRef.current;
        if (!latest.selectedTagIds || latest.locked) return;
        setStories([...EMPTY_STORIES]);
        setSelectedStoryIndex(null);
        void generateStories();
      }, 100);
    }
    prevTriggerRef.current = triggerGenerate;
  }, [generateStories, triggerGenerate]);

  return (
    <div className={`flex h-full max-h-full flex-col overflow-hidden pr-[120px] pt-8 pb-5 ${showEditPanel ? "edit-mode" : ""}`}>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 text-2xl px-4 font-normal text-black">请选择满意的故事梗概</div>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            ref={storyGridRef}
            className="mt-5 relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-[2px] [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[rgba(0,0,0,0.1)]"
          >
            <div className={`relative mb-8 flex shrink-0 flex-row flex-wrap gap-7 p-4 justify-between ${showEditPanel ? "pointer-events-none opacity-30" : ""}`}>
              {displayStories.map((story, index) => {
                const key = story ? `${story.title}-${index}` : `custom-${index}`;
                const selected = !!story && !!story.title && selectedStoryIndex === index;
                return (
                  <div
                    key={key}
                    className={`flex rounded-[10px] h-auto min-h-[400px] max-h-[calc((100vh-350px)*0.9)] basis-[calc(25%-30px)] flex-row ${
                      story ? "max-w-[calc(25%-30px)]" : "custom-wrapper max-w-[calc(25%-30px)]"
                    } ${selected ? "outline-2 outline-(--theme-color)" : ""}`}
                  >
                    {story ? (
                      <QuickStoryCard
                        data={story}
                        showEdit={!locked && !!story.title && !showEditPanel}
                        loading={loading}
                        isSelected={selectedStoryIndex === index}
                        onClick={(e) => handleSelectStory(story, index)}
                        onEdit={(e) => void handleEditStory(story, index, e)}
                      />
                    ) : (
                      <QuickStoryCard
                        isCustom
                        loading={loading}
                        onClick={(e) => void handleShowCustomDialog(e)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {!locked && !showEditPanel && (
              <div className="flex h-8 shrink-0 items-center justify-center">
                <LinkButton
                  type="button"
                  disabled={loading}
                  className="flex items-center gap-3  text-2xl text-[#999]"
                  onClick={() => void generateStories()}
                >
                  <Iconfont unicode="&#xe66f;" className="mr-[10px] inline-block text-[30px]"/>
                  <span>换一批</span>
                </LinkButton>
              </div>
            )}
          </div>

          {showEditPanel && (
            <div
              className={`absolute z-100 flex flex-col overflow-hidden rounded-[10px] border-2 border-[#ff9500] bg-[#fff8e5] transition-all duration-600 ${isAnimating ? "" : ""}`}
              style={editPanelStyle}
            >
              <div className="flex h-full flex-col overflow-y-auto px-[100px] pt-[35px] pb-[clamp(35px,5vh,50px)]">
                <div className="mb-5 shrink-0 text-center text-[30px] leading-[1.32em] tracking-[0.04em] text-[#464646]">
                  编辑故事梗概
                </div>
                <div className="flex min-h-min flex-[0_0_auto] flex-col gap-[30px]">
                  <div className="flex items-start">
                    <label className="w-[50px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] text-[#464646]">
                      书名：
                    </label>
                    <div className="relative ml-[100px] min-w-0 flex-1">
                      <input
                        value={customStory.title || ""}
                        maxLength={MAX_TITLE_LENGTH}
                        placeholder="请填入"
                        className="h-[60px] w-full rounded-[10px] bg-[rgba(255,245,205,0.5)] px-[30.91px] pr-[100px] text-2xl text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) => setCustomStory((prev) => ({ ...prev, title: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute top-[13px] right-4 text-2xl text-[#9a9a9a]">
                        {(customStory.title || "").length}/{MAX_TITLE_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <label className="w-[50px] shrink-0 pt-[15px] text-2xl leading-[1.32em] tracking-[0.04em] text-[#464646]">
                      梗概：
                    </label>
                    <div className="relative ml-[100px] min-w-0 flex-1">
                      <textarea
                        value={customStory.intro || ""}
                        maxLength={MAX_INTRO_LENGTH}
                        placeholder="请简述核心故事情节"
                        className="h-[270px] min-h-[270px] max-h-[270px] w-full resize-none rounded-[10px] border-none bg-[rgba(255,245,205,0.5)] px-[32.26px] py-[14.81px] pr-[100px] text-2xl text-[#464646] outline-none placeholder:text-[#999]"
                        onChange={(e) => setCustomStory((prev) => ({ ...prev, intro: e.target.value }))}
                      />
                      <span className="pointer-events-none absolute right-4 bottom-4 text-2xl text-[#9a9a9a]">
                        {(customStory.intro || "").length}/{MAX_INTRO_LENGTH}
                      </span>
                    </div>
                  </div>

                  <div className="mt-[clamp(20px,3vh,40px)] flex min-h-[52px] shrink-0 items-center justify-center gap-[25.91px]">
                    <button
                      type="button"
                      className="h-[52px] w-[130.91px] rounded-[10px] border-2 border-[#9a9a9a] bg-transparent text-2xl leading-[1.32em] text-[#464646] hover:opacity-80"
                      onClick={closeEditPanel}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      className="h-[52px] w-[129px] rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-2xl leading-[1.32em] font-bold text-white hover:opacity-90"
                      onClick={handleSaveCustomStory}
                    >
                      确定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!showEditPanel && (
        <div className="flex shrink-0 items-center justify-end py-5">
          {!locked && (
            <button
              type="button"
              disabled={!hasSelectedStory}
              className="h-[52px] w-[221px] rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[28px] leading-[1.32em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
              onClick={handleConfirm}
            >
              下一步
            </button>
          )}
        </div>
      )}

      {hasNextContent && (
        <div className="flex shrink-0 justify-end pb-5">
          <button
            type="button"
            className="h-[52px] w-[261px] rounded-[10px] border-2 border-[#999] bg-transparent px-0 py-[7px] text-[28px] leading-[1.32em] font-normal text-[#999] transition hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
            onClick={onRevertToCurrent}
          >
            回退至故事梗概
          </button>
        </div>
      )}

    </div>
  );
};

export default QuickStorySelector;
