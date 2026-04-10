import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Iconfont } from "@/components/Iconfont";
import { Upload } from "@/components/Upload";
import type { UploadFile } from "@/components/Upload";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { postWritingAnalysisStream, postWritingStyle } from "@/api/tools-square";
import type { PostStreamData } from "@/api";
import { getContentFromPartial } from "@/utils/getWorkFlowPartialData";
import type { PromptItem } from "./types";
import { LinkButton } from "../ui/LinkButton";
import { AutoScrollArea } from "../AutoScrollArea";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";

const SIZE_LIMIT = 10 * 1024 * 1024;

const readTxtFileContent = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (ext !== ".txt") {
      reject(new Error("仅支持 .txt 文件"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "UTF-8");
  });

export interface WritingStyleDialogProps {
  open: boolean;
  onClose: () => void;
  prompt?: PromptItem | null;
  appendToBody?: boolean;
  onAdd?: () => void | Promise<void>;
}

interface ChatMessage {
  id: string;
  type: "ai";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

const getUploadFileKey = (file: UploadFile | null): string => {
  if (!file) return "";
  const response = file.response as { putFilePath?: string } | undefined;
  if (response?.putFilePath) return response.putFilePath;
  return `${file.uid ?? ""}:${file.name}:${file.size ?? 0}`;
};

export const WritingStyleDialog = ({
  open,
  onClose,
  prompt,
  onAdd,
}: WritingStyleDialogProps) => {
  const [fileConfirmed, setFileConfirmed] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
  const [chatArr, setChatArr] = useState<ChatMessage[]>([]);
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownEditing, setMarkdownEditing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [styleName, setStyleName] = useState("");
  const [styleNameError, setStyleNameError] = useState("");
  const [lastGeneratedFileKey, setLastGeneratedFileKey] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const next = chatArr
      .filter((chat) => chat.type === "ai")
      .map((item) => item.content)
      .join("\n\n");
    setMarkdownContent(next);
  }, [chatArr]);

  useEffect(() => {
    if (!open) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setFileConfirmed(false);
      setUploadedFile(null);
      setChatArr([]);
      setMarkdownContent("");
      setMarkdownEditing(false);
      setStreaming(false);
      setHasError(false);
      setNameDialogOpen(false);
      setStyleName("");
      setStyleNameError("");
      setLastGeneratedFileKey("");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const canStart =
    uploadedFile != null &&
    uploadedFile.status !== "uploading" &&
    uploadedFile.response != null &&
    uploadedFile.raw != null;

  const onStreamData = useCallback((data: PostStreamData) => {
    switch (data.event) {
      case "messages/partial": {
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return;
        const dataId = (data.data as any[])[0]?.id;
        const content = getContentFromPartial(data.data);
        if (!content) return;
        setChatArr((prev) => {
          const existingIndex = prev.findIndex((msg) => msg.id === dataId);
          if (existingIndex === -1) {
            return [
              ...prev,
              {
                id: dataId ?? `ai_${Date.now()}`,
                type: "ai",
                content,
                timestamp: Date.now(),
                isStreaming: true,
              },
            ];
          }
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            content,
            isStreaming: true,
          };
          return next;
        });
        break;
      }
      case "updates": {
        const safety = (data?.data as any)?.check_input_safety;
        if (safety && safety.input_safety_passed === false) {
          const errorMessage =
            safety.final_output || "抱歉，文件存在敏感信息，我无法进行文风提炼";
          setChatArr((prev) => [
            ...prev,
            {
              id: `error_${Date.now()}`,
              type: "ai",
              content: errorMessage,
              timestamp: Date.now(),
              isStreaming: false,
            },
          ]);
          setHasError(true);
          setStreaming(false);
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          return;
        }
        const dataId = (data as any).id;
        if (dataId != null) {
          setChatArr((prev) => {
            const existingIndex = prev.findIndex((msg) => msg.id === dataId);
            if (existingIndex !== -1) {
              const next = [...prev];
              next[existingIndex] = {
                ...next[existingIndex],
                isStreaming: false,
              };
              return next;
            }
            return prev;
          });
        }
        break;
      }
      default:
        break;
    }
  }, []);

  const onStreamError = useCallback((error: Error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("文风提炼生成失败:", error);
    toast.error(error.message || "生成失败，请重试");
    setStreaming(false);
    abortControllerRef.current = null;
  }, []);

  const onStreamEnd = useCallback(() => {
    setStreaming(false);
    setChatArr((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], isStreaming: false };
      return next;
    });
    abortControllerRef.current = null;
  }, []);

  const doStreamGenerate = useCallback(async () => {
    const rawFile = uploadedFile?.raw;
    if (!rawFile) {
      toast.error("上传文件信息缺失，请重新上传");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setChatArr([]);
    setMarkdownContent("");
    setHasError(false);
    setStreaming(true);
    setLastGeneratedFileKey(getUploadFileKey(uploadedFile));
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const content = await readTxtFileContent(rawFile);
      if (!content.trim()) {
        toast.warning("文件内容为空");
        setStreaming(false);
        abortControllerRef.current = null;
        return;
      }

      await postWritingAnalysisStream(
        content,
        onStreamData,
        onStreamError,
        onStreamEnd,
        { signal: controller.signal },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStreaming(false);
      abortControllerRef.current = null;
      const message = error instanceof Error ? error.message : "文件读取失败，请重试";
      toast.error(message);
    }
  }, [onStreamData, onStreamEnd, onStreamError, uploadedFile]);

  const openNameDialog = useCallback(() => {
    if (hasError) {
      toast.warning("当前结果不可用于添加文风");
      return;
    }
    const content = markdownContent.trim();
    if (!content) {
      toast.warning("提炼结果为空，无法添加文风");
      return;
    }
    const defaultName = uploadedFile?.name?.replace(/\.[^.]*$/, "") || "";
    setStyleName(defaultName.slice(0, 6));
    setStyleNameError("");
    setNameDialogOpen(true);
  }, [hasError, markdownContent, uploadedFile?.name]);

  const validateAndAddStyle = useCallback(async () => {
    trackEvent('AI Tool', 'Use', 'Style Analysis')
    const name = styleName.trim();
    if (!name) {
      setStyleNameError("请输入文风名称");
      return;
    }
    if (name.length > 6) {
      setStyleNameError("不得超过6个字符");
      return;
    }
    setStyleNameError("");
    setNameDialogOpen(false);
    try {
      const req: any = await postWritingStyle({ name, content: markdownContent });
      if (!req?.id) {
        toast.warning("文风添加失败，请稍后再试");
        return;
      }
      await onAdd?.();
      toast.success("添加文风成功");
      onClose();
    } catch (error) {
      console.error(error);
      toast.warning("文风添加失败，请稍后再试");
    }
  }, [markdownContent, onAdd, onClose, styleName]);

  const handleConfirm = async () => {
    if (!fileConfirmed) {
      if (!canStart) return;
      const currentFileKey = getUploadFileKey(uploadedFile);
      const shouldReusePreviousStream =
        currentFileKey !== "" &&
        currentFileKey === lastGeneratedFileKey &&
        (streaming || chatArr.length > 0);
      setFileConfirmed(true);
      if (shouldReusePreviousStream) return;
      setMarkdownEditing(false);
      await doStreamGenerate();
    } else {
      openNameDialog();
    }
  };

  const handleRegenerate = async () => {
    if (!fileConfirmed || !canStart || streaming) return;
    setMarkdownEditing(false);
    await doStreamGenerate();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="w-[1020px] max-w-[90vw] py-11 px-[120px] pb-8 sm:max-w-[90vw]"
        showCloseButton
      >
        <DialogHeader className="px-5 relative h-9 min-h-0 shrink-0 gap-0">
          {fileConfirmed && (
            <div
              role="button"
              className="absolute left-5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-md hover:bg-accent cursor-pointer"
              onClick={() => setFileConfirmed(false)}
            >
              <Iconfont unicode="&#xe62a;" />
            </div>
          )}
          <DialogTitle className="h-9 min-h-0 overflow-hidden text-center text-2xl leading-9">
            文风提炼
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 w-full min-w-0 h-[520px] flex flex-col">
          {!fileConfirmed ? (
            <div className="mt-4 flex flex-col gap-4 min-w-0">
              <div className="min-w-0">
                <div className="text-xl">提示词</div>
                <div className="mt-2 flex h-20 min-w-0 items-center rounded-lg bg-[#f7f7f7] px-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0 overflow-hidden text-ellipsis text-lg">
                      {prompt?.name || "官方提供-专业短篇小说评价30年 · 文风提炼"}
                    </div>
                    <div className="text-sm text-[#666]">
                      {prompt?.authorName ? `@${prompt.authorName}` : "@爆文猫"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-xl">上传内容</div>
                <Upload
                  className="mt-4 h-55 w-full"
                  value={uploadedFile}
                  onChange={(file) => {
                    const nextFileKey = getUploadFileKey(file);
                    const currentFileKey = getUploadFileKey(uploadedFile);
                    const fileChanged = nextFileKey !== currentFileKey;
                    setUploadedFile(file);
                    if (fileChanged) {
                      setChatArr([]);
                      setMarkdownContent("");
                      setHasError(false);
                      setMarkdownEditing(false);
                    }
                  }}
                  accept={[".txt"]}
                  // sizeLimit={SIZE_LIMIT}
                />
              </div>
            </div>
          ) : (
            <>
              <AutoScrollArea
                className={cn(
                  "mt-2 flex-1 min-h-0 rounded-lg bg-[#f6f6f6]",
                  markdownEditing ? "outline-2 outline-(--theme-color)" : "",
                )}
              >
                <MarkdownEditor
                  value={markdownContent}
                  onChange={setMarkdownContent}
                  readonly={!markdownEditing}
                />
              </AutoScrollArea>
              <div className="mt-4 flex justify-center gap-4">
                <LinkButton
                  type="button"
                  disabled={streaming}
                  onClick={handleRegenerate}
                  className="text-gray-500 text-sm"
                >
                  <Iconfont unicode="&#xe66f;" className="mr-1" />
                  <span>重新生成</span>
                </LinkButton>
                <LinkButton
                  type="button"
                  disabled={streaming || hasError}
                  onClick={() => setMarkdownEditing((value) => !value)}
                  className="text-gray-500 text-sm"
                >
                  <Iconfont unicode="&#xea48;" className="mr-1" />
                  <span>{markdownEditing ? "完成" : "编辑"}</span>
                </LinkButton>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-row-reverse gap-4 border-0 px-5">
          <Button type="button" variant="outline" onClick={onClose}>
            退出
          </Button>
          <Button
            type="button"
            disabled={fileConfirmed? (!uploadedFile || uploadedFile.status === "uploading") : streaming}
            onClick={handleConfirm}
          >
            {fileConfirmed ? "添加文风" : "开始提炼"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent showCloseButton className="w-100">
          <DialogHeader>
            <DialogTitle>给文风起个名字</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="请输入，不得超过6个字符"
              value={styleName}
              onChange={(event) => {
                setStyleName(event.target.value);
                setStyleNameError("");
              }}
              maxLength={6}
              className={styleNameError ? "border-destructive" : ""}
            />
            {styleNameError ? (
              <p className="mt-1 text-sm text-destructive">{styleNameError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={validateAndAddStyle}
              disabled={!styleName.trim() || styleName.trim().length > 6}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
