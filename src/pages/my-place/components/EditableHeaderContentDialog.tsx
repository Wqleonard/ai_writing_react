import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";

const HEADER_MAX_LENGTH = 10;
const CONTENT_MAX_LENGTH = 2000;

export interface EditableHeaderContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogTitle?: string;
  headerLabel?: string;
  headerPlaceholder?: string;
  headerValue: string;
  onHeaderChange: (value: string) => void;
  contentLabel?: string;
  contentPlaceholder?: string;
  contentValue: string;
  onContentChange: (value: string) => void;
  cancelText?: string;
  saveText?: string;
  onCancel?: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
}

export const EditableHeaderContentDialog = ({
  open,
  onOpenChange,
  dialogTitle = "",
  headerLabel = "",
  headerPlaceholder = "请输入头部",
  headerValue,
  onHeaderChange,
  contentLabel = "内容",
  contentPlaceholder = "请输入内容",
  contentValue,
  onContentChange,
  cancelText = "取消",
  saveText = "保存",
  onCancel,
  onSave,
  saveDisabled = false,
}: EditableHeaderContentDialogProps) => {
  const headerLimitToastShownRef = useRef(false);
  const contentLimitToastShownRef = useRef(false);

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleSave = () => {
    onSave?.();
  };

  const handleHeaderInputChange = useCallback(
    (value: string) => {
      if (value.length > HEADER_MAX_LENGTH) {
        if (!headerLimitToastShownRef.current) {
          toast.warning(`文风标题最多输入${HEADER_MAX_LENGTH}个字`);
          headerLimitToastShownRef.current = true;
        }
        return;
      }
      headerLimitToastShownRef.current = false;
      onHeaderChange(value);
    },
    [onHeaderChange]
  );

  const handleContentInputChange = useCallback(
    (value: string) => {
      if (value.length > CONTENT_MAX_LENGTH) {
        if (!contentLimitToastShownRef.current) {
          toast.warning(`文风详情最多输入${CONTENT_MAX_LENGTH}个字`);
          contentLimitToastShownRef.current = true;
        }
        return;
      }
      contentLimitToastShownRef.current = false;
      onContentChange(value);
    },
    [onContentChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[640px] max-w-[90vw] px-6 py-2" showCloseButton={true}>
        <DialogHeader className="py-1">
          <Input
            className="border-0 placeholder:text-lg shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={headerValue}
            placeholder={headerPlaceholder}
            onChange={(e) => handleHeaderInputChange(e.target.value)}
          />
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-lg text-foreground px-3">{contentLabel}</div>
            <Textarea
              className="h-[220px] !border-0 !ring-0 !ring-transparent py-0 shadow-none outline-none"
              areaClassName="editable-header-content-dialog-textarea overflow-y-auto pr-1 text-sm text-foreground placeholder:text-muted-foreground"
              value={contentValue}
              placeholder={contentPlaceholder}
              onChange={(e) => handleContentInputChange(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex !justify-center gap-3">
          <Button type="button" variant="outline" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saveDisabled}>
            {saveText}
          </Button>
        </DialogFooter>
        <style>{`
          .editable-header-content-dialog-textarea {
            scrollbar-width: thin;
            scrollbar-color: #d5d6d8 transparent;
          }

          .editable-header-content-dialog-textarea::-webkit-scrollbar {
            width: 10px;
          }

          .editable-header-content-dialog-textarea::-webkit-scrollbar-track {
            background: transparent;
          }

          .editable-header-content-dialog-textarea::-webkit-scrollbar-button {
            display: none;
            width: 0;
            height: 0;
          }

          .editable-header-content-dialog-textarea::-webkit-scrollbar-thumb {
            background: #d5d6d8;
            border-radius: 9999px;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};
