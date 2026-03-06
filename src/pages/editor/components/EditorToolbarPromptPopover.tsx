import React, { useCallback, useEffect, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"
import { ScrollArea } from "@/components/ui/ScrollArea"
import IconFont from "@/components/IconFont/Iconfont"
import { getPromptsByCategoryId } from "@/api/community-prompt"
import type { PromptItem } from "@/components/Community/types"
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface EditorToolbarPromptPopoverProps {
  label: string
  icon: string
  categoryId: string
  onUse?: (item: PromptItem) => void
  onMore?: () => void
}

const getTagText = (item: PromptItem) => {
  if (item?.isOfficial) return "官方"
  if (item?.isFavorited) return "收藏"
  return ""
}

export const EditorToolbarPromptPopover = ({
  label,
  icon,
  categoryId,
  onUse,
  onMore,
}: EditorToolbarPromptPopoverProps) => {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<PromptItem[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")

  const fetchPrompts = useCallback(async () => {
    if (!categoryId) {
      setList([])
      return
    }
    setLoading(true)
    try {
      const response = (await getPromptsByCategoryId(categoryId)) as
        | PromptItem[]
        | { content?: PromptItem[]; data?: PromptItem[] }
      const prompts = Array.isArray(response)
        ? response
        : Array.isArray((response as any).content)
          ? (response as { content: PromptItem[] }).content
          : Array.isArray((response as any).data)
            ? (response as { data: PromptItem[] }).data
            : []
      setList(prompts)
    } catch (e) {
      console.error("获取提示词列表失败:", e)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    if (open) void fetchPrompts()
  }, [open, fetchPrompts])

  const filteredList = keyword
    ? list.filter(
        (item) =>
          item.name?.toLowerCase().includes(keyword.toLowerCase()) ||
          item.description?.toLowerCase().includes(keyword.toLowerCase())
      )
    : list

  const handleUse = useCallback(
    (item: PromptItem) => {
      setOpen(false)
      onUse?.(item)
    },
    [onUse]
  )

  const handleMore = useCallback(() => {
    setOpen(false)
    onMore?.()
  }, [onMore])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "inline-flex text-sm translate-y-0.5 cursor-pointer items-center border-b border-transparent pb-0.5 text-[#606266] transition-colors hover:text-black hover:[border-bottom-color:#000]",
            open && "border-black text-black"
          )}
          onClick={() => setOpen((v) => !v)}
        >
          <IconFont unicode={icon} className="mr-1 text-sm" />
          <span className="reference-btn-label">{label}</span>
          <IconFont unicode="\ueaa1" className="ml-1 text-sm" />
        </div>
      </PopoverTrigger>
      {/* w-[180px] 对齐 Vue 版 prompt-market-popover-popper 的 180px */}
      <PopoverContent align="center" sideOffset={8} className="w-[180px] overflow-hidden rounded-[20px] p-0 [box-shadow:0px_0px_.75rem_#0000001f]">
        <div className="flex w-full flex-col">
          {/* 搜索栏：padding 8px，gap 12px */}
          <div className="flex items-center gap-3 p-2">
            <div className="relative flex h-5 flex-1 items-center overflow-hidden rounded-lg border border-gray-200 px-2 focus-within:border-(--theme-color)">
              <input
                type="text"
                placeholder="搜索提示词市场"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-transparent text-[10px] outline-none placeholder:text-gray-400"
              />
              <IconFont unicode="\uea8c" className="shrink-0 text-[10px] text-gray-400" />
            </div>
            <div
              className="shrink-0 cursor-pointer text-[12px] text-(--theme-color) underline"
              onClick={handleMore}
            >
              更多
            </div>
          </div>

          {/* 列表区域 */}
          <div className="flex-1">
            {filteredList.length === 0 ? (
              <div className="flex h-[78px] items-center justify-center pb-2 text-sm text-gray-400">
                {loading ? "加载中..." : "暂无数据"}
              </div>
            ) : (
              <ScrollArea className="max-h-[350px]">
                <div className="px-2 pb-2 pt-1">
                  {filteredList.map((item, index) => (
                    <div
                      key={item.id ?? index}
                      className="group relative mb-1.5 min-w-0 cursor-pointer overflow-hidden rounded border border-(--el-border-color-light,#e4e7ed) bg-white px-2.5 py-1.5 transition-all last:mb-0 hover:border-[var(--theme-color)]"
                    >
                      {/* 角标：绝对定位旋转45度三角形 */}
                      {(item.isOfficial || item.isFavorited) && (
                        <div
                          className="absolute right-[-20px] top-[-20px] flex h-10 w-10 rotate-45 items-end justify-center bg-(--el-color-warning,#e6a23c) pb-0.5"
                          aria-label={getTagText(item)}
                        >
                          <span className="text-[10px] leading-none text-white">
                            {getTagText(item)}
                          </span>
                        </div>
                      )}

                      {/* 标题 */}
                      <div className="min-w-0 break-all text-[14px] font-semibold leading-4 text-(--el-text-color-primary,#303133)">
                        {item.name}
                      </div>

                      {/* 描述：3行截断，固定最小高度 */}
                      <div
                        className="mt-1 min-w-0 overflow-hidden break-all text-[10px] leading-[14px] text-(--el-text-color-regular,#606266)"
                        style={{
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 3,
                          minHeight: "42px",
                        }}
                      >
                        {item.description}
                      </div>

                      {/* 使用按钮：默认隐藏，hover 显示，绝对定位右下角 */}
                      <Button
                        className="absolute bottom-1 px-2 right-2 h-5 leading-5 text-xs text-white"
                        onClick={() => handleUse(item)}
                      >
                        使用 →
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
