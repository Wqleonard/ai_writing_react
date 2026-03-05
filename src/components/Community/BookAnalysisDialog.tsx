import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Iconfont } from "@/components/IconFont";
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
import { novelDeconstructStream } from "@/api/tools-square";
import type { PostStreamData } from "@/api";
import { getContentFromPartial } from "@/utils/getWorkFlowPartialData";
import type { PromptItem } from "./types";
import { LinkButton } from "../ui/LinkButton";
import { AutoScrollArea } from "../AutoScrollArea";
import { cn } from "@/lib/utils";
import { showGenerationSaveDialog } from "@/utils/showGenerationSaveDialog";
import { useEditorStore } from "@/stores/editorStore";

const SIZE_LIMIT = 8 * 1024 * 1024;

export interface BookAnalysisDialogProps {
  open: boolean;
  onClose: () => void;
  prompt?: PromptItem | null;
}

export const BookAnalysisDialog = ({
  open,
  onClose,
  prompt,
}: BookAnalysisDialogProps) => {
  const [fileConfirmed, setFileConfirmed] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null);
  const [markdownContent, setMarkdownContent] = useState("");
  const [markdownEditing, setMarkdownEditing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setFileConfirmed(false);
      setUploadedFile(null);
      setMarkdownContent("");
      setMarkdownEditing(false);
      setStreaming(false);
    }
  }, [open]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const canStart =
    uploadedFile != null &&
    uploadedFile.status !== "uploading" &&
    uploadedFile.response != null;

  const onStreamData = useCallback((data: PostStreamData) => {
    switch (data.event) {
      case "messages/partial": {
        const content = getContentFromPartial(data.data);
        if (!content) return;
        setMarkdownContent(content);
        break;
      }
      case "updates": {
        const generateContent = data?.data?.generate_content;
        if (generateContent?.content && generateContent?.finished === true) {
          setMarkdownContent(generateContent.content);
        }
        break;
      }
      default:
        break;
    }
  }, []);

  const onStreamError = useCallback((error: Error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("拆书仿写生成失败:", error);
    toast.error("生成失败，请重试");
    setStreaming(false);
    abortControllerRef.current = null;
  }, []);

  const onStreamEnd = useCallback(() => {
    setStreaming(false);
    abortControllerRef.current = null;
  }, []);

  const doStreamGenerate = useCallback(async () => {
    const response = uploadedFile?.response as
      | { putFilePath?: string; fileName?: string }
      | undefined;
    if (!response?.putFilePath || !response?.fileName) {
      toast.error("上传文件信息缺失，请重新上传");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setMarkdownContent("");
    setStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await novelDeconstructStream(
        { name: response.fileName, path: response.putFilePath },
        onStreamData,
        onStreamError,
        onStreamEnd,
        { signal: controller.signal },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStreaming(false);
      abortControllerRef.current = null;
    }
  }, [uploadedFile, onStreamData, onStreamError, onStreamEnd]);

  const workId = useEditorStore((s) => s.workId);

  const handleSave = useCallback(async () => {
    try {
      const name = "拆书仿写" + "(来自生成器)";
      const saveId = showGenerationSaveDialog({
        fileNameDefault: name,
      });
      if (!saveId) return;
      // if(saveId == workId){
      //   // await
      // }
      toast.success("保存成功");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("保存失败");
    }
  }, [onClose]);

  const handleConfirm = async () => {
    if (!fileConfirmed) {
      if (!canStart) return;
      setFileConfirmed(true);
      setMarkdownEditing(false);
      await doStreamGenerate();
      return;
    } else {
      await handleSave();
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
            拆书仿写
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
                      {prompt?.name ||
                        "官方提供-专业短篇小说评价30年 · 拆书仿写"}
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
                  onChange={setUploadedFile}
                  accept={[".txt", ".pdf"]}
                  sizeLimit={SIZE_LIMIT}
                />
              </div>
            </div>
          ) : (
            <>
              <AutoScrollArea
                maxHeight={440}
                className={cn(
                  "mt-2 h-[440px] rounded-lg bg-[#f6f6f6] p-3",
                  markdownEditing ? "outline-2 outline-(--theme-color)" : "",
                )}
              >
                <MarkdownEditor
                  value={markdownContent}
                  onChange={setMarkdownContent}
                  readonly={!markdownEditing}
                  minHeight={280}
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
                  disabled={streaming}
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
            disabled={streaming || (!fileConfirmed && !canStart)}
            onClick={handleConfirm}
          >
            {fileConfirmed ? "保存至作品" : "开始拆书"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
