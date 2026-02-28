import React, { useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { StepConfirmDialog } from "./StepConfirmDialog"

export type StepConfirmResult = "cancel" | "saveToCurrent" | "saveToNew"

const UNMOUNT_DELAY_MS = 300

interface WrapperProps {
  resolve: (value: StepConfirmResult) => void
  onUnmount: () => void
}

const Wrapper = ({ resolve, onUnmount }: WrapperProps) => {
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

/**
 * 打开步骤确认对话框（与 Vue showStepConfirmDialog 用法一致）
 * @returns Promise<'cancel' | 'saveToCurrent' | 'saveToNew'>
 */
export const showStepConfirmDialog = (): Promise<StepConfirmResult> => {
  return new Promise((resolve) => {
    const container = document.createElement("div")
    document.body.appendChild(container)

    const root = createRoot(container)
    const onUnmount = () => {
      root.unmount()
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
    }

    root.render(<Wrapper resolve={resolve} onUnmount={onUnmount} />)
  })
}
