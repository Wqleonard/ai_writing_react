import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { debounce } from "lodash-es"
import { toast } from "sonner"
import IconFont from "@/components/IconFont/Iconfont"
import { addCustomTagReq, delCustomTagReq, getWorkTagsReq } from "@/api/works"
import type { Tag } from "../types"

export interface TagCategoryDataItem {
  category: string
  categoryId: string
  max: number
  tags: Tag[]
}

interface CustomInputState {
  visible: boolean
  value: string
}

interface TagSelectorProps {
  categories: TagCategoryDataItem[]
  updateTagCategories: () => void
  selectedTags: Tag[]
  onSelectedTagsChange: (tags: Tag[]) => void
  onCategoriesChange?: (categories: TagCategoryDataItem[]) => void
}

const normalizeTagId = (tagId: string | number) => String(tagId)

export const TagSelector = ({
  categories,
  updateTagCategories,
  selectedTags,
  onSelectedTagsChange,
}: TagSelectorProps) => {
  const [customInputMap, setCustomInputMap] = useState<Record<string, CustomInputState>>({})
  const customInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const setCustomInputRef = useCallback((categoryId: string, input: HTMLInputElement | null) => {
    customInputRefs.current[categoryId] = input
  }, [])

  const isCustomInputVisible = useCallback(
    (categoryId: string) => !!customInputMap[categoryId]?.visible,
    [customInputMap]
  )

  const getCustomInputValue = useCallback(
    (categoryId: string) => customInputMap[categoryId]?.value ?? "",
    [customInputMap]
  )

  const showCustomInput = useCallback((categoryId: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: true, value: prev[categoryId]?.value ?? "" },
    }))
    setTimeout(() => {
      const input = customInputRefs.current[categoryId]
      if (input) {
        input.focus()
        input.select()
      }
    }, 0)
  }, [])

  const hideCustomInput = useCallback((categoryId: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: false, value: "" },
    }))
  }, [])

  const setCustomInputValue = useCallback((categoryId: string, value: string) => {
    setCustomInputMap((prev) => ({
      ...prev,
      [categoryId]: { visible: true, value },
    }))
  }, [])

  const addCustomTag = useMemo(
    () =>
      debounce(
        async (categoryId: string, tagName: string) => {
          await addCustomTagReq(categoryId, tagName)
        },
        500,
        { leading: true, trailing: false }
      ),
    []
  )

  useEffect(() => {
    return () => addCustomTag.cancel()
  }, [addCustomTag])

  useEffect(() => {
    if (selectedTags.length > 0 || categories.length === 0) return
    const chapterCategory = categories.find((item) => item.category.includes("章"))
    if (!chapterCategory) return
    const defaultChapterTag = chapterCategory.tags.find((tag) => tag.name.includes("10"))
    if (defaultChapterTag) {
      onSelectedTagsChange([defaultChapterTag])
    }
  }, [categories, onSelectedTagsChange, selectedTags.length])

  const getSelectedCount = useCallback(
    (category: TagCategoryDataItem) => {
      const tagIds = new Set(category.tags.map((tag) => normalizeTagId(tag.id)))
      return selectedTags.filter((tag) => tagIds.has(normalizeTagId(tag.id))).length
    },
    [selectedTags]
  )

  const isTagSelected = useCallback(
    (tagId: string | number) => selectedTags.some((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId)),
    [selectedTags]
  )

  const toggleTag = useCallback(
    (categoryId: string, tagId: string | number, maxSelect: number) => {
      const category = categories.find((cat) => cat.categoryId === categoryId)
      if (!category) return

      const target = category.tags.find((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId))
      if (!target) return

      const nextSelected = [...selectedTags]
      const selectedIndex = nextSelected.findIndex((tag) => normalizeTagId(tag.id) === normalizeTagId(tagId))

      if (selectedIndex > -1) {
        nextSelected.splice(selectedIndex, 1)
        onSelectedTagsChange(nextSelected)
        return
      }

      const categoryTagIds = new Set(category.tags.map((tag) => normalizeTagId(tag.id)))
      const currentSelectedCount = nextSelected.filter((tag) => categoryTagIds.has(normalizeTagId(tag.id))).length

      if (maxSelect !== 0 && currentSelectedCount >= maxSelect) {
        let lastIndex = -1
        for (let i = nextSelected.length - 1; i >= 0; i--) {
          if (categoryTagIds.has(normalizeTagId(nextSelected[i].id))) {
            lastIndex = i
            break
          }
        }
        if (lastIndex > -1) nextSelected.splice(lastIndex, 1)
      }

      nextSelected.push(target)
      onSelectedTagsChange(nextSelected)
    },
    [categories, onSelectedTagsChange, selectedTags]
  )

  const confirmCustomTag = useCallback(
    async (categoryId: string) => {
      const name = getCustomInputValue(categoryId).trim()
      if (!name) {
        hideCustomInput(categoryId)
        return
      }

      const category = categories.find((cat) => cat.categoryId === categoryId)
      if (!category) {
        hideCustomInput(categoryId)
        return
      }

      const existed = category.tags.some((tag) => tag.name === name)
      if (existed) {
        toast.warning("该标签已存在")
        hideCustomInput(categoryId)
        return
      }

      try {
        await addCustomTag(categoryId, name)
        hideCustomInput(categoryId)
        await updateTagCategories()
      } catch (error) {
        console.error(error)
      }
    },
    [addCustomTag, categories, getCustomInputValue, hideCustomInput, updateTagCategories]
  )

  const handleDeleteTag = useCallback(
    async (tag: Tag) => {
      try {
        await delCustomTagReq(String(tag.id))
        onSelectedTagsChange(selectedTags.filter((item) => normalizeTagId(item.id) !== normalizeTagId(tag.id)))
        await updateTagCategories()
      } catch (error) {
        console.error(error)
      }
    },
    [onSelectedTagsChange, selectedTags, updateTagCategories]
  )

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {categories.map((category) => (
        <div
          key={`${category.category}-${category.categoryId}`}
          className="mb-[18px] last:mb-0"
        >
          <div className="mb-3 flex items-baseline gap-2.5">
            <div className="text-base font-semibold text-(--text-primary)">{category.category}</div>
            {category.max > 0 && (
              <div className="text-sm text-(--text-muted)">
                <span
                  className={getSelectedCount(category) > 0 ? "font-semibold text-(--bg-editor-save)" : undefined}
                >
                  {getSelectedCount(category)}
                </span>
                <span>/{category.max}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {category.tags.map((tag) => {
              const selected = isTagSelected(tag.id)
              return (
                <div key={normalizeTagId(tag.id)} className="relative">
                  <button
                    type="button"
                    className={
                      selected
                        ? "cursor-pointer h-[25px] rounded-md border border-(--theme-color) bg-(--theme-color) px-1.5 text-xs text-white transition"
                        : "cursor-pointer h-[25px] rounded-md border border-gray-300 bg-white px-1.5 text-xs text-(--text-primary) transition hover:border-(--theme-color) hover:text-(--theme-color)"
                    }
                    onClick={() => toggleTag(category.categoryId, tag.id, category.max)}
                  >
                    {tag.name}
                  </button>

                  {!tag.isOfficial && (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border border-(--border-color) bg-white text-[5px] leading-none text-(--text-secondary) transition hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDeleteTag(tag)
                      }}
                    >
                      <IconFont unicode="&#xe633;" />
                    </button>
                  )}
                </div>
              )
            })}

            {category.category !== "章节数" && !isCustomInputVisible(category.categoryId) && (
              <button
                type="button"
                className="h-[25px] rounded-md border border-dashed border-gray-300 bg-transparent px-1.5 text-xs text-(--text-secondary) transition hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
                onClick={() => showCustomInput(category.categoryId)}
              >
                + 自定义
              </button>
            )}

            {category.category !== "章节数" && isCustomInputVisible(category.categoryId) && (
              <input
                ref={(node) => setCustomInputRef(category.categoryId, node)}
                value={getCustomInputValue(category.categoryId)}
                maxLength={6}
                placeholder="请输入自定义标签..."
                className="h-[25px] w-[120px] rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-(--theme-color)"
                onChange={(e) => setCustomInputValue(category.categoryId, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    void confirmCustomTag(category.categoryId)
                  }
                }}
                onBlur={() => {
                  void confirmCustomTag(category.categoryId)
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
