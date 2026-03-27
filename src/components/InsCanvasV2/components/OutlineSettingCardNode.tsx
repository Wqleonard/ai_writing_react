import React, { useMemo } from "react";
import { useNodes, useReactFlow } from "@xyflow/react";
import { ArrowRight, ChevronDown, CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

const OUTLINE_PERSPECTIVE_OPTIONS = ["第一人称", "第二人称", "第三人称"] as const;
const OUTLINE_ARTICLE_TYPE_OPTIONS = [
  "短篇(1w-5w字)",
  "中长篇(5w-10w字)",
  "短剧剧本（1w-5w字)",
] as const;
const OUTLINE_CHAPTER_OPTIONS = ["5章", "10章", "15章"] as const;
const OUTLINE_GROUP_SETTINGS_CARD_WIDTH = 600;
const OUTLINE_GROUP_SETTINGS_CARD_HEIGHT = 420;
const OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT = 56;
const OUTLINE_GROUP_HORIZONTAL_PADDING = 20;
const OUTLINE_GROUP_SETTINGS_TOP = 56;
const OUTLINE_GROUP_SETTINGS_BOTTOM_GAP = 24;
const OUTLINE_GROUP_CARD_GAP_X = 24;
const OUTLINE_GROUP_CARD_GAP_Y = 28;
const OUTLINE_GROUP_CARD_WIDTH = 300;
const OUTLINE_GROUP_CARD_HEIGHT = 260;
const OUTLINE_GROUP_COLS = 3;
const OUTLINE_GROUP_MIN_WIDTH =
  OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2;
const OUTLINE_STRUCTURE_OPTIONS = [
  {
    label: "起承转合（通用）",
    description: "",
  },
  {
    label: "救猫咪",
    description: `这个名称源于一个创作技巧：当主角出场时，即使他是个反英雄或怪人，也必须做一件好事（比如从树上救下一只猫），以此迅速赢得观众的认同和好感。
在更广泛的定义下，它代表了一套关于“故事节奏（Pacing）”的精确配方，强调剧本应在特定的时间点（页码）发生特定的转折。
核心写作结构：15个节拍表 (The Beat Sheet)`,
  },
  {
    label: "雪花写作",
    description: `“雪花法”（The Snowflake Method）是由物理学家兼小说家兰德尔·英格曼森（Randy Ingermanson）提出的一种自内向外、由简入繁的写作构思法。
它的核心逻辑就像雪花的形成过程：从一个简单的六角形冰晶（核心创意）开始，不断向外分叉、生长，最终形成一个结构复杂且稳固的整体。
雪花法是一种典型的设计型写作（Outlining）。它主张在写下正文第一行字之前，先建立起完整的逻辑骨架。这种方法能有效避免写到一半“卡文”或逻辑崩坏的情况，非常适合追求逻辑严密性的创作者。`,
  },
  {
    label: "英雄之旅",
    description: `“英雄之旅”（The Hero's Journey），又称单一神话（Monomyth），是由神话学家约瑟夫·坎贝尔（Joseph Campbell）在《千面英雄》中提出的理论。他发现世界各地的古代神话、宗教传说和民间故事，尽管文化背景迥异，但在叙事结构上都遵循一个几乎完全一致的逻辑模板。
从逻辑本质上讲，英雄之旅是一个关于“成长”与“转化”的循环：主角离开熟悉的环境，进入充满挑战的异世界，经历身心的彻底洗礼，最后带着新生的智慧回归。
经过现代创作（如《星球大战》、《哈利·波特》）多采用克里斯托弗·沃格勒（Christopher Vogler）精简后，成为 12 步逻辑结构。`,
  },
] as const;

export default function OutlineSettingCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const allNodes = useNodes();
  const { updateNodeData, setNodes, setEdges, getNodes } = useReactFlow();
  const { confirm, confirmDialog } = useConfirmDialog();
  const data = props?.data ?? {};
  const outlinePerspective = String(data.outlinePerspective ?? "");
  const outlineArticleType = String(data.outlineArticleType ?? "");
  const outlineChapterTag = String(data.outlineChapterTag ?? "10章");
  const outlineStructure = String(data.outlineStructure ?? "");
  const isCollapsed = Boolean(data.outlineSettingCollapsed);
  const hasAnyPendingCanvasOutput = useMemo(
    () =>
      allNodes.some((node) => {
        const content = String(node.data?.content ?? "").trim();
        return (
          Boolean((node.data as any)?.isStreaming) ||
          (Boolean((node.data as any)?.fromApi) && !content)
        );
      }),
    [allNodes]
  );

  const updateOutlineField = (patch: Record<string, unknown>) => {
    updateNodeData(props.id, patch);
  };

  const toggleOutlineSettingCollapsed = (collapsed: boolean) => {
    const groupId = String(props.parentId ?? "");
    setNodes((prev) => {
      if (!groupId) {
        return prev.map((node) =>
          node.id === props.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  outlineSettingCollapsed: collapsed,
                } as any,
              }
            : node
        );
      }

      const outlineChildren = prev
        .filter((node) => node.parentId === groupId && node.type === "outlineCard")
        .sort((a, b) => {
          const ay = Number(a.position?.y ?? 0);
          const by = Number(b.position?.y ?? 0);
          if (ay !== by) return ay - by;
          return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
        });

      const settingsHeight = collapsed
        ? OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT
        : OUTLINE_GROUP_SETTINGS_CARD_HEIGHT;
      const groupPaddingTop =
        OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_SETTINGS_BOTTOM_GAP;
      const totalCount = outlineChildren.length;
      const rows = totalCount > 0 ? Math.ceil(totalCount / OUTLINE_GROUP_COLS) : 0;
      const colsUsed = totalCount > 0 ? Math.min(OUTLINE_GROUP_COLS, totalCount) : 1;
      const nextGroupWidth = Math.max(
        OUTLINE_GROUP_MIN_WIDTH,
        OUTLINE_GROUP_HORIZONTAL_PADDING * 2 +
          colsUsed * OUTLINE_GROUP_CARD_WIDTH +
          Math.max(0, colsUsed - 1) * OUTLINE_GROUP_CARD_GAP_X
      );
      const nextGroupHeight = Math.max(
        OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_HORIZONTAL_PADDING,
        totalCount > 0
          ? groupPaddingTop +
              rows * OUTLINE_GROUP_CARD_HEIGHT +
              Math.max(0, rows - 1) * OUTLINE_GROUP_CARD_GAP_Y +
              OUTLINE_GROUP_HORIZONTAL_PADDING
          : OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_HORIZONTAL_PADDING
      );

      const nextPositionById = new Map<string, { x: number; y: number }>();
      outlineChildren.forEach((node, index) => {
        const col = index % OUTLINE_GROUP_COLS;
        const row = Math.floor(index / OUTLINE_GROUP_COLS);
        nextPositionById.set(node.id, {
          x: OUTLINE_GROUP_HORIZONTAL_PADDING + col * (OUTLINE_GROUP_CARD_WIDTH + OUTLINE_GROUP_CARD_GAP_X),
          y: groupPaddingTop + row * (OUTLINE_GROUP_CARD_HEIGHT + OUTLINE_GROUP_CARD_GAP_Y),
        });
      });

      return prev.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            style: {
              ...(node.style ?? {}),
              width: nextGroupWidth - OUTLINE_GROUP_HORIZONTAL_PADDING * 2,
              height: settingsHeight,
            } as any,
            data: {
              ...node.data,
              outlineSettingCollapsed: collapsed,
            } as any,
          };
        }

        if (node.id === groupId) {
          return {
            ...node,
            style: {
              ...(node.style ?? {}),
              width: nextGroupWidth,
              height: nextGroupHeight,
            } as any,
          };
        }

        const nextPosition = nextPositionById.get(node.id);
        if (!nextPosition) return node;

        return {
          ...node,
          position: nextPosition,
        };
      });
    });
  };

  const clearOutlineGroupCards = () => {
    const groupId = String(props.parentId ?? "");
    if (!groupId) return;

    const latestNodes = getNodes();
    const outlineNodeIds = latestNodes
      .filter((node) => node.parentId === groupId && node.type === "outlineCard")
      .map((node) => node.id);

    if (!outlineNodeIds.length) return;

    const outlineNodeIdSet = new Set(outlineNodeIds);
    setNodes((prev) => prev.filter((node) => !outlineNodeIdSet.has(node.id)));
    setEdges((prev) =>
      prev.filter(
        (edge) => !outlineNodeIdSet.has(String(edge.source ?? "")) && !outlineNodeIdSet.has(String(edge.target ?? ""))
      )
    );
  };

  const handleOutlineConfirm = async () => {
    const latestNodes = getNodes();
    const latestSettingNode = latestNodes.find((node) => node.id === props.id);
    const latestData = latestSettingNode?.data ?? data;
    const latestOutlineChapterTag = String(latestData?.outlineChapterTag ?? outlineChapterTag);
    const latestOutlinePerspective = String(latestData?.outlinePerspective ?? outlinePerspective);
    const latestOutlineArticleType = String(latestData?.outlineArticleType ?? outlineArticleType);
    const latestOutlineStructure = String(latestData?.outlineStructure ?? outlineStructure);
    const parsedChapterNum = Number(String(latestOutlineChapterTag).replace(/[^\d]/g, ""));
    const requirement = [
      latestOutlinePerspective ? `写作视角：${latestOutlinePerspective}` : "",
      latestOutlineArticleType ? `文章类型：${latestOutlineArticleType}` : "",
      latestOutlineStructure ? `文章结构：${latestOutlineStructure}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const sourceNodeId = String(latestData?.outlineSourceId || props.parentId || props.id || "");
    const groupId = String(props.parentId ?? "");
    const hasExistingOutlineNodes = groupId
      ? latestNodes.some((node) => node.parentId === groupId && node.type === "outlineCard")
      : false;

    if (hasExistingOutlineNodes) {
      const ok = await confirm({
        message: "是否根据基本信息重新生成纲章。",
        confirmText: "确认",
        cancelText: "取消",
      });
      if (!ok) return;
      clearOutlineGroupCards();
      toggleOutlineSettingCollapsed(true);
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
    }

    handlers.handleGenerateOutlineFromContext?.(
      sourceNodeId,
      {
        chapterNum: parsedChapterNum,
        requirement,
      }
    );
    if (!hasExistingOutlineNodes) {
      toggleOutlineSettingCollapsed(true);
    }
  };

  return (
    <div
      className={cn(
        "nodrag nopan nowheel relative rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0px_10px_28px_0px_rgba(0,0,0,0.08)]",
        "w-full min-w-0 overflow-hidden",
        isCollapsed ? "" : "min-h-[420px] p-4"
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {isCollapsed ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F9FAFB]"
          onClick={(e) => {
            e.stopPropagation();
            toggleOutlineSettingCollapsed(false);
          }}
        >
          <div className="min-w-0 text-[16px] font-semibold text-[#111827]">基本结构信息</div>
          <ChevronDown className="size-4 shrink-0 -rotate-90 text-[#6B7280]" />
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[16px] font-semibold text-[#111827]">基本结构信息</div>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[#6B7280] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
              onClick={(e) => {
                e.stopPropagation();
                toggleOutlineSettingCollapsed(true);
              }}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-[#374151]">写作视角</div>
            <div className="flex flex-wrap gap-2">
              {OUTLINE_PERSPECTIVE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "rounded-[6px] cursor-pointer border px-3 py-1.5 text-[12px] leading-5 transition-colors",
                    outlinePerspective === option
                      ? "border-[#EFAF00] bg-[#FFF7DB] text-[#854D0E]"
                      : "border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateOutlineField({ outlinePerspective: option });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-[#374151]">文章类型</div>
            <div className="flex flex-wrap gap-2">
              {OUTLINE_ARTICLE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "rounded-[6px] cursor-pointer border px-3 py-1.5 text-[12px] leading-5 transition-colors",
                    outlineArticleType === option
                      ? "border-[#EFAF00] bg-[#FFF7DB] text-[#854D0E]"
                      : "border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateOutlineField({ outlineArticleType: option });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-[#374151]">章节数</div>
            <div className="flex flex-wrap gap-2">
              {OUTLINE_CHAPTER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "rounded-[6px] cursor-pointer border px-3 py-1.5 text-[12px] leading-5 transition-colors",
                    outlineChapterTag === option
                      ? "border-[#EFAF00] bg-[#FFF7DB] text-[#854D0E]"
                      : "border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateOutlineField({ outlineChapterTag: option });
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-[#374151]">文章结构</div>
            <div className="flex flex-wrap gap-2">
              {OUTLINE_STRUCTURE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[6px] cursor-pointer border px-3 py-1.5 text-[12px] leading-5 transition-colors",
                    outlineStructure === option.label
                      ? "border-[#EFAF00] bg-[#FFF7DB] text-[#854D0E]"
                      : "border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateOutlineField({ outlineStructure: option.label });
                  }}
                >
                  <span>{option.label}</span>
                  {option.description ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex shrink-0 items-center text-current/70"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CircleQuestionMark className="size-3.5 shrink-0" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="max-w-[240px] text-[12px] leading-5">
                        {option.description}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    disabled={hasAnyPendingCanvasOutput}
                    className="rounded-[12px] bg-[#000000] text-white hover:bg-[#000000]/90 disabled:cursor-not-allowed disabled:bg-[#000000]/40 disabled:text-white"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (hasAnyPendingCanvasOutput) return;
                      await handleOutlineConfirm();
                    }}
                  >
                    开始
                    <ArrowRight className="mr-2 size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {hasAnyPendingCanvasOutput ? (
                <TooltipContent side="top" align="center" className="text-[12px]">
                  当前有喵喵在处理其他任务哦~
                </TooltipContent>
              ) : null}
            </Tooltip>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
