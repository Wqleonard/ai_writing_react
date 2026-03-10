import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { updateWorkInfoReq, updateWorkVersionReq } from "@/api/works";
import { useEditorStore } from "@/stores/editorStore";
import type { ServerData, WorkInfo } from "@/stores/editorStore/types";
import QuickTagSelector from "@/pages/quick-editor/components/QuickTagSelector";
import QuickStorySelector from "@/pages/quick-editor/components/QuickStorySelector";
import QuickCharacterSelector from "@/pages/quick-editor/components/QuickCharacterSelector";
import QuickOutlineEditor from "@/pages/quick-editor/components/QuickOutlineEditor";
import QuickChapterEditor, {
  type QuickChapterEditorHandle,
} from "@/pages/quick-editor/components/QuickChapterEditor";

type ChapterStorageData = {
  detailedOutline?: string;
  content?: string;
  isFinished?: boolean;
};

type OutlineStorageData = {
  jsonContent?: {
    outline_dict?: Array<{
      chapter?: string;
      chapter_title?: string;
      chapter_note?: string;
    }>;
  };
};

const DEFAULT_DIRECTORIES: ServerData = {
  "标签.md": "",
  "故事梗概.md": "",
  "主角设定.md": "",
  "大纲.md": "",
  "正文.md": "",
};

const FIXED_ORDER = ["标签.md", "故事梗概.md", "主角设定.md", "大纲.md"];
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

const numberToChinese = (num: number): string => CHINESE_NUMBERS[num] ?? String(num);

const getChapterIndexFromDir = (dir: string): number => {
  const match = dir.match(/正文-第(.+)章\.md/);
  if (!match) return 0;
  const idx = CHINESE_NUMBERS.indexOf(match[1] ?? "");
  return idx > 0 ? idx - 1 : 0;
};

const getDirectoryName = (dir: string): string => {
  const map: Record<string, string> = {
    "标签.md": "故事标签",
    "故事梗概.md": "故事梗概",
    "主角设定.md": "角色设定",
    "大纲.md": "大纲",
    "正文.md": "正文",
  };
  if (dir.startsWith("正文-第") && dir.endsWith("章.md")) {
    return dir.replace("正文-", "").replace(".md", "");
  }
  return map[dir] ?? dir.replace(".md", "");
};

const isChapterDir = (dir: string) => dir.startsWith("正文-第") && dir.endsWith("章.md");

const parseChapterData = (raw: string): ChapterStorageData | null => {
  try {
    return JSON.parse(raw) as ChapterStorageData;
  } catch {
    return null;
  }
};

const hasChapterValue = (serverData: ServerData, chapterName: string): boolean => {
  const content = serverData[chapterName];
  if (!content || content.trim() === "") return false;
  try {
    const parsed = JSON.parse(content);
    return !!parsed && typeof parsed === "object";
  } catch {
    return true;
  }
};

const QuickEditorPage = () => {
  const navigate = useNavigate();
  const { workId: routeWorkId } = useParams<{ workId: string }>();

  const { initEditorData, setServerData, setWorkInfo } = useEditorStore(
    useShallow((state) => ({
      initEditorData: state.initEditorData,
      setServerData: state.setServerData,
      setWorkInfo: state.setWorkInfo,
    })),
  );

  const [workInfo, setLocalWorkInfo] = useState<WorkInfo | null>(null);
  const [serverData, setLocalServerData] = useState<ServerData>({});
  const [lockedDirectories, setLockedDirectories] = useState<Set<string>>(new Set());
  const [currentDirectory, setCurrentDirectory] = useState("标签.md");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMainTextExpanded, setIsMainTextExpanded] = useState(false);
  const [storyGenerateTrigger, setStoryGenerateTrigger] = useState(0);
  const [characterGenerateTrigger, setCharacterGenerateTrigger] = useState(0);
  const [outlineGenerateTrigger, setOutlineGenerateTrigger] = useState(0);
  const bootstrappedWorkIdRef = useRef<string | null>(null);
  const sectionRefMap = useRef<Record<string, HTMLElement | null>>({});
  const chapterEditorRefs = useRef<Record<string, QuickChapterEditorHandle | null>>({});

  const directories = useMemo(() => {
    const baseData = Object.keys(serverData).length > 0 ? serverData : DEFAULT_DIRECTORIES;
    const dirs = Object.keys(baseData);
    const fixedDirs = dirs
      .filter((dir) => FIXED_ORDER.includes(dir))
      .sort((a, b) => FIXED_ORDER.indexOf(a) - FIXED_ORDER.indexOf(b));
    const chapterDirs = dirs
      .filter((dir) => isChapterDir(dir))
      .sort((a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b));
    const otherDirs = dirs.filter((dir) => !FIXED_ORDER.includes(dir) && !isChapterDir(dir) && dir !== "正文.md");
    return [...fixedDirs, ...chapterDirs, ...otherDirs];
  }, [serverData]);

  const persistServerData = useCallback(
    async (nextData: ServerData, status: "0" | "1") => {
      if (!routeWorkId) return;
      await updateWorkVersionReq(routeWorkId, JSON.stringify(nextData), status);
      setLocalServerData(nextData);
      setServerData(nextData);
    },
    [routeWorkId, setServerData],
  );

  const initLockedDirectories = useCallback(
    (data: ServerData, info: WorkInfo | null): Set<string> => {
      const next = new Set<string>();
      for (const dir of Object.keys(data)) {
        const content = data[dir];
        if (!content || !content.trim()) continue;
        if (isChapterDir(dir)) {
          const parsed = parseChapterData(content);
          if ((parsed?.detailedOutline?.trim() || parsed?.content?.trim()) && parsed?.isFinished !== false) {
            next.add(dir);
          }
        } else {
          next.add(dir);
        }
      }
      if ((info?.chapterNum ?? 0) > 0 && !next.has("标签.md")) {
        next.delete("故事梗概.md");
        next.delete("主角设定.md");
        next.delete("大纲.md");
      }
      return next;
    },
    [],
  );

  const initServerData = useCallback(
    (raw: ServerData, info: WorkInfo | null): ServerData => {
      if (!raw || Object.keys(raw).length === 0) return { ...DEFAULT_DIRECTORIES };
      const next = { ...raw };
      if ("故事标签.md" in next && "标签.md" in next) delete next["故事标签.md"];
      if ("故事标签.md" in next && !("标签.md" in next)) {
        next["标签.md"] = next["故事标签.md"];
        delete next["故事标签.md"];
      }
      for (const key of Object.keys(DEFAULT_DIRECTORIES).filter((k) => k !== "正文.md")) {
        if (!(key in next)) next[key] = "";
      }

      if (next["标签.md"] && info?.chapterNum) {
        const chapterNum = info.chapterNum;
        const existing = Object.keys(next).filter((k) => isChapterDir(k));
        if (existing.length === 0) {
          for (let i = 1; i <= chapterNum; i++) next[`正文-第${numberToChinese(i)}章.md`] = "";
        }
        delete next["正文.md"];
      } else if (!("正文.md" in next)) {
        next["正文.md"] = "";
      }
      return next;
    },
    [],
  );

  const isSectionVisible = useCallback(
    (dir: string) => {
      if (lockedDirectories.has(dir)) return true;
      if (isChapterDir(dir)) return hasChapterValue(serverData, dir);
      const idx = directories.indexOf(dir);
      if (idx === 0) return true;
      if (serverData[dir]?.trim()) return true;
      const prev = directories[idx - 1];
      return !!prev && lockedDirectories.has(prev);
    },
    [directories, lockedDirectories, serverData],
  );

  const isDirectoryDisabled = useCallback(
    (dir: string, index: number): boolean => {
      if (isChapterDir(dir)) return !hasChapterValue(serverData, dir);
      return !lockedDirectories.has(dir) && (index === 0 ? false : !lockedDirectories.has(directories[index - 1] ?? ""));
    },
    [directories, lockedDirectories, serverData],
  );

  const hasNextDirectoryContent = useCallback(
    (dir: string) => {
      if (!lockedDirectories.has(dir)) return false;
      const idx = directories.indexOf(dir);
      const next = idx >= 0 ? directories[idx + 1] : undefined;
      return !!next && isSectionVisible(next);
    },
    [directories, isSectionVisible, lockedDirectories],
  );

  const getPreviousChapterIndex = useCallback(
    (chapterIndex: number): number | undefined => {
      const current = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      const chapters = directories.filter((d) => isChapterDir(d));
      const currentIdx = chapters.indexOf(current);
      if (currentIdx < 0) return undefined;
      for (let i = currentIdx - 1; i >= 0; i--) {
        const dir = chapters[i];
        if (!dir) continue;
        const parsed = parseChapterData(serverData[dir] ?? "");
        if (parsed?.detailedOutline?.trim() || parsed?.content?.trim()) return getChapterIndexFromDir(dir);
      }
      return undefined;
    },
    [directories, serverData],
  );

  const isLastChapterWithContent = useCallback(
    (chapterIndex: number) => {
      const current = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      const chapters = directories.filter((d) => isChapterDir(d));
      const idx = chapters.indexOf(current);
      if (idx < 0) return false;
      const parsed = parseChapterData(serverData[current] ?? "");
      if (!parsed?.content?.trim()) return false;
      for (let i = idx + 1; i < chapters.length; i++) {
        const key = chapters[i];
        if (key && (serverData[key] ?? "").trim()) return false;
      }
      return true;
    },
    [directories, serverData],
  );

  useEffect(() => {
    let isActive = true;
    const bootstrap = async () => {
      if (!routeWorkId) return;
      if (bootstrappedWorkIdRef.current === routeWorkId) return;
      bootstrappedWorkIdRef.current = routeWorkId;
      await initEditorData(routeWorkId);
      if (!isActive) return;
      const state = useEditorStore.getState();
      const info = state.workInfo;
      const normalized = initServerData(state.serverData, info);
      setLocalWorkInfo(info);
      setLocalServerData(normalized);
      setServerData(normalized);
      const locks = initLockedDirectories(normalized, info);
      setLockedDirectories(locks);
      const normalizedKeys = Object.keys(normalized);
      const firstFixedDir = FIXED_ORDER.find((dir) => normalizedKeys.includes(dir));
      setCurrentDirectory(firstFixedDir ?? normalizedKeys[0] ?? "标签.md");
    };
    void bootstrap();
    return () => {
      isActive = false;
    };
  }, [initEditorData, initLockedDirectories, initServerData, routeWorkId, setServerData]);

  useEffect(() => {
    const el = sectionRefMap.current[currentDirectory];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentDirectory]);

  const handleBackClick = useCallback(() => navigate("/workspace/my-place", { replace: true }), [navigate]);

  const handleClickToSave = useCallback(async () => {
    try {
      await persistServerData(serverData, "0");
      toast.success("保存成功");
    } catch {
      toast.error("保存失败");
    }
  }, [persistServerData, serverData]);

  const handleTitleUpdate = useCallback(
    async (newTitle: string) => {
      if (!routeWorkId || !workInfo || !newTitle || newTitle === workInfo.title) return;
      const wrapped = `《${newTitle}》`;
      await updateWorkInfoReq(routeWorkId, { title: wrapped });
      const next = { ...workInfo, title: wrapped };
      setLocalWorkInfo(next);
      setWorkInfo(next);
    },
    [routeWorkId, setWorkInfo, workInfo],
  );

  const handleTagConfirm = useCallback(async (data: { tagIds: string; chapterNum: number; wordNum: number }) => {
    try {
      const next: ServerData = { ...serverData, "标签.md": data.tagIds };
      if (!("故事梗概.md" in next)) next["故事梗概.md"] = "";
      if (!("主角设定.md" in next)) next["主角设定.md"] = "";
      if (!("大纲.md" in next)) next["大纲.md"] = "";
      delete next["正文.md"];
      for (const key of Object.keys(next)) if (isChapterDir(key)) delete next[key];
      for (let i = 1; i <= data.chapterNum; i++) next[`正文-第${numberToChinese(i)}章.md`] = "";
      await persistServerData(next, "1");
      setLockedDirectories((prev) => new Set(prev).add("标签.md"));
      setLocalWorkInfo((prev) => {
        if (!prev) return prev;
        const nextInfo = { ...prev, chapterNum: data.chapterNum, wordNum: data.wordNum };
        setWorkInfo(nextInfo);
        return nextInfo;
      });
      const orderedDirs = [...FIXED_ORDER, ...Object.keys(next).filter((key) => isChapterDir(key)).sort(
        (a, b) => getChapterIndexFromDir(a) - getChapterIndexFromDir(b),
      )];
      const nextDir = orderedDirs.find((dir) => dir in next && dir !== "标签.md");
      setCurrentDirectory(nextDir ?? "故事梗概.md");
      setStoryGenerateTrigger((prev) => prev + 1);
      toast.success("标签保存成功");
      // TODO(api): 原 Vue 使用 trackingQuickCreationGenerate("Brief")，当前 React 项目未找到同名埋点 API。
    } catch {
      toast.error("保存失败");
    }
  }, [persistServerData, serverData, setWorkInfo]);

  const handleStoryConfirm = useCallback(async () => {
    try {
      await persistServerData(serverData, "1");
      setLockedDirectories((prev) => new Set(prev).add("故事梗概.md"));
      setCurrentDirectory("主角设定.md");
      toast.success("故事梗概保存成功");
    } catch {
      toast.error("保存失败");
    }
  }, [persistServerData, serverData]);

  const handleStoryConfirmWithData = useCallback(
    async (storyData: string) => {
      try {
        const next = { ...serverData, "故事梗概.md": storyData };
        await persistServerData(next, "1");
        setLockedDirectories((prev) => new Set(prev).add("故事梗概.md"));
        setCharacterGenerateTrigger((prev) => prev + 1);
        setCurrentDirectory("主角设定.md");
        toast.success("故事梗概保存成功");
      } catch {
        toast.error("保存失败");
      }
    },
    [persistServerData, serverData],
  );

  const handleStoryRevert = useCallback(async () => {
    const next = { ...serverData };
    delete next["正文.md"];
    const storyIdx = directories.indexOf("故事梗概.md");
    for (const dir of directories.slice(storyIdx >= 0 ? storyIdx : 0)) {
      next[dir] = "";
    }
    Object.keys(next).forEach((key) => {
      if (isChapterDir(key)) delete next[key];
    });
    next["正文.md"] = "";
    await persistServerData(next, "1");
    setLockedDirectories((prev) => {
      const clone = new Set(prev);
      clone.delete("标签.md");
      clone.delete("故事梗概.md");
      clone.delete("主角设定.md");
      clone.delete("大纲.md");
      return clone;
    });
    setCurrentDirectory("标签.md");
    toast.success("已回退至标签选择");
  }, [directories, persistServerData, serverData]);

  const handleCharacterConfirm = useCallback(async () => {
    try {
      await persistServerData(serverData, "1");
      setLockedDirectories((prev) => new Set(prev).add("主角设定.md"));
      setCurrentDirectory("大纲.md");
      toast.success("角色设定保存成功");
    } catch {
      toast.error("保存失败");
    }
  }, [persistServerData, serverData]);

  const handleCharacterConfirmWithData = useCallback(
    async (characterData: string) => {
      try {
        const next = { ...serverData, "主角设定.md": characterData };
        await persistServerData(next, "1");
        setLockedDirectories((prev) => new Set(prev).add("主角设定.md"));
        setOutlineGenerateTrigger((prev) => prev + 1);
        setCurrentDirectory("大纲.md");
        toast.success("角色设定保存成功");
      } catch {
        toast.error("保存失败");
      }
    },
    [persistServerData, serverData],
  );

  const handleCharacterRevert = useCallback(async () => {
    const next = { ...serverData };
    const charIdx = directories.indexOf("主角设定.md");
    for (const dir of directories.slice(charIdx >= 0 ? charIdx : 0)) next[dir] = "";
    await persistServerData(next, "1");
    setLockedDirectories((prev) => {
      const clone = new Set(prev);
      clone.delete("故事梗概.md");
      clone.delete("主角设定.md");
      clone.delete("大纲.md");
      directories.forEach((dir) => {
        if (isChapterDir(dir)) clone.delete(dir);
      });
      return clone;
    });
    setCurrentDirectory("故事梗概.md");
    toast.success("已回退至故事梗概选择");
  }, [directories, persistServerData, serverData]);

  const handleOutlineConfirm = useCallback(
    async (outlineData: string) => {
      try {
        const firstChapter = directories.find((dir) => isChapterDir(dir));
        const next: ServerData = { ...serverData, "大纲.md": outlineData };
        if (firstChapter) next[firstChapter] = JSON.stringify({ detailedOutline: "", content: "" });
        await persistServerData(next, "1");
        setLockedDirectories((prev) => new Set(prev).add("大纲.md"));
        if (firstChapter) setCurrentDirectory(firstChapter);
        toast.success("大纲保存成功");
      } catch {
        toast.error("保存失败");
      }
    },
    [directories, persistServerData, serverData],
  );

  const handleOutlineRevert = useCallback(async () => {
    const next = { ...serverData };
    const outlineIdx = directories.indexOf("大纲.md");
    for (const dir of directories.slice(outlineIdx >= 0 ? outlineIdx : 0)) next[dir] = "";
    await persistServerData(next, "1");
    setLockedDirectories((prev) => {
      const clone = new Set(prev);
      clone.delete("主角设定.md");
      clone.delete("大纲.md");
      directories.forEach((dir) => {
        if (isChapterDir(dir)) clone.delete(dir);
      });
      return clone;
    });
    setCurrentDirectory("主角设定.md");
    toast.success("已回退至角色选择");
  }, [directories, persistServerData, serverData]);

  const handleChapterConfirm = useCallback(
    async (chapterIndex: number, chapterData: string) => {
      const key = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      try {
        await persistServerData({ ...serverData, [key]: chapterData }, "1");
        toast.success("章节保存成功");
      } catch {
        toast.error("保存失败");
      }
    },
    [persistServerData, serverData],
  );

  const getChapterDataFromOutline = useCallback(
    (chapterIndex: number) => {
      const outlineRaw = serverData["大纲.md"];
      if (!outlineRaw) return null;
      try {
        const parsed = JSON.parse(outlineRaw) as OutlineStorageData;
        const chapter = parsed.jsonContent?.outline_dict?.[chapterIndex];
        if (!chapter) return null;
        return {
          chapter: chapter.chapter ?? `第${numberToChinese(chapterIndex + 1)}章`,
          chapter_title: chapter.chapter_title ?? "",
          chapter_note: chapter.chapter_note ?? "",
        };
      } catch {
        return null;
      }
    },
    [serverData],
  );

  const handleChapterNoteUpdate = useCallback(
    async (chapterIndex: number, chapterNote: string) => {
      const outlineRaw = serverData["大纲.md"];
      if (!outlineRaw) return;
      try {
        const parsed = JSON.parse(outlineRaw) as OutlineStorageData;
        const chapters = parsed.jsonContent?.outline_dict;
        if (!chapters?.[chapterIndex]) return;
        chapters[chapterIndex].chapter_note = chapterNote;
        await persistServerData({ ...serverData, "大纲.md": JSON.stringify(parsed) }, "1");
      } catch {
        toast.error("保存失败");
      }
    },
    [persistServerData, serverData],
  );

  const handleChapterRevertToNote = useCallback(
    async (chapterIndex: number) => {
      const chapterName = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      const chapterDirIndex = directories.indexOf(chapterName);
      if (chapterDirIndex < 0) return;
      const next: ServerData = {
        ...serverData,
        [chapterName]: JSON.stringify({ detailedOutline: "", content: "" }),
      };
      directories.slice(chapterDirIndex + 1).forEach((dir) => {
        if (isChapterDir(dir)) next[dir] = "";
      });
      await persistServerData(next, "1");
      setLockedDirectories((prev) => {
        const clone = new Set(prev);
        clone.delete(chapterName);
        directories.slice(chapterDirIndex + 1).forEach((dir) => {
          if (isChapterDir(dir)) clone.delete(dir);
        });
        return clone;
      });
      setCurrentDirectory(chapterName);
      toast.success("已回退至此步骤");
    },
    [directories, persistServerData, serverData],
  );

  const handleChapterRevertToOutline = useCallback(
    async (chapterIndex: number) => {
      const chapterName = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      const raw = serverData[chapterName];
      if (!raw?.trim()) return;
      try {
        const parsed = JSON.parse(raw) as ChapterStorageData;
        const nextRaw = JSON.stringify({ ...parsed, content: "" });
        await persistServerData({ ...serverData, [chapterName]: nextRaw }, "1");
        setLockedDirectories((prev) => {
          const clone = new Set(prev);
          clone.delete(chapterName);
          return clone;
        });
        setCurrentDirectory(chapterName);
        toast.success("已回退至细纲");
      } catch {
        toast.error("回退失败");
      }
    },
    [persistServerData, serverData],
  );

  const handleChapterGenerateContent = useCallback((_chapterIndex: number) => {
    // Reserved for analytics/side effects to keep parity with Vue emit.
  }, []);

  const handleChapterContinueNext = useCallback(
    async (chapterIndex: number) => {
      const total = workInfo?.chapterNum ?? 0;
      const current = `正文-第${numberToChinese(chapterIndex + 1)}章.md`;
      if (total > 0 && chapterIndex === total - 1) {
        const parsed = parseChapterData(serverData[current] ?? "") ?? {};
        const next = { ...serverData, [current]: JSON.stringify({ ...parsed, isFinished: true }) };
        await persistServerData(next, "1");
        setLockedDirectories((prev) => new Set(prev).add(current));
        toast.success("创作完成");
        return;
      }
      const nextChapterName = `正文-第${numberToChinese(chapterIndex + 2)}章.md`;
      if (!(nextChapterName in serverData)) {
        toast.warning("没有下一章了");
        return;
      }
      const next = { ...serverData, [nextChapterName]: JSON.stringify({ detailedOutline: "", content: "" }) };
      await persistServerData(next, "1");
      setLockedDirectories((prev) => {
        const clone = new Set(prev);
        clone.add(current);
        return clone;
      });
      setCurrentDirectory(nextChapterName);
    },
    [persistServerData, serverData, workInfo?.chapterNum],
  );

  const handleRevertToCurrentStep = useCallback(
    async (dir: string) => {
      const index = directories.indexOf(dir);
      if (index < 0) return;
      const next = { ...serverData };
      for (const key of directories.slice(index + 1)) next[key] = "";
      await persistServerData(next, "1");
      setLockedDirectories((prev) => {
        const clone = new Set(prev);
        clone.delete(dir);
        for (const key of directories.slice(index + 1)) clone.delete(key);
        return clone;
      });
      setCurrentDirectory(dir);
      toast.success("已回退");
    },
    [directories, persistServerData, serverData],
  );

  const displayDirectories = useMemo(() => {
    const chapterDirs = directories.filter((dir) => isChapterDir(dir));
    const others = directories.filter((dir) => !isChapterDir(dir) && dir !== "正文.md");
    const result: Array<{ type: "item" | "folder"; dir: string; children?: string[] }> = others.map((dir) => ({
      type: "item",
      dir,
    }));
    if (chapterDirs.length > 0) result.push({ type: "folder", dir: "正文.md", children: chapterDirs });
    return result;
  }, [directories]);

  const mainTextFolderState = useMemo<"default" | "selected" | "disabled">(() => {
    const chapters = directories.filter((d) => isChapterDir(d));
    if (chapters.length === 0) return "default";
    if (chapters.some((d) => d === currentDirectory)) return "selected";
    const allDisabled = chapters.every((dir) => isDirectoryDisabled(dir, directories.indexOf(dir)));
    return allDisabled ? "disabled" : "default";
  }, [currentDirectory, directories, isDirectoryDisabled]);

  const handleNotesConfirm = useCallback((notes: unknown[]) => {
    const current = currentDirectory;
    if (!isChapterDir(current) || !lockedDirectories.has(current)) {
      toast.warning("需要先将光标定位到您想插入笔记的正文位置");
      return;
    }
    const editor = chapterEditorRefs.current[current];
    if (!editor?.insertNoteContent) {
      toast.error("无法找到当前章节编辑器");
      return;
    }
    const result = editor.insertNoteContent(notes);
    if (result.success) toast.success(result.message);
    else toast.warning(result.message);
  }, [currentDirectory, lockedDirectories]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-(--bg-editor) text-(--text-primary)">
      <div className="flex h-14 shrink-0 items-center justify-between bg-(--bg-editor) px-7">
        <div className="flex items-center gap-4">
          <button className="text-sm text-(--text-primary) hover:text-(--accent-color)" onClick={handleBackClick}>
            返回
          </button>
          <span className="text-(--border-color)">|</span>
          <button className="text-sm text-(--text-primary) hover:text-(--accent-color)" onClick={handleClickToSave}>
            保存
          </button>
          <button
            className="rounded-md bg-[#ffc227] px-2 py-1 text-xs text-white hover:opacity-90"
            onClick={() => {
              const notes: unknown[] = [];
              handleNotesConfirm(notes);
            }}
          >
            插入笔记
          </button>
        </div>
        <input
          className="w-88 rounded-md border border-[#dedede] bg-white px-3 py-1 text-sm outline-none focus:border-[#ffb200]"
          placeholder="作品标题"
          value={(workInfo?.title ?? "").replace(/[《》]/g, "")}
          onChange={(e) => void handleTitleUpdate(e.target.value)}
        />
      </div>

      <div className="relative flex h-[calc(100vh-56px)] min-h-0 flex-1 overflow-hidden bg-(--bg-editor)">
        <aside
          className={`relative flex h-full flex-col bg-(--bg-editor) transition-all duration-300 ${isSidebarExpanded ? "w-[352px]" : "w-[184px]"}`}
        >
          {isSidebarExpanded ? (
            <div className="mt-[87px] ml-[49px] flex max-h-[calc(100vh-183px)] w-[258px] flex-col overflow-hidden rounded-[45px] bg-[#f3f3f3] pt-6 pb-[22px]">
              <div className="mb-[22px] flex h-12 w-full px-[17px]">
                <button
                  className="ml-[5px] flex h-12 w-12 items-center justify-center rounded-full bg-white text-xs text-[#666] shadow-sm"
                  onClick={() => setIsSidebarExpanded(false)}
                >
                  收起
                </button>
              </div>
              <div className="mx-auto flex min-h-0 w-[220px] flex-1 flex-col">
                {displayDirectories.map((item) => {
                  if (item.type === "folder" && item.children) {
                    const active = item.children.some((c) => c === currentDirectory);
                    const disabled = mainTextFolderState === "disabled";
                    return (
                      <div key="正文.md" className="mb-[10px] w-full">
                        <button
                          className={`relative flex h-10 w-full items-center rounded-[5px] px-2 transition-all ${
                            disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-[#f8f3df]"
                          } ${active && !disabled ? "bg-[#f8f3df]" : ""}`}
                          onClick={() => {
                            if (disabled) return;
                            setIsMainTextExpanded((v) => !v);
                          }}
                        >
                          <span className="mr-[10px] inline-flex h-10 w-10 items-center justify-center rounded bg-white text-[10px] text-[#999]">文</span>
                          <span
                            className={`flex-1 text-left text-[18px] ${
                              active && !disabled
                                ? "bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text text-[20px] font-bold text-transparent"
                                : disabled
                                  ? "text-[#999]"
                                  : "text-[#464646]"
                            }`}
                          >
                            正文
                          </span>
                          <span className={`ml-[10px] text-xs text-[#999] transition-transform ${isMainTextExpanded ? "rotate-180" : ""}`}>▼</span>
                        </button>

                        {isMainTextExpanded && (
                          <div className="w-full pt-[22px] pr-[14px] pl-[14px]">
                            <div className="flex max-h-[325px] min-h-[50px] w-[195px] flex-row items-start">
                              <div className="mr-[2px] mt-[10px] mb-[60px] ml-[8px] w-px self-stretch bg-[#e2e2e2]" />
                              <div className="ml-[-5px] flex max-h-[325px] flex-1 flex-col overflow-y-auto pl-[5px] pb-[50px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {item.children.map((child, idx) => {
                                  const disabledChild = isDirectoryDisabled(child, directories.indexOf(child));
                                  const activeChild = currentDirectory === child;
                                  return (
                                    <button
                                      key={child}
                                      className={`relative mb-[10px] flex h-[21px] w-full items-center text-left last:mb-0 ${
                                        disabledChild ? "cursor-not-allowed" : "cursor-pointer"
                                      }`}
                                      onClick={() => {
                                        if (disabledChild) return;
                                        setCurrentDirectory(child);
                                      }}
                                    >
                                      <span
                                        className={`absolute left-0 h-2 w-2 -translate-x-[4.5px] rounded-full ${
                                          activeChild ? "bg-[#ffc227]" : "bg-transparent"
                                        }`}
                                      />
                                      <span
                                        className={`ml-[29px] text-base ${
                                          activeChild
                                            ? "font-bold text-[#ffc227]"
                                            : disabledChild
                                              ? "text-[#e2e2e2]"
                                              : "text-[#999]"
                                        }`}
                                      >
                                        {getDirectoryName(child)}
                                      </span>
                                      {idx === 0 && (
                                        <span className="ml-2 rounded border border-[#eee] px-1 py-0.5 text-[10px] text-[#aaa]">起始</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  const idx = directories.indexOf(item.dir);
                  const disabled = isDirectoryDisabled(item.dir, idx);
                  const active = currentDirectory === item.dir;
                  return (
                    <button
                      key={item.dir}
                      className={`relative mb-[22px] flex h-10 w-full items-center rounded-[5px] px-2 text-left transition-all ${
                        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#f8f3df]"
                      } ${active && !disabled ? "bg-[#f8f3df]" : ""}`}
                      onClick={() => {
                        if (disabled) return;
                        setCurrentDirectory(item.dir);
                      }}
                    >
                      <span className="mr-[10px] inline-flex h-10 w-10 items-center justify-center rounded bg-white text-[10px] text-[#999]">
                        {getDirectoryName(item.dir).slice(0, 1)}
                      </span>
                      <span
                        className={`flex-1 whitespace-nowrap text-[18px] ${
                          active && !disabled
                            ? "bg-linear-to-r from-[#efaf00] to-[#ff9500] bg-clip-text text-[20px] font-bold text-transparent"
                            : disabled
                              ? "text-[#999]"
                              : "text-[#464646]"
                        }`}
                      >
                        {getDirectoryName(item.dir)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-[127px] ml-[49px] flex h-[431px] w-[90px] flex-col items-center justify-center rounded-[45px] bg-[#f3f3f3] py-6">
              <div className="flex h-[358px] w-14 flex-col items-center justify-between">
                <button
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[10px] text-[#666] shadow-sm"
                  onClick={() => setIsSidebarExpanded(true)}
                >
                  展开
                </button>
                {displayDirectories.map((item) => {
                  const active = item.children?.some((child) => child === currentDirectory) || currentDirectory === item.dir;
                  return (
                    <button
                      key={item.dir}
                      className={`flex h-10 w-10 items-center justify-center rounded-[5px] transition-all hover:bg-[#f8f3df] ${active ? "bg-[#f8f3df]" : ""}`}
                      onClick={() => {
                        setIsSidebarExpanded(true);
                        if (item.type === "folder" && item.children?.length) {
                          setIsMainTextExpanded(true);
                          setCurrentDirectory(item.children[0] ?? "标签.md");
                        } else {
                          setCurrentDirectory(item.dir);
                        }
                      }}
                    >
                      <span className="text-[10px] text-[#666]">{getDirectoryName(item.dir).slice(0, 1)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg-editor)">
          <div className="min-h-full flex-1 overflow-y-auto overflow-x-hidden scroll-auto scroll-pt-0 [scroll-snap-type:y_proximity] [-webkit-overflow-scrolling:touch] overscroll-y-contain">
            {directories.map((dir) => {
              const isVisible = isSectionVisible(dir);
              const isChapter = isChapterDir(dir);
              if (!isVisible) return null;
              return (
                <section
                  key={dir}
                  ref={(el) => {
                    sectionRefMap.current[dir] = el;
                  }}
                  className={`snap-start flex shrink-0 flex-col ${
                    isChapter ? "h-auto min-h-[calc(100vh-56px)] overflow-visible" : "h-[calc(100vh-56px)]"
                  }`}
                >
                  <div className={`flex w-full flex-1 flex-col ${isChapter ? "h-auto min-h-[calc(100vh-56px)] overflow-visible" : "overflow-hidden"}`}>
                    {dir === "标签.md" && (
                      <QuickTagSelector
                        workId={routeWorkId}
                        selectedTagIds={serverData["标签.md"] ?? ""}
                        locked={lockedDirectories.has("标签.md")}
                        hasNextContent={hasNextDirectoryContent("标签.md")}
                        initialChapterNum={workInfo?.chapterNum ?? 10}
                        initialWordNum={workInfo?.wordNum ?? 800}
                        onConfirm={(data) => void handleTagConfirm(data)}
                        onRevert={() => void handleRevertToCurrentStep("标签.md")}
                        onRevertToCurrent={() => void handleRevertToCurrentStep("标签.md")}
                      />
                    )}
                    {dir === "故事梗概.md" && (
                      <QuickStorySelector
                        selectedTagIds={serverData["标签.md"] ?? ""}
                        storyContent={serverData["故事梗概.md"] ?? ""}
                        locked={lockedDirectories.has("故事梗概.md")}
                        hasNextContent={hasNextDirectoryContent("故事梗概.md")}
                        triggerGenerate={storyGenerateTrigger}
                        workTags={(workInfo?.workTags ?? []).map((tag) => ({ name: tag.name }))}
                        onConfirm={(storyData) => void handleStoryConfirmWithData(storyData)}
                        onRevert={() => void handleStoryRevert()}
                        onRevertToCurrent={() => void handleRevertToCurrentStep("故事梗概.md")}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    )}
                    {dir === "主角设定.md" && (
                      <QuickCharacterSelector
                        selectedTagIds={serverData["标签.md"] ?? ""}
                        storyContent={serverData["故事梗概.md"] ?? ""}
                        characterContent={serverData["主角设定.md"] ?? ""}
                        locked={lockedDirectories.has("主角设定.md")}
                        hasNextContent={hasNextDirectoryContent("主角设定.md")}
                        triggerGenerate={characterGenerateTrigger}
                        workTags={(workInfo?.workTags ?? []).map((tag) => ({ name: tag.name }))}
                        onConfirm={(characterData) => void handleCharacterConfirmWithData(characterData)}
                        onRevert={() => void handleCharacterRevert()}
                        onRevertToCurrent={() => void handleRevertToCurrentStep("主角设定.md")}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    )}
                    {dir === "大纲.md" && (
                      <QuickOutlineEditor
                        selectedTagIds={serverData["标签.md"] ?? ""}
                        storyContent={serverData["故事梗概.md"] ?? ""}
                        characterContent={serverData["主角设定.md"] ?? ""}
                        outlineContent={serverData["大纲.md"] ?? ""}
                        locked={lockedDirectories.has("大纲.md")}
                        hasNextContent={hasNextDirectoryContent("大纲.md")}
                        triggerGenerate={outlineGenerateTrigger}
                        workInfoTitle={workInfo?.title ?? "大纲"}
                        workTags={(workInfo?.workTags ?? []).map((tag) => ({ name: tag.name }))}
                        chapterNum={workInfo?.chapterNum ?? 10}
                        onConfirm={(outlineData) => void handleOutlineConfirm(outlineData)}
                        onRevert={() => void handleOutlineRevert()}
                        onRevertToCurrent={() => void handleRevertToCurrentStep("大纲.md")}
                        onErrorAndRevert={(targetDir) => void handleRevertToCurrentStep(targetDir)}
                      />
                    )}
                    {isChapter && (
                      <QuickChapterEditor
                        ref={(instance) => {
                          chapterEditorRefs.current[dir] = instance;
                        }}
                        chapterIndex={getChapterIndexFromDir(dir)}
                        chapterData={getChapterDataFromOutline(getChapterIndexFromDir(dir))}
                        chapterContent={serverData[dir] ?? ""}
                        locked={lockedDirectories.has(dir)}
                        isLastChapterWithContent={isLastChapterWithContent(getChapterIndexFromDir(dir))}
                        previousChapterIndex={getPreviousChapterIndex(getChapterIndexFromDir(dir))}
                        hasNextContent={hasNextDirectoryContent(dir)}
                        workTitle={workInfo?.title ?? ""}
                        storyContent={serverData["故事梗概.md"] ?? ""}
                        characterContent={serverData["主角设定.md"] ?? ""}
                        workTags={(workInfo?.workTags ?? []).map((tag) => ({ name: tag.name }))}
                        wordNum={workInfo?.wordNum ?? 800}
                        totalChapterNum={workInfo?.chapterNum ?? 0}
                        allChapterServerData={serverData}
                        onConfirm={(chapterData) =>
                          void handleChapterConfirm(getChapterIndexFromDir(dir), chapterData)
                        }
                        onRevert={() => {
                          const prevIndex = getPreviousChapterIndex(getChapterIndexFromDir(dir));
                          if (prevIndex === undefined) void handleRevertToCurrentStep("大纲.md");
                          else void handleRevertToCurrentStep(`正文-第${numberToChinese(prevIndex + 1)}章.md`);
                        }}
                        onRevertToNote={() => void handleChapterRevertToNote(getChapterIndexFromDir(dir))}
                        onRevertToOutline={() => void handleChapterRevertToOutline(getChapterIndexFromDir(dir))}
                        onUpdateChapterNote={(chapterNote) =>
                          void handleChapterNoteUpdate(getChapterIndexFromDir(dir), chapterNote)
                        }
                        onScrollBoundary={() => {}}
                        onGenerateContent={() =>
                          void handleChapterGenerateContent(getChapterIndexFromDir(dir))
                        }
                        onContinueNextChapter={() =>
                          void handleChapterContinueNext(getChapterIndexFromDir(dir))
                        }
                        onRevertToCurrent={() => void handleRevertToCurrentStep(dir)}
                      />
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      </div>
      <div className="fixed bottom-[2px] left-0 w-full text-center text-[11px] text-[#ccc] opacity-80">
        {"<内容由AI生成，仅供参考>"}
      </div>
    </div>
  );
};

export default QuickEditorPage;
