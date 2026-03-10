import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFileReq, type FileItem } from "@/api/files";
import type { PostStreamData } from "@/api";
import {
  postScriptTemplateStreamPlot,
  type PostScriptTemplateStreamPlotRequestData,
} from "@/api/writing-templates";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import MarkdownRenderer from "@/components/MarkdownRenderer/MarkdownRenderer";
import scriptEmptyUploadIcon from "@/assets/images/quick_creation/script_empty_upload.svg";
import uploadBackImage from "@/assets/images/quick_creation/upload_back_image.svg";
import uploadUpImage from "@/assets/images/quick_creation/upload_up_image.svg";
import chapterTipImage from "@/assets/images/quick_creation/chapter_tip.svg";
import "./ScriptNovelOutlineChapter.css";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UploadStatus = "empty" | "hover" | "uploading" | "uploaded" | "completed";

interface ScriptNovelOutlineChapterResult {
  content: string;
  originalName?: string;
  serverFileName?: string;
  wordCount?: number;
  chapterNum?: number;
}

type PlotUpdatesPayload = {
  generate_writing_template?: {
    result?: {
      plot?: {
        novel_plot?: string;
      };
    };
  };
};

export interface ScriptNovelOutlineChapterProps {
  novelContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  onConfirm?: (data: ScriptNovelOutlineChapterResult) => void;
  onRevert?: () => void;
  onRevertToCurrent?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt"];

const getContentFromPartial = (data: unknown): string => {
  if (!Array.isArray(data) || data.length === 0) return "";
  const firstItem = data[0] as any;
  if (Array.isArray(firstItem?.content) && firstItem.content[0]?.text) {
    return String(firstItem.content[0].text);
  }
  return "";
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const getPlotResultFromUpdates = (data: unknown): string => {
  const payload = data as PlotUpdatesPayload | undefined;
  return payload?.generate_writing_template?.result?.plot?.novel_plot ?? "";
};

export const ScriptNovelOutlineChapter = ({
  novelContent = "",
  locked = false,
  hasNextContent = false,
  onConfirm,
  onRevertToCurrent,
}: ScriptNovelOutlineChapterProps) => {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("empty");
  const [uploadedFile, setUploadedFile] = useState<FileItem | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [totalWords, setTotalWords] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [outlineResult, setOutlineResult] = useState<ScriptNovelOutlineChapterResult | null>(null);
  const [streamingContent, setStreamingContent] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamingContentRef = useRef("");

  const fileNameWithoutExtension = useMemo(() => {
    const fileName = outlineResult?.originalName || uploadedFile?.originalName;
    if (!fileName) return "";
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  }, [outlineResult?.originalName, uploadedFile?.originalName]);

  const chapterPercent = useMemo(() => {
    if (totalChapters <= 1) return 0;
    return ((selectedChapter - 1) / (totalChapters - 1)) * 100;
  }, [selectedChapter, totalChapters]);

  const resetUploadState = useCallback(() => {
    setUploadStatus("empty");
    setUploadedFile(null);
    setTotalWords(0);
    setTotalChapters(0);
    setSelectedChapter(1);
    setOutlineResult(null);
    setStreamingContent("");
    streamingContentRef.current = "";
    setIsStreaming(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const validateFile = (file: File): boolean => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error("仅支持 .txt格式");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("文件大小不能超过10MB");
      return false;
    }
    return true;
  };

  const parseNovelContent = async (file: File) => {
    try {
      const text = await file.text();
      const textWithoutSpaces = text.replace(/\s/g, "");
      setTotalWords(textWithoutSpaces.length);
      const chapterPattern = /第[一二三四五六七八九十百千万\d]+章/g;
      const chapterMatches = text.match(chapterPattern);
      if (chapterMatches && chapterMatches.length > 0) {
        setTotalChapters(chapterMatches.length);
        setSelectedChapter(chapterMatches.length);
      } else {
        setTotalChapters(1);
        setSelectedChapter(1);
      }
    } catch (error) {
      console.error("解析文件内容失败:", error);
      toast.error("解析文件内容失败");
      resetUploadState();
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!validateFile(file)) return;
    setUploadStatus("uploading");
    setUploadedFile(null);
    try {
      const result = await uploadFileReq(file);
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const fileData: FileItem = {
        id: `file_${Date.now()}`,
        originalName: file.name,
        serverFileName: result.fileName,
        putFilePath: result.putFilePath,
        displayUrl: result.putFilePath,
        type: file.type,
        size: file.size,
        extension,
      };
      setUploadedFile(fileData);
      await parseNovelContent(file);
      setUploadStatus("uploaded");
    } catch (error) {
      console.error("文件上传失败:", error);
      toast.error("文件上传失败，请重试");
      resetUploadState();
    }
  };

  const handleFileSelect = () => {
    if (locked) return;
    fileInputRef.current?.click();
  };

  const handleReupload = () => {
    if (locked) return;
    resetUploadState();
    requestAnimationFrame(() => handleFileSelect());
  };

  const onPlotStreamData = (data: PostStreamData) => {
    switch (data.event) {
      case "messages/partial": {
        const content = getContentFromPartial(data.data);
        streamingContentRef.current = content;
        setStreamingContent(content);
        setOutlineResult((prev) => ({
          content: content || prev?.content || "",
          originalName: uploadedFile?.originalName,
          serverFileName: uploadedFile?.serverFileName,
          wordCount: totalWords,
          chapterNum: selectedChapter,
        }));
        if (content && uploadStatus !== "completed") {
          setUploadStatus("completed");
        }
        break;
      }
      case "updates": {
        if (!streamingContentRef.current) {
          toast.error("您上传的小说包含违规内容，请重新上传");
          setUploadStatus("empty");
          setIsStreaming(false);
          return;
        }
        const finalPlotContent = getPlotResultFromUpdates((data as { data?: unknown })?.data);
        if (finalPlotContent) {
          setOutlineResult((prev) => {
            if (!prev) return prev;
            return { ...prev, content: finalPlotContent };
          });
        }
        break;
      }
      default:
        break;
    }
  };

  const onPlotStreamEnd = () => {
    setIsStreaming(false);
    abortRef.current = null;
  };

  const onPlotStreamError = (error: Error) => {
    console.error("生成章纲失败:", error);
    setIsStreaming(false);
    abortRef.current = null;
  };

  const handleConfirmGenerate = async () => {
    if (locked) return;
    if (uploadStatus !== "uploaded" || !uploadedFile) {
      toast.warning("请先上传小说文件");
      return;
    }
    if (isStreaming) return;
    if (abortRef.current) abortRef.current.abort();

    setStreamingContent("");
    setOutlineResult(null);
    setIsStreaming(true);

    const data: PostScriptTemplateStreamPlotRequestData = {
      attachmentName: uploadedFile.serverFileName,
      wordCount: totalWords,
      chapterNum: selectedChapter,
    };

    try {
      abortRef.current = new AbortController();
      await postScriptTemplateStreamPlot(
        data,
        onPlotStreamData,
        onPlotStreamError,
        onPlotStreamEnd,
        { signal: abortRef.current.signal }
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setIsStreaming(false);
        abortRef.current = null;
        return;
      }
      console.error("生成章纲失败:", error);
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleNextStep = () => {
    if (locked) return;
    if (!outlineResult) {
      toast.warning("请先完成章纲生成");
      return;
    }
    onConfirm?.(outlineResult);
  };

  useEffect(() => {
    if (!novelContent) return;
    try {
      const data = JSON.parse(novelContent) as ScriptNovelOutlineChapterResult;
      setOutlineResult(data);
      setUploadStatus("completed");
      const initialContent = data.content || "";
      setStreamingContent(initialContent);
      streamingContentRef.current = initialContent;
    } catch (e) {
      console.error("Failed to parse novelContent:", e);
    }
  }, [novelContent]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const contentText = outlineResult?.content || streamingContent || "";
  const fileIconType = uploadedFile?.extension === "docx" ? ".docx" : ".TXT";

  return (
    <div className="novel-outline-chapter-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileUpload(file);
          e.target.value = "";
        }}
      />

      <div className="novel-outline-chapter-layout">
        {uploadStatus !== "uploaded" && uploadStatus !== "completed" ? (
          <div className="section-title">
            导入小说原文,进行
            <span className="title-highlight">
              章纲拆解
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "upload-area",
            uploadStatus === "empty" && "upload-area-empty",
            uploadStatus === "hover" && "upload-area-hover",
            uploadStatus === "uploading" && "upload-area-uploading",
            uploadStatus === "uploaded" && "upload-area-uploaded",
            uploadStatus === "completed" && "upload-area-completed"
          )}
          onClick={uploadStatus === "empty" || uploadStatus === "hover" ? handleFileSelect : undefined}
          onDragOver={(e) => {
            if (locked) return;
            e.preventDefault();
            if (uploadStatus === "empty" || uploadStatus === "hover") {
              setUploadStatus("hover");
            }
          }}
          onDragLeave={(e) => {
            if (locked) return;
            e.preventDefault();
            if (uploadStatus === "hover") setUploadStatus("empty");
          }}
          onDrop={(e) => {
            if (locked) return;
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
              void handleFileUpload(files[0]);
            } else {
              setUploadStatus("empty");
            }
          }}
        >
          {(uploadStatus === "empty" || uploadStatus === "hover") && (
            <>
              <div className="upload-icon-wrapper">
                <img src={scriptEmptyUploadIcon} alt="上传" className="upload-icon-empty" />
              </div>
              <div className="upload-text">
                <span>拖拽文件到此或点击</span>
                <span className="upload-link">
                  上传
                </span>
              </div>
              <div className="upload-hint">仅支持 .txt格式和 .docx格式，文件大小限制10MB</div>
            </>
          )}

          {uploadStatus === "uploading" && (
            <>
              <div className="upload-icon-wrapper">
                <div className={cn("file-icon", "file-icon-txt")} style={{ backgroundImage: `url(${uploadBackImage})` }}>
                  <div className="file-icon-text">
                    {fileIconType}
                  </div>
                  <div className="file-icon-arrow" style={{ backgroundImage: `url(${uploadUpImage})` }} />
                </div>
              </div>
              <div className="loading-indicator">
                <div className="loading-dot loading-dot-1" />
                <div className="loading-dot loading-dot-2" />
              </div>
              <div className="loading-text">加载中...</div>
            </>
          )}

          {uploadStatus === "uploaded" && uploadedFile && (
            <div className="uploaded-content">
              <div className="file-info-card">
                <div className={cn("file-icon-display", "file-icon-txt")} style={{ backgroundImage: `url(${uploadBackImage})` }}>
                  <div className="file-icon-text">
                  {fileIconType}
                  </div>
                  <div className="file-icon-arrow" style={{ backgroundImage: `url(${uploadUpImage})` }} />
                </div>
                <div className="file-info">
                  <div className="file-name">{uploadedFile.originalName}</div>
                  <div className="file-size">{formatFileSize(uploadedFile.size)}</div>
                </div>
              </div>

              {totalChapters > 0 && (
                <div className="chapter-range-selector">
                  <div className="chapter-range-info">
                    本书共计{totalWords}字, {totalChapters}章, 请选择需要拆解的章节范围
                  </div>
                  <div className="chapter-range-note">
                    注:若小说原文未使用"第N章"格式进行章节划分,则无法获取正确章节范围
                  </div>
                  <div className="chapter-range-controls">
                    <div className="chapter-indicator chapter-indicator-left">
                      <span className="chapter-indicator-value">
                        1
                      </span>
                    </div>
                    <div className="chapter-slider-container">
                      <div className="slider-content">
                      <Slider
                        value={[selectedChapter]}
                        min={1}
                        max={Math.max(1, totalChapters)}
                        step={1}
                        disabled={locked}
                        onValueChange={(v) => setSelectedChapter(v[0] ?? 1)}
                        className="chapter-slider"
                      />
                      <div
                        className="chapter-value"
                        style={{ left: `${chapterPercent}%`, backgroundImage: `url(${chapterTipImage})` }}
                      >
                        <span className="chapter-value-text">
                          {selectedChapter}章
                        </span>
                      </div>
                    </div>
                    </div>
                    <div className="chapter-indicator chapter-indicator-right">
                      <span className="chapter-indicator-value">
                        {totalChapters}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div
                className="reupload-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReupload();
                }}
              >
                <img src={scriptEmptyUploadIcon} className="reupload-icon" alt="" />
                <span>重新上传</span>
              </div>

              {!locked && (
                <Button
                  className="confirm-btn"
                  onClick={() => void handleConfirmGenerate()}
                >
                  确定
                </Button>
              )}
            </div>
          )}

          {uploadStatus === "completed" && (
            <div className="completed-content">
              {fileNameWithoutExtension ? (
                <div className="completed-title">
                  {fileNameWithoutExtension}
                </div>
              ) : null}
              <div className="completed-content-area">
                <AutoScrollArea className="h-full" autoScroll maxHeight="100%">
                  <div className="script-novel-outline-chapter-editor">
                    <MarkdownRenderer content={contentText} />
                  </div>
                </AutoScrollArea>
              </div>
              <div className="completed-actions">
                {!locked && !isStreaming ? (
                  <div
                    className="reupload-btn"
                    onClick={handleReupload}
                  >
                    <img src={scriptEmptyUploadIcon} className="reupload-icon" alt="" />
                    <span>重新上传</span>
                  </div>
                ) : null}
                {!locked && !isStreaming ? (
                  <Button
                    className="next-step-btn"
                    onClick={handleNextStep}
                    disabled={isStreaming}
                  >
                    下一步
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {hasNextContent ? (
          <div className="bottom-revert-section">
            <Button
              className="revert-btn-bottom"
              onClick={() => onRevertToCurrent?.()}
            >
              回退至小说纲章
            </Button>
          </div>
        ) : null}

        {(isStreaming && uploadStatus !== "completed") ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50">
            <div className="rounded-md bg-white px-4 py-2 text-sm text-[#666] shadow-sm">生成中...</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
