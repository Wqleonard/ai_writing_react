import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { addNote, type NoteSourceType } from "@/api/notes";
import { useEditorStore } from "@/stores/editorStore";
import MarkdownEditor from "@/components/MarkdownEditor";
import {
  getScriptSplitOutline,
  postScriptTemplateStreamOutline,
  type PostScriptTemplateStreamSplitOutlineRequestData,
  type ScriptGenerateOutlineData,
  type ScriptSplitOutlineDict,
  type ScriptStorySynopsisResult,
} from "@/api/generate-quick";
import type { PostStreamData } from "@/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface OutlineSegmentItem {
  start: number;
  end: number;
  label: string;
  raw: string;
}

interface ScriptCharacterCardData {
  name: string;
  definition: string;
  age: string;
  personality: string;
  biography: string;
}

interface ScriptOutlineStorageData {
  mdContent: string[] | string;
  jsonContent: ScriptGenerateOutlineData;
}

export interface ScriptOutlineEditorProps {
  storyContent?: string;
  characterContent?: string;
  outlineContent?: string;
  outlineSegments?: OutlineSegmentItem[];
  novelPlot?: string;
  description?: string;
  episodeNum?: number;
  locked?: boolean;
  hasNextContent?: boolean;
  triggerGenerate?: number;
  onConfirm?: (outlineData: string) => void;
  onRevert?: () => void;
  onRevertToCurrent?: () => void;
  onErrorAndRevert?: (targetDir: string) => void;
  onSplitReady?: (rawSegments: string[]) => void;
}

const getContentFromPartial = (partialData: unknown): string => {
  if (!Array.isArray(partialData) || partialData.length === 0) return "";
  const firstItem = partialData[0] as any;
  if (Array.isArray(firstItem?.content) && firstItem.content[0]?.text) {
    return String(firstItem.content[0].text);
  }
  return "";
};

export const ScriptOutlineEditor = ({
  storyContent = "",
  characterContent = "",
  outlineContent = "",
  outlineSegments = [],
  novelPlot = "",
  description = "",
  episodeNum = 60,
  locked = false,
  hasNextContent = false,
  triggerGenerate = 0,
  onConfirm,
  onRevert,
  onRevertToCurrent,
  onErrorAndRevert,
  onSplitReady,
}: ScriptOutlineEditorProps) => {
  const workInfo = useEditorStore((s) => s.workInfo);

  const [outlineContentMd, setOutlineContentMd] = useState("");
  const [outlineContentJson, setOutlineContentJson] = useState<ScriptGenerateOutlineData | null>(null);
  const [outlineContentBySegment, setOutlineContentBySegment] = useState<string[]>([]);
  const [outlineJsonBySegment, setOutlineJsonBySegment] = useState<(ScriptGenerateOutlineData | null)[]>([]);
  const [storedOutlineData, setStoredOutlineData] = useState<ScriptOutlineStorageData | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [currentStreamingSegmentIndex, setCurrentStreamingSegmentIndex] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [segmentRawsForRequest, setSegmentRawsForRequest] = useState<string[]>([]);

  const outlineContainerRef = useRef<HTMLDivElement | null>(null);
  const outlineStreamAbortController = useRef<AbortController | null>(null);
  const hasThrowErrorRef = useRef(false);
  const prevTriggerGenerateRef = useRef(triggerGenerate);

  const hasSegments = outlineSegments.length > 0;

  const currentSegmentMd = useMemo(() => {
    if (currentStreamingSegmentIndex === selectedSegmentIndex) return outlineContentMd;
    return outlineContentBySegment[selectedSegmentIndex] ?? "";
  }, [currentStreamingSegmentIndex, selectedSegmentIndex, outlineContentMd, outlineContentBySegment]);

  const currentSegmentJson = useMemo(() => {
    if (currentStreamingSegmentIndex === selectedSegmentIndex) return outlineContentJson;
    return outlineJsonBySegment[selectedSegmentIndex] ?? null;
  }, [currentStreamingSegmentIndex, selectedSegmentIndex, outlineContentJson, outlineJsonBySegment]);

  const hasOutlineContent = useMemo(() => {
    const n = outlineSegments.length;
    return n > 0 && outlineJsonBySegment.length >= n && outlineJsonBySegment.every(Boolean);
  }, [outlineSegments.length, outlineJsonBySegment]);

  const hasAnySegmentContent = useMemo(
    () => outlineJsonBySegment.length > 0 && outlineJsonBySegment.some(Boolean),
    [outlineJsonBySegment]
  );

  const getStoryParamsForRequest = useCallback((): {
    description: string;
    brainStorm: ScriptStorySynopsisResult;
  } => {
    try {
      const raw = storyContent || "";
      if (!raw.trim().startsWith("{")) {
        return { description: description ?? "", brainStorm: {} };
      }
      const storyDataWrapper = JSON.parse(raw);
      const selectedTab = storyDataWrapper.selectedTab;
      const selectedData = storyDataWrapper.selectedData || {};
      if (selectedTab === "original") {
        return { description: "", brainStorm: {} };
      }
      const brainStorm: ScriptStorySynopsisResult = {
        title: selectedData.title,
        synopsis: selectedData.synopsis,
        background: selectedData.background,
        highlight: selectedData.highlight,
        informationGap: selectedData.informationGap,
      };
      return { description: description ?? "", brainStorm };
    } catch {
      return { description: description ?? "", brainStorm: {} };
    }
  }, [storyContent, description]);

  const getRoleCardList = useCallback((): ScriptCharacterCardData[] => {
    const normalize = (c: Record<string, unknown>): ScriptCharacterCardData => ({
      name: String(c.name ?? ""),
      definition: String(c.definition ?? ""),
      age: String(c.age ?? ""),
      personality: String(c.personality ?? ""),
      biography: String(c.biography ?? ""),
    });
    try {
      const rawChar = characterContent || "";
      if (!rawChar.trim()) return [];
      const data = JSON.parse(rawChar);
      if (Array.isArray(data.generatedCards) && data.generatedCards.length > 0) {
        return data.generatedCards.map((c: Record<string, unknown>) => normalize(c));
      }
      if (Array.isArray(data)) {
        return data.map((c: Record<string, unknown>) => normalize(c));
      }
      if (data && typeof data === "object") {
        const single = data.selectedData ?? data;
        if (Array.isArray(single)) return single.map((c: Record<string, unknown>) => normalize(c));
        return [normalize(single as Record<string, unknown>)];
      }
    } catch {
      // ignore
    }
    return [];
  }, [characterContent]);

  const onOutlineStreamEnd = useCallback(() => {
    setIsStreaming(false);
    setLoading(false);
    outlineStreamAbortController.current = null;
    setCurrentStreamingSegmentIndex(null);
    setIsEditing((prev) => (locked ? prev : true));
  }, [locked]);

  const onOutlineStreamError = useCallback(
    (error: Error) => {
      if (hasThrowErrorRef.current) return;
      hasThrowErrorRef.current = true;
      console.error("[ScriptOutlineEditor] 获取大纲失败:", error);
      setLoading(false);
      setIsStreaming(false);
      outlineStreamAbortController.current = null;
      setTimeout(() => {
        hasThrowErrorRef.current = false;
      }, 1000);
      onErrorAndRevert?.("主角设定.md");
    },
    [onErrorAndRevert]
  );

  const createOnOutlineStreamData = useCallback((segmentIndex: number) => {
    return (data: PostStreamData) => {
      const segIdx = segmentIndex;
      switch (data.event) {
        case "messages/partial": {
          const content = getContentFromPartial(data.data);
          setOutlineContentMd(content);
          setOutlineContentBySegment((prev) => {
            if (prev.length === 0) return prev;
            const arr = [...prev];
            arr[segIdx] = content;
            return arr;
          });
          break;
        }
        case "updates": {
          const generateOutline: ScriptGenerateOutlineData | undefined =
            (data as any)?.data?.generate_writing_template?.result?.outline;
          if (generateOutline?.outline_dict && Array.isArray(generateOutline.outline_dict)) {
            setOutlineContentJson(generateOutline);
            setOutlineJsonBySegment((prev) => {
              if (prev.length === 0) return prev;
              const arr = [...prev];
              arr[segIdx] = generateOutline;
              return arr;
            });
          }
          break;
        }
        default:
          break;
      }
    };
  }, []);

  const generateSegmentOutline = useCallback(
    async (segmentIndex: number) => {
      const raws = segmentRawsForRequest.length
        ? segmentRawsForRequest
        : outlineSegments.map((s) => s.raw);
      if (!raws.length || segmentIndex < 0 || segmentIndex >= raws.length) return;
      if (loading || isStreaming) return;
      if (!storyContent.trim() || !characterContent.trim()) {
        toast.warning("请先完成前面的步骤");
        return;
      }

      const { description: reqDescription, brainStorm } = getStoryParamsForRequest();
      const segmentRaw = raws[segmentIndex];
      const existingEpisodes = outlineContentBySegment.slice(0, segmentIndex);
      const roleCards = getRoleCardList();
      const requestData: PostScriptTemplateStreamSplitOutlineRequestData = {
        novelPlot: novelPlot ?? "",
        description: reqDescription,
        brainStorm,
        roleCards,
        episodeNum: episodeNum ?? 60,
        episodeNumAndPart: segmentRaw,
        existingEpisodes,
      };

      if (outlineStreamAbortController.current) {
        outlineStreamAbortController.current.abort();
      }
      setOutlineContentMd("");
      setOutlineContentJson(null);
      setCurrentStreamingSegmentIndex(segmentIndex);
      setIsStreaming(true);
      setLoading(true);
      outlineStreamAbortController.current = new AbortController();

      try {
        await postScriptTemplateStreamOutline(
          requestData,
          createOnOutlineStreamData(segmentIndex),
          onOutlineStreamError,
          onOutlineStreamEnd,
          { signal: outlineStreamAbortController.current.signal }
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setLoading(false);
          setIsStreaming(false);
          setCurrentStreamingSegmentIndex(null);
          outlineStreamAbortController.current = null;
          return;
        }
        console.error("[ScriptOutlineEditor] generateSegmentOutline failed:", error);
        setLoading(false);
        setIsStreaming(false);
        setCurrentStreamingSegmentIndex(null);
        outlineStreamAbortController.current = null;
        onErrorAndRevert?.("主角设定.md");
      }
    },
    [
      segmentRawsForRequest,
      outlineSegments,
      loading,
      isStreaming,
      storyContent,
      characterContent,
      getStoryParamsForRequest,
      outlineContentBySegment,
      getRoleCardList,
      novelPlot,
      episodeNum,
      createOnOutlineStreamData,
      onOutlineStreamError,
      onOutlineStreamEnd,
      onErrorAndRevert,
    ]
  );

  const generateOutline = useCallback(() => {
    if (!hasSegments || !outlineSegments.length) return;
    if (loading || isStreaming) return;
    if (outlineStreamAbortController.current) {
      outlineStreamAbortController.current.abort();
    }
    const n = outlineSegments.length;
    setOutlineContentBySegment(Array(n).fill(""));
    setOutlineJsonBySegment(Array(n).fill(null));
    setOutlineContentMd("");
    setOutlineContentJson(null);
    setSelectedSegmentIndex(0);
    setTimeout(() => {
      void generateSegmentOutline(0);
    }, 0);
  }, [hasSegments, outlineSegments, loading, isStreaming, generateSegmentOutline]);

  const fetchSplitOutline = useCallback(async () => {
    try {
      if (!novelPlot.trim()) return;
      const { description: reqDescription, brainStorm } = getStoryParamsForRequest();
      const resp: any = await getScriptSplitOutline(
        novelPlot,
        reqDescription,
        brainStorm,
        episodeNum || 60
      );
      const rawArr: string[] =
        resp?.splitOutline && Array.isArray(resp.splitOutline) ? resp.splitOutline : [];
      onSplitReady?.(rawArr);
      if (rawArr.length > 0) {
        setSegmentRawsForRequest(rawArr);
        setOutlineContentBySegment(rawArr.map(() => ""));
        setOutlineJsonBySegment(rawArr.map(() => null));
        setSelectedSegmentIndex(0);
        setTimeout(() => {
          void generateSegmentOutline(0);
        }, 0);
      }
    } catch (e) {
      console.error("[ScriptOutlineEditor] fetchSplitOutline failed:", e);
      toast.warning("获取大纲分段失败，请稍后重试");
    }
  }, [novelPlot, getStoryParamsForRequest, episodeNum, onSplitReady, generateSegmentOutline]);

  const hydrateFromStoredData = useCallback(
    (storageData: ScriptOutlineStorageData) => {
      const segs = outlineSegments;
      const len = segs.length;
      if (len <= 0) return;
      const mergedJson = storageData.jsonContent;
      const allEpisodes = mergedJson?.outline_dict ?? [];

      const mdArr: string[] = Array(len).fill("");
      if (Array.isArray(storageData.mdContent)) {
        for (let i = 0; i < len; i++) mdArr[i] = storageData.mdContent[i] ?? "";
      } else {
        mdArr[0] = storageData.mdContent || "";
      }
      setOutlineContentBySegment(mdArr);

      const jsonBySegment: (ScriptGenerateOutlineData | null)[] = Array(len).fill(null);
      if (allEpisodes.length && len > 0) {
        for (let i = 0; i < len; i++) {
          const seg = segs[i];
          const startIdx = Math.max(0, (seg.start ?? 1) - 1);
          const endIdx = Math.min(allEpisodes.length, seg.end ?? allEpisodes.length);
          const slice = allEpisodes.slice(startIdx, endIdx);
          jsonBySegment[i] = { ...mergedJson, outline_dict: slice };
        }
      }
      setOutlineJsonBySegment(jsonBySegment);
      setSelectedSegmentIndex(0);
      setOutlineContentMd(mdArr[0] ?? "");
      setOutlineContentJson(jsonBySegment[0] ?? null);
    },
    [outlineSegments]
  );

  const initFromProps = useCallback(() => {
    if (!outlineContent.trim()) return;
    const trimmed = outlineContent.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return;
    try {
      const storageData = JSON.parse(outlineContent) as ScriptOutlineStorageData;
      setStoredOutlineData(storageData);
      if (Array.isArray(storageData.mdContent)) {
        setOutlineContentMd(storageData.mdContent[0] ?? "");
      } else {
        setOutlineContentMd(storageData.mdContent || "");
      }
      setOutlineContentJson(storageData.jsonContent || null);
      if (outlineSegments.length) {
        hydrateFromStoredData(storageData);
      }
    } catch (e) {
      console.error("[ScriptOutlineEditor] Failed to parse outline JSON:", e);
    }
  }, [outlineContent, outlineSegments.length, hydrateFromStoredData]);

  const handleChapterInput = (
    episodeIndex: number,
    field: keyof ScriptSplitOutlineDict,
    value: string
  ) => {
    if (field !== "episode_title" && field !== "episode_note") return;
    const i = selectedSegmentIndex;
    setOutlineJsonBySegment((prev) => {
      const arr = [...prev];
      const segment = arr[i];
      if (!segment?.outline_dict?.[episodeIndex]) return prev;
      segment.outline_dict[episodeIndex][field] = value;
      return arr;
    });
  };

  const handleSegmentTabClick = (segIdx: number) => {
    if (isStreaming) return;
    setOutlineContentBySegment((prev) => {
      if (!hasSegments) return prev;
      const arr = [...prev];
      if (selectedSegmentIndex >= 0 && selectedSegmentIndex < arr.length) {
        arr[selectedSegmentIndex] = outlineContentMd;
      }
      return arr;
    });
    setSelectedSegmentIndex(segIdx);
    setOutlineContentMd(outlineContentBySegment[segIdx] ?? "");
    setOutlineContentJson(outlineJsonBySegment[segIdx] ?? null);
  };

  const handleAddNote = async () => {
    if (isStreaming) {
      toast.warning("请等待大纲生成完成后再添加笔记");
      return;
    }
    const content = currentSegmentMd;
    if (!content.trim()) {
      toast.warning("当前分段大纲内容为空，无法添加笔记");
      return;
    }
    const baseTitle = workInfo?.title || "大纲";
    const seg = outlineSegments[selectedSegmentIndex];
    const title = seg?.raw ? `${baseTitle} - ${seg.raw}` : baseTitle;
    try {
      await addNote(title, content.trim(), "PC_ADD" as NoteSourceType);
      toast.success("笔记添加成功");
    } catch (error) {
      console.error("添加笔记失败:", error);
      toast.error("添加笔记失败，请重试");
    }
  };

  const handleConfirm = useCallback(() => {
    if (!hasOutlineContent) {
      toast.warning("请先生成大纲内容");
      return;
    }
    const segs = outlineSegments;
    const bySegment = [...outlineContentBySegment];
    while (bySegment.length < segs.length) bySegment.push("");
    bySegment[selectedSegmentIndex] = outlineContentMd;
    const mdBySegment: string[] = [];
    const allDict: ScriptSplitOutlineDict[] = [];
    for (let i = 0; i < segs.length; i++) {
      const md = bySegment[i] ?? "";
      mdBySegment.push(md);
      const j = outlineJsonBySegment[i];
      if (j?.outline_dict?.length) allDict.push(...j.outline_dict);
    }
    const jsonContent: ScriptGenerateOutlineData = { outline_dict: allDict };
    const storageData: ScriptOutlineStorageData = { mdContent: mdBySegment, jsonContent };
    onConfirm?.(JSON.stringify(storageData));
  }, [
    hasOutlineContent,
    outlineSegments,
    outlineContentBySegment,
    selectedSegmentIndex,
    outlineContentMd,
    outlineJsonBySegment,
    onConfirm,
  ]);

  const handleNextStep = () => {
    if (hasOutlineContent) {
      handleConfirm();
      return;
    }
    if (!outlineSegments.length) return;
    let firstUngeneratedIndex = -1;
    for (let i = 0; i < outlineSegments.length; i++) {
      if (!outlineJsonBySegment[i]) {
        firstUngeneratedIndex = i;
        break;
      }
    }
    if (firstUngeneratedIndex === -1) {
      handleConfirm();
      return;
    }
    setSelectedSegmentIndex(firstUngeneratedIndex);
    setTimeout(() => {
      void generateSegmentOutline(firstUngeneratedIndex);
    }, 0);
  };

  useEffect(() => {
    initFromProps();
  }, [initFromProps]);

  useEffect(() => {
    if (outlineSegments.length <= 0) return;
    if (storedOutlineData) {
      hydrateFromStoredData(storedOutlineData);
      return;
    }
    if (outlineContent.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(outlineContent) as ScriptOutlineStorageData;
        if (parsed.mdContent != null) {
          setStoredOutlineData(parsed);
          hydrateFromStoredData(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    setOutlineContentBySegment((prev) =>
      prev.length !== outlineSegments.length ? outlineSegments.map(() => "") : prev
    );
    setOutlineJsonBySegment((prev) =>
      prev.length !== outlineSegments.length ? outlineSegments.map(() => null) : prev
    );
  }, [outlineSegments, storedOutlineData, outlineContent, hydrateFromStoredData]);

  useEffect(() => {
    const oldVal = prevTriggerGenerateRef.current;
    if (triggerGenerate > oldVal && triggerGenerate > 0) {
      if (storyContent.trim() && characterContent.trim() && !locked) {
        if (isStreaming || loading) {
          if (outlineStreamAbortController.current) {
            outlineStreamAbortController.current.abort();
            outlineStreamAbortController.current = null;
          }
          setIsStreaming(false);
          setLoading(false);
        }
        setOutlineContentMd("");
        setOutlineContentJson(null);
        setTimeout(() => {
          void fetchSplitOutline();
        }, 100);
      }
    }
    prevTriggerGenerateRef.current = triggerGenerate;
  }, [triggerGenerate, storyContent, characterContent, locked, isStreaming, loading, fetchSplitOutline]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isEditing || locked || isStreaming) return;
      const target = e.target as HTMLElement;
      if (outlineContainerRef.current && outlineContainerRef.current.contains(target)) return;
      if (target.closest(".header-actions .action-btn")) return;
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isEditing, locked, isStreaming]);

  // Only abort active stream on component unmount.
  useEffect(() => {
    return () => {
      if (outlineStreamAbortController.current) {
        outlineStreamAbortController.current.abort();
        outlineStreamAbortController.current = null;
      }
    };
  }, []);

  return (
    <div className="relative box-border flex h-full max-h-full flex-col overflow-hidden py-[50px] pr-[260px]">
      <div className="mb-[50px] flex w-full shrink-0 items-center justify-between">
        <div className="text-2xl leading-[1.32] text-black">请确认大纲内容</div>
        <div className="header-actions flex items-center gap-8">
          <button
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 text-xl leading-[1.32] tracking-[0.04em] text-[#464646]"
            onClick={() => void handleAddNote()}
          >
            添加笔记
          </button>
          {!locked ? (
            <Button
              variant="link"
              className="action-btn p-0 text-xl leading-[1.32] tracking-[0.04em] text-[#464646]"
              disabled={loading || isStreaming || !hasSegments}
              onClick={() => void generateOutline()}
            >
              <span className="iconfont mr-2.5 text-2xl">&#xe66f;</span>
              <span>重新生成</span>
            </Button>
          ) : null}
        </div>
      </div>

      {outlineSegments.length ? (
        <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {outlineSegments.map((seg, segIdx) => (
              <button
                key={seg.raw}
                type="button"
                disabled={isStreaming}
                className={cn(
                  "inline-flex cursor-pointer items-center rounded-[8px] border px-4 py-2.5 text-base leading-[1.32] text-[#efaf00] transition-colors",
                  "border-[#efaf00] hover:border-[#ff9500]",
                  selectedSegmentIndex === segIdx && "border-[#ff9500] bg-[rgba(255,149,0,0.12)] text-[#ff9500]",
                  isStreaming && "cursor-not-allowed opacity-85"
                )}
                onClick={() => handleSegmentTabClick(segIdx)}
              >
                {seg.raw}
              </button>
            ))}
          </div>
          {isStreaming ? (
            <div className="flex shrink-0 items-center gap-2 rounded-[8px] bg-white/90 px-4 py-2 text-sm text-[#666] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              <span className="iconfont animate-spin">&#xe66f;</span>
              <span>正在生成大纲...</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={outlineContainerRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[50px]"
      >
        {isStreaming ? (
          <MarkdownEditor
            value={outlineContentMd}
            onChange={setOutlineContentMd}
            readonly
            loading
            className="h-full w-full p-0"
            placeholder="开始编写大纲..."
          />
        ) : (
          <div className={cn("w-full p-0 text-2xl leading-[1.8] text-[#333]", (isEditing || locked || currentSegmentJson) && "is-editing")}>
            {currentSegmentJson?.outline_dict?.map((item, index) => (
              <div key={`${item.episode}-${index}`} className={cn("mb-0", (isEditing || locked || currentSegmentJson) && "mb-4 last:mb-0")}>
                <div className="flex items-start gap-9">
                  <div className="w-[72px] shrink-0 whitespace-nowrap text-2xl leading-[1.8] text-[#333]">
                    {item.episode}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="w-[429px] max-w-full">
                      <Textarea
                        value={item.episode_title}
                        onChange={(e) => handleChapterInput(index, "episode_title", e.target.value)}
                        className="border-none bg-[#f7f7f8] px-2.5 py-0"
                        areaClassName="text-2xl leading-[1.8] min-h-[45px] max-h-[45px]"
                        readOnly={locked}
                      />
                    </div>
                    <div className="max-w-[940px]">
                      <Textarea
                        value={item.episode_note}
                        onChange={(e) => handleChapterInput(index, "episode_note", e.target.value)}
                        className="border-none bg-[#f7f7f8]"
                        areaClassName="text-2xl leading-[1.8] min-h-[5.9em]"
                        readOnly={locked}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!locked ? (
        <div className="absolute right-[260px] bottom-[50px] z-[100]">
          <Button
            variant="quick-primary"
            size="quick-confirm"
            disabled={isStreaming || !outlineSegments.length || !(hasOutlineContent || hasAnySegmentContent)}
            onClick={handleNextStep}
          >
            下一步
          </Button>
        </div>
      ) : null}

      {hasNextContent ? (
        <div className="absolute right-[260px] bottom-[50px] z-[100]">
          <Button
            variant="quick-revert"
            size="quick-revert-size"
            onClick={() => onRevertToCurrent?.()}
          >
            回退至编辑大纲
          </Button>
        </div>
      ) : null}

      {/* 预留回退事件入口，保持与 Vue 组件事件契约一致 */}
      <span className="hidden" onClick={() => onRevert?.()} />
    </div>
  );
};
