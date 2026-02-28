"use client"

import React, { useCallback, useState } from "react"
import clsx from "clsx"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import { WorkspaceHeader } from "@/layout/WorkspaceLayout/WorkspaceHeader"
import IconFont from "@/components/IconFont/Iconfont"
import { EditorToolbarPromptPopover } from "./EditorToolbarPromptPopover"
import { UsePrompts } from "@/components/Community/UsePrompts"
import { WritingStyleDialog } from "@/components/Community/WritingStyleDialog"
import { BookAnalysisDialog } from "@/components/Community/BookAnalysisDialog"
import type { PromptItem } from "@/components/Community/types"

dayjs.extend(utc)

const PROMPT_ITEMS = [
  { label: "故事设定", icon: "\ue627", categoryId: "4" },
  { label: "角色", icon: "\ue626", categoryId: "3" },
  { label: "大纲", icon: "\ue62f", categoryId: "2" },
  { label: "导语", icon: "\ue623", categoryId: "1" },
  { label: "正文", icon: "\ue624", categoryId: "5" },
] as const

export interface EditorTopToolbarProps {
  onBackClick?: () => void
  onSaveClick?: () => void
  onHelpWriteClick?: () => void
  onUpdateTitle?: (newTitle: string) => void
  updatedTime?: number | string
  className?: string
}

export const EditorTopToolbar = ({
  onBackClick,
  onSaveClick,
  onHelpWriteClick,
  onUpdateTitle,
  updatedTime,
  className,
}: EditorTopToolbarProps) => {
  const saveTimeText =
    updatedTime !== null
      ? dayjs.utc(updatedTime).local().format("HH:mm:ss")
      : null

  const [usePromptsOpen, setUsePromptsOpen] = useState(false)
  const [usePromptsData, setUsePromptsData] = useState<PromptItem | null>(null)
  const [openMarketDirectly, setOpenMarketDirectly] = useState(false)
  const [writingStyleDialogOpen, setWritingStyleDialogOpen] = useState(false)
  const [bookAnalysisDialogOpen, setBookAnalysisDialogOpen] = useState(false)

  const handlePromptUse = useCallback((item: PromptItem) => {
    setUsePromptsData(item)
    setOpenMarketDirectly(false)
    setUsePromptsOpen(true)
  }, [])

  const handlePromptMore = useCallback(() => {
    setUsePromptsData(null)
    setOpenMarketDirectly(true)
    setUsePromptsOpen(true)
  }, [])

  const handleBookAnalysisClick = useCallback(() => {
    setBookAnalysisDialogOpen(true)
  }, [])

  const handleWritingStyleClick = useCallback(() => {
    setWritingStyleDialogOpen(true)
  }, [])

  return (
    <div
      className={clsx(
        "editor-top-toolbar flex h-14 w-full shrink-0 flex-row items-center justify-between bg-[var(--bg-editor)] px-7",
        className
      )}
    >
      <div className="top-toolbar-left flex h-[30px] items-center">
        <div
          className="flex cursor-pointer items-center text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]"
          onClick={onBackClick}
        >
          <IconFont unicode="\ue62a" className="mr-2 text-sm" />
          <span>返回</span>
        </div>
        <span className="divider mx-2 select-none text-base text-[var(--border-color)]">
          |
        </span>
        <div
          className="cursor-pointer text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]"
          onClick={onSaveClick}
        >
          保存
        </div>
        {saveTimeText != null && (
          <div className="ml-2 flex items-center text-sm text-[#adb5bd]">
            <IconFont unicode="\ue619" className="mr-1" />
            <span>保存于{saveTimeText}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {PROMPT_ITEMS.map(({ label, icon, categoryId }) => (
          <EditorToolbarPromptPopover
            key={categoryId}
            label={label}
            icon={icon}
            categoryId={categoryId}
            onUse={handlePromptUse}
            onMore={handlePromptMore}
          />
        ))}

        <div
          className="text-sm inline-flex translate-y-0.5 cursor-pointer items-center border-b border-transparent pb-0.5 text-[#606266] hover:border-black hover:text-black"
          onClick={handleBookAnalysisClick}
        >
          <IconFont unicode="\ue622" className="mr-1" />
          <span className="reference-btn-label">拆书仿写</span>
        </div>

        <div
          className="text-sm inline-flex translate-y-0.5 cursor-pointer items-center border-b border-transparent pb-0.5 text-[#606266] hover:border-black hover:text-black"
          onClick={handleWritingStyleClick}
        >
          <IconFont unicode="\ue630" className="mr-1" />
          <span className="reference-btn-label">文风提炼</span>
        </div>

        <div
          className="text-sm flex cursor-pointer items-center rounded-lg bg-(--theme-color) px-3 h-6 leading-6 custom-btn text-white"
          onClick={onHelpWriteClick}
        >
          <IconFont unicode="\ue63c" className="mr-1" />
          <span>带你写</span>
        </div>
      </div>

      <div className="top-toolbar-right flex items-center gap-1">
        <WorkspaceHeader />
      </div>

      <UsePrompts
        open={usePromptsOpen}
        onOpenChange={setUsePromptsOpen}
        data={usePromptsData}
        openMarketDirectly={openMarketDirectly}
      />

      <WritingStyleDialog
        open={writingStyleDialogOpen}
        onClose={() => setWritingStyleDialogOpen(false)}
      />

      <BookAnalysisDialog
        open={bookAnalysisDialogOpen}
        onClose={() => setBookAnalysisDialogOpen(false)}
      />
    </div>
  )
}
