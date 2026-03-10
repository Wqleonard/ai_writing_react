import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";

export type ChangeStatus = "pending" | "accepted" | "rejected";

export interface EditorChangeItem {
  index: number;
  oldString: string;
  newString: string;
  status: ChangeStatus;
}

export interface EditChangesPanelProps {
  changes: EditorChangeItem[];
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  onSelectChange?: (change: EditorChangeItem | null) => void;
  activeChangeIndex?: number | null;
  onActiveChangeIndexChange?: (index: number | null) => void;
  panelHeight?: number;
}

const trimPreview = (text: string) => text.replace(/\s+/g, " ").trim();

const extractChangedSegment = (oldText: string, newText: string, contextSize = 18) => {
  const oldRaw = oldText ?? "";
  const newRaw = newText ?? "";
  const minLen = Math.min(oldRaw.length, newRaw.length);

  let start = 0;
  while (start < minLen && oldRaw[start] === newRaw[start]) start += 1;

  let oldEnd = oldRaw.length - 1;
  let newEnd = newRaw.length - 1;
  while (oldEnd >= start && newEnd >= start && oldRaw[oldEnd] === newRaw[newEnd]) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  const oldChange = oldRaw.slice(start, oldEnd + 1);
  const newChange = newRaw.slice(start, newEnd + 1);
  const oldPrefix = oldRaw.slice(Math.max(0, start - contextSize), start);
  const oldSuffix = oldRaw.slice(oldEnd + 1, Math.min(oldRaw.length, oldEnd + 1 + contextSize));
  const newPrefix = newRaw.slice(Math.max(0, start - contextSize), start);
  const newSuffix = newRaw.slice(newEnd + 1, Math.min(newRaw.length, newEnd + 1 + contextSize));
  const oldHasHeadEllipsis = start - contextSize > 0;
  const oldHasTailEllipsis = oldEnd + 1 + contextSize < oldRaw.length;
  const newHasHeadEllipsis = start - contextSize > 0;
  const newHasTailEllipsis = newEnd + 1 + contextSize < newRaw.length;

  const oldPreview = `${oldHasHeadEllipsis ? "..." : ""}${oldPrefix}${oldChange || "（无内容）"}${oldSuffix}${oldHasTailEllipsis ? "..." : ""}`;
  const newPreview = `${newHasHeadEllipsis ? "..." : ""}${newPrefix}${newChange || "（无内容）"}${newSuffix}${newHasTailEllipsis ? "..." : ""}`;

  return {
    oldPreview: trimPreview(oldPreview),
    newPreview: trimPreview(newPreview),
  };
};

export function EditChangesPanel({
  changes,
  onAccept,
  onReject,
  onSelectChange,
  activeChangeIndex,
  onActiveChangeIndexChange,
  panelHeight = 0,
}: EditChangesPanelProps) {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({});
  const selectedIndex = activeChangeIndex ?? internalSelectedIndex;
  const setSelectedIndex = (next: number | null) => {
    if (activeChangeIndex === undefined) setInternalSelectedIndex(next);
    onActiveChangeIndexChange?.(next);
    const selectedChange =
      next == null ? null : visibleChanges.find((item) => item.index === next) ?? null;
    onSelectChange?.(selectedChange);
  };
  const visibleChanges = changes.filter((c) => c.status === "pending");

    return (
      <div
        className="flex h-full w-full min-h-0 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
        style={panelHeight > 0 ? { height: `${panelHeight}px` } : undefined}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">修改详情</div>
          <div className="text-xs text-muted-foreground">待确认 {visibleChanges.length}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {visibleChanges.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--border-color)] px-3 py-6 text-center text-xs text-muted-foreground">
              暂无待确认修改
            </div>
          ) : (
            <div className="space-y-2">
              {visibleChanges.map((change) => {
                const selected = selectedIndex === change.index;
                const expanded = expandedMap[change.index] === true;
                const segmentPreview = extractChangedSegment(change.oldString, change.newString);
                const canExpand =
                  segmentPreview.oldPreview.length > 60 || segmentPreview.newPreview.length > 60;
                return (
                  <div
                    key={change.index}
                    role="button"
                    tabIndex={0}
                    className={clsx(
                      "rounded-md border bg-[var(--bg-primary)] p-3 text-left transition-colors",
                      selected
                        ? "border-[var(--bg-editor-save)]"
                        : "border-[var(--border-color)] hover:border-[var(--bg-editor-save)]"
                    )}
                    onClick={() =>
                      setSelectedIndex(selected ? null : change.index)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedIndex(selected ? null : change.index);
                      }
                    }}
                  >
                    <div className="text-[11px] text-muted-foreground">原文</div>
                    <div
                      className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground overflow-hidden"
                      style={
                        expanded
                          ? undefined
                          : {
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }
                      }
                    >
                      {segmentPreview.oldPreview || "（无内容）"}
                    </div>
                    {canExpand && (
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          className="text-[11px] text-[var(--bg-editor-save)] hover:opacity-90"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMap((prev) => ({
                              ...prev,
                              [change.index]: !expanded,
                            }));
                          }}
                        >
                          {expanded ? "收起" : "展开"}
                        </button>
                      </div>
                    )}
                    {selected && (
                      <>
                        <div className="mt-2 text-[11px] text-muted-foreground">修改后</div>
                        <div
                          className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground overflow-hidden"
                          style={
                            expanded
                              ? undefined
                              : {
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                }
                          }
                        >
                          {segmentPreview.newPreview || "（无内容）"}
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReject(change.index);
                              setSelectedIndex(null);
                              onSelectChange?.(null);
                            }}
                          >
                            撤销
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAccept(change.index);
                              setSelectedIndex(null);
                              onSelectChange?.(null);
                            }}
                          >
                            接受
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
}

