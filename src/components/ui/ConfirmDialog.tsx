import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "提示",
  message,
  cancelText = "取消",
  confirmText = "确认",
  confirmVariant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm leading-6 text-muted-foreground">{message}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: "default" | "destructive";
}

type PendingConfirm = ConfirmOptions & {
  resolve: (result: boolean) => void;
};

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setPending((current) => {
      current?.resolve(false);
      return null;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setPending((current) => {
      current?.resolve(true);
      return null;
    });
  }, []);

  const confirmDialog = useMemo(
    () => (
      <ConfirmDialog
        open={!!pending}
        onOpenChange={handleOpenChange}
        title={pending?.title ?? "提示"}
        message={pending?.message ?? ""}
        cancelText={pending?.cancelText ?? "取消"}
        confirmText={pending?.confirmText ?? "确认"}
        confirmVariant={pending?.confirmVariant ?? "default"}
        onConfirm={handleConfirm}
      />
    ),
    [pending, handleOpenChange, handleConfirm]
  );

  return {
    confirm,
    confirmDialog,
    isConfirmOpen: !!pending,
  };
}
