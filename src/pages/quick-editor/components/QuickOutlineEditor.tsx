import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addNote } from "@/api/notes";
import { postDocTemplateStreamOutline } from "@/api/generate-quick";
import type { PostStreamData } from "@/api";
import MarkdownEditor from "@/components/MainEditor";
import { LinkButton } from "@/components/ui/LinkButton";
import { Iconfont } from "@/components/IconFont";

type StoryData = {
  title: string;
  intro: string;
  theme: string;
};

type CharacterData = {
  name?: string;
  gender?: string;
  age?: string;
  bloodType?: string;
  mbti?: string;
  experiences?: string;
  personality?: string;
  abilities?: string;
  identity?: string;
};

type OutlineChapter = {
  chapter: string;
  chapter_title: string;
  chapter_note: string;
};

type GenerateOutlineData = {
  outline_dict: OutlineChapter[];
};

type OutlineStorageData = {
  mdContent: string;
  jsonContent: GenerateOutlineData;
};

type Props = {
  selectedTagIds?: string;
  storyContent?: string;
  characterContent?: string;
  outlineContent?: string;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
  workInfoTitle?: string;
  workTags?: Array<{ name: string }>;
  chapterNum?: number;
  onConfirm: (outlineData: string) => void;
  onRevert: () => void;
  onRevertToCurrent: () => void;
  onErrorAndRevert: (targetDir: string) => void;
};

const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) return "";
  const first = partialData[0];
  if (Array.isArray(first?.content) && first.content.length > 0 && first.content[0]?.text) {
    return first.content[0].text;
  }
  return "";
};

const QuickOutlineEditor = ({
  selectedTagIds = "",
  storyContent = "",
  characterContent = "",
  outlineContent = "",
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  workInfoTitle = "大纲",
  workTags = [],
  chapterNum = 10,
  onConfirm,
  onRevert,
  onRevertToCurrent,
  onErrorAndRevert,
}: Props) => {
  const [outlineContentMd, setOutlineContentMd] = useState("");
  const [outlineContentJson, setOutlineContentJson] = useState<GenerateOutlineData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedVersion] = useState("v1");
  const abortRef = useRef<AbortController | null>(null);
  const prevTriggerRef = useRef(0);
  const latestTriggerParamsRef = useRef({
    storyContent,
    characterContent,
    selectedTagIds,
    locked,
  });

  useEffect(() => {
    latestTriggerParamsRef.current = {
      storyContent,
      characterContent,
      selectedTagIds,
      locked,
    };
  }, [storyContent, characterContent, selectedTagIds, locked]);

  const hasOutlineContent = useMemo(() => outlineContentJson !== null, [outlineContentJson]);

  const getChapterNumber = useCallback((): number => {
    if (chapterNum && chapterNum > 0) return chapterNum;
    const tag = workTags.find((t) => t.name.includes("章"));
    if (!tag) return 10;
    const match = tag.name.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 10;
  }, [chapterNum, workTags]);

  const onOutlineStreamData = useCallback((data: PostStreamData) => {
    if (data.event === "messages/partial") {
      setOutlineContentMd(getContentFromPartial(data.data));
      return;
    }
    if (data.event === "updates") {
      const generateOutline: GenerateOutlineData | undefined =
        data?.data?.generate_writing_template?.result?.outline;
      if (generateOutline?.outline_dict && Array.isArray(generateOutline.outline_dict)) {
        setOutlineContentJson(generateOutline);
      }
    }
  }, []);

  const onOutlineStreamEnd = useCallback(() => {
    setIsStreaming(false);
    setLoading(false);
    abortRef.current = null;
    if (!locked) setIsEditing(true);
  }, [locked]);

  const onOutlineStreamError = useCallback(
    (error: Error) => {
      console.error("[QuickOutlineEditor] 获取大纲失败:", error);
      setLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
      onErrorAndRevert("主角设定.md");
    },
    [onErrorAndRevert],
  );

  const generateOutline = useCallback(async () => {
    if (loading || isStreaming) return;
    if (!storyContent || !characterContent) {
      toast.warning("请先完成前面的步骤");
      return;
    }
    try {
      const storyWrapper = JSON.parse(storyContent);
      const characterWrapper = JSON.parse(characterContent);
      const story: StoryData = storyWrapper.selectedData || storyWrapper;
      const character: CharacterData = characterWrapper.selectedData || characterWrapper;
      if (abortRef.current) abortRef.current.abort();
      setOutlineContentMd("");
      setOutlineContentJson(null);
      setIsEditing(false);
      setIsStreaming(true);
      setLoading(true);
      const description = workTags.map((tag) => tag.name).join(",");
      const requestData = {
        brainStorm: {
          title: story.title,
          intro: story.intro,
        },
        roleCard: character,
        chapterNum: getChapterNumber(),
        description,
      };
      abortRef.current = new AbortController();
      await postDocTemplateStreamOutline(
        requestData as any,
        onOutlineStreamData,
        onOutlineStreamError,
        onOutlineStreamEnd,
        { signal: abortRef.current.signal },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setLoading(false);
        setIsStreaming(false);
        abortRef.current = null;
        return;
      }
      console.error("[QuickOutlineEditor] 调用模板流式接口失败:", error);
      setLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
      onErrorAndRevert("主角设定.md");
    }
  }, [
    characterContent,
    getChapterNumber,
    isStreaming,
    loading,
    onErrorAndRevert,
    onOutlineStreamData,
    onOutlineStreamEnd,
    onOutlineStreamError,
    storyContent,
    workTags,
  ]);

  const handleAddNote = useCallback(async () => {
    if (isStreaming) {
      toast.warning("请等待大纲生成完成后再添加笔记");
      return;
    }
    const content = outlineContentMd;
    if (!content) {
      toast.warning("大纲内容为空，无法添加笔记");
      return;
    }
    try {
      await addNote(workInfoTitle || "大纲", content, "PC_ADD");
      toast.success("笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      toast.error("添加笔记失败，请重试");
    }
  }, [isStreaming, outlineContentMd, workInfoTitle]);

  const handleChapterInput = useCallback(
    (chapterIndex: number, field: "chapter_title" | "chapter_note", value: string) => {
      setOutlineContentJson((prev) => {
        if (!prev?.outline_dict) return prev;
        const next = { ...prev, outline_dict: [...prev.outline_dict] };
        const item = { ...next.outline_dict[chapterIndex] };
        item[field] = value;
        next.outline_dict[chapterIndex] = item;
        return next;
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!hasOutlineContent || !outlineContentJson) {
      toast.warning("请先生成大纲内容");
      return;
    }
    const storageData: OutlineStorageData = {
      mdContent: outlineContentMd,
      jsonContent: outlineContentJson,
    };
    onConfirm(JSON.stringify(storageData));
  }, [hasOutlineContent, onConfirm, outlineContentJson, outlineContentMd]);

  const initFromProps = useCallback(() => {
    if (!outlineContent) return;
    const trimmed = outlineContent.trim();
    const isJson = trimmed.startsWith("{") && trimmed.endsWith("}");
    if (!isJson) {
      setOutlineContentMd(outlineContent);
      setOutlineContentJson(null);
      return;
    }
    try {
      const storageData: OutlineStorageData = JSON.parse(outlineContent);
      setOutlineContentMd(storageData.mdContent || "");
      setOutlineContentJson(storageData.jsonContent || null);
      if (storageData.jsonContent) setIsEditing(true);
    } catch (error) {
      console.error("[QuickOutlineEditor] Failed to parse JSON outline content:", error);
      setOutlineContentMd(outlineContent);
      setOutlineContentJson(null);
    }
  }, [outlineContent]);

  useEffect(() => {
    if (!outlineContent) {
      setOutlineContentMd("");
      setOutlineContentJson(null);
      return;
    }
    initFromProps();
  }, [initFromProps, outlineContent]);

  useEffect(() => {
    if (triggerGenerate > prevTriggerRef.current && triggerGenerate > 0) {
      setTimeout(() => {
        const latest = latestTriggerParamsRef.current;
        if (
          !latest.storyContent.trim() ||
          !latest.characterContent.trim() ||
          !latest.selectedTagIds ||
          latest.locked
        ) {
          return;
        }
        if (isStreaming || loading) {
          if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
          }
          setIsStreaming(false);
          setLoading(false);
        }
        setOutlineContentMd("");
        setOutlineContentJson(null);
        void generateOutline();
      }, 100);
    }
    prevTriggerRef.current = triggerGenerate;
  }, [
    generateOutline,
    isStreaming,
    loading,
    triggerGenerate,
  ]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex h-full max-h-full flex-col overflow-hidden pt-[50px] pr-[120px] pb-[50px] text-[24px]">
      <div className="mb-[50px] flex w-full shrink-0 items-center justify-between">
        <div className="text-2xl leading-[1.32em] text-black">请确认大纲内容</div>
        <div className="flex items-center gap-8">
          <LinkButton
            className="text-xl text-[#464646]"
            onClick={() => void handleAddNote()}
          >
            <Iconfont unicode="&#xe64c;" className="mr-2"/>
            <span>添加笔记</span>
          </LinkButton>
          {!locked && (
            <LinkButton
              disabled={loading}
              className="flex items-center text-xl text-[#464646]"
              onClick={() => void generateOutline()}
            >
              <Iconfont unicode="&#xe66f;" className="mr-2"/>
              <span>重新生成</span>
            </LinkButton>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pr-[50px] pb-[50px] [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [&::-webkit-scrollbar]:w-[2px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[rgba(0,0,0,0.1)]">
        <div className="mb-[30px] flex shrink-0 items-center justify-between">
          <div className="text-[32px] leading-[1.32em] font-bold text-[#464646]">大纲</div>
          {!locked && !isStreaming && (
            <div className="rounded border border-[#ddd] px-2 py-1 text-xs text-[#666]">{selectedVersion}</div>
          )}
        </div>

        {isStreaming ? (
          <div className="min-h-[260px] w-full rounded-[10px] bg-[#f7f7f8] p-4 text-[#333]">
            <MarkdownEditor
              value={outlineContentMd || "正在生成大纲..."}
              readonly
              minHeight={260}
              placeholder="正在生成大纲..."
              className="text-[24px] leading-[1.8em] text-[#333]"
            />
            {/* <pre className="whitespace-pre-wrap wrap-break-word text-base leading-[1.8em]"> */}
              {/* {outlineContentMd || "正在生成大纲..."} */}
            {/* </pre> */}
          </div>
        ) : (
          <div className={`w-full text-[#333] ${isEditing || locked || outlineContentJson ? "is-editing" : ""}`}>
            {(outlineContentJson?.outline_dict ?? []).map((chapter, index) => (
              <div key={`${chapter.chapter}-${index}`} className="mb-4 last:mb-0">
                <div className="flex items-start gap-9">
                  <div className="w-[72px] shrink-0 whitespace-nowrap text-2xl leading-[1.8em] text-[#333]">
                    {chapter.chapter}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
                    <div className="w-[429px]">
                      <textarea
                        disabled={locked}
                        value={chapter.chapter_title}
                        className="min-h-[45px] max-h-[45px] w-full resize-none rounded-[10px] border-none bg-[#f7f7f8] px-[10px] py-0 text-2xl leading-[1.8em] text-[#333] outline-none focus:bg-[#f0f0f0]"
                        onChange={(e) => handleChapterInput(index, "chapter_title", e.target.value)}
                      />
                    </div>
                    <div className="max-w-[940px]">
                      <textarea
                        disabled={locked}
                        value={chapter.chapter_note}
                        className="min-h-[140px] w-full resize-none rounded-[10px] border-none bg-[#f7f7f8] px-[10px] py-[13px] text-2xl leading-[1.8em] text-[#333] outline-none focus:bg-[#f0f0f0]"
                        onChange={(e) => handleChapterInput(index, "chapter_note", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isStreaming && (
          <div className="absolute top-0 right-0 z-10 flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.9)] px-4 py-2 text-sm text-(--text-secondary) shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <span className="inline-block animate-spin">↻</span>
            <span>正在生成大纲...</span>
          </div>
        )}
      </div>

      {!locked && (
        <div className="absolute right-[120px] bottom-[50px] z-100">
          <button
            type="button"
            disabled={!hasOutlineContent || isStreaming}
            className="flex h-[52px] w-[221px] items-center justify-center rounded-[10px] bg-linear-to-r from-[#efaf00] to-[#ff9500] text-[28px] leading-[1.32em] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
            onClick={handleConfirm}
          >
            下一步
          </button>
        </div>
      )}

      {hasNextContent && (
        <div className="absolute right-[120px] bottom-[50px] z-100">
          <button
            type="button"
            className="flex h-[52px] w-[261px] items-center justify-center rounded-[10px] border-2 border-[#999] bg-transparent text-[28px] leading-[1.32em] font-normal text-[#999] transition hover:border-(--bg-editor-save) hover:text-(--bg-editor-save)"
            onClick={onRevertToCurrent}
          >
            回退至编辑大纲
          </button>
        </div>
      )}

    </div>
  );
};

export default QuickOutlineEditor;
