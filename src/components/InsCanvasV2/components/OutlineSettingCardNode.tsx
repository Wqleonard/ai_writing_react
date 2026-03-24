import React from "react";
import { useReactFlow } from "@xyflow/react";
import { ArrowRight, CircleQuestionMark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

const OUTLINE_PERSPECTIVE_OPTIONS = ["第一人称", "第二人称", "第三人称"] as const;
const OUTLINE_ARTICLE_TYPE_OPTIONS = [
  "短篇(1w-5w字)",
  "中长篇(5w-10w字)",
  "断句剧本（1w-5w字)",
  "分支小说",
] as const;
const OUTLINE_CHAPTER_OPTIONS = ["5章", "10章", "15章"] as const;
const OUTLINE_STRUCTURE_OPTIONS = [
  {
    label: "起承转合（通用）",
    description: "",
  },
  {
    label: "救猫咪",
    description: "强调人物魅力与戏剧节拍，适合强情节、商业化表达。",
  },
  {
    label: "金字塔",
    description: "适合大多数常规叙事，按铺垫、发展、转折、收束推进故事。",
  },
] as const;

export default function OutlineSettingCardNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const { updateNodeData } = useReactFlow();
  const data = props?.data ?? {};
  const outlinePerspective = String(data.outlinePerspective ?? "");
  const outlineArticleType = String(data.outlineArticleType ?? "");
  const outlineChapterTag = String(data.outlineChapterTag ?? "10章");
  const outlineStructure = String(data.outlineStructure ?? "");

  const updateOutlineField = (patch: Record<string, unknown>) => {
    updateNodeData(props.id, patch);
  };

  const handleOutlineConfirm = () => {
    const parsedChapterNum = Number(String(outlineChapterTag).replace(/[^\d]/g, ""));
    const requirement = [
      outlinePerspective ? `写作视角：${outlinePerspective}` : "",
      outlineArticleType ? `文章类型：${outlineArticleType}` : "",
      outlineStructure ? `文章结构：${outlineStructure}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    handlers.handleGenerateOutlineFromContext?.(
      String(data.outlineSourceId ?? props.parentId ?? props.id),
      {
        chapterNum: parsedChapterNum,
        requirement,
        files: data.files,
        title: data.title,
      }
    );
    handlers.handleGroupDelete?.(props.id, { skipLayout: true });
  };

  return (
    <div
      className="nodrag nopan nowheel relative w-[600px] min-h-[420px] rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0px_10px_28px_0px_rgba(0,0,0,0.08)]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="space-y-4">
        <div className="text-[16px] font-semibold text-[#111827]">基本结构信息</div>
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
                {option.description ? <CircleQuestionMark className="size-3.5 shrink-0" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            className="rounded-[12px] bg-[#000000] text-white hover:bg-[#000000]/90"
            onClick={(e) => {
              e.stopPropagation();
              handleOutlineConfirm();
            }}
          >
            开始
            <ArrowRight className="mr-2 size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
