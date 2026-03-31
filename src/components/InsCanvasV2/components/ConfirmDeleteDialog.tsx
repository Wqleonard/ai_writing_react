import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Iconfont } from "@/components/Iconfont";
import type { ConfirmDeleteDialogProps } from "@/components/InsCanvasV2/types";

export default function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  targetLabel = "卡片",
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(92vw,26rem)] gap-5 rounded-[12px] border-0 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.14)]"
      >
        <DialogHeader className="gap-2 px-6 pt-6 text-left">
          <DialogTitle className="text-base font-semibold text-[#111827]">
            <Iconfont unicode="&#xe655;" className="text-[#E67E22] size-4 mr-2" />
            删除{targetLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 text-sm leading-6 text-[#4b5563]">
          此操作不可逆，确认删除{targetLabel}？
        </div>
        <DialogFooter className="gap-3 px-6 pb-6 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-3xl border border-[#e5e7eb] bg-white px-5 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-3xl bg-white border !border-[#8E77F0] px-5 text-sm font-medium text-[#8E77F0] hover:bg-[#8E77F0] hover:text-white"
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
