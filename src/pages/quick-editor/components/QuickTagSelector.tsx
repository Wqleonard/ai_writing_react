import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addCustomTagReq, delCustomTagReq, getWorkTagsReq, updateWorkInfoReq } from "@/api/works";

type TagItem = {
  id: string | number;
  name: string;
  isOfficial?: boolean;
  userId?: string | number;
};

type TagCategoryDataItem = {
  category: string;
  categoryId: string;
  max: number;
  tags: TagItem[];
};

type CustomInputState = {
  visible: boolean;
  value: string;
};

type ConfirmPayload = {
  tagIds: string;
  chapterNum: number;
  wordNum: number;
};

type Props = {
  workId?: string;
  selectedTagIds?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  initialChapterNum?: number;
  initialWordNum?: number;
  onConfirm: (data: ConfirmPayload) => void;
  onRevert: () => void;
  onRevertToCurrent: () => void;
};

const normalizeTagId = (id: string | number) => String(id);

const extractNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (value.trim() === "") return null;
  const digits = value.match(/\d+/g);
  if (!digits?.length) return null;
  const next = Number.parseInt(digits.join(""), 10);
  return Number.isNaN(next) ? null : next;
};

const correctWordNum = (value: number | null | undefined): number => {
  if (value === null || value === undefined) return 800;
  if (value < 100) return 100;
  if (value > 5000) return 5000;
  return value;
};

export const QuickTagSelector = ({
  workId,
  selectedTagIds = "",
  locked = false,
  hasNextContent = false,
  initialChapterNum = 10,
  initialWordNum = 800,
  onConfirm,
  onRevert,
  onRevertToCurrent,
}: Props) => {
  const [categories, setCategories] = useState<TagCategoryDataItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [chapterNum, setChapterNum] = useState(initialChapterNum);
  const [wordNum, setWordNum] = useState<number | string>(initialWordNum);
  const [customInputMap, setCustomInputMap] = useState<Record<string, CustomInputState>>({});
  const customInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const wordNumCorrectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmCustomTagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasSelectedTags = selectedTags.length > 0;

  const updateTagCategories = useCallback(async () => {
    try {
      const response: any = await getWorkTagsReq();
      if (!Array.isArray(response)) {
        setCategories([]);
        return;
      }
      const next = response
        .filter(
          (group: { category?: string }) =>
            !String(group.category ?? "").includes("章节") &&
            !String(group.category ?? "").toLowerCase().includes("chapter number"),
        )
        .map(
          (group: {
            category: string;
            categoryId: number | string;
            max: number;
            tags: TagItem[];
          }) => ({
            category: group.category,
            categoryId: String(group.categoryId),
            max: group.max,
            tags: (group.tags ?? []).map((tag) => ({
              ...tag,
            })),
          }),
        );
      setCategories(next);
    } catch (error) {
      setCategories([]);
      console.error("获取标签数据失败:", error);
    }
  }, []);

  const initSelectedTags = useCallback(() => {
    if (!selectedTagIds) {
      setSelectedTags([]);
      return;
    }
    const ids = selectedTagIds
      .split(",")
      .map((item) => Number.parseInt(item.trim(), 10))
      .filter((item) => !Number.isNaN(item));
    const found: TagItem[] = [];
    for (const category of categories) {
      for (const tag of category.tags) {
        if (ids.includes(Number(tag.id))) found.push(tag);
      }
    }
    setSelectedTags(found);
  }, [categories, selectedTagIds]);

  useEffect(() => {
    void updateTagCategories();
  }, [updateTagCategories]);

  useEffect(() => {
    setChapterNum(initialChapterNum || 10);
    setWordNum(initialWordNum || 800);
  }, [initialChapterNum, initialWordNum]);

  useEffect(() => {
    if (categories.length > 0) initSelectedTags();
  }, [categories, initSelectedTags]);

  useEffect(() => {
    return () => {
      if (wordNumCorrectionTimer.current) clearTimeout(wordNumCorrectionTimer.current);
      if (confirmCustomTagTimer.current) clearTimeout(confirmCustomTagTimer.current);
    };
  }, []);

  const getSelectedCount = useCallback(
    (categoryName: string) => {
      const category = categories.find((cat) => cat.category === categoryName);
      if (!category) return 0;
      const categoryTagIds = new Set(category.tags.map((tag) => normalizeTagId(tag.id)));
      return selectedTags.filter((tag) => categoryTagIds.has(normalizeTagId(tag.id))).length;
    },
    [categories, selectedTags],
  );

  const isTagSelected = useCallback(
    (tagId: string | number) =>
      selectedTags.some((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId)),
    [selectedTags],
  );

  const toggleTag = useCallback(
    (categoryId: string, tagId: string | number, maxSelect: number) => {
      if (locked) return;
      const category = categories.find((cat) => cat.categoryId === categoryId);
      if (!category) return;
      const target = category.tags.find((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId));
      if (!target) return;

      const next = [...selectedTags];
      const index = next.findIndex((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId));
      if (index > -1) {
        next.splice(index, 1);
        setSelectedTags(next);
        return;
      }

      const categoryTagIds = new Set(category.tags.map((tag) => normalizeTagId(tag.id)));
      const currentSelectedCount = next.filter((tag) => categoryTagIds.has(normalizeTagId(tag.id))).length;
      if (maxSelect !== 0 && currentSelectedCount >= maxSelect) {
        for (let i = next.length - 1; i >= 0; i--) {
          if (categoryTagIds.has(normalizeTagId(next[i].id))) {
            next.splice(i, 1);
            break;
          }
        }
      }
      next.push(target);
      setSelectedTags(next);
    },
    [categories, locked, selectedTags],
  );

  const showCustomInput = useCallback(
    (categoryId: string) => {
      if (locked) return;
      setCustomInputMap((prev) => ({
        ...prev,
        [categoryId]: { visible: true, value: prev[categoryId]?.value ?? "" },
      }));
      setTimeout(() => {
        const el = customInputRefs.current[categoryId];
        if (!el) return;
        el.focus();
        el.select();
      }, 0);
    },
    [locked],
  );

  const hideCustomInput = useCallback((categoryId: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: false, value: "" },
    }));
  }, []);

  const isCustomInputVisible = useCallback(
    (categoryId: string) => !!customInputMap[categoryId]?.visible,
    [customInputMap],
  );

  const getCustomInputValue = useCallback(
    (categoryId: string) => customInputMap[categoryId]?.value ?? "",
    [customInputMap],
  );

  const setCustomInputValue = useCallback((categoryId: string, value: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: true, value },
    }));
  }, []);

  const addCustomTag = useCallback(async (categoryId: string, tagName: string) => {
    await addCustomTagReq(categoryId, tagName);
  }, []);

  const confirmCustomTag = useCallback(
    (categoryId: string) => {
      if (confirmCustomTagTimer.current) clearTimeout(confirmCustomTagTimer.current);
      confirmCustomTagTimer.current = setTimeout(async () => {
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
        const existed = category.tags.some((tag) => tag.name === name);
        if (existed) {
          toast.warning("该标签已存在");
          hideCustomInput(categoryId);
          return;
        }
        try {
          await addCustomTag(categoryId, name);
          hideCustomInput(categoryId);
          await updateTagCategories();
        } catch (error) {
          console.error(error);
        }
      }, 300);
    },
    [addCustomTag, categories, getCustomInputValue, hideCustomInput, updateTagCategories],
  );

  const handleDeleteTag = useCallback(
    async (tag: TagItem) => {
      if (locked) return;
      try {
        await delCustomTagReq(String(tag.id));
        setSelectedTags((prev) => prev.filter((item) => normalizeTagId(item.id) !== normalizeTagId(tag.id)));
        await updateTagCategories();
      } catch (error) {
        console.error(error);
      }
    },
    [locked, updateTagCategories],
  );

  const handleWordNumInput = useCallback((value: string) => {
    if (wordNumCorrectionTimer.current) clearTimeout(wordNumCorrectionTimer.current);
    if (value === "") {
      setWordNum("");
      return;
    }
    setWordNum(value);
    const num = extractNumber(value);
    wordNumCorrectionTimer.current = setTimeout(() => {
      setWordNum(correctWordNum(num));
      wordNumCorrectionTimer.current = null;
    }, 1000);
  }, []);

  const handleWordNumBlur = useCallback(() => {
    if (wordNumCorrectionTimer.current) {
      clearTimeout(wordNumCorrectionTimer.current);
      wordNumCorrectionTimer.current = null;
    }
    setWordNum(correctWordNum(extractNumber(wordNum)));
  }, [wordNum]);

  const handleConfirm = useCallback(async () => {
    if (locked) return;
    try {
      const selectedTagIds = selectedTags.map((tag) => tag.id);
      const correctedWordNum = correctWordNum(extractNumber(wordNum));
      setWordNum(correctedWordNum);
      if (workId) {
        await updateWorkInfoReq(workId, {
          tagIds: selectedTagIds,
          chapterNum,
          wordNum: correctedWordNum,
        } as any);
      }
      onConfirm({
        tagIds: selectedTagIds.map((id) => String(id)).join(","),
        chapterNum,
        wordNum: correctedWordNum,
      });
    } catch (error) {
      console.error(error);
      toast.error("保存失败,请稍后重试");
    }
  }, [chapterNum, locked, onConfirm, selectedTags, wordNum, workId]);

  const chapterPercent = useMemo(() => ((chapterNum - 1) / 19) * 100, [chapterNum]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden pr-[120px] pb-[50px] py-5 px-4">
      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[rgba(0,0,0,0.1)]">
        {categories.map((category, index) => (
          <div key={`${category.category}-${category.categoryId}`} className={`${index > 0 ? "pt-[clamp(8px,1.2vh,12px)]" : ""}`}>
            <div className="mb-[clamp(8px,1.2vh,12px)] flex items-start">
              <div className="flex flex-wrap items-baseline text-[clamp(14px,1.6vw,18px)] leading-[1.32em] tracking-[0.04em] text-black">
                {category.category}
                {category.max > 0 && (
                  <span className="ml-[clamp(10px,1vw,14px)]">
                    <span
                      className={
                        getSelectedCount(category.category) > 0
                          ? "bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text font-bold text-transparent"
                          : ""
                      }
                    >
                      {getSelectedCount(category.category)}
                    </span>
                    /{category.max}
                  </span>
                )}
              </div>
            </div>

            <div className="flex w-full flex-wrap">
              {category.tags.map((tag) => {
                const selected = isTagSelected(tag.id);
                const canDelete = String(tag.userId ?? "1") !== "1" && !locked;
                return (
                  <div key={normalizeTagId(tag.id)} className="relative mr-[clamp(6px,0.6vw,8px)] mb-[clamp(6px,0.8vh,8px)] shrink-0">
                    <button
                      type="button"
                      disabled={locked}
                      className={`h-[clamp(26px,3vh,30px)] rounded-[clamp(15px,1.5vw,18px)] px-[clamp(8px,0.8vw,10px)] text-[clamp(13px,1.3vw,15px)] leading-none tracking-[0.04em] transition ${
                        selected
                          ? "bg-linear-to-r from-[#efaf00] to-[#ff9500] font-bold text-white"
                          : "border border-[rgba(0,0,0,0.2)] text-[#4d4d4d] hover:border-[rgba(0,0,0,0.3)]"
                      } ${locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      onClick={() => toggleTag(category.categoryId, tag.id, category.max)}
                    >
                      {tag.name}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        className="absolute -top-1 -right-1 z-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-(--border-color) bg-white text-[8px] text-(--text-secondary) hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteTag(tag);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}

              {!locked && !isCustomInputVisible(category.categoryId) && (
                <button
                  type="button"
                  className="mr-[clamp(6px,0.6vw,8px)] mb-[clamp(6px,0.8vh,8px)] h-[clamp(26px,3vh,30px)] rounded-[clamp(15px,1.5vw,18px)] border border-[rgba(0,0,0,0.2)] px-[clamp(8px,0.8vw,10px)] text-[clamp(13px,1.3vw,15px)] text-[#4d4d4d] hover:border-[rgba(0,0,0,0.3)]"
                  onClick={() => showCustomInput(category.categoryId)}
                >
                  + 自定义
                </button>
              )}

              {!locked && isCustomInputVisible(category.categoryId) && (
                <input
                  ref={(el) => {
                    customInputRefs.current[category.categoryId] = el;
                  }}
                  value={getCustomInputValue(category.categoryId)}
                  maxLength={6}
                  placeholder="请输入自定义标签..."
                  className="mr-[clamp(6px,0.6vw,8px)] mb-[clamp(6px,0.8vh,8px)] h-[clamp(26px,3vh,30px)] min-w-[clamp(80px,8vw,100px)] rounded-[clamp(15px,1.5vw,18px)] border border-[rgba(0,0,0,0.2)] px-[clamp(8px,0.8vw,10px)] text-[clamp(13px,1.3vw,15px)] outline-none focus:border-black"
                  onChange={(e) => setCustomInputValue(category.categoryId, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    confirmCustomTag(category.categoryId);
                  }}
                  onBlur={() => confirmCustomTag(category.categoryId)}
                />
              )}
            </div>
            {index !== categories.length - 1 && <div className="mt-[clamp(8px,1.2vh,12px)] h-px w-[90%] bg-[#dedede]" />}
          </div>
        ))}

        <div className="pt-[clamp(8px,1.2vh,12px)]">
          <div className="mb-[clamp(8px,1.2vh,12px)] text-[clamp(14px,1.6vw,18px)] tracking-[0.04em] text-black">
            故事有多少章节数？
          </div>
          <div className="ml-[clamp(5px,0.8vw,10px)]">
            <div className="relative h-[clamp(45px,5.5vh,55px)] w-[clamp(320px,30vw,400px)]">
              <div
                className="pointer-events-none absolute top-[2px] z-10 flex h-[clamp(24px,3vh,30px)] w-[clamp(42px,4.8vw,52px)] -translate-x-1/2 items-center justify-center rounded-md bg-white shadow"
                style={{ left: `${chapterPercent}%` }}
              >
                <span className="mb-[clamp(4px,0.5vh,5px)] bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text text-[clamp(10px,1.1vw,12px)] font-bold text-transparent">
                  {chapterNum}章
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20}
                value={chapterNum}
                disabled={locked}
                className="absolute top-[clamp(32px,3.8vh,38px)] left-[clamp(16px,1.6vw,20px)] h-[clamp(11px,1.1vh,11px)] w-[clamp(280px,26vw,350px)] cursor-pointer appearance-none rounded-full bg-[rgba(255,149,0,0.3)] disabled:cursor-not-allowed [&::-webkit-slider-runnable-track]:h-[11px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#ff9500] [&::-webkit-slider-thumb]:bg-white"
                onChange={(e) => setChapterNum(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="pt-[clamp(8px,1.2vh,12px)]">
          <div className="mb-[clamp(8px,1.2vh,12px)] text-[clamp(14px,1.6vw,18px)] tracking-[0.04em] text-black">
            每章节字数大约为？
          </div>
          <input
            value={wordNum}
            disabled={locked}
            placeholder="请输入字数"
            className="h-[clamp(36px,4.2vh,42px)] w-[clamp(150px,16vw,180px)] rounded-[clamp(6px,0.8vw,8px)] border border-[#d9d9d9] bg-white px-[clamp(10px,1vw,12px)] text-[clamp(14px,1.5vw,17px)] text-black outline-none placeholder:text-[#b3b3b3] focus:border-black disabled:cursor-not-allowed disabled:text-[#b3b3b3]"
            onChange={(e) => handleWordNumInput(e.target.value)}
            onBlur={handleWordNumBlur}
          />
        </div>
      </div>

      {!locked && (
        <div className="absolute right-0 bottom-0 z-10 flex justify-end">
          <button
            type="button"
            disabled={!hasSelectedTags}
            className="h-[46px] w-[200px] rounded-lg bg-linear-to-r from-[#efaf00] to-[#ff9500] text-2xl leading-[1.32em] font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleConfirm()}
          >
            下一步
          </button>
        </div>
      )}

      {hasNextContent && (
        <div className="absolute right-0 bottom-0 z-10 flex justify-end">
          <button
            type="button"
            className="h-[46px] w-[230px] rounded-lg border-2 border-[#999] bg-white px-0 py-[6px] text-2xl leading-[1.32em] font-normal text-[#999] shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition hover:-translate-y-0.5 hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
            onClick={onRevertToCurrent}
          >
            回退至故事标签
          </button>
        </div>
      )}
    </div>
  );
};

export default QuickTagSelector;
