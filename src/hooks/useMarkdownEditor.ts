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

const LEGACY_HIGHLIGHT_END = "<<<--highlight-end-->>>";
const INLINE_HIGHLIGHT_END = "==";
const BRACKET_HIGHLIGHT_START_PREFIX = "[[[hl-start:";
const BRACKET_HIGHLIGHT_START_SUFFIX = "]]]";
const BRACKET_HIGHLIGHT_END = "[[[hl-end]]]";

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
      const uniqueId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const startMarkerWithId = `${BRACKET_HIGHLIGHT_START_PREFIX}${uniqueId}${BRACKET_HIGHLIGHT_START_SUFFIX}`;
      const newContent =
        before +
        startMarkerWithId +
        searchText +
        BRACKET_HIGHLIGHT_END +
        after;
      const actualStartMarkerLength = startMarkerWithId.length;
      const markerInfo: HighlightMarkerInfo = {
        markerStartIndex: startIndex,
        markerEndIndex:
          startIndex +
          actualStartMarkerLength +
          searchText.length +
          BRACKET_HIGHLIGHT_END.length,
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
      if (before.includes(LEGACY_HIGHLIGHT_END)) {
        const lastEndMarkerIndex = before.lastIndexOf(LEGACY_HIGHLIGHT_END);
        if (lastEndMarkerIndex !== -1) {
          before =
            before.substring(0, lastEndMarkerIndex) +
            before.substring(lastEndMarkerIndex + LEGACY_HIGHLIGHT_END.length);
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
      const bracketStartMarker = `${BRACKET_HIGHLIGHT_START_PREFIX}${highlightId}${BRACKET_HIGHLIGHT_START_SUFFIX}`;
      const bracketMarkerStartIndex = mdContent.indexOf(bracketStartMarker);
      if (bracketMarkerStartIndex !== -1) {
        const bracketNewStringStartIndex =
          bracketMarkerStartIndex + bracketStartMarker.length;
        const bracketEndIndex = mdContent.indexOf(
          BRACKET_HIGHLIGHT_END,
          bracketNewStringStartIndex
        );
        if (bracketEndIndex === -1) return mdContent;
        const before = mdContent.substring(0, bracketMarkerStartIndex);
        const after = mdContent.substring(
          bracketEndIndex + BRACKET_HIGHLIGHT_END.length
        );
        return before + replacementContent + after;
      }
      const inlineStartMarker = `==#${highlightId}#`;
      const inlineMarkerStartIndex = mdContent.indexOf(inlineStartMarker);
      if (inlineMarkerStartIndex !== -1) {
        const inlineNewStringStartIndex =
          inlineMarkerStartIndex + inlineStartMarker.length;
        const inlineEndIndex = mdContent.indexOf(
          INLINE_HIGHLIGHT_END,
          inlineNewStringStartIndex
        );
        if (inlineEndIndex === -1) return mdContent;
        const before = mdContent.substring(0, inlineMarkerStartIndex);
        const after = mdContent.substring(
          inlineEndIndex + INLINE_HIGHLIGHT_END.length
        );
        return before + replacementContent + after;
      }
      const legacyStartMarker = `<<<--highlight-start data-highlight-id="${highlightId}"-->>>`;
      const legacyMarkerStartIndex = mdContent.indexOf(legacyStartMarker);
      if (legacyMarkerStartIndex === -1) return mdContent;
      const legacyNewStringStartIndex =
        legacyMarkerStartIndex + actualStartMarkerLength;
      const remainingContent = mdContent.substring(legacyNewStringStartIndex);
      const legacyEndIndex = remainingContent.indexOf(LEGACY_HIGHLIGHT_END);
      if (legacyEndIndex === -1) return mdContent;
      const legacyMarkerEndIndex =
        legacyNewStringStartIndex + legacyEndIndex + LEGACY_HIGHLIGHT_END.length;
      const before = mdContent.substring(0, legacyMarkerStartIndex);
      const after = mdContent.substring(legacyMarkerEndIndex);
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
        newStringEndIndex + LEGACY_HIGHLIGHT_END.length
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
      const bracketStartMarker = `${BRACKET_HIGHLIGHT_START_PREFIX}${highlightId}${BRACKET_HIGHLIGHT_START_SUFFIX}`;
      const bracketMarkerStartIndex = mdContent.indexOf(bracketStartMarker);
      if (bracketMarkerStartIndex !== -1) {
        const bracketNewStringStartIndex =
          bracketMarkerStartIndex + bracketStartMarker.length;
        const bracketEndIndex = mdContent.indexOf(
          BRACKET_HIGHLIGHT_END,
          bracketNewStringStartIndex
        );
        if (bracketEndIndex === -1) return mdContent;
        const before = mdContent.substring(0, bracketMarkerStartIndex);
        const newString = mdContent.substring(
          bracketNewStringStartIndex,
          bracketEndIndex
        );
        const after = mdContent.substring(
          bracketEndIndex + BRACKET_HIGHLIGHT_END.length
        );
        return before + newString + after;
      }
      const inlineStartMarker = `==#${highlightId}#`;
      const inlineMarkerStartIndex = mdContent.indexOf(inlineStartMarker);
      if (inlineMarkerStartIndex !== -1) {
        const inlineNewStringStartIndex =
          inlineMarkerStartIndex + inlineStartMarker.length;
        const inlineEndIndex = mdContent.indexOf(
          INLINE_HIGHLIGHT_END,
          inlineNewStringStartIndex
        );
        if (inlineEndIndex === -1) return mdContent;
        const before = mdContent.substring(0, inlineMarkerStartIndex);
        const newString = mdContent.substring(
          inlineNewStringStartIndex,
          inlineEndIndex
        );
        const after = mdContent.substring(inlineEndIndex + INLINE_HIGHLIGHT_END.length);
        return before + newString + after;
      }
      const legacyStartMarker = `<<<--highlight-start data-highlight-id="${highlightId}"-->>>`;
      const legacyMarkerStartIndex = mdContent.indexOf(legacyStartMarker);
      if (legacyMarkerStartIndex === -1) return mdContent;
      const legacyNewStringStartIndex =
        legacyMarkerStartIndex + actualStartMarkerLength;
      const remainingContent = mdContent.substring(legacyNewStringStartIndex);
      const legacyEndIndex = remainingContent.indexOf(LEGACY_HIGHLIGHT_END);
      if (legacyEndIndex === -1) return mdContent;
      const legacyNewStringEndIndex = legacyNewStringStartIndex + legacyEndIndex;
      const before = mdContent.substring(0, legacyMarkerStartIndex);
      const newString = mdContent.substring(
        legacyNewStringStartIndex,
        legacyNewStringEndIndex
      );
      const after = mdContent.substring(
        legacyNewStringEndIndex + LEGACY_HIGHLIGHT_END.length
      );
      return before + newString + after;
    },
    [removeHighlightMarkersAt_Legacy]
  );

  const removeAllHighlightMarkers = useCallback((content: string): string => {
    if (!content) return content;
    const legacyStartPattern =
      /<<<--highlight-start(?:\s+data-highlight-id="[^"]+")?\s*-->>>\n?/g;
    const legacyEndPattern = new RegExp(escapeRegExp(LEGACY_HIGHLIGHT_END), "g");
    const withLegacyRemoved = content
      .replace(legacyStartPattern, "")
      .replace(legacyEndPattern, "");
    const withInlineRemoved = withLegacyRemoved.replace(
      /==#([A-Za-z0-9_-]+)#([\s\S]*?)==/g,
      "$2"
    );
    return withInlineRemoved.replace(
      /\[\[\[hl-start:[A-Za-z0-9_-]+\]\]\]([\s\S]*?)\[\[\[hl-end\]\]\]/g,
      "$1"
    );
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
