import React, { useEffect, useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { MessageSquarePlus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

const OUTLINE_PERSPECTIVE_OPTIONS = ["第一人称", "第二人称", "第三人称"] as const;
const OUTLINE_ARTICLE_TYPE_OPTIONS = [
  "短篇(1w-5w字)",
  "中长篇(5w-10w字)",
  "断句剧本（1w-5w字)",
  "分支小说",
] as const;
const OUTLINE_CHAPTER_OPTIONS = ["5章", "10章", "15章"] as const;
const OUTLINE_STRUCTURE_OPTIONS = ["起承转合（通用）", "救猫咪", "金字塔"] as const;

export default function RoleGroupNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const { updateNodeData } = useReactFlow();
  const label = String(props?.data?.label ?? "角色");
  const highlighted = Boolean(props?.data?.highlighted);
  const isRoleGroup = label === "角色";
  const isOutlineGroup = label === "大纲";
  const [outlinePopoverOpen, setOutlinePopoverOpen] = useState(false);
  const [outlinePerspective, setOutlinePerspective] = useState<string>("");
  const [outlineArticleType, setOutlineArticleType] = useState<string>("");
  const [outlineChapterTag, setOutlineChapterTag] = useState<string>("10章");
  const [outlineStructure, setOutlineStructure] = useState<string>("");

  useEffect(() => {
    if (!isOutlineGroup || !props?.data?.openOutlinePopover) return;
    setOutlinePopoverOpen(true);
    updateNodeData(props.id, { openOutlinePopover: false });
  }, [isOutlineGroup, props?.data?.openOutlinePopover, props.id, updateNodeData]);

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
      String(props?.data?.outlineSourceId ?? props.id),
      {
        chapterNum: parsedChapterNum,
        requirement,
      }
    );
    setOutlinePopoverOpen(false);
  };

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-[20px]",
        highlighted
          ? "border border-[#EFAF00] bg-[#F4F4F4] shadow-[0px_0px_0px_2px_rgba(239,175,0,0.18),0px_10px_28px_0px_rgba(0,0,0,0.08)]"
          : "border border-[#F3F4F6] bg-[#F4F4F4]",
        "shadow-[0px_10px_28px_0px_rgba(0,0,0,0.08)]"
      )}
    >
      {/* header: drag handle */}
      <div
        className={cn(
          "role-group-drag-handle absolute inset-x-0 top-0",
          "flex h-[42px] items-center justify-between px-4",
          "cursor-grab active:cursor-grabbing select-none",
          "text-[13px] font-semibold text-[#111]"
        )}
      >
        <div
          className="min-w-0 inline-flex w-fit max-w-full truncate rounded-[6px] px-2 py-0.5"
          style={{
            backgroundImage: isRoleGroup
              ? "linear-gradient(90deg, #C4FEC3 0%, rgba(196,254,195,0) 100%)"
              : isOutlineGroup
                ? "linear-gradient(90deg, #FFBCF8 0%, rgba(255,188,248,0) 100%)"
                : undefined,
          }}
        >
          {label}
        </div>

        {/* actions (align to right edge with header padding) */}
        <div
          className="flex items-center gap-1.5"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isOutlineGroup && (
            <Popover open={outlinePopoverOpen} onOpenChange={setOutlinePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  title="配置并生成大纲"
                  className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
                >
                  <Sparkles className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={10}
                className="w-lg rounded-[20px] border border-[#F3F4F6] bg-white p-4 shadow-[0px_16px_40px_0px_rgba(15,23,42,0.12)]"
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="text-[16px] font-semibold text-[#111827]">基本结构信息</div>
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
                            setOutlinePerspective(option);
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
                            setOutlineArticleType(option);
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
                            setOutlineChapterTag(option);
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
                          key={option}
                          type="button"
                          className={cn(
                            "rounded-[6px] cursor-pointer border px-3 py-1.5 text-[12px] leading-5 transition-colors",
                            outlineStructure === option
                              ? "border-[#EFAF00] bg-[#FFF7DB] text-[#854D0E]"
                              : "border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOutlineStructure(option);
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-[12px] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOutlinePopoverOpen(false);
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      className="rounded-[12px] bg-[#EFAF00] text-white hover:bg-[#EFAF00]/90"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOutlineConfirm();
                      }}
                    >
                      <Sparkles className="mr-2 size-4" />
                      完成并生成
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              // placeholder: wire up later if needed
            }}
            title="添加到对话"
            className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-foreground"
          >
            <MessageSquarePlus className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              handlers.handleGroupDelete?.(props.id, { skipLayout: true });
            }}
            title="删除"
            className="rounded-full text-muted-foreground hover:bg-[#f5f5f5] hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </div>
      <div className="pointer-events-none absolute left-4 right-4 top-[42px] h-px bg-[#F3F4F6]" />

      {/* Invisible handle: allow edges to connect to the group */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

