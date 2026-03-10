import { useMemo } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editorStore";
import type { FileTreeNode } from "@/stores/editorStore/types";
import { ExportUtils } from "@/utils/exportUtils";

interface QuickExportDialogProps {
  visible: boolean;
  isScript?: boolean;
  onClose?: () => void;
}

const getQuickChapterIndexFromDir = (dir: string): number => {
  const numMatch = dir.match(/正文-第(\d+)章\.md/);
  if (numMatch) return Math.max(0, Number.parseInt(numMatch[1] ?? "1", 10) - 1);
  const match = dir.match(/正文-第(.+)章\.md/);
  if (!match) return -1;
  const chineseNumbers = [
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
  const index = chineseNumbers.indexOf(match[1] ?? "");
  return index > 0 ? index - 1 : -1;
};

const getScriptEpisodeIndexFromDir = (dir: string): number => {
  const match = dir.match(/^第(\d+)集\.md$/);
  if (!match) return -1;
  return Math.max(0, Number.parseInt(match[1] ?? "1", 10) - 1);
};

export const QuickExportDialog = ({ visible, isScript = false, onClose }: QuickExportDialogProps) => {
  const serverData = useEditorStore((s) => s.serverData);
  const workInfo = useEditorStore((s) => s.workInfo);

  const workNode = useMemo<FileTreeNode | null>(() => {
    if (!workInfo?.title) return null;

    const directories = Object.keys(serverData ?? {});
    const children: FileTreeNode[] = [];

    if (isScript) {
      const episodeDirs = directories
        .filter((dir) => /^第\d+集\.md$/.test(dir))
        .sort((a, b) => getScriptEpisodeIndexFromDir(a) - getScriptEpisodeIndexFromDir(b));

      episodeDirs.forEach((dir) => {
        const raw = serverData[dir];
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as { content?: string };
          children.push({
            id: dir,
            key: dir,
            label: dir.replace(".md", ""),
            content: parsed?.content ?? "",
            isDirectory: false,
            path: [dir],
            fileType: "md",
            children: [],
          });
        } catch {
          children.push({
            id: dir,
            key: dir,
            label: dir.replace(".md", ""),
            content: raw,
            isDirectory: false,
            path: [dir],
            fileType: "md",
            children: [],
          });
        }
      });
    } else {
      const chapterDirs = directories
        .filter((dir) => dir.startsWith("正文-第") && dir.endsWith("章.md"))
        .sort((a, b) => getQuickChapterIndexFromDir(a) - getQuickChapterIndexFromDir(b));

      chapterDirs.forEach((dir) => {
        const raw = serverData[dir];
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as { content?: string };
          children.push({
            id: dir,
            key: dir,
            label: dir.replace(".md", ""),
            content: parsed?.content ?? "",
            isDirectory: false,
            path: [dir],
            fileType: "md",
            children: [],
          });
        } catch {
          children.push({
            id: dir,
            key: dir,
            label: dir.replace(".md", ""),
            content: raw,
            isDirectory: false,
            path: [dir],
            fileType: "md",
            children: [],
          });
        }
      });
    }

    if (children.length === 0) return null;

    return {
      id: workInfo.title,
      key: workInfo.title,
      label: workInfo.title,
      content: "",
      isDirectory: true,
      path: [],
      children,
    };
  }, [isScript, serverData, workInfo?.title]);

  const exportFullBook = async (format: "word" | "txt") => {
    if (!workNode) {
      toast.warning("没有可导出的正文内容");
      return;
    }

    try {
      if (format === "word") {
        await ExportUtils.exportWorkAsZipDoc(workNode);
        toast.success("正文 Word 文件导出成功");
      } else {
        await ExportUtils.exportWorkAsZipTxt(workNode);
        toast.success("正文 TXT 文件导出成功");
      }
      onClose?.();
    } catch (error) {
      console.error("导出失败:", error);
      toast.error(error instanceof Error ? error.message : "导出失败");
    }
  };

  if (!visible) return null;

  return (
    <div className="quick-export-dropdown" onClick={(e) => e.stopPropagation()}>
      <div className="quick-export-menu rounded-[8px] border border-(--border-color) bg-(--bg-primary) shadow-[0_4px_12px_var(--shadow-color)]">
        <div className="export-options py-1">
          <div
            className="export-option flex cursor-pointer items-center px-4 py-2.5 text-sm text-(--text-primary) transition-colors hover:bg-(--bg-hover)"
            onClick={() => void exportFullBook("word")}
          >
            <span className="option-text flex-1">导出正文为 Word</span>
          </div>
          <div
            className="export-option flex cursor-pointer items-center px-4 py-2.5 text-sm text-(--text-primary) transition-colors hover:bg-(--bg-hover)"
            onClick={() => void exportFullBook("txt")}
          >
            <span className="option-text flex-1">导出正文为 TXT</span>
          </div>
        </div>
      </div>
    </div>
  );
};

