"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { getWritingTemplatesListReq } from "@/api/writing-templates"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { TemplateCardItem } from "../TemplateCardItem"
import type { Template } from "../types"

export interface CreateRecommendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateBlank?: () => void
  onCreateWithTags?: () => void
  onCreateTemplate?: (template: Template) => void
}

const fetchTemplates = async (): Promise<Template[]> => {
  const res: any = await getWritingTemplatesListReq(0, 10000)
  if (!Array.isArray(res?.content)) return []
  return res.content.map((item: any) => ({
    id: String(item.id),
    title: item.title || "",
    description: item.content || "",
    usageCount: item.numberOfUses || 0,
    tags:
      item.tags?.map((tag: any) => ({
        name: tag?.name,
        id: tag?.id,
        category: tag?.category,
      })) ?? [],
  }))
}

export const CreateRecommendDialog = ({
  open,
  onOpenChange,
  onCreateWithTags,
  onCreateTemplate,
}: CreateRecommendDialogProps) => {
  const [templates, setTemplates] = useState<Template[]>([])
  const hasFetchedForOpenRef = useRef(false)

  const loadTemplates = useCallback(async () => {
    try {
      const list = await fetchTemplates()
      setTemplates(list)
    } catch (error) {
      console.error("获取模板列表失败:", error)
    }
  }, [])

  // 与 Vue 一致：仅在 dialog 打开时请求一次，关闭时重置，避免重复请求
  useEffect(() => {
    if (open) {
      if (!hasFetchedForOpenRef.current) {
        hasFetchedForOpenRef.current = true
        loadTemplates()
      }
    } else {
      hasFetchedForOpenRef.current = false
    }
  }, [open, loadTemplates])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={clsx(
          "flex h-[80vh] w-full max-w-[95vw] flex-col gap-0 p-0 sm:w-[880px] sm:max-w-[880px]!",
          "left-1/2 top-[10vh] -translate-x-1/2 translate-y-0",
          "duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:slide-out-to-top-8 data-[state=open]:slide-in-from-top-8"
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-2 px-8 pt-5 pb-0">
          <DialogTitle className="text-xl font-semibold text-foreground">
            创作推荐
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 pb-6 pt-1">
          <div className="grid grid-cols-3 gap-[22px]">
            <button
              type="button"
              onClick={onCreateWithTags}
              className={clsx(
                "grid-item flex h-[190px] cursor-pointer flex-col items-center justify-center gap-0 rounded-[20px] border-2 border-border bg-background transition-all duration-300 hover:border-(--theme-color)"
              )}
            >
              <div
                className="flex h-14 w-14 items-center justify-center text-[40px] text-foreground"
                style={{ fontFamily: "iconfont" }}
              >
                &#xe60d;
              </div>
              <div className="text-xl font-medium text-foreground">创建作品</div>
            </button>
            {templates.map((template) => (
              <TemplateCardItem
                key={template.id}
                data={template}
                className="h-[190px]"
                onClick={onCreateTemplate}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
