import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeToolbar, Position, useEdges, useNodes } from "@xyflow/react";
import { MessageSquarePlus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useInsCanvasHandlers } from "@/components/InsCanvasV2/InsCanvasContext";

type FloatingAction = {
  key: string;
  label: string;
  onClick: (event: React.MouseEvent) => void;
};

const sanitizeGroupFileName = (value: string, fallback: string) => {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "_");
  return normalized || fallback;
};

export default function RoleGroupNode(props: any) {
  const handlers = useInsCanvasHandlers();
  const allNodes = useNodes();
  const allEdges = useEdges();
  const label = String(props?.data?.label ?? "角色");
  const highlighted = Boolean(props?.data?.highlighted);
  const isRoleGroup = label === "角色";
  const isOutlineGroup = label === "大纲";
  const [showFloatingButtons, setShowFloatingButtons] = useState(false);
  const hideFloatingButtonsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAnyPendingCanvasOutput = useMemo(
    () =>
      allNodes.some((node) => {
        const content = String(node.data?.content ?? "").trim();
        return (
          Boolean((node.data as any)?.isStreaming) ||
          Boolean((node.data as any)?.pendingGenerate) ||
          (Boolean((node.data as any)?.fromApi) && !content)
        );
      }),
    [allNodes]
  );

  const groupMeta = useMemo(() => {
    if (!isRoleGroup && !isOutlineGroup) {
      return {
        files: {} as Record<string, string>,
        title: "卡片组",
        hasSummaryContext: false,
        hasOutlineContext: false,
        isPlaceholder: false,
        hasPendingApiResponse: false,
      };
    }

    const childNodes = allNodes
      .filter((node) => {
        const groupId = isRoleGroup
          ? String((node.data as any)?.roleGroupId ?? node.parentId ?? "")
          : String((node.data as any)?.outlineGroupId ?? node.parentId ?? "");
        return groupId === props.id && node.type !== "outlineSettingCard";
      })
      .sort((a, b) => {
        const ay = Number(a.position?.y ?? 0);
        const by = Number(b.position?.y ?? 0);
        if (ay !== by) return ay - by;
        return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
      });

    const files = childNodes.reduce<Record<string, string>>((acc, node, index) => {
      const filePath = String((node.data as any)?.filePath ?? "").trim();
      const title = String((node.data as any)?.title ?? "").trim();
      const content = String(node.data?.content ?? "").trim();
      if (!content) return acc;
      const fallbackName = isRoleGroup
        ? `角色设定/${sanitizeGroupFileName(title, `角色${index + 1}`)}.md`
        : `大纲设定/${sanitizeGroupFileName(title, `大纲${index + 1}`)}.md`;
      acc[filePath || fallbackName] = content;
      return acc;
    }, {});
    const isPlaceholder = childNodes.some((node) => {
      const content = String(node.data?.content ?? "").trim();
      return Boolean((node.data as any)?.isStreaming) || (Boolean((node.data as any)?.fromApi) && !content);
    });
    const hasPendingApiResponse = childNodes.some((node) => {
      const content = String(node.data?.content ?? "").trim();
      return (
        Boolean((node.data as any)?.isStreaming) ||
        Boolean((node.data as any)?.pendingGenerate) ||
        (Boolean((node.data as any)?.fromApi) && !content)
      );
    });

    const title = childNodes
      .map((node) => String((node.data as any)?.title ?? "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join("、") || (isRoleGroup ? "角色组" : "大纲组");

    const sourceNodeId = String(
      allEdges.find((edge) => edge.target === props.id)?.source ?? ""
    );
    const visited = new Set<string>();
    const stack = sourceNodeId ? [sourceNodeId] : [];
    const contextNodes: any[] = [];

    while (stack.length > 0) {
      const currentId = stack.pop() as string;
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);
      const currentNode = allNodes.find((node) => node.id === currentId);
      if (currentNode) contextNodes.push(currentNode);
      allEdges
        .filter((edge) => edge.target === currentId)
        .forEach((edge) => {
          if (!visited.has(edge.source)) {
            stack.push(edge.source);
          }
        });
    }

    return {
      files,
      title,
      hasSummaryContext: contextNodes.some((node) =>
        String(node?.data?.label ?? "").includes("梗概")
      ),
      hasOutlineContext: contextNodes.some((node) =>
        String(node?.data?.label ?? "").includes("大纲")
      ),
      isPlaceholder,
      hasPendingApiResponse,
    };
  }, [allEdges, allNodes, isOutlineGroup, isRoleGroup, props.id]);

  const showFloatingButtonsNow = useCallback(() => {
    if (hideFloatingButtonsTimerRef.current) {
      clearTimeout(hideFloatingButtonsTimerRef.current);
      hideFloatingButtonsTimerRef.current = null;
    }
    setShowFloatingButtons(true);
  }, []);

  const scheduleHideFloatingButtons = useCallback(() => {
    if (hideFloatingButtonsTimerRef.current) {
      clearTimeout(hideFloatingButtonsTimerRef.current);
    }
    hideFloatingButtonsTimerRef.current = setTimeout(() => {
      hideFloatingButtonsTimerRef.current = null;
      setShowFloatingButtons(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (!groupMeta.hasPendingApiResponse && !hasAnyPendingCanvasOutput) return;
    setShowFloatingButtons(false);
  }, [groupMeta.hasPendingApiResponse, hasAnyPendingCanvasOutput]);

  useEffect(() => {
    return () => {
      if (hideFloatingButtonsTimerRef.current) {
        clearTimeout(hideFloatingButtonsTimerRef.current);
        hideFloatingButtonsTimerRef.current = null;
      }
    };
  }, []);
  const floatingActions = useMemo(() => {
    if (groupMeta.hasPendingApiResponse || hasAnyPendingCanvasOutput) return [] as FloatingAction[];

    const groupOptions = {
      files: groupMeta.files,
      title: groupMeta.title,
    };
    const actions: FloatingAction[] = [];

    if (isRoleGroup) {
      actions.push({
        key: "expand-role",
        label: "以此扩充随机角色",
        onClick: (event) => {
          event.stopPropagation();
          handlers.handleGenerateIns?.(props.id, "role", groupOptions);
        },
      });

      if (!groupMeta.hasSummaryContext) {
        actions.push({
          key: "generate-summary",
          label: "以此生成故事梗概",
          onClick: (event) => {
            event.stopPropagation();
            handlers.handleGenerateIns?.(props.id, "summary", groupOptions);
          },
        });
      } else if (!groupMeta.hasOutlineContext) {
        actions.push({
          key: "generate-outline",
          label: "以此生成大纲",
          onClick: (event) => {
            event.stopPropagation();
            handlers.handleGenerateOutlineFromContext?.(props.id, groupOptions);
          },
        });
      }
    }

    actions.push({
      key: "generate-info",
      label: "我想用它生成...",
      onClick: (event) => {
        event.stopPropagation();
        handlers.handleAddGroupToDialog?.(props.id);
      },
    });

    return actions;
  }, [groupMeta, handlers, hasAnyPendingCanvasOutput, isRoleGroup, props.id]);

  const visibleFloatingActions = useMemo(() => floatingActions.slice(0, 3), [floatingActions]);
  return (
    <div
      className={cn(
        "relative h-full w-full rounded-[20px]",
        highlighted
          ? "border border-[#EFAF00] bg-[#F4F4F4] shadow-[0px_0px_0px_2px_rgba(239,175,0,0.18),0px_10px_28px_0px_rgba(0,0,0,0.08)] after:pointer-events-none after:absolute after:inset-[-6px] after:rounded-[24px] after:border after:border-[#EFAF00]/70 after:content-[''] after:animate-ping"
          : "border border-[#F3F4F6] bg-[#F4F4F4]",
        "shadow-[0px_10px_28px_0px_rgba(0,0,0,0.08)]"
      )}
      onMouseEnter={floatingActions.length > 0 && !groupMeta.hasPendingApiResponse && !hasAnyPendingCanvasOutput ? showFloatingButtonsNow : undefined}
      onMouseLeave={floatingActions.length > 0 && !groupMeta.hasPendingApiResponse && !hasAnyPendingCanvasOutput ? scheduleHideFloatingButtons : undefined}
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
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(e) => {
              e.stopPropagation();
              handlers.handleAddGroupToDialog?.(props.id);
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

      {floatingActions.length > 0 && !groupMeta.hasPendingApiResponse && !hasAnyPendingCanvasOutput ? (
        <NodeToolbar
          isVisible={showFloatingButtons}
          position={Position.Bottom}
          offset={-15}
          onMouseEnter={showFloatingButtonsNow}
          onMouseLeave={scheduleHideFloatingButtons}
        >
          <div className="relative z-50">
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                showFloatingButtons ? "block" : "hidden"
              )}
              aria-hidden={!showFloatingButtons}
            >
              {visibleFloatingActions.map((action, index) => (
                <div
                  key={action.key}
                  className={cn(
                    "pointer-events-none absolute z-50",
                    index === 0 && "-top-15 left-15 -translate-x-1/2",
                    index === 1 && "top-1/2 left-15 ml-2 -translate-y-1/2",
                    index === 2 && "top-full left-20 mt-2 -translate-x-1/2"
                  )}
                >
                  <Button
                    type="button"
                    className={cn(
                      "pointer-events-auto rounded-[10px] border border-[#FEF08A] bg-[#FEFCE8] px-3 py-1 text-[12px] text-[#854D0E] shadow-sm",
                      "hover:bg-[#FEF08A]/80"
                    )}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                </div>
              ))}
            </div>

            <Button
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
              }}
              className="size-8 rounded-full bg-[#EFAF00] text-white hover:bg-[#EFAF00]/90 hover:scale-110 hover:shadow-md z-50"
              title={isRoleGroup ? "角色组操作" : "大纲组操作"}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </NodeToolbar>
      ) : null}

      {/* Invisible handle: allow edges to connect to the group */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

