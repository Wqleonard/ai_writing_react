/**
 * Markdown 编辑功能模块（React 版）
 * 负责处理 AI 修改的高亮、接受、拒绝等核心逻辑
 */

import { useCallback, useState } from "react";

// ========== 类型定义 ==========
export interface HighlightMarkerInfo {
  markerStartIndex: number;
  markerEndIndex: number;
  newStringStartIndex: number;
  newStringEndIndex: number;
  newStringLength: number;
  actualStartMarkerLength: number;
  highlightId?: string;
}

export interface FileEditInfo {
  rawEditData: {
    old_string: string;
    new_string: string;
    file_path: string;
    timestamp: number;
    editIndex?: number;
  };
  highlightData?: HighlightMarkerInfo;
  status: "pending" | "accepted" | "rejected";
}

const HIGHLIGHT_START = "<<<--highlight-start";
const HIGHLIGHT_END = "<<<--highlight-end-->>>";

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeHtmlTags(str: string): string {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, "");
}

export function cleanTextForCompare(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

export function cleanText(text: string): string {
  if (!text) return "";
  return text.trim();
}

export function useMarkdownEditor() {
  const [fileEditInfoMap, setFileEditInfoMap] = useState<
    Record<string, FileEditInfo[]>
  >({});

  const findTextInMarkdown = useCallback(
    (
      mdContent: string,
      searchText: string,
      insertedMarkers: HighlightMarkerInfo[] = []
    ): number => {
      let index = mdContent.indexOf(searchText);
      if (insertedMarkers.length > 0 && index !== -1) {
        let currentIndex = index;
        let attempts = 0;
        const maxAttempts = 1000;
        while (currentIndex !== -1 && attempts < maxAttempts) {
          attempts++;
          const searchEnd = currentIndex + searchText.length;
          const isOverlapping = insertedMarkers.some(
            (marker) =>
              (currentIndex >= marker.markerStartIndex &&
                currentIndex < marker.markerEndIndex) ||
              (searchEnd > marker.markerStartIndex &&
                searchEnd <= marker.markerEndIndex) ||
              (currentIndex < marker.markerStartIndex &&
                searchEnd > marker.markerEndIndex)
          );
          if (!isOverlapping) return currentIndex;
          currentIndex = mdContent.indexOf(searchText, currentIndex + 1);
        }
      }
      return index;
    },
    []
  );

  const insertHighlightMarkers = useCallback(
    (
      mdContent: string,
      searchText: string,
      startIndex: number
    ): { newContent: string; markerInfo: HighlightMarkerInfo } | null => {
      const endIndex = startIndex + searchText.length;
      if (startIndex < 0 || endIndex > mdContent.length) return null;
      const actualText = mdContent.substring(startIndex, endIndex);
      if (actualText !== searchText) return null;
      const before = mdContent.substring(0, startIndex);
      const after = mdContent.substring(endIndex);
      const searchTextStartsWithNewline = searchText.startsWith("\n");
      const needsNewlineAfterStart = !searchTextStartsWithNewline;
      const separator = needsNewlineAfterStart ? "\n" : "";
      const uniqueId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const startMarkerWithId = `<<<--highlight-start data-highlight-id="${uniqueId}"-->>>`;
      const newContent =
        before +
        startMarkerWithId +
        separator +
        searchText +
        HIGHLIGHT_END +
        after;
      const actualStartMarkerLength = startMarkerWithId.length + separator.length;
      const markerInfo: HighlightMarkerInfo = {
        markerStartIndex: startIndex,
        markerEndIndex:
          startIndex +
          actualStartMarkerLength +
          searchText.length +
          HIGHLIGHT_END.length,
        newStringStartIndex: startIndex + actualStartMarkerLength,
        newStringEndIndex: startIndex + actualStartMarkerLength + searchText.length,
        newStringLength: searchText.length,
        actualStartMarkerLength,
        highlightId: uniqueId,
      };
      return { newContent, markerInfo };
    },
    []
  );

  const replaceContentAndRemoveMarkers_Legacy = useCallback(
    (
      mdContent: string,
      markerInfo: HighlightMarkerInfo,
      replacementContent: string
    ): string => {
      const { markerStartIndex, markerEndIndex } = markerInfo;
      if (
        markerStartIndex < 0 ||
        markerEndIndex > mdContent.length ||
        markerStartIndex >= markerEndIndex
      )
        return mdContent;
      let before = mdContent.substring(0, markerStartIndex);
      const after = mdContent.substring(markerEndIndex);
      if (before.includes(HIGHLIGHT_END)) {
        const lastEndMarkerIndex = before.lastIndexOf(HIGHLIGHT_END);
        if (lastEndMarkerIndex !== -1) {
          before =
            before.substring(0, lastEndMarkerIndex) +
            before.substring(lastEndMarkerIndex + HIGHLIGHT_END.length);
        }
      }
      return before + replacementContent + after;
    },
    []
  );

  const replaceContentAndRemoveMarkers = useCallback(
    (
      mdContent: string,
      markerInfo: HighlightMarkerInfo,
      replacementContent: string
    ): string => {
      const { highlightId, actualStartMarkerLength } = markerInfo;
      if (!highlightId)
        return replaceContentAndRemoveMarkers_Legacy(
          mdContent,
          markerInfo,
          replacementContent
        );
      const baseStartMarker = `<<<--highlight-start data-highlight-id="${highlightId}"-->>>`;
      const actualMarkerStartIndex = mdContent.indexOf(baseStartMarker);
      if (actualMarkerStartIndex === -1) return mdContent;
      const actualNewStringStartIndex =
        actualMarkerStartIndex + actualStartMarkerLength;
      const remainingContent = mdContent.substring(actualNewStringStartIndex);
      const endMarkerIndex = remainingContent.indexOf(HIGHLIGHT_END);
      if (endMarkerIndex === -1) return mdContent;
      const actualMarkerEndIndex =
        actualNewStringStartIndex + endMarkerIndex + HIGHLIGHT_END.length;
      const before = mdContent.substring(0, actualMarkerStartIndex);
      const after = mdContent.substring(actualMarkerEndIndex);
      return before + replacementContent + after;
    },
    [replaceContentAndRemoveMarkers_Legacy]
  );

  const removeHighlightMarkersAt_Legacy = useCallback(
    (mdContent: string, markerInfo: HighlightMarkerInfo): string => {
      const { markerStartIndex, newStringStartIndex, newStringEndIndex } =
        markerInfo;
      if (
        markerStartIndex < 0 ||
        newStringStartIndex > mdContent.length ||
        newStringEndIndex > mdContent.length ||
        markerStartIndex >= newStringStartIndex ||
        newStringStartIndex >= newStringEndIndex
      )
        return mdContent;
      const before = mdContent.substring(0, markerStartIndex);
      const newString = mdContent.substring(
        newStringStartIndex,
        newStringEndIndex
      );
      const after = mdContent.substring(
        newStringEndIndex + HIGHLIGHT_END.length
      );
      return before + newString + after;
    },
    []
  );

  const removeHighlightMarkersAt = useCallback(
    (mdContent: string, markerInfo: HighlightMarkerInfo): string => {
      const { highlightId, actualStartMarkerLength } = markerInfo;
      if (!highlightId)
        return removeHighlightMarkersAt_Legacy(mdContent, markerInfo);
      const baseStartMarker = `<<<--highlight-start data-highlight-id="${highlightId}"-->>>`;
      const actualMarkerStartIndex = mdContent.indexOf(baseStartMarker);
      if (actualMarkerStartIndex === -1) return mdContent;
      const actualNewStringStartIndex =
        actualMarkerStartIndex + actualStartMarkerLength;
      const remainingContent = mdContent.substring(actualNewStringStartIndex);
      const endMarkerIndex = remainingContent.indexOf(HIGHLIGHT_END);
      if (endMarkerIndex === -1) return mdContent;
      const actualNewStringEndIndex = actualNewStringStartIndex + endMarkerIndex;
      const before = mdContent.substring(0, actualMarkerStartIndex);
      const newString = mdContent.substring(
        actualNewStringStartIndex,
        actualNewStringEndIndex
      );
      const after = mdContent.substring(
        actualNewStringEndIndex + HIGHLIGHT_END.length
      );
      return before + newString + after;
    },
    [removeHighlightMarkersAt_Legacy]
  );

  const removeAllHighlightMarkers = useCallback((content: string): string => {
    if (!content) return content;
    const startPattern =
      /<<<--highlight-start(?:\s+data-highlight-id="[^"]+")?\s*-->>>\n?/g;
    const endPattern = new RegExp(escapeRegExp(HIGHLIGHT_END), "g");
    return content.replace(startPattern, "").replace(endPattern, "");
  }, []);

  const logFileEditInfoMap = useCallback(
    (action: string, filePath?: string) => {
      if (filePath) {
        const list = fileEditInfoMap[filePath] || [];
        console.log(`[fileEditInfoMap-${action}] 文件 ${filePath} 的编辑项:`, {
          count: list.length,
          items: list.map((item, idx) => ({
            index: idx,
            status: item.status,
            hasHighlightData: !!item.highlightData,
          })),
        });
      } else {
        console.log(`[fileEditInfoMap-${action}] 所有文件:`, {
          fileCount: Object.keys(fileEditInfoMap).length,
          files: Object.keys(fileEditInfoMap).map((path) => ({
            path,
            editCount: fileEditInfoMap[path].length,
          })),
        });
      }
    },
    [fileEditInfoMap]
  );

  const clearFileEdits = useCallback((fileId: string) => {
    setFileEditInfoMap((prev) => {
      const next = { ...prev };
      delete next[fileId];
      return next;
    });
  }, []);

  const clearAllEdits = useCallback(() => {
    setFileEditInfoMap({});
  }, []);

  const setFileEdits = useCallback(
    (filePath: string, editInfoList: FileEditInfo[]) => {
      setFileEditInfoMap((prev) => ({ ...prev, [filePath]: editInfoList }));
    },
    []
  );

  const getPendingCount = useCallback(
    (fileId: string): number => {
      const editInfoList = fileEditInfoMap[fileId];
      if (!editInfoList) return 0;
      return editInfoList.filter((item) => item.status === "pending").length;
    },
    [fileEditInfoMap]
  );

  return {
    fileEditInfoMap,
    findTextInMarkdown,
    insertHighlightMarkers,
    replaceContentAndRemoveMarkers,
    removeHighlightMarkersAt,
    removeAllHighlightMarkers,
    removeHtmlTags,
    cleanTextForCompare,
    cleanText,
    logFileEditInfoMap,
    clearFileEdits,
    clearAllEdits,
    setFileEdits,
    getPendingCount,
  };
}

export default useMarkdownEditor;
