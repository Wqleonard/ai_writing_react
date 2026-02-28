"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  VisuallyHidden,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"

export interface StepConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel?: () => void
  onSaveToCurrent?: () => void
  onSaveToNew?: () => void
}

export const StepConfirmDialog = ({
  open,
  onOpenChange,
  onCancel,
  onSaveToCurrent,
  onSaveToNew,
}: StepConfirmDialogProps) => {
  const handleCancel = () => {
    onOpenChange(false)
    onCancel?.()
  }

  const handleSaveToCurrent = () => {
    onOpenChange(false)
    onSaveToCurrent?.()
  }

  const handleSaveToNew = () => {
    onOpenChange(false)
    onSaveToNew?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[370px] rounded-[10px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>是否保存至当前作品？</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col justify-center pb-5">
          <div className="text-center text-xl font-medium">
            是否保存至当前作品？
          </div>
          <div className="mt-1 text-center text-sm">
            注：如已有内容将被覆盖
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[60px] text-xs"
              onClick={handleCancel}
            >
              取消
            </Button>
            <Button
              type="button"
              className="min-w-[92px] text-xs"
              onClick={handleSaveToCurrent}
            >
              保存至当前作品
            </Button>
            <Button
              type="button"
              className="min-w-[92px] text-xs"
              onClick={handleSaveToNew}
            >
              保存至新建作品
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
