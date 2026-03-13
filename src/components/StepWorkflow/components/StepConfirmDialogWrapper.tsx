import React, { useRef, useState } from "react"
import { StepConfirmDialog } from "./StepConfirmDialog"

export type StepConfirmResult = "cancel" | "saveToCurrent" | "saveToNew"

const UNMOUNT_DELAY_MS = 300

interface StepConfirmDialogWrapperProps {
  resolve: (value: StepConfirmResult) => void
  onUnmount: () => void
}

export const StepConfirmDialogWrapper = ({
  resolve,
  onUnmount,
}: StepConfirmDialogWrapperProps) => {
  const [open, setOpen] = useState(true)
  const resolvedRef = useRef(false)

  const finish = (result: StepConfirmResult) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    resolve(result)
    setOpen(false)
    setTimeout(onUnmount, UNMOUNT_DELAY_MS)
  }

  return (
    <StepConfirmDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) finish("cancel")
      }}
      onCancel={() => finish("cancel")}
      onSaveToCurrent={() => finish("saveToCurrent")}
      onSaveToNew={() => finish("saveToNew")}
    />
  )
}
