"use client"

import React from "react"
import clsx from "clsx"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/Tooltip"
import { Button } from "@/components/ui/Button"
import type { Template } from "./types"

export interface TemplateCardItemProps {
  data: Template
  showCreate?: boolean
  onClick?: (template: Template) => void
  className?: string
}

export const TemplateCardItem = ({
  data,
  showCreate = false,
  onClick,
  className,
}: TemplateCardItemProps) => {
  const handleCreate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.(data)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(data)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.(data)
        }
      }}
      className={clsx(
        "group relative flex h-[190px] cursor-pointer flex-col gap-1 rounded-[20px] border-2 border-border bg-card p-3 transition-all duration-300 hover:border-(--theme-color)",
        className
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className="text-sm text-[#ff9800]"
          style={{ fontFamily: "iconfont" }}
        >
          &#xe608;
        </span>
        <span className="text-xs text-[#ff9800]">
          {data.usageCount || 0}
          {data?.usageCount ? "+" : ""}人已使用
        </span>
      </div>
      <div className="truncate text-base font-semibold leading-[22px] text-foreground">
        {data.title}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="line-clamp-4 min-h-[78px] text-xs leading-relaxed text-muted-foreground"
            style={{ wordBreak: "break-word" }}
          >
            {data.description || ""}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px]">
          {data.description}
        </TooltipContent>
      </Tooltip>
      <div className="mt-auto flex flex-wrap gap-2">
        {data.tags?.map((tag) => (
          <span
            key={tag.id}
            className="rounded-xl bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {tag.name}
          </span>
        ))}
      </div>
      {showCreate && (
        <Button
          type="button"
          size="sm"
          className="absolute bottom-3.5 right-2 hidden h-6 px-2.5 text-sm font-medium group-hover:block"
          onClick={handleCreate}
        >
          <span className="mr-1" style={{ fontFamily: "iconfont" }}>
            &#xe605;
          </span>
          立即创作
        </Button>
      )}
    </div>
  )
}
