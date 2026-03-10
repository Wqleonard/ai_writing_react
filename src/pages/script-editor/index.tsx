import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { updateWorkInfoReq, updateWorkVersionReq } from "@/api/works";
import { useEditorStore } from "@/stores/editorStore";
import { cn } from "@/lib/utils";
import { ScriptNovelOutlineChapter } from "./components/ScriptNovelOutlineChapter";
import { ScriptTagSelector } from "./components/ScriptTagSelector";
import { ScriptStorySelector } from "./components/ScriptStorySelector";
import { ScriptCharacterSelector } from "./components/ScriptCharacterSelector";
import { ScriptOutlineEditor, type OutlineSegmentItem } from "./components/ScriptOutlineEditor";
import type { ScriptSplitOutlineDict } from "@/api/generate-quick";
import TITLE_LOGO from "@/assets/images/logo.webp";
import novelChapterDefaultIcon from "@/assets/images/quick_creation/novel_chapter_default.svg";
import novelChapterSelectedIcon from "@/assets/images/quick_creation/novel_chapter_selected.svg";
import storyTagDefaultIcon from "@/assets/images/quick_creation/story-tag-default.svg";
import storyTagSelectedIcon from "@/assets/images/quick_creation/story-tag-selected.svg";
import storyTagDisabledIcon from "@/assets/images/quick_creation/story-tag-disabled.svg";
import storyOutlineDefaultIcon from "@/assets/images/quick_creation/story-outline-default.svg";
import storyOutlineSelectedIcon from "@/assets/images/quick_creation/story-outline-selected.svg";
import storyOutlineDisabledIcon from "@/assets/images/quick_creation/story-outline-disabled.svg";
import characterSettingDefaultIcon from "@/assets/images/quick_creation/character-setting-default.svg";
import characterSettingSelectedIcon from "@/assets/images/quick_creation/character-setting-selected.svg";
import characterSettingDisabledIcon from "@/assets/images/quick_creation/character-setting-disabled.svg";
import outlineDefaultIcon from "@/assets/images/quick_creation/outline-default.svg";
import outlineSelectedIcon from "@/assets/images/quick_creation/outline-selected.svg";
import outlineDisabledIcon from "@/assets/images/quick_creation/outline-disabled.svg";
import mainTextDefaultIcon from "@/assets/images/quick_creation/main-text-default.svg";
import mainTextSelectedIcon from "@/assets/images/quick_creation/main-text-selected.svg";
import mainTextDisabledIcon from "@/assets/images/quick_creation/main-text-disabled.svg";
import arrowDefaultIcon from "@/assets/images/quick_creation/arrow-default.svg";
import arrowSelectedIcon from "@/assets/images/quick_creation/arrow-selected.svg";
import arrowDisabledIcon from "@/assets/images/quick_creation/arrow-disabled.svg";
import { QuickEditorTopToolBar } from "@/components/QuickEditorTopToolBar";
import "./index.css";

type ScriptServerData = Record<string, string>;

interface ScriptNovelOutlineChapterResult {
  content: string;
  originalName?: string;
  serverFileName?: string;
  wordCount?: number;
  chapterNum?: number;
}

interface ScriptChapterStorageData {
  episodeNote: string;
  content: string;
  isFinished?: boolean;
}

interface ScriptOutlineStorageData {
  mdContent: string[] | string;
  jsonContent: {
    outline_dict?: ScriptSplitOutlineDict[];
  };
}

const DEFAULT_DIRECTORIES: ScriptServerData = {
  "小说纲章.md": "",
  "标签.md": "",
  "故事梗概.md": "",
  "主角设定.md": "",
  "大纲.md": "",
  "正文.md": "",
};

const FIXED_ORDER = ["小说纲章.md", "标签.md", "故事梗概.md", "主角设定.md", "大纲.md"];
const STEP_BEFORE_MAIN_TEXT = new Set(FIXED_ORDER);

const isEpisodeDir = (dir: string) => /^第\d+集\.md$/.test(dir);
const isEpisodeOrChapterDir = (dir: string) =>
  isEpisodeDir(dir) || /^正文-第\d+章\.md$/.test(dir);

const getChapterIndexFromDir = (dir: string): number => {
  const ep = dir.match(/^第(\d+)集\.md$/);
  if (ep) return Math.max(0, Number.parseInt(ep[1] ?? "1", 10) - 1);
  const ch = dir.match(/^正文-第(\d+)章\.md$/);
  if (ch) return Math.max(0, Number.parseInt(ch[1] ?? "1", 10) - 1);
  return 0;
};

const getChapterDirByIndex = (index: number) => `第${index + 1}集.md`;

const parseOutlineSegmentsFromRaw = (rawArr: string[]): OutlineSegmentItem[] => {
  const next: OutlineSegmentItem[] = [];
  rawArr.forEach((item) => {
    const m = String(item).match(/^(\d+)-(\d+)\((.+)\)$/);
    if (!m) return;
    next.push({
      start: Number.parseInt(m[1] ?? "1", 10),
      end: Number.parseInt(m[2] ?? "1", 10),
      label: String(m[3] ?? "").trim(),
      raw: String(item),
    });
  });
  return next;
};

const getDirectoryName = (dir: string) => {
  const map: Record<string, string> = {
    "小说纲章.md": "小说纲章",
    "标签.md": "故事标签",
    "故事梗概.md": "故事梗概",
    "主角设定.md": "角色设定",
    "大纲.md": "大纲",
    "正文.md": "正文",
  };
  if (isEpisodeDir(dir)) return dir.replace(".md", "");
  const oldChapter = dir.match(/^正文-第(\d+)章\.md$/);
  if (oldChapter) return `第${oldChapter[1]}集`;
  return map[dir] ?? dir.replace(".md", "");
};

const getNovelPlotFromServerData = (novelOutlineData: string): string => {
  if (!novelOutlineData) return "";
  try {
    const parsed = JSON.parse(novelOutlineData) as { content?: string };
    return String(parsed?.content ?? "");
  } catch {
    return novelOutlineData;
  }
};

const getTagIdsFromServerData = (tagData: string): string => {
  if (!tagData) return "";
  try {
    const parsed = JSON.parse(tagData) as { tagIds?: string };
    return String(parsed?.tagIds ?? "");
  } catch {
    return tagData;
  }
};

const getSynopsisFromServerData = (tagData: string): string => {
  if (!tagData) return "";
  try {
    const parsed = JSON.parse(tagData) as { synopsis?: string };
    return String(parsed?.synopsis ?? "");
  } catch {
    return "";
  }
};

const getDescriptionFromServerData = (tagData: string): string => {
  if (!tagData) return "";
  try {
    const parsed = JSON.parse(tagData) as { description?: string };
    return String(parsed?.description ?? "");
  } catch {
    return "";
  }
};

const getEpisodeNumFromServerData = (tagData: string): number => {
  if (!tagData) return 60;
  try {
    const parsed = JSON.parse(tagData) as { episodeNum?: number };
    return typeof parsed?.episodeNum === "number" ? parsed.episodeNum : 60;
  } catch {
    return 60;
  }
};

const hasChapterValue = (data: ScriptServerData, chapterName: string): boolean => {
  const content = data[chapterName];
  if (!content || content.trim() === "") return false;
  try {
    const parsed = JSON.parse(content);
    return !!parsed && typeof parsed === "object";
  } catch {
    return true;
  }
};

const normalizeChapterKeys = (data: ScriptServerData): ScriptServerData => {
  const next = { ...data };
  const byIndex = new Map<number, string[]>();

  Object.keys(next).forEach((key) => {
    if (!isEpisodeOrChapterDir(key)) return;
    const idx = getChapterIndexFromDir(key);
    byIndex.set(idx, [...(byIndex.get(idx) ?? []), key]);
  });

  byIndex.forEach((keys) => {
    if (keys.length <= 1) return;
    const preferred = keys.find((k) => isEpisodeDir(k)) ?? keys[0];
    keys.forEach((k) => {
      if (k !== preferred) delete next[k];
    });
  });

  return next;
};

const getChapterDataFromOutline = (
  outlineRaw: string,
  chapterIndex: number,
): ScriptSplitOutlineDict | null => {
  if (!outlineRaw) return null;
  try {
    const parsed = JSON.parse(outlineRaw) as ScriptOutlineStorageData;
    const list = parsed?.jsonContent?.outline_dict ?? [];
    if (!Array.isArray(list) || chapterIndex >= list.length) return null;
    return list[chapterIndex] ?? null;
  } catch {
    return null;
  }
};

const getRevertSuccessMessage = (dir: string): string => {
  if (dir === "小说纲章.md") return "已回退至小说纲章";
  if (dir === "标签.md") return "已回退至选择标签";
  if (dir === "故事梗概.md") return "已回退至选择故事梗概";
  if (dir === "主角设定.md") return "已回退至选择角色";
  if (dir === "大纲.md") return "已回退至编辑大纲";
  if (isEpisodeOrChapterDir(dir)) return `已回退至第${getChapterIndexFromDir(dir) + 1}集`;
  return `已回退至${dir}`;
};

interface ChapterCardProps {
  chapterIndex: number;
  chapterName: string;
  chapterOutlineData: ScriptSplitOutlineDict | null;
  chapterContent: string;
  locked: boolean;
  hasNextContent: boolean;
  isLastChapter: boolean;
  isLastChapterWithContent: boolean;
  previousChapterIndex?: number;
  onConfirm: (chapterIndex: number, chapterData: string) => void;
  onContinueNext: (chapterIndex: number, chapterData: string) => void;
  onRevertToNote: (chapterIndex: number) => void;
  onRevertToOutline: (chapterIndex: number) => void;
  onRevertChapter: (chapterIndex: number) => void;
  onChapterNoteUpdate: (chapterIndex: number, chapterNote: string) => void;
  onRevertToCurrent: () => void;
}

const ScriptChapterEditorCard = ({
  chapterIndex,
  chapterName,
  chapterOutlineData,
  chapterContent,
  locked,
  hasNextContent,
  isLastChapter,
  isLastChapterWithContent,
  previousChapterIndex,
  onConfirm,
  onContinueNext,
  onRevertToNote,
  onRevertToOutline,
  onRevertChapter,
  onChapterNoteUpdate,
  onRevertToCurrent,
}: ChapterCardProps) => {
  const [episodeNote, setEpisodeNote] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!chapterContent?.trim()) {
      setEpisodeNote(chapterOutlineData?.episode_note ?? "");
      setContent("");
      return;
    }
    try {
      const parsed = JSON.parse(chapterContent) as ScriptChapterStorageData;
      setEpisodeNote(parsed.episodeNote ?? chapterOutlineData?.episode_note ?? "");
      setContent(parsed.content ?? "");
    } catch {
      setEpisodeNote(chapterOutlineData?.episode_note ?? "");
      setContent(chapterContent);
    }
  }, [chapterContent, chapterOutlineData?.episode_note]);

  const toPayload = useCallback(
    (): ScriptChapterStorageData => ({ episodeNote, content }),
    [episodeNote, content],
  );

  return (
    <div className="rounded-xl border border-[#efaf00]/35 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-[#3d2d00]">{chapterName}</div>
          <div className="text-xs text-[#8f7a4b]">
            {chapterOutlineData?.episode_title || "章节标题可在大纲中调整"}
          </div>
        </div>
        <div className="text-xs text-[#8f7a4b]">章节编辑</div>
      </div>
      <div className="space-y-3">
        <Input
          value={episodeNote}
          disabled={locked}
          onChange={(e) => setEpisodeNote(e.target.value)}
          onBlur={() => onChapterNoteUpdate(chapterIndex, episodeNote)}
          placeholder="本集细纲"
        />
        <Textarea
          value={content}
          readOnly={locked}
          onChange={(e) => setContent(e.target.value)}
          placeholder="生成或编辑正文..."
          className="min-h-[280px] border border-[#efaf00]/35 bg-white px-3 py-2"
          areaClassName="min-h-[260px] text-sm leading-7"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!locked ? (
          <Button
            onClick={() => onConfirm(chapterIndex, JSON.stringify(toPayload()))}
            disabled={!episodeNote.trim() && !content.trim()}
          >
            保存本集
          </Button>
        ) : null}
        {!locked ? (
          <Button
            variant="outline"
            onClick={() => onContinueNext(chapterIndex, JSON.stringify(toPayload()))}
            disabled={!content.trim()}
          >
            {isLastChapter ? "完成创作" : "继续下一集"}
          </Button>
        ) : null}
        {!locked ? (
          <Button variant="outline" onClick={() => onRevertToOutline(chapterIndex)}>
            回退至细纲
          </Button>
        ) : null}
        {!locked ? (
          <Button variant="outline" onClick={() => onRevertToNote(chapterIndex)}>
            回退至本集细纲
          </Button>
        ) : null}
        {!locked ? (
          <Button variant="outline" onClick={() => onRevertChapter(chapterIndex)}>
            {isLastChapterWithContent && previousChapterIndex != null
              ? `回退至第${previousChapterIndex + 1}集`
              : "回退至编辑大纲"}
          </Button>
        ) : null}
        {hasNextContent ? (
          <Button variant="outline" onClick={onRevertToCurrent}>
            回退到当前步骤
          </Button>
        ) : null}
      </div>
    </div>
  );
};

const ScriptEditorPage = () => {
  const navigate = useNavigate();
  const { workId: routeWorkId } = useParams<{ workId: string }>();
  const initDoneRef = useRef(false);

  const storeWorkId = useEditorStore((s) => s.workId);
  const storeServerData = useEditorStore((s) => s.serverData);
  const workInfo = useEditorStore((s) => s.workInfo);
  const setWorkId = useEditorStore((s) => s.setWorkId);
  const initEditorData = useEditorStore((s) => s.initEditorData);
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo);

  const [serverData, setServerData] = useState<ScriptServerData>(DEFAULT_DIRECTORIES);
  const [lockedDirectories, setLockedDirectories] = useState<Set<string>>(new Set());
  const [currentDirectory, setCurrentDirectory] = useState("小说纲章.md");
  const [outlineSegmentList, setOutlineSegmentList] = useState<OutlineSegmentItem[]>([]);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [tagGenerateTrigger, setTagGenerateTrigger] = useState(0);
  const [storyGenerateTrigger, setStoryGenerateTrigger] = useState(0);
  const [characterGenerateTrigger, setCharacterGenerateTrigger] = useState(0);
  const [outlineGenerateTrigger, setOutlineGenerateTrigger] = useState(0);
  const [isMainTextExpanded, setIsMainTextExpanded] = useState(false);
  const [segmentExpanded, setSegmentExpanded] = useState<Record<string, boolean>>({});
  const lockedDirectoriesRef = useRef<Set<string>>(new Set());
  const contentScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollLockRef = useRef(false);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const workId = routeWorkId || storeWorkId;

  useEffect(() => {
    if (!routeWorkId) return;
    setWorkId(routeWorkId);
    void initEditorData(routeWorkId);
  }, [routeWorkId, setWorkId, initEditorData]);

  const directories = useMemo(() => {
    const keys = Object.keys(serverData).length ? Object.keys(serverData) : Object.keys(DEFAULT_DIRECTORIES);
    const fixed = keys.filter((k) => FIXED_ORDER.includes(k)).sort((a, b) => FIXED_ORDER.indexOf(a) - FIXED_ORDER.indexOf(b));
    const chapters = keys
      .filter((k) => isEpisodeOrChapterDir(k))
      .sort((a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b));
    const others = keys.filter(
      (k) => !FIXED_ORDER.includes(k) && !isEpisodeOrChapterDir(k) && k !== "正文.md" && k !== "大纲分段.md",
    );
    return [...fixed, ...chapters, ...others];
  }, [serverData]);

  const persistServerData = useCallback(
    async (nextData: ScriptServerData, saveStatus: "0" | "1" = "1") => {
      if (!workId) return false;
      try {
        await updateWorkVersionReq(workId, JSON.stringify(nextData), saveStatus);
        return true;
      } catch (error) {
        console.error("[ScriptEditor] save failed:", error);
        toast.error("保存失败");
        return false;
      }
    },
    [workId],
  );

  useEffect(() => {
    if (initDoneRef.current) return;
    if (!storeServerData) return;
    const base = normalizeChapterKeys({ ...DEFAULT_DIRECTORIES, ...(storeServerData as ScriptServerData) });
    if ("故事标签.md" in base && !("标签.md" in base)) {
      base["标签.md"] = base["故事标签.md"] ?? "";
    }
    delete base["故事标签.md"];

    if (base["大纲分段.md"]) {
      try {
        const parsed = JSON.parse(base["大纲分段.md"]) as OutlineSegmentItem[];
        if (Array.isArray(parsed)) setOutlineSegmentList(parsed);
      } catch {
        // ignore legacy data
      }
    }

    const lockSet = new Set<string>();
    Object.keys(base).forEach((key) => {
      const value = base[key];
      if (!value || !value.trim()) return;
      if (isEpisodeOrChapterDir(key)) {
        try {
          const parsed = JSON.parse(value) as ScriptChapterStorageData;
          if (parsed.content?.trim() || parsed.isFinished) lockSet.add(key);
        } catch {
          lockSet.add(key);
        }
      } else {
        lockSet.add(key);
      }
    });

    setServerData(base);
    setLockedDirectories(lockSet);
    initDoneRef.current = true;
  }, [storeServerData]);

  useEffect(() => {
    if (!directories.length) return;
    if (directories.includes(currentDirectory)) return;
    setCurrentDirectory(directories[0] ?? "小说纲章.md");
  }, [directories, currentDirectory]);

  useEffect(() => {
    lockedDirectoriesRef.current = lockedDirectories;
  }, [lockedDirectories]);

  const tagSelectorTagIds = useMemo(
    () => getTagIdsFromServerData(serverData["标签.md"] ?? ""),
    [serverData],
  );
  const tagSelectorSynopsis = useMemo(
    () => getSynopsisFromServerData(serverData["标签.md"] ?? ""),
    [serverData],
  );
  const tagSelectorDescription = useMemo(
    () => getDescriptionFromServerData(serverData["标签.md"] ?? ""),
    [serverData],
  );
  const tagSelectorEpisodeNum = useMemo(
    () => getEpisodeNumFromServerData(serverData["标签.md"] ?? ""),
    [serverData],
  );
  const tagSelectorNovelPlot = useMemo(
    () => getNovelPlotFromServerData(serverData["小说纲章.md"] ?? ""),
    [serverData],
  );

  const isSectionVisible = useCallback(
    (dir: string) => {
      if (lockedDirectories.has(dir)) return true;
      if (isEpisodeOrChapterDir(dir)) return hasChapterValue(serverData, dir);
      const idx = directories.indexOf(dir);
      if (idx <= 0) return true;
      if (serverData[dir]?.trim()) return true;
      const prev = directories[idx - 1];
      return !!prev && lockedDirectories.has(prev);
    },
    [directories, lockedDirectories, serverData],
  );

  const isDirectoryDisabled = useCallback(
    (dir: string) => {
      if (isEpisodeOrChapterDir(dir)) return !hasChapterValue(serverData, dir);
      const idx = directories.indexOf(dir);
      if (idx <= 0) return false;
      if (lockedDirectories.has(dir)) return false;
      return !lockedDirectories.has(directories[idx - 1] ?? "");
    },
    [directories, lockedDirectories, serverData],
  );

  const hasNextDirectoryContent = useCallback(
    (dir: string) => {
      if (!lockedDirectories.has(dir)) return false;
      const idx = directories.indexOf(dir);
      if (idx < 0 || idx === directories.length - 1) return false;
      const next = directories[idx + 1];
      return !!next && isSectionVisible(next);
    },
    [directories, isSectionVisible, lockedDirectories],
  );

  const scrollToDirectorySection = useCallback((dir: string) => {
    const sectionId = `section-${getDirectoryName(dir)}`;
    requestAnimationFrame(() => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
      scrollLockRef.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      scrollLockTimerRef.current = setTimeout(() => {
        scrollLockRef.current = false;
        scrollLockTimerRef.current = null;
      }, 800);
    });
  }, []);

  useEffect(() => {
    const container = contentScrollAreaRef.current;
    if (!container) return;

    const sectionEls = directories
      .map((dir) => document.getElementById(`section-${getDirectoryName(dir)}`))
      .filter((el): el is HTMLElement => !!el);

    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return;
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visibleEntries[0];
        const nextDir = topEntry?.target.getAttribute("data-dir");
        if (!nextDir) return;
        setCurrentDirectory((prev) => (prev === nextDir ? prev : nextDir));
      },
      {
        root: container,
        threshold: [0.35, 0.6, 0.8],
      },
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [directories, lockedDirectories, serverData]);

  const gotoNextUnlocked = useCallback(() => {
    const next = directories.find((dir) => !lockedDirectoriesRef.current.has(dir));
    if (next) {
      setCurrentDirectory(next);
      scrollToDirectorySection(next);
    }
  }, [directories, scrollToDirectorySection]);

  const handleRevertToCurrentStep = useCallback(
    async (currentDir: string) => {
      const currentIdx = directories.indexOf(currentDir);
      if (currentIdx < 0) return;
      const nextData = { ...serverData };
      directories.slice(currentIdx + 1).forEach((dir) => {
        nextData[dir] = "";
      });
      if (currentDir === "主角设定.md") {
        delete nextData["大纲分段.md"];
        setOutlineSegmentList([]);
      }
      const nextLocked = new Set(lockedDirectories);
      nextLocked.delete(currentDir);
      directories.slice(currentIdx + 1).forEach((dir) => nextLocked.delete(dir));
      const ok = await persistServerData(nextData);
      if (!ok) return;
      setServerData(nextData);
      setLockedDirectories(nextLocked);
      setCurrentDirectory(currentDir);
      scrollToDirectorySection(currentDir);
      if (STEP_BEFORE_MAIN_TEXT.has(currentDir)) setIsSidebarExpanded(true);
      toast.success(getRevertSuccessMessage(currentDir));
    },
    [directories, lockedDirectories, persistServerData, scrollToDirectorySection, serverData],
  );

  const lockAndSave = useCallback(
    async (dir: string, nextData: ScriptServerData, msg: string) => {
      const ok = await persistServerData(nextData);
      if (!ok) return false;
      const nextLocked = new Set(lockedDirectories);
      nextLocked.add(dir);
      setServerData(nextData);
      setLockedDirectories(nextLocked);
      lockedDirectoriesRef.current = nextLocked;
      toast.success(msg);
      return true;
    },
    [lockedDirectories, persistServerData],
  );

  const handleNovelOutlineConfirm = useCallback(
    async (data: ScriptNovelOutlineChapterResult) => {
      const nextData = { ...serverData, "小说纲章.md": JSON.stringify(data) };
      const ok = await lockAndSave("小说纲章.md", nextData, "小说纲章保存成功");
      if (!ok) return;
      setTagGenerateTrigger((v) => v + 1);
      gotoNextUnlocked();
    },
    [gotoNextUnlocked, lockAndSave, serverData],
  );

  const handleTagConfirm = useCallback(
    async (data: { tagIds: string; synopsis: string; episodeNum: number; description: string }) => {
      const nextData = {
        ...serverData,
        "标签.md": JSON.stringify({
          tagIds: data.tagIds,
          synopsis: data.synopsis,
          episodeNum: data.episodeNum,
          description: data.description ?? "",
        }),
      };
      const ok = await lockAndSave("标签.md", nextData, "标签保存成功");
      if (!ok) return;
      setStoryGenerateTrigger((v) => v + 1);
      gotoNextUnlocked();
    },
    [gotoNextUnlocked, lockAndSave, serverData],
  );

  const handleStoryConfirm = useCallback(
    async (storyData: string, title: string) => {
      const nextData = { ...serverData, "故事梗概.md": storyData };
      if (title?.trim() && workId) {
        const wrapped = `《${title.trim()}》`;
        try {
          await updateWorkInfoReq(workId, { title: wrapped });
          setWorkInfo({ title: wrapped });
        } catch (error) {
          console.error("[ScriptEditor] update title failed:", error);
        }
      }
      const ok = await lockAndSave("故事梗概.md", nextData, "故事梗概保存成功");
      if (!ok) return;
      setCharacterGenerateTrigger((v) => v + 1);
      gotoNextUnlocked();
    },
    [gotoNextUnlocked, lockAndSave, serverData, setWorkInfo, workId],
  );

  const handleCharacterConfirm = useCallback(
    async (characterData: string) => {
      const nextData = { ...serverData, "主角设定.md": characterData };
      const ok = await lockAndSave("主角设定.md", nextData, "角色设定保存成功");
      if (!ok) return;
      setOutlineGenerateTrigger((v) => v + 1);
      gotoNextUnlocked();
    },
    [gotoNextUnlocked, lockAndSave, serverData],
  );

  const handleOutlineSplitReady = useCallback(
    async (rawSegments: string[]) => {
      const segments = parseOutlineSegmentsFromRaw(Array.isArray(rawSegments) ? rawSegments : []);
      const total = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 0;
      if (total <= 0) return;
      const nextData: ScriptServerData = { ...serverData };
      Object.keys(nextData).forEach((key) => {
        if (isEpisodeOrChapterDir(key)) delete nextData[key];
      });
      for (let i = 1; i <= total; i += 1) {
        nextData[`第${i}集.md`] = "";
      }
      delete nextData["正文.md"];
      nextData["大纲分段.md"] = JSON.stringify(segments);
      if (workId) {
        try {
          await updateWorkInfoReq(workId, { chapterNum: total });
          setWorkInfo({ chapterNum: total });
        } catch (error) {
          console.error("[ScriptEditor] chapterNum update failed:", error);
        }
      }
      const ok = await persistServerData(nextData);
      if (!ok) return;
      setOutlineSegmentList(segments);
      setServerData(nextData);
    },
    [persistServerData, serverData, setWorkInfo, workId],
  );

  const handleOutlineConfirm = useCallback(
    async (outlineData: string) => {
      const nextData: ScriptServerData = { ...serverData, "大纲.md": outlineData };
      const firstChapter = directories.find((dir) => isEpisodeOrChapterDir(dir));
      if (firstChapter && !nextData[firstChapter]) {
        nextData[firstChapter] = JSON.stringify({ episodeNote: "", content: "" });
      }
      const ok = await lockAndSave("大纲.md", nextData, "大纲保存成功");
      if (!ok) return;
      if (firstChapter) {
        setCurrentDirectory(firstChapter);
        scrollToDirectorySection(firstChapter);
      }
    },
    [directories, lockAndSave, scrollToDirectorySection, serverData],
  );

  const handleChapterConfirm = useCallback(
    async (chapterIndex: number, chapterData: string) => {
      const chapterName = getChapterDirByIndex(chapterIndex);
      const nextData = { ...serverData, [chapterName]: chapterData };
      const ok = await persistServerData(nextData);
      if (!ok) return;
      setServerData(nextData);
      toast.success("章节保存成功");
    },
    [persistServerData, serverData],
  );

  const handleChapterNoteUpdate = useCallback(
    async (chapterIndex: number, chapterNote: string) => {
      const outlineData = serverData["大纲.md"];
      if (!outlineData) return;
      try {
        const parsed = JSON.parse(outlineData) as ScriptOutlineStorageData;
        const dict = parsed?.jsonContent?.outline_dict;
        if (!Array.isArray(dict) || !dict[chapterIndex]) return;
        dict[chapterIndex].episode_note = chapterNote;
        const nextData = { ...serverData, "大纲.md": JSON.stringify(parsed) };
        const ok = await persistServerData(nextData);
        if (!ok) return;
        setServerData(nextData);
      } catch (e) {
        console.error("[ScriptEditor] update chapter note failed:", e);
      }
    },
    [persistServerData, serverData],
  );

  const handleChapterRevertToNote = useCallback(
    async (chapterIndex: number) => {
      const chapterName = getChapterDirByIndex(chapterIndex);
      const nextData = { ...serverData, [chapterName]: JSON.stringify({ episodeNote: "", content: "" }) };
      const nextLocked = new Set(lockedDirectories);
      nextLocked.delete(chapterName);

      const chapterIndexInDirs = directories.indexOf(chapterName);
      if (chapterIndexInDirs !== -1) {
        directories.slice(chapterIndexInDirs + 1).forEach((dir) => {
          if (isEpisodeOrChapterDir(dir)) {
            nextData[dir] = "";
            nextLocked.delete(dir);
          }
        });
      }

      const ok = await persistServerData(nextData);
      if (!ok) return;
      setServerData(nextData);
      setLockedDirectories(nextLocked);
      setCurrentDirectory(chapterName);
      scrollToDirectorySection(chapterName);
      toast.success("已回退至此步骤");
    },
    [directories, lockedDirectories, persistServerData, scrollToDirectorySection, serverData],
  );

  const handleChapterRevertToOutline = useCallback(
    async (chapterIndex: number) => {
      const chapterName = getChapterDirByIndex(chapterIndex);
      const raw = serverData[chapterName];
      if (!raw?.trim()) return;

      try {
        const parsed = JSON.parse(raw) as ScriptChapterStorageData;
        const nextData = {
          ...serverData,
          [chapterName]: JSON.stringify({ ...parsed, content: "" }),
        };
        const nextLocked = new Set(lockedDirectories);
        nextLocked.delete(chapterName);
        const ok = await persistServerData(nextData);
        if (!ok) return;
        setServerData(nextData);
        setLockedDirectories(nextLocked);
        setCurrentDirectory(chapterName);
        scrollToDirectorySection(chapterName);
        toast.success("已回退至细纲");
      } catch (e) {
        console.error("[ScriptEditor] revert chapter to outline failed:", e);
      }
    },
    [lockedDirectories, persistServerData, scrollToDirectorySection, serverData],
  );

  const getPreviousChapterIndex = useCallback(
    (chapterIndex: number): number | undefined => {
      const chapterDirs = directories.filter((dir) => isEpisodeOrChapterDir(dir));
      const currentChapterName = getChapterDirByIndex(chapterIndex);
      const currentIndex = chapterDirs.indexOf(currentChapterName);
      if (currentIndex === -1) return undefined;

      for (let i = currentIndex - 1; i >= 0; i -= 1) {
        const dir = chapterDirs[i];
        const content = serverData[dir];
        if (!content || !content.trim()) continue;
        try {
          const parsed = JSON.parse(content) as ScriptChapterStorageData;
          if (parsed?.content?.trim()) return getChapterIndexFromDir(dir);
        } catch {
          // ignore parse failure
        }
      }
      return undefined;
    },
    [directories, serverData],
  );

  const isLastChapterWithContent = useCallback(
    (chapterIndex: number): boolean => {
      const chapterDirs = directories.filter((dir) => isEpisodeOrChapterDir(dir));
      const currentChapterName = getChapterDirByIndex(chapterIndex);
      const currentIndex = chapterDirs.indexOf(currentChapterName);
      if (currentIndex === -1) return false;

      const currentContent = serverData[currentChapterName];
      if (!currentContent?.trim()) return false;
      try {
        const parsed = JSON.parse(currentContent) as ScriptChapterStorageData;
        if (!parsed?.content?.trim()) return false;
      } catch {
        return false;
      }

      for (let i = currentIndex + 1; i < chapterDirs.length; i += 1) {
        const nextContent = serverData[chapterDirs[i]];
        if (nextContent?.trim()) return false;
      }
      return true;
    },
    [directories, serverData],
  );

  const handleChapterRevert = useCallback(
    async (chapterIndex: number) => {
      const chapterName = getChapterDirByIndex(chapterIndex);
      const previousChapterIndex = getPreviousChapterIndex(chapterIndex);
      const nextData = { ...serverData };
      const nextLocked = new Set(lockedDirectories);

      if (previousChapterIndex != null && previousChapterIndex >= 0) {
        const chapterDirs = directories.filter((dir) => isEpisodeOrChapterDir(dir));
        const currentIndex = chapterDirs.indexOf(chapterName);
        for (let i = currentIndex; i < chapterDirs.length; i += 1) {
          nextData[chapterDirs[i]] = "";
          nextLocked.delete(chapterDirs[i]);
        }
        const prevChapterName = getChapterDirByIndex(previousChapterIndex);
        const ok = await persistServerData(nextData);
        if (!ok) return;
        setServerData(nextData);
        setLockedDirectories(nextLocked);
        setCurrentDirectory(prevChapterName);
        scrollToDirectorySection(prevChapterName);
        toast.success(`已回退至第${previousChapterIndex + 1}集`);
        return;
      }

      nextLocked.delete("大纲.md");
      directories.forEach((dir) => {
        if (isEpisodeOrChapterDir(dir)) {
          nextData[dir] = "";
          nextLocked.delete(dir);
        }
      });
      const ok = await persistServerData(nextData);
      if (!ok) return;
      setServerData(nextData);
      setLockedDirectories(nextLocked);
      setCurrentDirectory("大纲.md");
      scrollToDirectorySection("大纲.md");
      toast.success("已回退至编辑大纲");
    },
    [
      directories,
      getPreviousChapterIndex,
      lockedDirectories,
      persistServerData,
      scrollToDirectorySection,
      serverData,
    ],
  );

  const handleChapterContinueNext = useCallback(
    async (chapterIndex: number, chapterData: string) => {
      const chapterName = getChapterDirByIndex(chapterIndex);
      const chapterNum = workInfo?.chapterNum ?? 0;
      const isLast = chapterNum > 0 && chapterIndex === chapterNum - 1;
      const nextData = { ...serverData, [chapterName]: chapterData };
      const nextLocked = new Set(lockedDirectories);
      if (isLast) {
        try {
          const parsed = JSON.parse(chapterData) as ScriptChapterStorageData;
          nextData[chapterName] = JSON.stringify({ ...parsed, isFinished: true });
        } catch {
          // ignore parse fallback
        }
        nextLocked.add(chapterName);
        const ok = await persistServerData(nextData);
        if (!ok) return;
        setServerData(nextData);
        setLockedDirectories(nextLocked);
        toast.success("创作完成");
        return;
      }

      const nextName = getChapterDirByIndex(chapterIndex + 1);
      if (!directories.includes(nextName)) {
        toast.warning("没有下一集了");
        return;
      }
      nextLocked.add(chapterName);
      nextData[nextName] = nextData[nextName] || JSON.stringify({ episodeNote: "", content: "" });
      const ok = await persistServerData(nextData);
      if (!ok) return;
      setServerData(nextData);
      setLockedDirectories(nextLocked);
      setCurrentDirectory(nextName);
      scrollToDirectorySection(nextName);
    },
    [directories, lockedDirectories, persistServerData, scrollToDirectorySection, serverData, workInfo?.chapterNum],
  );

  const handleSaveClick = useCallback(async () => {
    const ok = await persistServerData(serverData, "0");
    if (ok) toast.success("保存成功");
  }, [persistServerData, serverData]);

  const handleBackClick = useCallback(() => {
    navigate("/workspace/my-place");
  }, [navigate]);

  const handleTitleUpdate = useCallback(async (value: string) => {
    if (!workId) return;
    const cleaned = value.trim();
    if (!cleaned) return;
    const wrapped = `《${cleaned}》`;
    try {
      await updateWorkInfoReq(workId, { title: wrapped });
      setWorkInfo({ title: wrapped });
      toast.success("标题已更新");
    } catch (error) {
      console.error("[ScriptEditor] update title failed:", error);
      toast.error("标题更新失败");
    }
  }, [setWorkInfo, workId]);

  const displayDirectories = useMemo(() => {
    const result: Array<{
      type: "item" | "folder";
      dir?: string;
      children?: string[];
      segmentGroups?: { label: string; children: string[] }[];
    }> = [];
    const chapterDirs: string[] = [];
    const otherDirs: string[] = [];

    for (const dir of directories) {
      if (isEpisodeOrChapterDir(dir)) {
        chapterDirs.push(dir);
      } else if (dir !== "正文.md") {
        otherDirs.push(dir);
      }
    }

    for (const dir of otherDirs) {
      result.push({ type: "item", dir });
    }

    if (chapterDirs.length > 0) {
      const segmentGroups =
        outlineSegmentList.length > 0
          ? outlineSegmentList.map((seg) => {
              const startIdx = seg.start - 1;
              const endIdx = seg.end - 1;
              const children = chapterDirs
                .filter((d) => {
                  const idx = getChapterIndexFromDir(d);
                  return idx >= startIdx && idx <= endIdx;
                })
                .sort((a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b));
              return { label: seg.label, children };
            })
          : undefined;
      result.push({
        type: "folder",
        dir: "正文.md",
        children: chapterDirs,
        segmentGroups,
      });
    }
    return result;
  }, [directories, outlineSegmentList]);

  const getMainTextFolderState = useCallback((): "default" | "selected" | "disabled" => {
    const chapterDirs = directories.filter((dir) => isEpisodeOrChapterDir(dir));
    if (chapterDirs.length === 0) return "default";
    if (chapterDirs.some((chapterDir) => currentDirectory === chapterDir)) return "selected";
    const allDisabled = chapterDirs.every((chapterDir) => isDirectoryDisabled(chapterDir));
    return allDisabled ? "disabled" : "default";
  }, [currentDirectory, directories, isDirectoryDisabled]);

  const getDirectoryIcon = useCallback(
    (dir: string, state?: "default" | "selected" | "disabled") => {
      let finalState = state;
      if (dir === "正文.md") {
        finalState = getMainTextFolderState();
      } else if (!finalState) {
        if (currentDirectory === dir) finalState = "selected";
        else if (isDirectoryDisabled(dir)) finalState = "disabled";
        else finalState = "default";
      }

      if (isEpisodeOrChapterDir(dir)) {
        if (currentDirectory === dir) return mainTextSelectedIcon;
        if (isDirectoryDisabled(dir)) return mainTextDisabledIcon;
        return mainTextDefaultIcon;
      }

      const iconMap: Record<string, Record<string, string>> = {
        "小说纲章.md": {
          default: novelChapterDefaultIcon,
          selected: novelChapterSelectedIcon,
          disabled: novelChapterDefaultIcon,
        },
        "标签.md": {
          default: storyTagDefaultIcon,
          selected: storyTagSelectedIcon,
          disabled: storyTagDisabledIcon,
        },
        "故事梗概.md": {
          default: storyOutlineDefaultIcon,
          selected: storyOutlineSelectedIcon,
          disabled: storyOutlineDisabledIcon,
        },
        "主角设定.md": {
          default: characterSettingDefaultIcon,
          selected: characterSettingSelectedIcon,
          disabled: characterSettingDisabledIcon,
        },
        "大纲.md": {
          default: outlineDefaultIcon,
          selected: outlineSelectedIcon,
          disabled: outlineDisabledIcon,
        },
        "正文.md": {
          default: mainTextDefaultIcon,
          selected: mainTextSelectedIcon,
          disabled: mainTextDisabledIcon,
        },
      };

      return iconMap[dir]?.[finalState ?? "default"] ?? "";
    },
    [currentDirectory, getMainTextFolderState, isDirectoryDisabled],
  );

  const getMainTextFolderArrowIcon = useCallback(() => {
    const state = getMainTextFolderState();
    if (state === "selected") return arrowSelectedIcon;
    if (state === "disabled") return arrowDisabledIcon;
    return arrowDefaultIcon;
  }, [getMainTextFolderState]);

  const handleDirectoryClick = useCallback(
    (dir: string) => {
      if (isDirectoryDisabled(dir)) return;
      if (isEpisodeOrChapterDir(dir)) setIsMainTextExpanded(true);
      setCurrentDirectory(dir);
      scrollToDirectorySection(dir);
    },
    [isDirectoryDisabled, scrollToDirectorySection],
  );

  const handleCollapsedFolderClick = useCallback(
    (dir?: string, children?: string[]) => {
      if (!dir) return;
      setIsSidebarExpanded(true);
      if (dir === "正文.md" && children && children.length > 0) {
        setIsMainTextExpanded(true);
        const firstEnabled = children.find((child) => !isDirectoryDisabled(child));
        if (firstEnabled) handleDirectoryClick(firstEnabled);
      }
    },
    [handleDirectoryClick, isDirectoryDisabled],
  );

  const toggleSegment = useCallback((label: string) => {
    setSegmentExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  useEffect(() => {
    if (!isEpisodeOrChapterDir(currentDirectory)) return;
    setIsMainTextExpanded(true);
    const chapterIndex = getChapterIndexFromDir(currentDirectory) + 1;
    outlineSegmentList.forEach((seg) => {
      if (chapterIndex >= seg.start && chapterIndex <= seg.end) {
        setSegmentExpanded((prev) => ({ ...prev, [seg.label]: true }));
      }
    });
  }, [currentDirectory, outlineSegmentList]);

  return (
    <div className="page-quick-editor">
      <QuickEditorTopToolBar
        hideFeedback
        isScript
        onBackClick={handleBackClick}
        onSaveClick={handleSaveClick}
        onUpdateTitle={handleTitleUpdate}
      />

      <div className="quick-editor-container">
        <div
          className={cn("left-sidebar", !isSidebarExpanded && "collapsed")}
          onClick={() => setIsSidebarExpanded((v) => !v)}
        >
          {isSidebarExpanded ? (
            <div className="sidebar-content">
              <div className="sidebar-header">
                <div className="menu-header-icon">
                  <img src={TITLE_LOGO} alt="菜单栏" className="w-7 h-7" />
                </div>
              </div>
              <div className="directory-list" onClick={(e) => e.stopPropagation()}>
                {displayDirectories.map((item, index) => {
                  if (item.type === "folder") {
                    return (
                      <div
                        key={item.dir || `folder-${index}`}
                        className={cn(
                          "directory-folder",
                          item.dir === "正文.md" && isMainTextExpanded && "directory-folder--main-text-expanded",
                        )}
                      >
                        <div
                          className={cn(
                            "directory-folder-header",
                            getMainTextFolderState() === "selected" &&
                              item.children?.some((child) => currentDirectory === child) &&
                              "active",
                            getMainTextFolderState() === "disabled" && "disabled",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (getMainTextFolderState() !== "disabled") {
                              setIsMainTextExpanded((v) => !v);
                            }
                          }}
                        >
                          <img
                            src={getDirectoryIcon(item.dir || "正文.md")}
                            alt=""
                            className="directory-icon"
                          />
                          <span className="directory-name">{getDirectoryName(item.dir || "正文.md")}</span>
                          <img
                            src={getMainTextFolderArrowIcon()}
                            alt=""
                            className={cn("folder-arrow", isMainTextExpanded && "expanded")}
                          />
                        </div>
                        {isMainTextExpanded && item.children ? (
                          <div className="directory-folder-children">
                            <div className="directory-folder-children-scroll">
                              {item.segmentGroups?.length ? (
                                item.segmentGroups.map((group) => (
                                  <div key={group.label} className="segment-group">
                                    <div
                                      className="segment-header"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSegment(group.label);
                                      }}
                                    >
                                      <span className="segment-label">{group.label}</span>
                                      <img
                                        src={arrowDefaultIcon}
                                        alt=""
                                        className={cn(
                                          "folder-arrow segment-arrow",
                                          !!segmentExpanded[group.label] && "expanded",
                                        )}
                                      />
                                    </div>
                                    {segmentExpanded[group.label] ? (
                                      <div className="chapter-children-container segment-children">
                                        <div className="chapter-line" />
                                        <div className="chapter-list">
                                          {group.children.map((childDir) => (
                                            <div
                                              key={childDir}
                                              className={cn(
                                                "chapter-item",
                                                currentDirectory === childDir && "active",
                                                isDirectoryDisabled(childDir) && "disabled",
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDirectoryClick(childDir);
                                              }}
                                            >
                                              <span
                                                className={cn(
                                                  "chapter-dot",
                                                  currentDirectory === childDir && "active",
                                                )}
                                              />
                                              <span className="chapter-name">{getDirectoryName(childDir)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <div className="chapter-children-container">
                                  <div className="chapter-line" />
                                  <div className="chapter-list">
                                    {item.children.map((childDir) => (
                                      <div
                                        key={childDir}
                                        className={cn(
                                          "chapter-item",
                                          currentDirectory === childDir && "active",
                                          isDirectoryDisabled(childDir) && "disabled",
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDirectoryClick(childDir);
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            "chapter-dot",
                                            currentDirectory === childDir && "active",
                                          )}
                                        />
                                        <span className="chapter-name">{getDirectoryName(childDir)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.dir || `item-${index}`}
                      className={cn(
                        "directory-item",
                        currentDirectory === item.dir && "active",
                        !!item.dir && isDirectoryDisabled(item.dir) && "disabled",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.dir) handleDirectoryClick(item.dir);
                      }}
                    >
                      <img
                        src={getDirectoryIcon(
                          item.dir || "",
                          currentDirectory === item.dir
                            ? "selected"
                            : item.dir && isDirectoryDisabled(item.dir)
                            ? "disabled"
                            : "default",
                        )}
                        alt=""
                        className="directory-icon"
                      />
                      <span className="directory-name">{getDirectoryName(item.dir || "")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="sidebar-collapsed">
              <div className="collapsed-icon-list" onClick={(e) => e.stopPropagation()}>
                <div className="collapsed-menu-icon-wrapper" onClick={() => setIsSidebarExpanded(true)}>
                  <div className="menu-header-icon">
                    <img src={TITLE_LOGO} alt="菜单栏" className="w-7 h-7 object-cover" />
                  </div>
                </div>
                {displayDirectories.map((item, index) => (
                  <div
                    key={item.dir || `collapsed-${index}`}
                    className={cn(
                      item.type === "folder" ? "collapsed-folder" : "collapsed-icon-item",
                      item.type === "folder" &&
                        item.children?.some((child) => currentDirectory === child) &&
                        "active",
                      item.type === "item" && currentDirectory === item.dir && "active",
                    )}
                    onClick={() => {
                      if (item.type === "folder") handleCollapsedFolderClick(item.dir, item.children);
                      if (item.type === "item" && item.dir) handleDirectoryClick(item.dir);
                    }}
                  >
                    <img src={getDirectoryIcon(item.dir || "正文.md")} alt="" className="collapsed-icon" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="right-content">
          <div ref={contentScrollAreaRef} className="content-scroll-area">
            {directories.map((dir) => {
              const sectionClass = cn(
                "content-section",
                currentDirectory === dir && "section-active",
                isSectionVisible(dir) && "section-visible",
                isEpisodeOrChapterDir(dir) && "section-chapter-outer",
              );
              return (
                <div
                  key={dir}
                  className={sectionClass}
                  id={`section-${getDirectoryName(dir)}`}
                  data-dir={dir}
                >
                  {dir === "小说纲章.md" ? (
                    <div className="section-content">
                      <ScriptNovelOutlineChapter
                        novelContent={serverData[dir] || ""}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        onConfirm={handleNovelOutlineConfirm}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                      />
                    </div>
                  ) : null}

                  {dir === "标签.md" ? (
                    <div className="section-content">
                      <ScriptTagSelector
                        selectedTagIds={tagSelectorTagIds}
                        synopsis={tagSelectorSynopsis}
                        description={tagSelectorDescription}
                        novelPlot={tagSelectorNovelPlot}
                        triggerGenerate={tagGenerateTrigger}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        onConfirm={handleTagConfirm}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                      />
                    </div>
                  ) : null}

                  {dir === "故事梗概.md" ? (
                    <div className="section-content">
                      <ScriptStorySelector
                        novelPlot={tagSelectorNovelPlot}
                        description={tagSelectorDescription}
                        storyContent={serverData[dir] || ""}
                        triggerGenerate={storyGenerateTrigger}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        onConfirm={handleStoryConfirm}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    </div>
                  ) : null}

                  {dir === "主角设定.md" ? (
                    <div className="section-content">
                      <ScriptCharacterSelector
                        selectedTagIds={serverData["标签.md"] || ""}
                        novelPlot={tagSelectorNovelPlot}
                        description={tagSelectorDescription}
                        storyContent={serverData["故事梗概.md"] || ""}
                        characterContent={serverData[dir] || ""}
                        triggerGenerate={characterGenerateTrigger}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        onConfirm={handleCharacterConfirm}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    </div>
                  ) : null}

                  {dir === "大纲.md" ? (
                    <div className="section-content">
                      <ScriptOutlineEditor
                        storyContent={serverData["故事梗概.md"] || ""}
                        characterContent={serverData["主角设定.md"] || ""}
                        outlineContent={serverData[dir] || ""}
                        outlineSegments={outlineSegmentList}
                        novelPlot={tagSelectorNovelPlot}
                        description={tagSelectorDescription}
                        episodeNum={tagSelectorEpisodeNum}
                        triggerGenerate={outlineGenerateTrigger}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        onSplitReady={(raw) => void handleOutlineSplitReady(raw)}
                        onConfirm={handleOutlineConfirm}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    </div>
                  ) : null}

                  {isEpisodeOrChapterDir(dir) ? (
                    <div className="section-content section-chapter">
                      <ScriptChapterEditorCard
                        chapterIndex={getChapterIndexFromDir(dir)}
                        chapterName={getDirectoryName(dir)}
                        chapterOutlineData={getChapterDataFromOutline(
                          serverData["大纲.md"] || "",
                          getChapterIndexFromDir(dir),
                        )}
                        chapterContent={serverData[dir] || ""}
                        locked={lockedDirectories.has(dir)}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        isLastChapter={
                          (workInfo?.chapterNum ?? 0) > 0 &&
                          getChapterIndexFromDir(dir) === (workInfo?.chapterNum ?? 0) - 1
                        }
                        isLastChapterWithContent={isLastChapterWithContent(getChapterIndexFromDir(dir))}
                        previousChapterIndex={getPreviousChapterIndex(getChapterIndexFromDir(dir))}
                        onConfirm={handleChapterConfirm}
                        onContinueNext={handleChapterContinueNext}
                        onRevertToNote={handleChapterRevertToNote}
                        onRevertToOutline={handleChapterRevertToOutline}
                        onRevertChapter={handleChapterRevert}
                        onChapterNoteUpdate={handleChapterNoteUpdate}
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptEditorPage;
