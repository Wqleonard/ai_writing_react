"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import clsx from "clsx"
import IconFont from "@/components/IconFont/Iconfont"

export interface RecommendItem {
  label: string
  value: string
}

export interface FormRecommendLabelProps {
  label: string
  required?: boolean
  recommends?: RecommendItem[]
  fieldKey: string
  onSelect?: (key: string, value: string) => void
  className?: string
}

/**
 * 表单字段标题 + 推荐词快捷填入（与 Vue FormRecommendLabel 对齐）
 * 含「推荐：」前缀、横向滚动、左右箭头、隐藏滚动条
 */
export const FormRecommendLabel = React.forwardRef<
  HTMLDivElement,
  FormRecommendLabelProps
>(function FormRecommendLabel(
  { label, required = false, recommends = [], fieldKey, onSelect, className },
  ref
) {
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkOverflow = useCallback(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScrollLeft = scrollWidth - clientWidth
    setShowLeftArrow(scrollLeft > 2)
    setShowRightArrow(maxScrollLeft - scrollLeft > 2)
  }, [])

  useEffect(() => {
    checkOverflow()
  }, [recommends, checkOverflow])

  const handleScroll = useCallback(() => {
    checkOverflow()
  }, [checkOverflow])

  const handleScrollLeft = useCallback(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    el.scrollBy({ left: -el.clientWidth * 0.8, behavior: "smooth" })
  }, [])

  const handleScrollRight = useCallback(() => {
    const el = scrollWrapperRef.current
    if (!el) return
    el.scrollBy({ left: el.clientWidth * 0.8, behavior: "smooth" })
  }, [])

  const handleTagClick = useCallback(
    (item: RecommendItem) => {
      onSelect?.(fieldKey, item.value)
    },
    [fieldKey, onSelect]
  )

  return (
    <div
      ref={ref}
      className={clsx(
        "recommend-label flex w-full items-center text-[18px] leading-[22px]",
        className
      )}
    >
      <span
        className={clsx(
          "main-label shrink-0 pr-3 text-[20px] text-black",
          required && "relative"
        )}
      >
        {label}
        {required && (
          <span
            className="absolute right-0 top-0 text-[14px] leading-none text-[var(--el-color-danger)]"
            style={{ transform: "translate(-50%, -20%)" }}
          >
            *
          </span>
        )}
      </span>

      <div className="recommend-prefix shrink-0 text-sm text-[#999]">
        推荐：
      </div>

      <div className="tags-scroll-layout relative flex min-w-0 flex-1 items-center px-5">
        {showLeftArrow && (
          <div
            role="button"
            tabIndex={0}
            className="arrow-btn arrow-left absolute left-0 flex h-full cursor-pointer items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              handleScrollLeft()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleScrollLeft()
              }
            }}
          >
            <IconFont unicode="\ueaa2" className="text-base" />
          </div>
        )}

        <div
          ref={scrollWrapperRef}
          className="tags-scroll flex h-5 flex-1 items-center overflow-x-auto whitespace-nowrap"
          onScroll={handleScroll}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {recommends.map((item) => (
            <div
              key={item.value}
              role="button"
              tabIndex={0}
              className="tag-item inline-block mr-2 h-full cursor-pointer rounded-full bg-[#f9eece] px-2 text-xs leading-5 transition-colors hover:bg-[#fff7e0]"
              onClick={() => handleTagClick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleTagClick(item)
                }
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {showRightArrow && (
          <div
            role="button"
            tabIndex={0}
            className="arrow-btn arrow-right absolute right-0 flex h-full cursor-pointer items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              handleScrollRight()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleScrollRight()
              }
            }}
          >
            <IconFont unicode="\ueaa5" className="text-base" />
          </div>
        )}
      </div>
    </div>
  )
})
