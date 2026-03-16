import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MConfirmDialog } from "@/components/ui/MConfirmDialog";
import { Iconfont } from "@/components/Iconfont";
import { WritingStyleDialog } from "@/components/Community";
import {
  deleteWritingStylesListReq,
  getWritingStyleByIdReq,
  getWritingStylesListReq,
  updateWritingStyleReq,
} from "@/api/writing-styles";
import { useLLM } from "@/hooks/useLLM";
import { postWritingStyle } from "@/api/tools-square";

export interface WritingStyleOption {
  label: string;
  value: string;
  isPublic?: boolean;
}

export interface WritingStylePopupProps {
  options?: WritingStyleOption[];
  disabled?: boolean;
  /** controlled value; when omitted, defaults to useLLM().selectedWritingStyle */
  value?: string;
  /** controlled change callback; when omitted, updates useLLM().setSelectedWritingStyle */
  onChange?: (value: string) => void;
  className?: string;
}

const NAME_MAX = 10;

export const WritingStylePopup = ({
  options: optionsProp,
  disabled = false,
  value,
  onChange,
  className,
}: WritingStylePopupProps) => {
  const {
    selectedWritingStyle,
    setSelectedWritingStyle,
    setWritingStyles,
  } = useLLM();

  const isControlled = value != null;
  const currentValue = isControlled ? String(value) : String(selectedWritingStyle ?? "");

  const [options, setOptions] = useState<WritingStyleOption[]>(() => optionsProp ?? []);
  const [open, setOpen] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [isLoadingStyle, setIsLoadingStyle] = useState(false);
  const [editingStyleId, setEditingStyleId] = useState("");
  const [editingStyleName, setEditingStyleName] = useState("");
  const [editingStyleContent, setEditingStyleContent] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameInput, setEditingNameInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WritingStyleOption | null>(null);

  useEffect(() => {
    if (!optionsProp) return;
    setOptions(optionsProp);
  }, [optionsProp]);

  const updateWritingStyleOptions = useCallback(async () => {
    try {
      const res: any = await getWritingStylesListReq();
      const raw = Array.isArray(res) ? res : [];
      const list: WritingStyleOption[] = raw.map((item: any) => ({
        label: String(item?.name ?? ""),
        value: String(item?.id ?? ""),
        isPublic: item?.isPublic !== false,
      }));
      setOptions(list);
      setWritingStyles(list.map((x) => ({ id: x.value, name: x.label })));

      // keep selection valid
      if (list.length > 0) {
        const exists = list.some((opt) => opt.value === currentValue);
        const next = exists ? currentValue : list[0].value;
        if (next && next !== currentValue) {
          if (isControlled) onChange?.(next);
          else setSelectedWritingStyle(next);
        } else if (!currentValue) {
          if (isControlled) onChange?.(list[0].value);
          else setSelectedWritingStyle(list[0].value);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [
    currentValue,
    isControlled,
    onChange,
    setSelectedWritingStyle,
    setWritingStyles,
  ]);

  useEffect(() => {
    void updateWritingStyleOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    void updateWritingStyleOptions();
  }, [open, updateWritingStyleOptions]);

  const currentOption = useMemo(() => {
    const found = options.find((opt) => opt.value === currentValue);
    return found ?? options[0];
  }, [currentValue, options]);

  const setNextValue = useCallback(
    (next: string) => {
      if (isControlled) onChange?.(next);
      else setSelectedWritingStyle(next);
    },
    [isControlled, onChange, setSelectedWritingStyle]
  );

  const handleSelect = useCallback(
    (opt: WritingStyleOption) => {
      setNextValue(opt.value);
      setOpen(false);
    },
    [setNextValue]
  );

  const openCreate = useCallback(() => {
    setOpen(false);
    setCreateDialogOpen(true);
  }, []);

  const handleAddSuccess = useCallback(async () => {
    await updateWritingStyleOptions();
  }, [updateWritingStyleOptions]);

  const openEdit = useCallback(async (opt: WritingStyleOption) => {
    setOpen(false);
    setEditOpen(true);
    setEditingStyleId(opt.value);
    setEditingStyleName(opt.label);
    setEditingNameInput(opt.label);
    setIsEditingName(false);
    setEditingStyleContent("");
    if (!opt.value) return;
    try {
      setIsLoadingStyle(true);
      const res: any = await getWritingStyleByIdReq(opt.value);
      if (res) {
        setEditingStyleContent(String(res?.content ?? ""));
        const name = String(res?.name ?? "");
        if (name) {
          setEditingStyleName(name);
          setEditingNameInput(name);
        }
      }
    } catch (e) {
      console.error("加载文风详情失败:", e);
      toast.error("加载文风详情失败");
    } finally {
      setIsLoadingStyle(false);
    }
  }, []);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditingStyleId("");
    setEditingStyleName("");
    setEditingStyleContent("");
    setIsEditingName(false);
    setEditingNameInput("");
    setIsLoadingStyle(false);
  }, []);

  const startEditName = useCallback(() => {
    setIsEditingName(true);
    setEditingNameInput(editingStyleName);
    queueMicrotask(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [editingStyleName]);

  const cancelEditName = useCallback(() => {
    setIsEditingName(false);
    setEditingNameInput(editingStyleName);
  }, [editingStyleName]);

  const saveEditName = useCallback(() => {
    const next = editingNameInput.trim();
    if (!next) {
      toast.warning("文风标题不能为空");
      return;
    }
    if (next.length > NAME_MAX) {
      toast.warning(`文风标题不能超过${NAME_MAX}个字符`);
      return;
    }
    setEditingStyleName(next);
    setIsEditingName(false);
  }, [editingNameInput]);

  const saveEdit = useCallback(async () => {
    const name = editingStyleName.trim();
    if (!name) {
      toast.warning("文风标题不能为空");
      return;
    }
    if (name.length > NAME_MAX) {
      toast.warning(`文风标题不能超过${NAME_MAX}个字符`);
      return;
    }
    const payload = {
      name,
      content: editingStyleContent,
    }
    try {
      editingStyleId ? await updateWritingStyleReq(editingStyleId, payload) : await postWritingStyle(payload);
      toast.success("保存成功");
      await updateWritingStyleOptions();
      closeEdit();
    } catch (e) {
      console.error("保存失败:", e);
      toast.error("保存失败，请稍后再试");
    }
  }, [
    closeEdit,
    editingStyleContent,
    editingStyleId,
    editingStyleName,
    updateWritingStyleOptions,
  ]);

  const askDelete = useCallback((opt: WritingStyleOption) => {
    setDeleteTarget(opt);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    if (!target) {
      setDeleteConfirmOpen(false);
      return;
    }
    try {
      await deleteWritingStylesListReq(target.value);
      toast.success("删除成功");
      await updateWritingStyleOptions();
      setOpen(false);
    } catch (e) {
      console.error("删除失败:", e);
      toast.error("删除失败，请稍后再试");
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, updateWritingStyleOptions]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            className={cn(
              "writing-style-trigger inline-flex items-center gap-1 rounded-md outline-none transition-[transform,opacity]",
              "text-xs text-[#333333] cursor-pointer hover:opacity-80",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50",
              className
            )}
          >
            <span className="max-w-[90px] truncate text-left">
              {currentOption?.label || "默认文风"}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={8}
          className="w-[235px] p-1 rounded-lg border bg-(--bg-primary-overlay,white) shadow-md"
        >
          <div className="writing-style-content flex flex-col max-h-[220px]">
            {/* ScrollArea 需要明确高度，否则只会显示顶部几条，看起来像“只显示官方” */}
            <ScrollArea className="style-options h-[180px] w-full py-0.5 pr-1">
              <div className="flex flex-col">
                {options.map((opt) => (
                  <div
                    key={opt.value}
                    role="button"
                    className={cn(
                      "style-option w-full h-9 rounded-lg flex items-center justify-between gap-2 px-3 text-left text-sm transition-colors cursor-pointer",
                      opt.value === currentValue ? "bg-(--bg-hover,#f5f5f5)" : "hover:bg-(--bg-hover,#f5f5f5)"
                    )}
                    onClick={() => handleSelect(opt)}
                  >
                    <span className="option-label text-(--text-primary,#303133) truncate">
                      {opt.label || "未命名"}
                    </span>
                    {opt.isPublic ? (
                      <span className="option-tag shrink-0 text-xs text-muted-foreground">
                        官方
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            askDelete(opt);
                          }}
                        >
                          <Iconfont unicode="&#xea46;" className="text-sm" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openEdit(opt);
                          }}
                        >
                          <Iconfont unicode="&#xe63f;" className="text-sm" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button
              type="button"
              variant="outline"
              className="create-writing-style-btn mt-1 h-8 w-full text-xs hover:bg-muted/80 transition-colors"
              onClick={() => void openEdit({ label: '', value: '', isPublic: false })}
            >
              <span className="mr-1">+</span>
              <span>创建专属文风</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="create-writing-style-btn mt-1 h-8 w-full text-xs hover:bg-muted/80 transition-colors"
              onClick={openCreate}
            >
              <span className="mr-1">+</span>
              <span>上传内容提炼文风</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={editOpen} onOpenChange={(next) => !next && closeEdit()}>
        <DialogContent className="w-[1020px] max-w-[90vw] py-6 px-10 sm:max-w-[90vw]" showCloseButton={true}>
          <DialogHeader className="px-2 relative h-9 min-h-0 shrink-0 gap-0">
            <DialogTitle className="sr-only">编辑文风</DialogTitle>
            <div className="flex items-center gap-2">
              {isEditingName || !editingStyleId ? (
                <Input
                  ref={titleInputRef}
                  value={editingNameInput}
                  maxLength={NAME_MAX}
                  className="min-w-[200px] border-0 bg-transparent px-0 text-2xl md:text-2xl font-semibold placeholder:text-2xl md:placeholder:text-2xl shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="输入文风标题"
                  onChange={(e) => setEditingNameInput(e.target.value)}
                  onBlur={saveEditName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEditName();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditName();
                    }
                  }}
                />
              ) : (
                <>
                  <div className="text-[18px] font-medium text-[#303133]">
                    {editingStyleName || ""}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={startEditName}
                  >
                    <Iconfont unicode="&#xea48;" className="text-sm" />
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <div className="px-2 w-full min-w-0 h-[520px] flex flex-col">
            {isLoadingStyle ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>加载中...</span>
              </div>
            ) : (
              <>
                <div className="pb-3">
                  <div className="text-[18px] font-semibold text-[#303133]">文风详情</div>
                </div>
                <ScrollArea className="flex-1 min-h-0 rounded-lg bg-white">
                  <div>
                    <MarkdownEditor
                      value={editingStyleContent}
                      placeholder="输入文风描述，如叙述视角、语言风格、句式结构，示例文段等"
                      onChange={setEditingStyleContent}
                      className="markdown-editor-wrapper !p-0"
                    />
                  </div>
                </ScrollArea>
              </>
            )}
          </div>

          <DialogFooter className="flex flex-row !justify-center gap-4 border-0 px-2 pt-4">
            <Button type="button" variant="outline" onClick={closeEdit}>
              取消
            </Button>
            <Button type="button" disabled={isLoadingStyle} onClick={() => void saveEdit()}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WritingStyleDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onAdd={handleAddSuccess}
      />

      <MConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="删除确认"
        message={deleteTarget ? `确定要删除文风“${deleteTarget.label}”吗？` : "确定要删除该文风吗？"}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
};

export default WritingStylePopup;
