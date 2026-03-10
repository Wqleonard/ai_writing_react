import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { addNote } from "@/api/notes";
import type { PostStreamData } from "@/api";
import {
  postDocTemplateStreamContent,
  postDocTemplateStreamDetailedOutline,
} from "@/api/generate-quick";
import MainEditor, { type MarkdownEditorRef } from "@/components/MainEditor";
import type {
  PostDocTemplateStreamContentRequestData,
  PostDocTemplateStreamDetailedOutlineRequestData,
} from "@/api/writing-templates";

type ChapterOutlineData = {
  chapter: string;
  chapter_title: string;
  chapter_note: string;
};

type ChapterStorageData = {
  detailedOutline?: string;
  content?: string;
  isFinished?: boolean;
};

type NoteItem = {
  content?: string;
};

type Props = {
  chapterIndex: number;
  chapterData?: ChapterOutlineData | null;
  chapterContent?: string;
  locked?: boolean;
  isLastChapterWithContent?: boolean;
  previousChapterIndex?: number;
  hasNextContent?: boolean;
  workTitle?: string;
  storyContent?: string;
  characterContent?: string;
  workTags?: Array<{ name: string }>;
  wordNum?: number;
  totalChapterNum?: number;
  allChapterServerData?: Record<string, string>;
  onConfirm: (chapterData: string) => void;
  onRevert: () => void;
  onRevertToNote: () => void;
  onRevertToOutline: () => void;
  onUpdateChapterNote: (chapterNote: string) => void;
  onScrollBoundary: (boundary: "top" | "bottom") => void;
  onGenerateContent: () => void;
  onContinueNextChapter: () => void;
  onRevertToCurrent: () => void;
};

export type QuickChapterEditorHandle = {
  insertNoteContent: (notes: unknown[]) => { success: boolean; message: string };
};

const CHINESE_NUMBERS = [
  "",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
];

const numberToChinese = (num: number): string => CHINESE_NUMBERS[num] || String(num);

const getChapterIndexFromDir = (dir: string): number => {
  const match = dir.match(/正文-第(.+)章\.md/);
  if (!match) return -1;
  const idx = CHINESE_NUMBERS.indexOf(match[1] || "");
  return idx > 0 ? idx - 1 : -1;
};

const getPartialText = (partialData: unknown): string => {
  if (!Array.isArray(partialData) || partialData.length === 0) return "";
  const first = partialData[0] as { content?: unknown };
  if (typeof first?.content === "string") return first.content;
  if (Array.isArray(first?.content)) {
    return first.content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String((item as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
};

const QuickChapterEditor = forwardRef<QuickChapterEditorHandle, Props>(
  (
    {
      chapterIndex,
      chapterData = null,
      chapterContent = "",
      locked = false,
      isLastChapterWithContent = false,
      previousChapterIndex,
      hasNextContent = false,
      workTitle = "",
      storyContent = "",
      characterContent = "",
      workTags = [],
      wordNum = 800,
      totalChapterNum = 0,
      allChapterServerData = {},
      onConfirm,
      onRevert,
      onRevertToNote,
      onRevertToOutline,
      onUpdateChapterNote,
      onScrollBoundary,
      onGenerateContent,
      onContinueNextChapter,
      onRevertToCurrent,
    },
    ref,
  ) => {
    const [chapterNote, setChapterNote] = useState("");
    const [detailedOutline, setDetailedOutline] = useState("");
    const [contentText, setContentText] = useState("");
    const [contentStreamingText, setContentStreamingText] = useState("");
    const [outlineStreamingText, setOutlineStreamingText] = useState("");
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [isEditingDetailedOutline, setIsEditingDetailedOutline] = useState(false);
    const [isGeneratingDetailedOutline, setIsGeneratingDetailedOutline] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [isEditingContent, setIsEditingContent] = useState(false);
    const [isNoteExpanded, setIsNoteExpanded] = useState(false);
    const [isOutlineExpanded, setIsOutlineExpanded] = useState(true);

    const outlineAbortRef = useRef<AbortController | null>(null);
    const contentAbortRef = useRef<AbortController | null>(null);
    const outlineStreamingRef = useRef("");
    const contentStreamingRef = useRef("");
    const outlineWrapperRef = useRef<HTMLDivElement | null>(null);
    const contentWrapperRef = useRef<HTMLDivElement | null>(null);
    const outlineScrollRef = useRef<HTMLDivElement | null>(null);
    const outlineEditorRef = useRef<MarkdownEditorRef | null>(null);
    const contentEditorRef = useRef<MarkdownEditorRef | null>(null);
    const lastBlurPositionRef = useRef<number | null>(null);

    const hasDetailedOutline = detailedOutline.trim().length > 0;
    const hasContent = contentText.trim().length > 0;
    const isOutlineLocked = hasContent || isGeneratingContent;
    const needFixedHeight = hasDetailedOutline && isOutlineExpanded;

    const isLastChapter = useMemo(() => {
      if (totalChapterNum > 0) return chapterIndex === totalChapterNum - 1;
      const chapterDirs = Object.keys(allChapterServerData).filter(
        (key) => key.startsWith("正文-第") && key.endsWith("章.md"),
      );
      const maxIndex = chapterDirs
        .map(getChapterIndexFromDir)
        .filter((idx) => idx >= 0)
        .reduce((max, idx) => (idx > max ? idx : max), -1);
      return maxIndex >= 0 && chapterIndex === maxIndex;
    }, [allChapterServerData, chapterIndex, totalChapterNum]);

    const saveChapterData = useCallback(
      (nextOutline = detailedOutline, nextContent = contentText) => {
        const storageData: ChapterStorageData = {
          detailedOutline: nextOutline || "",
          content: nextContent || "",
        };
        onConfirm(JSON.stringify(storageData));
      },
      [contentText, detailedOutline, onConfirm],
    );

    const getExistingDetailedOutlines = useCallback((): string[] => {
      const outlines: string[] = [];
      Object.keys(allChapterServerData).forEach((dir) => {
        if (!dir.startsWith("正文-第") || !dir.endsWith("章.md")) return;
        const idx = getChapterIndexFromDir(dir);
        if (idx < 0 || idx >= chapterIndex) return;
        const raw = allChapterServerData[dir];
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as ChapterStorageData;
          if (parsed.detailedOutline?.trim()) outlines.push(parsed.detailedOutline);
        } catch {
          // Keep compatibility with mixed legacy chapter formats.
        }
      });
      return outlines;
    }, [allChapterServerData, chapterIndex]);

    const getExistingChapters = useCallback((): string => {
      const chapters: string[] = [];
      Object.keys(allChapterServerData).forEach((dir) => {
        if (!dir.startsWith("正文-第") || !dir.endsWith("章.md")) return;
        const idx = getChapterIndexFromDir(dir);
        if (idx < 0 || idx >= chapterIndex) return;
        const raw = allChapterServerData[dir];
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as ChapterStorageData;
          if (parsed.content?.trim()) chapters.push(parsed.content);
        } catch {
          // Keep compatibility with mixed legacy chapter formats.
        }
      });
      return chapters.join("\n\n");
    }, [allChapterServerData, chapterIndex]);

    const handleSelectionNoteClick = useCallback(
      async (text: string) => {
        if (!text.trim()) {
          toast.warning("选中的内容为空，无法添加笔记");
          return;
        }
        const noteTitle = `${workTitle || "作品"}-正文-第${numberToChinese(chapterIndex + 1)}章`;
        try {
          await addNote(noteTitle, text.trim(), "PC_WORD_HIGHLIGHT");
          toast.success("笔记添加成功");
        } catch (error) {
          console.error("添加笔记失败:", error);
          toast.error("添加笔记失败，请重试");
        }
      },
      [chapterIndex, workTitle],
    );

    const generateDetailedOutline = useCallback(async () => {
      if (!chapterData) {
        toast.warning("缺少章节数据");
        return;
      }
      if (!storyContent || !characterContent) {
        toast.warning("缺少故事梗概或角色设定数据");
        return;
      }

      try {
        setDetailedOutline("");
        setOutlineStreamingText("");
        setIsGeneratingDetailedOutline(true);
        setIsOutlineExpanded(true);
        setIsEditingDetailedOutline(false);
        outlineAbortRef.current?.abort();
        outlineAbortRef.current = new AbortController();

        const storyWrapper = JSON.parse(storyContent);
        const characterWrapper = JSON.parse(characterContent);
        const story = storyWrapper.selectedData || storyWrapper;
        const character = characterWrapper.selectedData || characterWrapper;
        const description = workTags.map((tag) => tag.name).join(",");

        const requestData: PostDocTemplateStreamDetailedOutlineRequestData = {
          description,
          brainStorm: {
            title: story.title || "",
            intro: story.intro || "",
          },
          roleCard: character,
          chapterOutline: {
            chapter: chapterData.chapter,
            chapterTitle: chapterData.chapter_title,
            chapterNote: chapterNote || "",
          },
          existingChapters: getExistingChapters(),
          existingDetailedOutlines: getExistingDetailedOutlines(),
        };

        const onData = (data: PostStreamData) => {
          if (data?.event === "messages/partial") {
            const text = getPartialText(data.data);
            if (text) {
              outlineStreamingRef.current = text;
              setOutlineStreamingText(text);
              setDetailedOutline(text);
            }
            return;
          }
          if (data?.event === "updates") {
            const finalOutline =
              data?.data?.generate_writing_template?.result?.detailed_outline?.detailed_outline;
            if (finalOutline) {
              outlineStreamingRef.current = finalOutline;
              setOutlineStreamingText(finalOutline);
              setDetailedOutline(finalOutline);
            }
          }
        };

        const onError = (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("[QuickChapterEditor] 细纲流式请求失败:", error);
          setIsGeneratingDetailedOutline(false);
          outlineAbortRef.current = null;
          toast.error("生成细纲失败，请重试");
        };

        const onEnd = () => {
          const finalValue = outlineStreamingRef.current || "";
          setDetailedOutline(finalValue);
          saveChapterData(finalValue, contentText);
          setOutlineStreamingText("");
          outlineStreamingRef.current = "";
          setIsGeneratingDetailedOutline(false);
          outlineAbortRef.current = null;
        };

        await postDocTemplateStreamDetailedOutline(
          requestData,
          onData,
          onError,
          onEnd,
          { signal: outlineAbortRef.current.signal },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setIsGeneratingDetailedOutline(false);
          outlineAbortRef.current = null;
          return;
        }
        console.error("[QuickChapterEditor] 调用细纲接口失败:", error);
        setIsGeneratingDetailedOutline(false);
        outlineAbortRef.current = null;
        toast.error("生成细纲失败，请重试");
      }
    }, [
      chapterData,
      chapterNote,
      contentText,
      getExistingChapters,
      getExistingDetailedOutlines,
      saveChapterData,
      storyContent,
      characterContent,
      workTags,
      outlineStreamingRef,
    ]);

    const generateContent = useCallback(async () => {
      if (!chapterData) {
        toast.warning("缺少章节数据");
        return;
      }
      if (!detailedOutline.trim()) {
        toast.warning("请先生成细纲");
        return;
      }
      if (!storyContent || !characterContent) {
        toast.warning("缺少故事梗概或角色设定数据");
        return;
      }

      try {
        setIsOutlineExpanded(false);
        setContentText("");
        setContentStreamingText("");
        setIsGeneratingContent(true);
        setIsEditingContent(false);
        contentAbortRef.current?.abort();
        contentAbortRef.current = new AbortController();

        const storyWrapper = JSON.parse(storyContent);
        const characterWrapper = JSON.parse(characterContent);
        const story = storyWrapper.selectedData || storyWrapper;
        const character = characterWrapper.selectedData || characterWrapper;
        const description = workTags.map((tag) => tag.name).join(",");

        const requestData: PostDocTemplateStreamContentRequestData = {
          description,
          brainStorm: {
            title: story.title || "",
            intro: story.intro || "",
          },
          roleCard: character,
          chapterOutline: {
            chapter: chapterData.chapter,
            chapterTitle: chapterData.chapter_title,
            chapterNote: chapterNote || "",
          },
          wordCount: wordNum || 800,
          chapterDetailOutline: detailedOutline,
          existingChapters: getExistingChapters(),
        };

        const onData = (data: PostStreamData) => {
          if (data?.event === "messages/partial") {
            const text = getPartialText(data.data);
            if (text) {
              contentStreamingRef.current = text;
              setContentStreamingText(text);
            }
          }
        };

        const onError = (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("[QuickChapterEditor] 正文流式请求失败:", error);
          setIsGeneratingContent(false);
          contentAbortRef.current = null;
          toast.error("生成正文失败，请重试");
        };

        const onEnd = () => {
          const finalContent = contentStreamingRef.current || "";
          setContentText(finalContent);
          setContentStreamingText("");
          contentStreamingRef.current = "";
          setIsGeneratingContent(false);
          contentAbortRef.current = null;
          saveChapterData(detailedOutline, finalContent);
          if (isLastChapter && finalContent.trim()) {
            toast.success("恭喜！您已完成所有章节的创作！");
          }
          onGenerateContent();
        };

        await postDocTemplateStreamContent(
          requestData,
          onData,
          onError,
          onEnd,
          { signal: contentAbortRef.current.signal },
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setIsGeneratingContent(false);
          contentAbortRef.current = null;
          return;
        }
        console.error("[QuickChapterEditor] 调用正文接口失败:", error);
        setIsGeneratingContent(false);
        contentAbortRef.current = null;
        toast.error("生成正文失败，请重试");
      }
    }, [
      chapterData,
      chapterNote,
      characterContent,
      detailedOutline,
      getExistingChapters,
      isLastChapter,
      onGenerateContent,
      saveChapterData,
      storyContent,
      wordNum,
      workTags,
    ]);

    const regenerateContent = useCallback(async () => {
      const ok = window.confirm("重新生成将清空当前正文内容，是否确认？");
      if (!ok) return;
      setContentText("");
      setContentStreamingText("");
      setIsEditingContent(false);
      await generateContent();
    }, [generateContent]);

    const saveChapterNote = useCallback(() => {
      if (!isEditingNote) return;
      setIsEditingNote(false);
      onUpdateChapterNote(chapterNote);
    }, [chapterNote, isEditingNote, onUpdateChapterNote]);

    const exitOutlineEditAndSave = useCallback(() => {
      if (!isEditingDetailedOutline) return;
      setIsEditingDetailedOutline(false);
      saveChapterData();
    }, [isEditingDetailedOutline, saveChapterData]);

    const exitContentEditAndSave = useCallback(() => {
      if (!isEditingContent) return;
      setIsEditingContent(false);
      saveChapterData();
    }, [isEditingContent, saveChapterData]);

    const getContentCursorPosition = useCallback((): number | null => {
      const editor = contentEditorRef.current?.editor;
      if (!editor) return null;
      return editor.state.selection.from ?? null;
    }, []);

    useEffect(() => {
      const onDocClick = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          isEditingDetailedOutline &&
          outlineWrapperRef.current &&
          !outlineWrapperRef.current.contains(target)
        ) {
          exitOutlineEditAndSave();
        }
        if (isEditingContent && contentWrapperRef.current && !contentWrapperRef.current.contains(target)) {
          exitContentEditAndSave();
        }
      };
      document.addEventListener("click", onDocClick);
      return () => {
        document.removeEventListener("click", onDocClick);
      };
    }, [exitContentEditAndSave, exitOutlineEditAndSave, isEditingContent, isEditingDetailedOutline]);

    useEffect(() => {
      setChapterNote(chapterData?.chapter_note || "");
    }, [chapterData]);

    useEffect(() => {
      if (!chapterContent || chapterContent.trim() === "") {
        setDetailedOutline("");
        setContentText("");
        setIsOutlineExpanded(true);
        setIsGeneratingDetailedOutline(false);
        setIsEditingDetailedOutline(false);
        return;
      }
      try {
        const parsed = JSON.parse(chapterContent) as ChapterStorageData;
        const nextDetailed = parsed.detailedOutline || "";
        const nextContent = parsed.content || "";
        setDetailedOutline(nextDetailed);
        setContentText(nextContent);
        if (nextContent.trim()) setIsOutlineExpanded(false);
      } catch (error) {
        console.error("[QuickChapterEditor] 解析章节数据失败:", error);
      }
    }, [chapterContent]);

    useEffect(() => {
      const scrollEl = outlineScrollRef.current;
      if (!scrollEl) return;
      const onScroll = () => {
        if (scrollEl.scrollTop <= 0) onScrollBoundary("top");
        const nearBottom = scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop <= 1;
        if (nearBottom) onScrollBoundary("bottom");
      };
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        scrollEl.removeEventListener("scroll", onScroll);
      };
    }, [onScrollBoundary]);

    useEffect(() => {
      return () => {
        outlineAbortRef.current?.abort();
        contentAbortRef.current?.abort();
      };
    }, []);

    const insertNoteContent = useCallback(
      (notes: unknown[]) => {
        if (isGeneratingContent) return { success: false, message: "请等待生成结束后添加" };
        if (!hasContent) return { success: false, message: "请先生成正文内容" };
        const editor = contentEditorRef.current?.editor;
        if (!editor) return { success: false, message: "无法找到正文编辑器" };

        const hasFocus = editor.isFocused;
        const insertPosition = hasFocus ? editor.state.selection.from : lastBlurPositionRef.current;
        if (insertPosition === null || insertPosition === undefined) {
          return { success: false, message: "请先在正文中确认位置" };
        }

        const noteItems = notes as NoteItem[];
        const notesContent = noteItems
          .map((note) => String(note?.content ?? ""))
          .filter(Boolean)
          .join("\n\n");
        if (!notesContent.trim()) return { success: false, message: "笔记内容为空" };

        editor.chain().focus().setTextSelection(insertPosition).insertContent(notesContent).run();
        const nextText = contentEditorRef.current?.getMarkdown() ?? contentText;
        setContentText(nextText);
        setIsEditingContent(true);
        lastBlurPositionRef.current = null;
        saveChapterData(detailedOutline, nextText);
        return { success: true, message: "笔记内容已添加到正文" };
      },
      [contentText, detailedOutline, hasContent, isGeneratingContent, saveChapterData],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertNoteContent,
      }),
      [insertNoteContent],
    );

    return (
      <div className="flex flex-col pt-[87px] pr-[120px] pb-5">
        <div className={`flex flex-col ${needFixedHeight ? "h-[calc(100vh-56px)] overflow-hidden" : ""}`}>
          <div className="mb-5 text-[32px] leading-[1.32em] font-bold text-[#464646]">
            {chapterData?.chapter} {chapterData?.chapter_title}
          </div>

          <div className="mb-3 flex items-center gap-[60px]">
            <div
              className={`relative flex min-h-[45px] flex-1 items-center gap-3 overflow-hidden rounded-[5px] border px-3 transition-all ${
                hasDetailedOutline || isGeneratingDetailedOutline || isGeneratingContent
                  ? "h-auto min-h-[26px] cursor-default border-transparent px-0"
                  : "h-[45px] cursor-pointer border-[#d6d6d6]"
              } ${isEditingNote ? "border-(--theme-color)" : ""}`}
              onClick={() => {
                if (locked || hasDetailedOutline || isGeneratingDetailedOutline) return;
                setIsEditingNote(true);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <span
                  className={`shrink-0 leading-[1.32em] ${
                    hasDetailedOutline || isGeneratingDetailedOutline || isGeneratingContent
                      ? "text-[20px] text-[#999]"
                      : "text-[24px] text-[#464646]"
                  }`}
                >
                  故事梗概：
                </span>
                {!isEditingNote ? (
                  <span
                    className={`min-w-0 flex-1 leading-[1.32em] ${
                      hasDetailedOutline || isGeneratingDetailedOutline || isGeneratingContent
                        ? "overflow-visible text-[20px] whitespace-pre-wrap text-[#999]"
                        : "overflow-hidden text-[24px] text-ellipsis whitespace-nowrap text-[#333]"
                    }`}
                  >
                    {chapterNote}
                  </span>
                ) : (
                  <input
                    className="w-full min-w-0 border-none bg-transparent text-[24px] leading-[1.32em] text-[#333] outline-none"
                    value={chapterNote}
                    onChange={(e) => setChapterNote(e.target.value)}
                    onBlur={saveChapterNote}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveChapterNote();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>
              {!hasDetailedOutline && !isGeneratingDetailedOutline && (
                <div className="flex h-full shrink-0 items-center gap-[10px] text-[#999]">
                  <span className="text-[23px]">✎</span>
                  <span className="text-[20px]">编辑</span>
                </div>
              )}
            </div>

            <div className="shrink-0">
              {!hasDetailedOutline && !isGeneratingDetailedOutline ? (
                <button
                  type="button"
                  disabled={!chapterNote}
                  className="flex h-[52px] w-[165px] items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[24px] leading-[1.32em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void generateDetailedOutline()}
                >
                  生成细纲
                </button>
              ) : isGeneratingDetailedOutline ? (
                <div className="w-[165px]" />
              ) : (
                <button
                  type="button"
                  disabled={isGeneratingDetailedOutline || isGeneratingContent}
                  className="h-10 w-[165px] rounded-[10px] border-2 border-[#999] text-[20px] text-[#999] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void onRevertToNote()}
                >
                  回退至此步骤
                </button>
              )}
            </div>
          </div>

          {isGeneratingDetailedOutline && !detailedOutline && !outlineStreamingText && (
            <div className="mt-[50px] mb-0 flex shrink-0 flex-col gap-10 pr-[223px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[52px] animate-pulse rounded-[10px] bg-linear-to-r from-[#d9d9d9] via-[#e8e8e8] to-[#d9d9d9] ${
                    i >= 3 ? "w-[756px]" : "w-full"
                  }`}
                />
              ))}
            </div>
          )}

          {(hasDetailedOutline || outlineStreamingText) &&
            !(isGeneratingDetailedOutline && !detailedOutline && !outlineStreamingText) && (
              <div className={`mt-[10px] shrink-0 ${isOutlineExpanded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}`}>
                {isGeneratingDetailedOutline && (outlineStreamingText || detailedOutline) ? (
                  <div className="flex">
                    <div ref={outlineWrapperRef} className="min-h-[340px] flex-1 rounded-[10px] bg-[#f7f7f8]">
                      <div ref={outlineScrollRef} className="h-full max-h-full overflow-y-auto p-4">
                        <MainEditor
                          className="editor-outer-scroll-mode [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:text-[24px] [&_.ProseMirror]:leading-[1.8em] [&_.ProseMirror]:text-[#333]"
                          fontClassName="font-KaiTi"
                          value={detailedOutline}
                          readonly
                          minHeight={300}
                          placeholder="正在生成细纲..."
                        />
                      </div>
                    </div>
                    <div className="w-[200px]" />
                  </div>
                ) : isOutlineLocked ? (
                  <div className="flex min-h-0 flex-1 items-center gap-[60px] overflow-hidden">
                    {!isOutlineExpanded ? (
                      <div
                        className="flex min-h-[26px] flex-1 cursor-pointer items-center px-3"
                        onClick={() => setIsOutlineExpanded(true)}
                      >
                        <div className="min-w-0">
                          <span className="text-[20px] text-[#999]">章节细纲：</span>
                          <span className="text-[20px] text-[#999]">{detailedOutline}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1">
                        <div
                          ref={outlineWrapperRef}
                          className="min-h-[280px] flex-1 cursor-pointer rounded-[10px] bg-[#f7f7f8]"
                          onClick={() => setIsOutlineExpanded(false)}
                        >
                          <div ref={outlineScrollRef} className="h-full max-h-full overflow-y-auto p-4">
                            <MainEditor
                              className="editor-outer-scroll-mode [&_.ProseMirror]:min-h-[240px] [&_.ProseMirror]:text-[24px] [&_.ProseMirror]:leading-[1.8em] [&_.ProseMirror]:text-[#333]"
                              fontClassName="font-KaiTi"
                              value={detailedOutline}
                              readonly
                              minHeight={240}
                              placeholder="细纲内容..."
                            />
                          </div>
                        </div>
                        <div className="ml-[60px]">
                          <button
                            type="button"
                            disabled={isGeneratingContent}
                            className="h-10 w-[165px] rounded-[10px] border-2 border-[#999] text-[20px] text-[#999] disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => void onRevertToOutline()}
                          >
                            回退至此步骤
                          </button>
                        </div>
                      </div>
                    )}
                    {!isOutlineExpanded && (
                      <div>
                        <button
                          type="button"
                          disabled={isGeneratingContent}
                          className="h-10 w-[165px] rounded-[10px] border-2 border-[#999] text-[20px] text-[#999] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void onRevertToOutline()}
                        >
                          回退至此步骤
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex">
                    <div
                      ref={outlineWrapperRef}
                      className={`relative flex-1 rounded-[10px] bg-[#f7f7f8] ${
                        isEditingDetailedOutline ? "ring-1 ring-[#ffb200]" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOutlineLocked) return;
                        setIsEditingDetailedOutline(true);
                        setIsOutlineExpanded(true);
                      }}
                    >
                      {!isGeneratingDetailedOutline && hasDetailedOutline && !isEditingDetailedOutline && (
                        <button
                          type="button"
                          className="absolute top-3 right-3 z-10 flex items-center gap-2 text-[#999]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditingDetailedOutline(true);
                          }}
                        >
                          <span>✎</span>
                          <span>编辑</span>
                        </button>
                      )}
                      <div ref={outlineScrollRef} className="h-full max-h-[420px] overflow-y-auto p-4">
                        <MainEditor
                          ref={outlineEditorRef}
                          className="editor-outer-scroll-mode [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:text-[24px] [&_.ProseMirror]:leading-[1.8em] [&_.ProseMirror]:text-[#333]"
                          fontClassName="font-KaiTi"
                          value={detailedOutline}
                          readonly={isGeneratingDetailedOutline || !isEditingDetailedOutline}
                          onChange={setDetailedOutline}
                          onBlur={exitOutlineEditAndSave}
                          needSelectionToolbar={!isGeneratingDetailedOutline && isEditingDetailedOutline}
                          btns={["note"]}
                          onSelectionNote={(text) => void handleSelectionNoteClick(text)}
                          minHeight={280}
                          placeholder="细纲内容..."
                        />
                      </div>
                    </div>
                    <div className="ml-[60px] flex w-[165px] flex-col gap-3">
                      <button
                        type="button"
                        className="h-10 w-[165px] rounded-[10px] border-2 border-[#999] text-[20px] text-[#999]"
                        onClick={() => void generateDetailedOutline()}
                      >
                        重新生成
                      </button>
                      <button
                        type="button"
                        className="flex h-[52px] w-[165px] items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[24px] leading-[1.32em] font-bold text-white"
                        onClick={() => void generateContent()}
                      >
                        生成正文
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {isGeneratingContent && !contentText && !contentStreamingText && (
            <div className="mt-[50px] mb-0 flex shrink-0 flex-col gap-10 pr-[223px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-[52px] animate-pulse rounded-[10px] bg-linear-to-r from-[#d9d9d9] via-[#e8e8e8] to-[#d9d9d9] ${
                    i >= 3 ? "w-[756px]" : "w-full"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {(hasContent || contentStreamingText) &&
          !(isGeneratingContent && !contentText && !contentStreamingText) && (
            <div className="mt-2">
              <div className="flex">
                <div
                  ref={contentWrapperRef}
                  className={`flex-1 rounded-[10px] bg-[#f7f7f8] p-4 ${
                    isEditingContent ? "ring-1 ring-[#ffb200]" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isGeneratingContent || !hasContent || isEditingContent) return;
                    setIsEditingContent(true);
                  }}
                >
                  {isGeneratingContent ? (
                    <MainEditor
                      className="editor-outer-scroll-mode [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:text-[24px] [&_.ProseMirror]:leading-[1.8em] [&_.ProseMirror]:text-[#333]"
                      fontClassName="font-KaiTi"
                      value={contentStreamingText}
                      readonly
                      minHeight={300}
                      placeholder="正在生成正文..."
                    />
                  ) : (
                    <MainEditor
                      ref={contentEditorRef}
                      className="editor-outer-scroll-mode [&_.ProseMirror]:min-h-[420px] [&_.ProseMirror]:text-[24px] [&_.ProseMirror]:leading-[1.8em] [&_.ProseMirror]:text-[#333]"
                      fontClassName="font-KaiTi"
                      value={contentText}
                      readonly={isGeneratingContent || !isEditingContent}
                      onChange={setContentText}
                      onBlur={() => {
                        lastBlurPositionRef.current = getContentCursorPosition();
                        exitContentEditAndSave();
                      }}
                      needSelectionToolbar={isEditingContent}
                      btns={["note"]}
                      onSelectionNote={(text) => void handleSelectionNoteClick(text)}
                      minHeight={420}
                      placeholder="正文内容..."
                    />
                  )}
                </div>

                <div className="ml-6 w-[200px]">
                  <div className="sticky top-[120px] flex flex-col gap-3">
                    {hasContent && !isGeneratingContent && !locked && (
                      <button
                        type="button"
                        className="h-10 w-full rounded-[10px] border-2 border-[#999] text-[20px] text-[#999]"
                        onClick={() => void regenerateContent()}
                      >
                        重新生成
                      </button>
                    )}
                    {isLastChapterWithContent && hasContent && !isGeneratingContent && !locked && (
                      <button
                        type="button"
                        className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[24px] leading-[1.32em] font-bold text-white"
                        onClick={() => void onContinueNextChapter()}
                      >
                        {isLastChapter ? "完成" : "继续下一章"}
                      </button>
                    )}
                    {locked && !isGeneratingContent && (
                      <button
                        type="button"
                        className="h-10 w-full rounded-[10px] border-2 border-[#999] text-[20px] text-[#999]"
                        onClick={() => void onRevertToCurrent()}
                      >
                        回退至第{numberToChinese(chapterIndex + 1)}章
                      </button>
                    )}
                    {!locked && hasNextContent && (
                      <button
                        type="button"
                        className="h-10 w-full rounded-[10px] border-2 border-[#999] text-[20px] text-[#999]"
                        onClick={() => void onRevertToCurrent()}
                      >
                        回退至此步骤
                      </button>
                    )}
                    {!locked && (
                      <button
                        type="button"
                        className="h-10 w-full rounded-[10px] border border-[#d0d0d0] text-[16px] text-[#777]"
                        onClick={() => void onRevert()}
                      >
                        {previousChapterIndex !== undefined && previousChapterIndex >= 0
                          ? `回退至第${numberToChinese(previousChapterIndex + 1)}章`
                          : "回退至编辑大纲"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    );
  },
);

QuickChapterEditor.displayName = "QuickChapterEditor";

export default QuickChapterEditor;
