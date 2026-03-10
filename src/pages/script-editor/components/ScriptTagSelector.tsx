import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { addCustomTagReq, delCustomTagReq, getScriptSelectedTagsReq, getScriptTagsReq, updateWorkInfoReq } from "@/api/works";
import { useEditorStore } from "@/stores/editorStore";
import type { Tag } from "@/components/StepWorkflow/types";
import { toast } from "sonner";
import { Iconfont } from "@/components/IconFont";
import { cn } from "@/lib/utils";

interface TagCategoryDataItem {
  category: string;
  categoryId: string;
  max: number;
  tags: Tag[];
}

interface ScriptSelectedTagsResult {
  topics?: string[];
  plots?: string[];
  backgrounds?: string[];
  storyAudiences?: string[];
  episodeNum?: string;
  synopsis?: string;
}

interface CustomInputState {
  visible: boolean;
  value: string;
}

export interface ScriptTagSelectorProps {
  selectedTagIds?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  novelPlot?: string;
  synopsis?: string;
  description?: string;
  triggerGenerate?: number;
  onConfirm?: (data: { tagIds: string; synopsis: string; episodeNum: number; description: string }) => void;
  onRevert?: () => void;
  onRevertToCurrent?: () => void;
}

const MAX_CUSTOM_NAME_LEN = 6;

export const ScriptTagSelector = ({
  selectedTagIds = "",
  locked = false,
  hasNextContent = false,
  novelPlot = "",
  synopsis: synopsisProp = "",
  description: descriptionProp = "",
  triggerGenerate = 0,
  onConfirm,
  onRevert,
  onRevertToCurrent,
}: ScriptTagSelectorProps) => {
  const workId = useEditorStore((s) => s.workId);
  const [categories, setCategories] = useState<TagCategoryDataItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [synopsis, setSynopsis] = useState("");
  const [description, setDescription] = useState("");
  const [isFetchingDefaultSelectedTags, setIsFetchingDefaultSelectedTags] = useState(false);
  const [customInputMap, setCustomInputMap] = useState<Record<string, CustomInputState>>({});
  const customInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const prevTriggerGenerateRef = useRef(triggerGenerate);
  const didAutoFetchDefaultRef = useRef(false);

  const hasSelectedTags = selectedTags.length > 0;

  const ensureCustomState = (categoryId: string): CustomInputState =>
    customInputMap[categoryId] || { visible: false, value: "" };

  const setCustomInputRef = (categoryId: string, el: HTMLInputElement | null) => {
    customInputRefs.current[categoryId] = el;
  };

  const showCustomInput = (categoryId: string) => {
    if (locked) return;
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { ...ensureCustomState(categoryId), visible: true },
    }));
    setTimeout(() => {
      const input = customInputRefs.current[categoryId];
      input?.focus();
      input?.select();
    }, 0);
  };

  const hideCustomInput = (categoryId: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: false, value: "" },
    }));
  };

  const isCustomInputVisible = (categoryId: string) => !!customInputMap[categoryId]?.visible;
  const getCustomInputValue = (categoryId: string) => customInputMap[categoryId]?.value || "";

  const setCustomInputValue = (categoryId: string, value: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { ...ensureCustomState(categoryId), value },
    }));
  };

  const updateTagCategories = useCallback(async () => {
    try {
      const response = await getScriptTagsReq();
      setCategories(Array.isArray(response) ? (response as TagCategoryDataItem[]) : []);
    } catch (error) {
      setCategories([]);
      console.error("获取标签数据失败:", error);
    }
  }, []);

  const getEpisodeCategory = useCallback(
    () => categories.find((cat) => cat.category?.includes("集数")),
    [categories]
  );

  const parseEpisodeNumFromTagName = (name: string): number => {
    const m = String(name).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };

  const ensureEpisodeDefaultSelected = useCallback(() => {
    const episodeCat = getEpisodeCategory();
    if (!episodeCat?.tags?.length) return;
    const categoryTagIds = new Set(episodeCat.tags.map((tag) => String(tag.id)));
    const defaultTag = episodeCat.tags[0];
    setSelectedTags((prev) => {
      const selectedInEpisode = prev.filter((t) => categoryTagIds.has(String(t.id)));
      if (selectedInEpisode.length > 0) return prev;
      return [...prev, defaultTag];
    });
  }, [getEpisodeCategory]);

  const initSelectedTags = useCallback(() => {
    if (!selectedTagIds || selectedTagIds.trim() === "") {
      setSelectedTags([]);
      return;
    }
    const tagIdArray = selectedTagIds
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !Number.isNaN(id));
    const foundTags: Tag[] = [];
    categories.forEach((category) => {
      category.tags.forEach((tag) => {
        if (tagIdArray.includes(Number(tag.id))) {
          foundTags.push(tag);
        }
      });
    });
    setSelectedTags(foundTags);
  }, [selectedTagIds, categories]);

  const tryInitFromProps = useCallback(() => {
    if (categories.length === 0) return;
    if (selectedTagIds !== undefined && selectedTagIds !== null) {
      initSelectedTags();
    }
    if (synopsisProp !== undefined && synopsisProp !== null) {
      setSynopsis(synopsisProp);
    }
    if (descriptionProp !== undefined && descriptionProp !== null) {
      setDescription(descriptionProp);
    }
    ensureEpisodeDefaultSelected();
  }, [categories.length, selectedTagIds, synopsisProp, descriptionProp, initSelectedTags, ensureEpisodeDefaultSelected]);

  const getSelectedCount = (categoryName: string) => {
    const category = categories.find((cat) => cat.category === categoryName);
    if (!category) return 0;
    const categoryTagIds = new Set(category.tags.map((tag) => String(tag.id)));
    return selectedTags.filter((tag) => categoryTagIds.has(String(tag.id))).length;
  };

  const isTagSelected = (tagId: number | string) =>
    selectedTags.some((tag) => String(tag.id) === String(tagId));

  const toggleTag = (categoryId: string, tagId: number, maxSelect: number) => {
    if (locked) return;
    const category = categories.find((cat) => cat.categoryId === categoryId);
    if (!category) return;
    const tag = category.tags.find((t) => Number(t.id) === tagId);
    if (!tag) return;

    setSelectedTags((prev) => {
      const next = [...prev];
      const index = next.findIndex((t) => Number(t.id) === tagId);
      if (index > -1) {
        next.splice(index, 1);
        return next;
      }
      const categoryTagIds = new Set(category.tags.map((t) => Number(t.id)));
      const currentSelectedCount = next.filter((t) => categoryTagIds.has(Number(t.id))).length;
      if (maxSelect !== 0 && currentSelectedCount >= maxSelect) {
        let lastIndex = -1;
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (categoryTagIds.has(Number(next[i].id))) {
            lastIndex = i;
            break;
          }
        }
        if (lastIndex > -1) next.splice(lastIndex, 1);
      }
      next.push(tag);
      return next;
    });
  };

  const isValidEpisodeTagName = (name: string): boolean => parseEpisodeNumFromTagName(name) > 0;

  const confirmCustomTag = async (categoryId: string) => {
    const name = getCustomInputValue(categoryId).trim();
    if (!name) {
      hideCustomInput(categoryId);
      return;
    }
    const category = categories.find((cat) => cat.categoryId === categoryId);
    if (!category) {
      hideCustomInput(categoryId);
      return;
    }
    const episodeCat = getEpisodeCategory();
    if (episodeCat?.categoryId === categoryId && !isValidEpisodeTagName(name)) {
      toast.warning("集数请输入可提取数字的格式，如：60集、80集，请重新输入");
      return;
    }
    const existed = category.tags.find((t) => t.name === name);
    if (existed) {
      toast.warning("该标签已存在");
      hideCustomInput(categoryId);
      return;
    }
    try {
      await addCustomTagReq(categoryId, name, "script");
      hideCustomInput(categoryId);
      await updateTagCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (locked) return;
    try {
      await delCustomTagReq(String(tag.id));
      setSelectedTags((prev) => prev.filter((t) => String(t.id) !== String(tag.id)));
      await updateTagCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDefaultSelectedTags = useCallback(async () => {
    if (locked || !novelPlot) return;
    try {
      const result = (await getScriptSelectedTagsReq(novelPlot)) as ScriptSelectedTagsResult;
      const defaultTagNames: string[] = [];
      if (result.topics) defaultTagNames.push(...result.topics);
      if (result.plots) defaultTagNames.push(...result.plots);
      if (result.backgrounds) defaultTagNames.push(...result.backgrounds);
      if (result.storyAudiences) defaultTagNames.push(...result.storyAudiences);
      if (result.episodeNum) defaultTagNames.push(result.episodeNum);
      if (result.synopsis) setSynopsis(result.synopsis);

      const matchedTags: Tag[] = [];
      categories.forEach((category) => {
        category.tags.forEach((tag) => {
          if (defaultTagNames.includes(tag.name) && !matchedTags.some((t) => String(t.id) === String(tag.id))) {
            matchedTags.push(tag);
          }
        });
      });

      if (matchedTags.length > 0) {
        setSelectedTags((prev) => (prev.length === 0 ? matchedTags : prev));
      }
      ensureEpisodeDefaultSelected();
    } catch (error) {
      console.error("获取默认选中标签失败:", error);
    } finally {
      setIsFetchingDefaultSelectedTags(false);
    }
  }, [locked, novelPlot, categories, ensureEpisodeDefaultSelected]);

  const handleConfirm = async () => {
    if (locked) return;
    try {
      const selectedTagIds = selectedTags.map((tag) => Number(tag.id));
      await updateWorkInfoReq(workId, { tagIds: selectedTagIds });

      const episodeCat = getEpisodeCategory();
      let episodeNum = 60;
      if (episodeCat?.tags?.length) {
        const selectedInCategory = selectedTags.filter((t) =>
          episodeCat.tags.some((tag) => String(tag.id) === String(t.id))
        );
        const tagForEpisode = selectedInCategory[0] ?? episodeCat.tags[0];
        episodeNum =
          parseEpisodeNumFromTagName(tagForEpisode.name) ||
          parseEpisodeNumFromTagName(episodeCat.tags[0].name) ||
          60;
      }

      const descriptionParts: string[] = [];
      for (const tag of selectedTags) {
        const cat = categories.find((c) => c.tags?.some((t) => String(t.id) === String(tag.id)));
        if (!cat?.category) continue;
        if (
          cat.category.includes("章节") ||
          cat.category.includes("chapter number") ||
          cat.category.includes("集数")
        ) {
          continue;
        }
        descriptionParts.push(tag.name);
      }
      const descriptionStr = descriptionParts.join(",");
      onConfirm?.({
        tagIds: selectedTagIds.join(","),
        synopsis: synopsis.trim(),
        episodeNum,
        description: descriptionStr,
      });
    } catch (e) {
      console.error(e);
      toast.error("保存失败,请稍后重试");
    }
  };

  useEffect(() => {
    void updateTagCategories();
  }, [updateTagCategories]);

  useEffect(() => {
    if (categories.length > 0) {
      tryInitFromProps();
    }
  }, [categories.length, tryInitFromProps]);

  useEffect(() => {
    const oldVal = prevTriggerGenerateRef.current;
    if (triggerGenerate > oldVal && !locked && novelPlot) {
      didAutoFetchDefaultRef.current = true;
      setIsFetchingDefaultSelectedTags(true);
      setSelectedTags([]);
      setSynopsis("");
      void fetchDefaultSelectedTags();
    }
    prevTriggerGenerateRef.current = triggerGenerate;
  }, [triggerGenerate, locked, novelPlot, fetchDefaultSelectedTags]);

  useEffect(() => {
    if (didAutoFetchDefaultRef.current || selectedTagIds || locked || !novelPlot || categories.length === 0) return;
    didAutoFetchDefaultRef.current = true;
    setIsFetchingDefaultSelectedTags(true);
    void fetchDefaultSelectedTags();
  }, [selectedTagIds, locked, novelPlot, categories.length, fetchDefaultSelectedTags]);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (c) => !c.category.includes("章节") && !c.category.includes("chapter number")
      ),
    [categories]
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden p-[50px_260px_50px_0]">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {isFetchingDefaultSelectedTags ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50">
            <div className="rounded-md bg-white px-4 py-2 text-sm text-[#666] shadow-sm">加载中...</div>
          </div>
        ) : null}

        {visibleCategories.map((category, index) => (
          <div
            key={`${category.category}-${category.categoryId}`}
            className={cn("flex shrink-0 flex-col", index !== 0 && "pt-[clamp(8px,1.2vh,12px)]")}
          >
            <div className="mb-[clamp(8px,1.2vh,12px)] flex items-center">
              <div className="text-[22px] tracking-[0.88px]">
                {category.category}
                {category.max > 0 ? (
                  <span className="ml-[clamp(10px,1vw,14px)] text-[clamp(14px,1.6vw,18px)]">
                    <span className={cn(getSelectedCount(category.category) > 0 && "bg-gradient-to-r from-[#efaf00] to-[#ff9500] bg-clip-text font-bold text-transparent")}>
                      {getSelectedCount(category.category)}
                    </span>
                    /{category.max}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="m-0 flex w-full flex-wrap p-0">
              {category.tags.map((tag) => (
                <div key={String(tag.id)} className="relative mr-[clamp(6px,0.6vw,8px)] mb-[clamp(6px,0.8vh,8px)] shrink-0">
                  <Button
                    size="xs"
                    className={cn(
                      "tag-item h-[clamp(26px,3vh,30px)] rounded-[clamp(15px,1.5vw,18px)] px-[clamp(8px,0.8vw,10px)] text-[clamp(13px,1.3vw,15px)] font-normal text-[#4d4d4d]",
                      isTagSelected(Number(tag.id))
                        ? "border-none bg-gradient-to-r from-[#efaf00] to-[#ff9500] font-bold text-white"
                        : "border border-black/20 bg-transparent hover:border-black/30"
                    )}
                    disabled={locked}
                    onClick={() => toggleTag(category.categoryId, Number(tag.id), category.max)}
                  >
                    {tag.name}
                  </Button>
                  {String(tag.userId ?? "") !== "1" && !locked ? (
                    <div
                      className="iconfont absolute -top-1 -right-1 z-[1] flex h-[15px] w-[15px] cursor-pointer items-center justify-center rounded-full border border-(--border-color) bg-white text-[6px] leading-[15px] text-(--text-secondary) hover:border-(--theme-color) hover:text-(--theme-color)"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteTag(tag);
                      }}
                    >
                      &#xe633;
                    </div>
                  ) : null}
                </div>
              ))}

              {!locked ? (
                <>
                  {!isCustomInputVisible(category.categoryId) ? (
                    <Button
                      size="xs"
                      className="h-[clamp(26px,3vh,30px)] rounded-[clamp(15px,1.5vw,18px)] border border-black/20 bg-transparent px-[clamp(8px,0.8vw,10px)] text-[clamp(13px,1.3vw,15px)] font-normal text-[#4d4d4d] hover:border-black/30"
                      onClick={() => showCustomInput(category.categoryId)}
                    >
                      + 自定义
                    </Button>
                  ) : (
                    <input
                      ref={(el) => setCustomInputRef(category.categoryId, el)}
                      value={getCustomInputValue(category.categoryId)}
                      maxLength={MAX_CUSTOM_NAME_LEN}
                      placeholder="请输入自定义标签..."
                      className="mr-[clamp(6px,0.6vw,8px)] mb-[clamp(6px,0.8vh,8px)] h-[clamp(26px,3vh,30px)] min-w-[clamp(80px,8vw,100px)] rounded-[clamp(15px,1.5vw,18px)] border border-black/20 px-[clamp(8px,0.8vw,10px)] py-[clamp(3px,0.4vh,4px)] text-[clamp(13px,1.3vw,15px)] outline-none focus:border-(--theme-color)"
                      onChange={(e) => setCustomInputValue(category.categoryId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void confirmCustomTag(category.categoryId);
                        }
                      }}
                      onBlur={() => {
                        void confirmCustomTag(category.categoryId);
                      }}
                    />
                  )}
                </>
              ) : null}
            </div>

            {index !== visibleCategories.length - 1 ? (
              <div className="mt-[clamp(8px,1.2vh,12px)] h-px w-full bg-[#dedede]" />
            ) : null}
          </div>
        ))}

        {!locked ? (
          <div className="absolute right-0 bottom-0 z-10 flex justify-end p-0 m-0">
            <Button
              variant="quick-primary"
              size="quick-action"
              disabled={!hasSelectedTags}
              onClick={() => void handleConfirm()}
            >
              下一步
            </Button>
          </div>
        ) : null}

        {hasNextContent ? (
          <div className="absolute right-0 bottom-0 z-10 flex justify-end">
            <Button
              variant="quick-revert"
              size="quick-action-revert"
              className="bg-white"
              onClick={() => onRevertToCurrent?.()}
            >
              回退至故事标签
            </Button>
          </div>
        ) : null}
      </div>

      {/* 保持与 Vue 事件契约一致，留出回退事件入口 */}
      <span className="hidden" onClick={() => onRevert?.()} />
      <span className="hidden">
        <Iconfont unicode="&#xe633;" />
      </span>
      <span className="hidden">{description}</span>
    </div>
  );
};
