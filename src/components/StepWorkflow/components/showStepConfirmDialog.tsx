import { createRoot } from "react-dom/client"
import {
  StepConfirmDialogWrapper,
  type StepConfirmResult,
} from "./StepConfirmDialogWrapper"

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

    root.render(<StepConfirmDialogWrapper resolve={resolve} onUnmount={onUnmount} />)
  })
}
