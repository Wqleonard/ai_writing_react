import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"

interface MConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  message: string
  cancelText?: string
  confirmText?: string
  confirmClassName?: string
  onConfirm: () => void
}

export function MConfirmDialog({
  open,
  onOpenChange,
  title = "提示",
  message,
  cancelText = "取消",
  confirmText = "确定",
  confirmClassName,
  onConfirm,
}: MConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-120 max-w-[calc(100%-2rem)] rounded-2xl p-0"
      >
        <DialogHeader className="px-8 pt-8 text-center">
          <DialogTitle className="text-[2rem] leading-[1.2] font-semibold text-[#333]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-8 pt-5 pb-7 text-center text-[1.625rem] leading-[1.4] text-[#666]">
          {message}
        </div>

        <DialogFooter className="flex h-20 flex-row gap-0 border-t border-[#ebebeb] p-0">
          <Button
            variant="ghost"
            className="outline-0 rounded-0 h-full flex-1 text-[1.75rem] text-[#999] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-transparent active:bg-[#f5f5f5]"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <div className="h-full w-px bg-[#ebebeb]" />
          <Button
            variant="ghost"
            className={`outline-0 rounded-0 h-full flex-1 text-[1.75rem] font-semibold text-[#f0ae00] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-transparent active:bg-[#fff7e6] ${confirmClassName ?? ""}`}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
