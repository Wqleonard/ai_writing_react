import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  Controls,
  MiniMap,
  Background,
  MarkerType,
  ControlButton,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";
import MainCardNode from "./components/MainCardNode";
import SummaryCardNode from "./components/SummaryCardNode";
import SettingCardNode from "./components/SettingCardNode";
import OutlineCardNode from "./components/OutlineCardNode";
import OutlineSettingCardNode from "./components/OutlineSettingCardNode";
import RoleGroupNode from "./components/RoleGroupNode";
import InitCarousel from "./components/InitCarousel";
import InitWorkDialog from "./components/InitWorkDialog";
import InspirationHistoryDialog from "./components/InspirationHistoryDialog";
import { InsCanvasContext } from "@/components/InsCanvasV2/InsCanvasContext";
import { useDagreLayout } from "@/hooks/useDagreLayout";
import type {
  CanvasAddCardOptions,
  CanvasCardKey,
  CanvasGenerateOptions,
  CanvasGenerateOutlineOptions,
  CanvasModeCategory,
  CanvasModelType,
  CanvasOutputType,
  CanvasWriteFileCall,
  CustomNode,
  CustomEdge,
  DialogReferenceCard,
  InsCanvasApi,
  InsCanvasInnerProps,
  InsCanvasProps,
  ParentNode,
  PartialCanvasWriteFileCall,
  ReplySegments,
  ReqPanelAction,
  SettingsSection,
  SmartSuggestionItem,
  InspirationVersion,
  TreeNode,
} from "./types";
import {
  CANVAS_LAYOUT,
  CANVAS_UI,
  IDEA_PLACEHOLDER_OPTIONS,
  MODE_CATEGORY_OPTIONS,
  MODEL_TYPE_OPTIONS,
  OUTLINE_GROUP_LAYOUT,
  OUTPUT_TYPE_OPTIONS,
  ROLE_GROUP_LAYOUT,
  TASK_TYPE_CARD_KEY_MAP,
  TASK_TYPE_LABEL_MAP,
} from "./constant";
import {
  buildCanvasNodeFilePath,
  buildCanvasNodeMarkdown,
  buildCanvasSyncFileNodeIdMap,
  buildCanvasSyncFiles,
  collectPartialPanelMessagesById,
  extractChoicesToolFileContent,
  extractChoicesWriteFileContent,
  extractCreationIdeaFileContent,
  extractDisplayToolFileContent,
  extractMarkdownImage,
  extractPartialWriteToolFiles,
  extractReplySegmentsFromToolFiles,
  extractUpdatesMessageContentWithoutReadFile,
  extractUpdateToolFiles,
  extractWriteFileTitle,
  formatOutlineMarkdown,
  formatRecordMarkdown,
  getCanvasNodeLayoutSize as getCanvasNodeLayoutSizeFromUtils,
  getFirstTextValue,
  getLatestWriteFiles,
  getPanelTextsFromMessageMap,
  getTextValue,
  inferCardKeyFromWriteFilePath,
  isRelationshipWriteFile,
  isRelationshipInfoWriteFile,
  parseChoicesSuggestionItems,
  shouldSkipWriteFileCardCreation,
  splitAutoUpdatesContent,
} from "./canvasUtils";
import { Iconfont } from "../Iconfont";
import { generateInspirationDrawIdReq, saveInspirationCanvasReq } from "@/api/works";
import { useCanvasStore } from "@/stores/canvasStore";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowUp, MapPin, Pause, X } from "lucide-react";

const getTaskTypeLabel = (taskType: unknown) => {
  const normalizedTaskType = getTextValue(taskType);
  return TASK_TYPE_LABEL_MAP[normalizedTaskType] ?? "";
};

const getTaskCardKey = (taskType: unknown): CanvasCardKey | "" => {
  const normalizedTaskType = getTextValue(taskType);
  return TASK_TYPE_CARD_KEY_MAP[normalizedTaskType] ?? "";
};

const getPositiveTaskNum = (taskNum: unknown) => {
  const normalizedTaskNum = Number.parseInt(getTextValue(taskNum), 10);
  return Number.isFinite(normalizedTaskNum) && normalizedTaskNum > 0
    ? normalizedTaskNum
    : 0;
};

const parseTaskJsonContent = (
  content: unknown
): Record<string, unknown> | null => {
  const normalizedContent = getTextValue(content);
  if (!normalizedContent) return null;
  try {
    const parsed = JSON.parse(normalizedContent);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractTaskJsonPayload = (value: unknown): Record<string, unknown> | null => {
  let result: Record<string, unknown> | null = null;

  const visit = (input: unknown) => {
    if (result || !input) return;
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input !== "object") return;

    const record = input as {
      tool_calls?: Array<{
        name?: string;
        args?: { file_path?: string; content?: string };
      }>;
      tools?: {
        files?: Record<string, unknown>;
      };
    } & Record<string, unknown>;
    const toolFiles = record.tools?.files;

    if (toolFiles && typeof toolFiles === "object") {
      const directTaskJson =
        toolFiles["/task.json"] ??
        toolFiles["task.json"] ??
        Object.entries(toolFiles).find(([filePath]) =>
          /(^|\/)task\.json$/i.test(filePath)
        )?.[1];
      const parsedTaskJson = parseTaskJsonContent(directTaskJson);
      if (parsedTaskJson) {
        result = parsedTaskJson;
        return;
      }
    }

    if (Array.isArray(record.tool_calls)) {
      for (const toolCall of record.tool_calls) {
        if (getTextValue(toolCall?.name) !== "write_file") continue;
        if (!/(^|\/)task\.json$/i.test(getTextValue(toolCall?.args?.file_path))) {
          continue;
        }
        const parsedTaskJson = parseTaskJsonContent(toolCall?.args?.content);
        if (parsedTaskJson) {
          result = parsedTaskJson;
          return;
        }
      }
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return result;
};

const getNextTaskPanelLabelFromStream = (value: unknown) => {
  const taskJson = extractTaskJsonPayload(value);
  return getTaskTypeLabel(taskJson?.next_task_type);
};

const getCurrentTaskPanelLabelFromStream = (value: unknown) => {
  const taskJson = extractTaskJsonPayload(value);
  const taskTypeLabel = getTaskTypeLabel(taskJson?.task_type);
  return taskTypeLabel || "";
};

const getCurrentTaskPlaceholderConfigFromStream = (value: unknown) => {
  const taskJson = extractTaskJsonPayload(value);
  const key = getTaskCardKey(taskJson?.task_type);
  const taskNum = getPositiveTaskNum(taskJson?.task_num);
  if (!key || taskNum <= 0) return null;
  return { key, taskNum };
};

const summarizeCanvasPersistenceState = (nodes: CustomNode[], edges: CustomEdge[]) => {
  const placeholderNodes = nodes.filter((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    return (
      Boolean(data.fromApi) &&
      (
        Boolean(data.isStreaming) ||
        Boolean(data.pendingGenerate) ||
        (
          !String(data.title ?? "").trim() &&
          !String(data.content ?? "").trim()
        )
      )
    );
  });

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    placeholderCount: placeholderNodes.length,
    streamingCount: nodes.filter((node) => Boolean((node.data as any)?.isStreaming)).length,
    pendingGenerateCount: nodes.filter((node) => Boolean((node.data as any)?.pendingGenerate)).length,
    placeholderNodeIds: placeholderNodes.slice(0, 10).map((node) => node.id),
  };
};

const shouldBlockCanvasPersistence = (
  summary: ReturnType<typeof summarizeCanvasPersistenceState>
) =>
  summary.placeholderCount > 0 ||
  summary.streamingCount > 0 ||
  summary.pendingGenerateCount > 0;
const nodeTypes = {
  mainCard: MainCardNode,
  summaryCard: SummaryCardNode,
  settingCard: SettingCardNode,
  outlineCard: OutlineCardNode,
  outlineSettingCard: OutlineSettingCardNode,
  roleGroup: RoleGroupNode,
};

function convertToTreeStructure(
  nodes: CustomNode[],
  edges: CustomEdge[]
): TreeNode[] | null {
  if (nodes.length === 0) return null;
  const targetIds = new Set(edges.map((e) => e.target));
  let roots = nodes.filter((n) => !targetIds.has(n.id));
  if (roots.length === 0) {
    const main = nodes.find((n) => n.type === "mainCard");
    if (main) roots = [main];
    else if (nodes.length > 0) roots = [nodes[0]];
  }
  if (roots.length === 0) return null;

  const processed = new Set<string>();
  const buildTree = (nodeId: string): TreeNode | null => {
    if (processed.has(nodeId)) return null;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    processed.add(nodeId);
    const childEdges = edges.filter((e) => e.source === nodeId);
    const children: TreeNode[] = [];
    for (const e of childEdges) {
      processed.delete(nodeId);
      const child = buildTree(e.target);
      processed.add(nodeId);
      if (child) children.push(child);
    }
    processed.delete(nodeId);
    return {
      id: node.id,
      type: node.type,
      data: { ...node.data },
      position: { ...node.position },
      children: children.length > 0 ? children : undefined,
    };
  };
  const trees: TreeNode[] = [];
  for (const r of roots) {
    const t = buildTree(r.id);
    if (t) trees.push(t);
  }
  return trees.length > 0 ? trees : null;
}

const {
  randomIdeaOptionsMarker: RANDOM_IDEA_OPTIONS_MARKER,
  dockRestOffsetRem: CANVAS_DOCK_REST_OFFSET_REM,
} = CANVAS_UI;

const {
  cardGapX: CARD_LAYOUT_GAP_X,
  cardGapY: CARD_LAYOUT_GAP_Y,
  infoColumnGapX: INFO_COLUMN_GAP_X,
} = CANVAS_LAYOUT;
const {
  settingsCardWidth: OUTLINE_GROUP_SETTINGS_CARD_WIDTH,
  settingsCardHeight: OUTLINE_GROUP_SETTINGS_CARD_HEIGHT,
  settingsCollapsedHeight: OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT,
  horizontalPadding: OUTLINE_GROUP_HORIZONTAL_PADDING,
  settingsTop: OUTLINE_GROUP_SETTINGS_TOP,
  settingsBottomGap: OUTLINE_GROUP_SETTINGS_BOTTOM_GAP,
  settingsNodeType: OUTLINE_GROUP_SETTINGS_NODE_TYPE,
  defaultTop: OUTLINE_GROUP_DEFAULT_TOP,
  maxCols: OUTLINE_GROUP_MAX_COLS,
  cardWidth: OUTLINE_GROUP_CARD_WIDTH,
  cardHeight: OUTLINE_GROUP_CARD_HEIGHT,
  cardGapX: OUTLINE_GROUP_CARD_GAP_X,
  cardGapY: OUTLINE_GROUP_CARD_GAP_Y,
} = OUTLINE_GROUP_LAYOUT;
const {
  minHeight: ROLE_GROUP_MIN_HEIGHT,
  maxCols: ROLE_GROUP_MAX_COLS,
  cardWidth: ROLE_GROUP_CARD_WIDTH,
  cardHeight: ROLE_GROUP_CARD_HEIGHT,
  cardGapX: ROLE_GROUP_CARD_GAP_X,
  cardGapY: ROLE_GROUP_CARD_GAP_Y,
  paddingTop: ROLE_GROUP_PADDING_TOP,
  padding: ROLE_GROUP_PADDING,
} = ROLE_GROUP_LAYOUT;
const getCanvasNodeLayoutSize = (node: CustomNode) => getCanvasNodeLayoutSizeFromUtils(node);

const getOutlineGroupSettingsNode = (currentNodes: CustomNode[], groupId: string) =>
  currentNodes.find(
    (node) => node.parentId === groupId && node.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE
  );

const getOutlineGroupSettingsHeight = (currentNodes: CustomNode[], groupId: string) => {
  const settingsNode = getOutlineGroupSettingsNode(currentNodes, groupId);
  return settingsNode ? getCanvasNodeLayoutSize(settingsNode).height : 0;
};

const getOutlineGroupCardsTop = (settingsHeight: number) =>
  settingsHeight > 0
    ? OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + OUTLINE_GROUP_SETTINGS_BOTTOM_GAP
    : OUTLINE_GROUP_DEFAULT_TOP;

type GroupRelayoutOptions = {
  shiftOtherTopLevelNodes?: boolean;
  currentEdges?: CustomEdge[];
};

const getCanvasNodeGroupId = (node?: CustomNode | null) =>
  getTextValue(node?.parentId) ||
  getTextValue((node?.data as any)?.roleGroupId) ||
  getTextValue((node?.data as any)?.outlineGroupId);

const clampGroupedChildNodePositions = (currentNodes: CustomNode[], nodeIds?: string[]) => {
  const targetIds = nodeIds?.length ? new Set(nodeIds) : null;
  let changed = false;

  const nextNodes = currentNodes.map((node) => {
    if (targetIds && !targetIds.has(node.id)) return node;
    if (node.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE) return node;

    const groupId = getCanvasNodeGroupId(node);
    if (!groupId) return node;

    const groupNode = currentNodes.find((candidate) => candidate.id === groupId && candidate.type === "roleGroup");
    if (!groupNode) return node;

    const groupLabel = getTextValue(groupNode.data?.label);
    const isRoleGroup = groupLabel === "角色";
    const isOutlineGroup = groupLabel === "大纲";
    if (!isRoleGroup && !isOutlineGroup) return node;

    const { width: groupWidth, height: groupHeight } = getCanvasNodeLayoutSize(groupNode);
    const { width: nodeWidth, height: nodeHeight } = getCanvasNodeLayoutSize(node);
    const paddingX = isRoleGroup ? ROLE_GROUP_PADDING : OUTLINE_GROUP_HORIZONTAL_PADDING;
    const minY = isRoleGroup
      ? ROLE_GROUP_PADDING_TOP
      : getOutlineGroupCardsTop(getOutlineGroupSettingsHeight(currentNodes, groupId));
    const maxX = Math.max(paddingX, groupWidth - paddingX - nodeWidth);
    const maxY = Math.max(minY, groupHeight - (isRoleGroup ? ROLE_GROUP_PADDING : OUTLINE_GROUP_HORIZONTAL_PADDING) - nodeHeight);
    const currentX = Number(node.position?.x ?? 0);
    const currentY = Number(node.position?.y ?? 0);
    const nextX = Math.min(Math.max(currentX, paddingX), maxX);
    const nextY = Math.min(Math.max(currentY, minY), maxY);

    if (currentX === nextX && currentY === nextY) return node;

    changed = true;
    return {
      ...node,
      position: {
        x: nextX,
        y: nextY,
      },
    };
  });

  return changed ? nextNodes : currentNodes;
};

const shiftImpactedTopLevelNodesHorizontally = (
  currentNodes: CustomNode[],
  currentEdges: CustomEdge[],
  sourceNodeId: string,
  minX: number,
  deltaX: number
) => {
  if (!sourceNodeId || deltaX <= 0) return currentNodes;

  const topLevelOwnerIdByNodeId = new Map<string, string>();
  currentNodes.forEach((node) => {
    const ownerId =
      getTextValue(node.parentId) ||
      getTextValue((node.data as any)?.roleGroupId) ||
      getTextValue((node.data as any)?.outlineGroupId) ||
      node.id;
    topLevelOwnerIdByNodeId.set(node.id, ownerId);
  });

  const topLevelNodeById = new Map(
    currentNodes.filter((node) => !node.parentId).map((node) => [node.id, node] as const)
  );
  const downstreamByTopLevelId = new Map<string, Set<string>>();
  const connectTopLevel = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    if (!downstreamByTopLevelId.has(fromId)) {
      downstreamByTopLevelId.set(fromId, new Set());
    }
    downstreamByTopLevelId.get(fromId)?.add(toId);
  };

  currentEdges.forEach((edge) => {
    const sourceOwnerId = topLevelOwnerIdByNodeId.get(String(edge.source ?? "")) ?? "";
    const targetOwnerId = topLevelOwnerIdByNodeId.get(String(edge.target ?? "")) ?? "";
    connectTopLevel(sourceOwnerId, targetOwnerId);
  });

  const queue = Array.from(topLevelNodeById.values())
    .filter((node) => node.id !== sourceNodeId && Number(node.position?.x ?? 0) >= minX)
    .map((node) => node.id);

  if (!queue.length) return currentNodes;

  const idsToShift = new Set<string>();
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (!currentId || idsToShift.has(currentId) || currentId === sourceNodeId) continue;
    idsToShift.add(currentId);
    downstreamByTopLevelId.get(currentId)?.forEach((nextId) => {
      if (!idsToShift.has(nextId)) {
        queue.push(nextId);
      }
    });
  }

  if (!idsToShift.size) return currentNodes;

  return currentNodes.map((node) =>
    !node.parentId && idsToShift.has(node.id)
      ? {
        ...node,
        position: {
          ...node.position,
          x: Number(node.position?.x ?? 0) + deltaX,
        },
      }
      : node
  );
};

const fitGroupNodeToChildren = (
  currentNodes: CustomNode[],
  groupId: string,
  options?: GroupRelayoutOptions
) => {
  if (!groupId) return currentNodes;

  const groupNode = currentNodes.find((node) => node.id === groupId && node.type === "roleGroup");
  if (!groupNode) return currentNodes;

  const groupLabel = getTextValue(groupNode.data?.label);
  const isRoleGroup = groupLabel === "角色";
  const isOutlineGroup = groupLabel === "大纲";
  if (!isRoleGroup && !isOutlineGroup) return currentNodes;

  const childNodes = currentNodes.filter((node) => {
    if (node.id === groupId) return false;
    if (node.parentId === groupId) return true;
    return isRoleGroup
      ? getTextValue((node.data as any)?.roleGroupId) === groupId
      : getTextValue((node.data as any)?.outlineGroupId) === groupId;
  });

  if (!childNodes.length) return currentNodes;

  const maxRight = childNodes.reduce((max, node) => {
    const { width } = getCanvasNodeLayoutSize(node);
    return Math.max(max, Number(node.position?.x ?? 0) + width);
  }, 0);
  const maxBottom = childNodes.reduce((max, node) => {
    const { height } = getCanvasNodeLayoutSize(node);
    return Math.max(max, Number(node.position?.y ?? 0) + height);
  }, 0);

  const horizontalPadding = isRoleGroup ? ROLE_GROUP_PADDING : OUTLINE_GROUP_HORIZONTAL_PADDING;
  const minWidth = isRoleGroup
    ? 340
    : OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2;
  const maxWidth = isRoleGroup
    ? Number.POSITIVE_INFINITY
    : Math.max(
      OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2,
      OUTLINE_GROUP_HORIZONTAL_PADDING * 2 +
      OUTLINE_GROUP_MAX_COLS * OUTLINE_GROUP_CARD_WIDTH +
      Math.max(0, OUTLINE_GROUP_MAX_COLS - 1) * OUTLINE_GROUP_CARD_GAP_X
    );
  const minHeight = isRoleGroup
    ? ROLE_GROUP_PADDING_TOP + ROLE_GROUP_PADDING
    : OUTLINE_GROUP_SETTINGS_TOP + getOutlineGroupSettingsHeight(currentNodes, groupId) + OUTLINE_GROUP_HORIZONTAL_PADDING;
  const nextGroupWidth = Math.min(maxWidth, Math.max(minWidth, Math.ceil(maxRight + horizontalPadding)));
  const nextGroupHeight = Math.max(minHeight, Math.ceil(maxBottom + horizontalPadding));

  const groupCurrentX = Number(groupNode.position?.x ?? 0);
  const groupCurrentWidth = Number((groupNode.style as any)?.width ?? getCanvasNodeLayoutSize(groupNode).width);
  const widthDelta = Math.max(0, nextGroupWidth - groupCurrentWidth);
  const groupRightBeforeExpand = groupCurrentX + groupCurrentWidth;

  let changed = false;
  let nextNodes = currentNodes.map((node) => {
    if (node.id === groupId) {
      const currentWidth = Number((node.style as any)?.width ?? 0);
      const currentHeight = Number((node.style as any)?.height ?? 0);
      if (currentWidth === nextGroupWidth && currentHeight === nextGroupHeight) {
        return node;
      }
      changed = true;
      return {
        ...node,
        style: {
          ...(node.style ?? {}),
          width: nextGroupWidth,
          height: nextGroupHeight,
        } as any,
      };
    }

    if (isOutlineGroup && node.parentId === groupId && node.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE) {
      const targetWidth = Math.max(
        nextGroupWidth - OUTLINE_GROUP_HORIZONTAL_PADDING * 2,
        OUTLINE_GROUP_SETTINGS_CARD_WIDTH
      );
      const currentWidth = Number((node.style as any)?.width ?? 0);
      if (currentWidth === targetWidth) {
        return node;
      }
      changed = true;
      return {
        ...node,
        style: {
          ...(node.style ?? {}),
          width: targetWidth,
        } as any,
      };
    }

    return node;
  });

  // 当分组宽度扩展时，默认顶开右侧顶层节点；局部 relayout 模式下保持组外节点位置不变。
  if (widthDelta > 0 && options?.shiftOtherTopLevelNodes !== false) {
    const shiftedNodes = shiftImpactedTopLevelNodesHorizontally(
      nextNodes,
      options?.currentEdges ?? [],
      groupId,
      groupRightBeforeExpand,
      widthDelta
    );
    if (shiftedNodes !== nextNodes) {
      changed = true;
      nextNodes = shiftedNodes;
    }
  }

  return changed ? nextNodes : currentNodes;
};

const fitAllGroupNodesToChildren = (currentNodes: CustomNode[]) => {
  const groupIds = currentNodes
    .filter((node) => node.type === "roleGroup")
    .map((node) => node.id);

  return groupIds.reduce((nodesAcc, groupId) => fitGroupNodeToChildren(nodesAcc, groupId), currentNodes);
};

const previewGroupedSiblingPositions = (currentNodes: CustomNode[], draggedNodeId: string) => {
  if (!draggedNodeId) return currentNodes;

  const draggedNode = currentNodes.find((node) => node.id === draggedNodeId);
  const groupId = getCanvasNodeGroupId(draggedNode);
  if (!draggedNode || !groupId) return currentNodes;

  const groupNode = currentNodes.find((node) => node.id === groupId && node.type === "roleGroup");
  if (!groupNode) return currentNodes;

  const groupLabel = getTextValue(groupNode.data?.label);
  const isRoleGroup = groupLabel === "角色";
  const isOutlineGroup = groupLabel === "大纲";
  if (!isRoleGroup && !isOutlineGroup) return currentNodes;

  const groupChildren = currentNodes
    .filter((node) =>
      isRoleGroup
        ? node.parentId === groupId && node.type !== OUTLINE_GROUP_SETTINGS_NODE_TYPE
        : node.parentId === groupId && node.type === "outlineCard"
    )
    .sort((a, b) => {
      const ay = Number(a.position?.y ?? 0);
      const by = Number(b.position?.y ?? 0);
      if (ay !== by) return ay - by;
      return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
    });

  if (groupChildren.length <= 1) return currentNodes;

  const siblingChildren = groupChildren.filter((node) => node.id !== draggedNodeId);
  if (!siblingChildren.length) return currentNodes;

  const buildPreviewPositions = (orderedNodes: CustomNode[]) => {
    const nextPositionById = new Map<string, { x: number; y: number }>();
    if (isRoleGroup) {
      let rowStartY = ROLE_GROUP_PADDING_TOP;
      for (let start = 0; start < orderedNodes.length; start += ROLE_GROUP_MAX_COLS) {
        const rowNodes = orderedNodes.slice(start, start + ROLE_GROUP_MAX_COLS);
        const rowHeight = rowNodes.reduce((max, node) => {
          const { height } = getCanvasNodeLayoutSize(node);
          return Math.max(max, height);
        }, 0);

        let nextRowX = ROLE_GROUP_PADDING;
        rowNodes.forEach((node) => {
          const { width } = getCanvasNodeLayoutSize(node);
          nextPositionById.set(node.id, { x: nextRowX, y: rowStartY });
          nextRowX += width + ROLE_GROUP_CARD_GAP_X;
        });
        rowStartY += rowHeight + ROLE_GROUP_CARD_GAP_Y;
      }
    } else {
      const settingsHeight = getOutlineGroupSettingsHeight(currentNodes, groupId);
      const groupPaddingTop = getOutlineGroupCardsTop(settingsHeight);
      orderedNodes.forEach((node, index) => {
        const col = index % OUTLINE_GROUP_MAX_COLS;
        const row = Math.floor(index / OUTLINE_GROUP_MAX_COLS);
        nextPositionById.set(node.id, {
          x: OUTLINE_GROUP_HORIZONTAL_PADDING + col * (OUTLINE_GROUP_CARD_WIDTH + OUTLINE_GROUP_CARD_GAP_X),
          y: groupPaddingTop + row * (OUTLINE_GROUP_CARD_HEIGHT + OUTLINE_GROUP_CARD_GAP_Y),
        });
      });
    }
    return nextPositionById;
  };

  const draggedSize = getCanvasNodeLayoutSize(draggedNode);
  const draggedCenterX = Number(draggedNode.position?.x ?? 0) + draggedSize.width / 2;
  const draggedCenterY = Number(draggedNode.position?.y ?? 0) + draggedSize.height / 2;

  let orderedChildren = [...siblingChildren, draggedNode];
  let nextPositionById = buildPreviewPositions(orderedChildren);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let insertionIndex = 0; insertionIndex <= siblingChildren.length; insertionIndex += 1) {
    const candidateOrder = [
      ...siblingChildren.slice(0, insertionIndex),
      draggedNode,
      ...siblingChildren.slice(insertionIndex),
    ];
    const candidatePositions = buildPreviewPositions(candidateOrder);
    const draggedSlot = candidatePositions.get(draggedNodeId);
    if (!draggedSlot) continue;

    const draggedSlotCenterX = draggedSlot.x + draggedSize.width / 2;
    const draggedSlotCenterY = draggedSlot.y + draggedSize.height / 2;
    const distance = Math.hypot(draggedCenterX - draggedSlotCenterX, draggedCenterY - draggedSlotCenterY);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    orderedChildren = candidateOrder;
    nextPositionById = candidatePositions;
  }

  let changed = false;
  const nextNodes = currentNodes.map((node) => {
    if (node.id === draggedNodeId) return node;
    const nextPosition = nextPositionById.get(node.id);
    if (!nextPosition) return node;

    const currentX = Number(node.position?.x ?? 0);
    const currentY = Number(node.position?.y ?? 0);
    if (currentX === nextPosition.x && currentY === nextPosition.y) {
      return node;
    }

    changed = true;
    return {
      ...node,
      position: nextPosition,
    };
  });

  return changed ? nextNodes : currentNodes;
};

const compactRoleGroupNodes = (currentNodes: CustomNode[], groupId: string) => {
  if (!groupId) return currentNodes;

  const groupNode = currentNodes.find(
    (node) =>
      node.id === groupId &&
      node.type === "roleGroup" &&
      getTextValue(node.data?.label) === "角色"
  );
  if (!groupNode) return currentNodes;

  const roleChildren = currentNodes
    .filter((node) => node.parentId === groupId && node.type !== OUTLINE_GROUP_SETTINGS_NODE_TYPE)
    .sort((a, b) => {
      const ay = Number(a.position?.y ?? 0);
      const by = Number(b.position?.y ?? 0);
      if (ay !== by) return ay - by;
      return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
    });

  if (!roleChildren.length) return currentNodes;

  const nextPositionById = new Map<string, { x: number; y: number }>();
  let rowStartY = ROLE_GROUP_PADDING_TOP;

  for (let start = 0; start < roleChildren.length; start += ROLE_GROUP_MAX_COLS) {
    const rowNodes = roleChildren.slice(start, start + ROLE_GROUP_MAX_COLS);
    const rowHeight = rowNodes.reduce((max, node) => {
      const { height } = getCanvasNodeLayoutSize(node);
      return Math.max(max, height);
    }, 0);

    let nextRowX = ROLE_GROUP_PADDING;
    rowNodes.forEach((node) => {
      const { width } = getCanvasNodeLayoutSize(node);
      nextPositionById.set(node.id, {
        x: nextRowX,
        y: rowStartY,
      });
      nextRowX += width + ROLE_GROUP_CARD_GAP_X;
    });

    rowStartY += rowHeight + ROLE_GROUP_CARD_GAP_Y;
  }

  let changed = false;
  const nextNodes = currentNodes.map((node) => {
    const nextPosition = nextPositionById.get(node.id);
    if (!nextPosition) return node;

    const currentX = Number(node.position?.x ?? 0);
    const currentY = Number(node.position?.y ?? 0);
    if (currentX === nextPosition.x && currentY === nextPosition.y) {
      return node;
    }

    changed = true;
    return {
      ...node,
      position: nextPosition,
    };
  });

  return changed ? nextNodes : currentNodes;
};

const compactGroupNodes = (
  currentNodes: CustomNode[],
  groupId: string,
  options?: GroupRelayoutOptions
) => {
  if (!groupId) return currentNodes;

  const groupNode = currentNodes.find((node) => node.id === groupId && node.type === "roleGroup");
  if (!groupNode) return currentNodes;

  const groupLabel = getTextValue(groupNode.data?.label);
  const compactedNodes =
    groupLabel === "角色"
      ? compactRoleGroupNodes(currentNodes, groupId)
      : groupLabel === "大纲"
        ? compactOutlineGroupNodes(currentNodes, groupId)
        : currentNodes;

  return fitGroupNodeToChildren(compactedNodes, groupId, options);
};

const compactOutlineGroupNodes = (currentNodes: CustomNode[], groupId: string) => {
  if (!groupId) return currentNodes;

  const groupNode = currentNodes.find((node) => node.id === groupId);
  if (!groupNode) return currentNodes;

  const settingsHeight = getOutlineGroupSettingsHeight(currentNodes, groupId);
  const hasSettingsNode = settingsHeight > 0;
  const outlineChildren = currentNodes
    .filter((node) => node.parentId === groupId && node.type === "outlineCard")
    .sort((a, b) => {
      const ay = Number(a.position?.y ?? 0);
      const by = Number(b.position?.y ?? 0);
      if (ay !== by) return ay - by;
      return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
    });

  const cardWidth = OUTLINE_GROUP_CARD_WIDTH;
  const cardHeight = OUTLINE_GROUP_CARD_HEIGHT;
  const gapX = OUTLINE_GROUP_CARD_GAP_X;
  const gapY = OUTLINE_GROUP_CARD_GAP_Y;
  const cols = OUTLINE_GROUP_MAX_COLS;
  const groupPadding = OUTLINE_GROUP_HORIZONTAL_PADDING;
  const groupPaddingTop = getOutlineGroupCardsTop(settingsHeight);
  const minGroupWidth = hasSettingsNode
    ? OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2
    : 340;

  const nextPositionById = new Map<string, { x: number; y: number }>();
  outlineChildren.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    nextPositionById.set(node.id, {
      x: groupPadding + col * (cardWidth + gapX),
      y: groupPaddingTop + row * (cardHeight + gapY),
    });
  });

  const totalCount = outlineChildren.length;
  const rows = totalCount > 0 ? Math.ceil(totalCount / cols) : 0;
  const colsUsed = totalCount > 0 ? Math.min(cols, totalCount) : 1;
  const nextGroupWidth = Math.max(
    minGroupWidth,
    groupPadding * 2 + colsUsed * cardWidth + Math.max(0, colsUsed - 1) * gapX
  );
  const nextGroupHeight = hasSettingsNode
    ? Math.max(
      OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + groupPadding,
      totalCount > 0
        ? groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding
        : OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + groupPadding
    )
    : totalCount > 0
      ? groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding
      : groupPaddingTop + groupPadding;

  let changed = false;
  const nextNodes = currentNodes.map((node) => {
    if (node.id === groupId) {
      const currentWidth = Number((node.style as any)?.width ?? 0);
      const currentHeight = Number((node.style as any)?.height ?? 0);
      if (currentWidth === nextGroupWidth && currentHeight === nextGroupHeight) {
        return node;
      }
      changed = true;
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
    const currentX = Number(node.position?.x ?? 0);
    const currentY = Number(node.position?.y ?? 0);
    if (currentX === nextPosition.x && currentY === nextPosition.y) {
      return node;
    }
    changed = true;
    return {
      ...node,
      position: nextPosition,
    };
  });

  return changed ? nextNodes : currentNodes;
};

const getCanvasNodeRight = (node: CustomNode) => node.position.x + getCanvasNodeLayoutSize(node).width;

const getCanvasNodeBottom = (node: CustomNode) => node.position.y + getCanvasNodeLayoutSize(node).height;

const isInfoCanvasNode = (node: CustomNode) => String(node.data?.label ?? "").trim() === "信息";

const getStandaloneNextRowPosition = (currentNodes: CustomNode[]) => {
  const topLevelNodes = currentNodes.filter((node) => !node.parentId);
  if (!topLevelNodes.length) {
    return { x: 360, y: 180 };
  }

  const leftX = Math.min(...topLevelNodes.map((node) => node.position.x));
  const maxBottom = Math.max(...topLevelNodes.map(getCanvasNodeBottom));
  return { x: leftX, y: maxBottom + CARD_LAYOUT_GAP_Y };
};

const getStandaloneNextRightInsertPosition = (currentNodes: CustomNode[]) => {
  const topLevelNodes = currentNodes.filter((node) => !node.parentId);
  if (!topLevelNodes.length) {
    return { x: 360, y: 180 };
  }

  const rightmostNode = topLevelNodes.reduce((currentMax, node) =>
    getCanvasNodeRight(node) > getCanvasNodeRight(currentMax) ? node : currentMax
  );

  return {
    x: getCanvasNodeRight(rightmostNode) + CARD_LAYOUT_GAP_X,
    y: rightmostNode.position.y,
  };
};

const getStandaloneBatchRowPositions = (
  currentNodes: CustomNode[],
  cardWidth: number,
  count: number,
  anchorNode?: CustomNode | null
) => {
  if (count <= 0) return [] as Array<{ x: number; y: number }>;

  const anchorIsTopLevel = anchorNode && !anchorNode.parentId;
  const basePosition = anchorIsTopLevel
    ? {
      x: getCanvasNodeRight(anchorNode) + CARD_LAYOUT_GAP_X,
      y: anchorNode.position.y,
    }
    : getStandaloneNextRowPosition(currentNodes);

  return Array.from({ length: count }, (_, index) => ({
    x: basePosition.x + index * (cardWidth + CARD_LAYOUT_GAP_X),
    y: basePosition.y,
  }));
};

const getLinkedCardPosition = (
  sourceNodeId: string,
  currentNodes: CustomNode[],
  currentEdges: CustomEdge[],
  kind: "attribute" | "info"
) => {
  const source = currentNodes.find((node) => node.id === sourceNodeId);
  if (!source) {
    return getStandaloneNextRowPosition(currentNodes);
  }

  const linkedChildren = currentEdges
    .filter((edge) => edge.source === sourceNodeId)
    .map((edge) => currentNodes.find((node) => node.id === edge.target))
    .filter((node): node is CustomNode => Boolean(node))
    .filter((node) => !node.parentId);

  if (kind === "info") {
    const infoChildren = linkedChildren.filter(isInfoCanvasNode);
    const infoColumnX = getCanvasNodeRight(source) + INFO_COLUMN_GAP_X;
    const infoColumnChildren = infoChildren.filter(
      (node) => Math.abs(node.position.x - infoColumnX) <= INFO_COLUMN_GAP_X / 2
    );
    return {
      x: infoColumnX,
      y: infoColumnChildren.length
        ? Math.max(...infoColumnChildren.map(getCanvasNodeBottom)) + CARD_LAYOUT_GAP_Y
        : source.position.y,
    };
  }

  const attributeChildren = linkedChildren.filter((node) => !isInfoCanvasNode(node));
  const attributeRowY = getCanvasNodeBottom(source) + CARD_LAYOUT_GAP_Y;
  const attributeRowChildren = attributeChildren.filter(
    (node) => Math.abs(node.position.y - attributeRowY) <= CARD_LAYOUT_GAP_Y / 2
  );
  return {
    x: attributeRowChildren.length
      ? Math.max(...attributeRowChildren.map(getCanvasNodeRight)) + CARD_LAYOUT_GAP_X
      : source.position.x,
    y: attributeRowY,
  };
};

const shiftDownstreamTopLevelNodes = (
  currentNodes: CustomNode[],
  currentEdges: CustomEdge[],
  sourceNodeId: string,
  deltaY: number
) => {
  if (!sourceNodeId || deltaY <= 0) return currentNodes;

  const sourceNode = currentNodes.find((node) => node.id === sourceNodeId);
  if (!sourceNode) return currentNodes;

  const topLevelOwnerIdByNodeId = new Map<string, string>();
  currentNodes.forEach((node) => {
    const ownerId =
      getTextValue(node.parentId) ||
      getTextValue((node.data as any)?.roleGroupId) ||
      getTextValue((node.data as any)?.outlineGroupId) ||
      node.id;
    topLevelOwnerIdByNodeId.set(node.id, ownerId);
  });

  const topLevelNodeById = new Map(
    currentNodes.filter((node) => !node.parentId).map((node) => [node.id, node] as const)
  );
  const downstreamByTopLevelId = new Map<string, Set<string>>();
  const connectTopLevel = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    if (!downstreamByTopLevelId.has(fromId)) {
      downstreamByTopLevelId.set(fromId, new Set());
    }
    downstreamByTopLevelId.get(fromId)?.add(toId);
  };

  currentEdges.forEach((edge) => {
    const sourceOwnerId = topLevelOwnerIdByNodeId.get(String(edge.source ?? "")) ?? "";
    const targetOwnerId = topLevelOwnerIdByNodeId.get(String(edge.target ?? "")) ?? "";
    connectTopLevel(sourceOwnerId, targetOwnerId);
  });

  const sourceBottom = getCanvasNodeBottom(sourceNode);
  const queue: string[] = [];
  const idsToShift = new Set<string>();

  downstreamByTopLevelId.get(sourceNodeId)?.forEach((targetId) => {
    const targetNode = topLevelNodeById.get(targetId);
    if (!targetNode) return;
    if (Number(targetNode.position?.y ?? 0) < sourceBottom) return;
    queue.push(targetId);
  });

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (!currentId || idsToShift.has(currentId) || currentId === sourceNodeId) continue;
    idsToShift.add(currentId);
    downstreamByTopLevelId.get(currentId)?.forEach((nextId) => {
      if (!idsToShift.has(nextId)) {
        queue.push(nextId);
      }
    });
  }

  if (!idsToShift.size) return currentNodes;

  return currentNodes.map((node) =>
    !node.parentId && idsToShift.has(node.id)
      ? {
        ...node,
        position: {
          ...node.position,
          y: Number(node.position?.y ?? 0) + deltaY,
        },
      }
      : node
  );
};

const createDirectedCanvasEdge = (
  source: string,
  target: string,
  options?: {
    sourceHandle?: string;
    targetHandle?: string;
  }
): CustomEdge => ({
  id: `e${source}-${target}-${Date.now()}`,
  source,
  target,
  sourceHandle: options?.sourceHandle,
  targetHandle: options?.targetHandle,
  type: "default",
  animated: false,
});

const normalizeCanvasEdges = (input: CustomEdge[] = []): CustomEdge[] =>
  input.map((edge) =>
    getTextValue(edge?.type).toLowerCase() === "bezier"
      ? {
        ...edge,
        type: "default",
      }
      : edge
  );

const withVerticalPorts = (node: CustomNode): CustomNode => {
  if (isInfoCanvasNode(node)) {
    if (node.sourcePosition === Position.Right && node.targetPosition === Position.Left) {
      return node;
    }
    return {
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  }

  if (node.sourcePosition === Position.Bottom && node.targetPosition === Position.Top) {
    return node;
  }
  return {
    ...node,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  };
};

function InsCanvasInner({
  workId,
  nodes: initialNodes = [],
  edges: initialEdges = [],
  inspirationDrawId: initialInspirationDrawId = "",
  onCreateHere,
  onCreateNew,
  onMessage,
  onCanvasReady,
  autoSyncDirectory = false,
  onAutoSyncDirectory,
  onCanvasFileContentChange,
  onCanvasOpenFileRequest,
  canvasRef,
}: InsCanvasInnerProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedInitialEdges = useMemo(
    () => normalizeCanvasEdges(initialEdges),
    [initialEdges]
  );
  const [nodes, setNodes] = useNodesState<CustomNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>(normalizedInitialEdges);
  // autoLayout 会被 setTimeout 调用；用 ref 避免闭包拿到旧 nodes/edges 导致把新数据覆盖回去
  const nodesRef = useRef<CustomNode[]>(initialNodes);
  const edgesRef = useRef<CustomEdge[]>(normalizedInitialEdges);
  const canvasAutoSaveTimerRef = useRef<number | null>(null);
  const ensureDrawIdPromiseRef = useRef<Promise<string> | null>(null);
  const canvasAutoSaveSuppressedRef = useRef(false);
  const pendingStablePersistenceRef = useRef(false);
  const hasInitialSnapshotFittedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  const hasIdeaRef = useRef(false);
  const layoutRequestIdRef = useRef(0);
  const canvasNodeIdSeqRef = useRef(0);
  const [inspirationDrawId, setInspirationDrawId] = useState(initialInspirationDrawId);
  const [ideaContent, setIdeaContent] = useState("");
  const [ideaPlaceholderIndex, setIdeaPlaceholderIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const canvasRequestAbortControllerRef = useRef<AbortController | null>(null);
  const activeCanvasRequestAbortCleanupRef = useRef<(() => void) | null>(null);
    const abortRequestedRef = useRef(false);
    const pausedRequestMessageRef = useRef("");
  const [generateMode, setGenerateMode] = useState<"smart" | "brainstorm" | "fast">("smart");
  const [canvasModeCategory, setCanvasModeCategory] = useState<CanvasModeCategory>("smart");
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("mode");
  const [canvasOutputType, setCanvasOutputType] = useState<CanvasOutputType>("auto");
  const [canvasModelType, setCanvasModelType] = useState<CanvasModelType>("max");
  const [reqPanelVisible, setReqPanelVisible] = useState(false);
  const [reqPanelExpanded, setReqPanelExpanded] = useState(false);
  const [cardKeyLabel, setCardKeyLabel] = useState<string>("脑洞");
  const nextReqPanelTaskLabelRef = useRef("");
  const [reqPanelTaskLabel, setReqPanelTaskLabel] = useState("");
  const [reqPanelTitle, setReqPanelTitle] = useState("");
  const [reqPanelStatus, setReqPanelStatus] = useState<"idle" | "loading" | "success" | "error" | "paused">("idle");
  const [reqPanelDetail, setReqPanelDetail] = useState<string>("");
  const [reqPanelBodyDetail, setReqPanelBodyDetail] = useState<string>("");
  const [reqPanelFooterDetail, setReqPanelFooterDetail] = useState<string>("");
  const [reqPanelUseSmartTheme, setReqPanelUseSmartTheme] = useState(false);
  const [creationIdeaContent, setCreationIdeaContent] = useState<string>("");
  const [ideaInputSource, setIdeaInputSource] = useState<"default" | "carousel">("default");
  const reqPanelDetailRef = useRef("");
  const reqPanelBodyDetailRef = useRef("");
  const reqPanelFooterDetailRef = useRef("");
  const creationIdeaContentRef = useRef("");
  const [reqPanelAction, setReqPanelAction] = useState<ReqPanelAction | null>(null);
  const [latestGeneratedNodeId, setLatestGeneratedNodeId] = useState("");
  const latestGeneratedNodeIdRef = useRef("");
  const locateHighlightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const generatedWriteFilesRef = useRef<Record<string, string>>({});
  const preparedContextFilesRef = useRef<Record<string, string> | undefined>(undefined);
  const preparedGenerateSourceNodeIdRef = useRef<string | undefined>(undefined);
  const ignoreDialogReferencesForNextRequestRef = useRef(false);
  const clearDialogPreviewsForNextRequestRef = useRef<boolean | undefined>(undefined);
  const [smartSuggestionsActive, setSmartSuggestionsActive] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestionItem[]>([]);
  const [pendingSuggestionIdea, setPendingSuggestionIdea] = useState("");
  const [pendingContextActionLabel, setPendingContextActionLabel] = useState("");
  const [dialogCardPreviews, setDialogCardPreviews] = useState<DialogReferenceCard[]>([]);
  const [inputDockResetKey, setInputDockResetKey] = useState(0);
  const [outlineCompletionCelebrationVisible, setOutlineCompletionCelebrationVisible] = useState(false);
  // 允许在“尚无节点”时也进入画布视图（例如 smart 空输入的推荐列表）
  const [forceCanvasView, setForceCanvasView] = useState(false);
  // 仅首次空白进入显示首页；进入过画布后即使删空节点也保持画布视图。
  const [hasEnteredCanvasView, setHasEnteredCanvasView] = useState(false);
  const [initWorkDialogShow, setInitWorkDialogShow] = useState(false);
  const [historyDialogShow, setHistoryDialogShow] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [currentChain, setCurrentChain] = useState<ParentNode | null>(null);
  const [canvasViewportWidth, setCanvasViewportWidth] = useState(0);
  // 是否在画布中
  const [canvasReady, setCanvasReady] = useState(false);
  // “随机选题创建”的 3 张脑洞卡占位（用于接口返回后回填）
  const brainstormBatchIdsRef = useRef<string[]>([]);
  // 脑洞生成进度（0~100），用于卡片 loading UI
  const brainstormProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const brainstormProgressValueRef = useRef(0);
  const loadingProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingProgressValueRef = useRef(0);
  const loadingProgressNodeIdsRef = useRef<string[]>([]);
  const outlineCompletionCelebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outlineCompletionMessageRef = useRef<HTMLDivElement | null>(null);
  const outlineCompletionConfettiFrameRef = useRef<number | null>(null);
  const handleGenerateInsRef = useRef<
    | ((
      requestType: "auto" | "manual",
      ideaOverride?: string,
      outputTypeOverride?: CanvasOutputType,
      sourceNodeId?: string,
      filesOverride?: Record<string, string>,
      contextActionLabelOverride?: string,
      requestSourceOverride?: "default" | "carousel",
      resetOutputTypeAfterFinish?: boolean,
      includeDialogReferencesOverride?: boolean,
      clearDialogPreviewsAfterRequestOverride?: boolean
    ) => void | Promise<void>)
    | null
  >(null);

  const getNextCanvasNodeId = useCallback((prefix: string) => {
    canvasNodeIdSeqRef.current += 1;
    return `${prefix}-${Date.now()}-${canvasNodeIdSeqRef.current}`;
  }, []);
  const updateCanvasViewportWidth = useCallback(() => {
    const nextWidth = containerRef.current?.clientWidth ?? 0;
    setCanvasViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, []);
  const shouldHideCanvasAuxControls =
    canvasViewportWidth > 0 && canvasViewportWidth < 960;

  const launchOutlineCompletionConfetti = useCallback(() => {
    const messageRect = outlineCompletionMessageRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const originX = messageRect
      ? Math.min(1, Math.max(0, (messageRect.left + messageRect.width / 2) / viewportWidth))
      : 0.5;
    const originY = messageRect
      ? Math.min(1, Math.max(0, (messageRect.top - 8) / viewportHeight))
      : 0.8;

    void import("canvas-confetti")
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 150,
          angle: 90,
          spread: 70,
          startVelocity: 30,
          decay: 0.9,
          origin: { x: originX, y: originY },
          colors: ["#ff5252", "#ff4081", "#7c4dff", "#64b5f6", "#4caf50"],
          ticks: 200,
          gravity: 0.8,
        });
      })
      .catch(() => undefined);
  }, []);

  const triggerOutlineCompletionCelebration = useCallback(() => {
    if (outlineCompletionCelebrationTimerRef.current) {
      clearTimeout(outlineCompletionCelebrationTimerRef.current);
      outlineCompletionCelebrationTimerRef.current = null;
    }
    setOutlineCompletionCelebrationVisible(true);
    outlineCompletionCelebrationTimerRef.current = setTimeout(() => {
      outlineCompletionCelebrationTimerRef.current = null;
      setOutlineCompletionCelebrationVisible(false);
    }, 5200);
  }, [launchOutlineCompletionConfetti]);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);
  const ensureInspirationDrawId = useCallback(async (): Promise<string> => {
    const existingId = String(inspirationDrawId || "").trim();
    if (existingId) return existingId;
    if (!workId) return "";

    if (!ensureDrawIdPromiseRef.current) {
      ensureDrawIdPromiseRef.current = (async () => {
        const res: any = await generateInspirationDrawIdReq(workId, {
          nodes: nodesRef.current as unknown[],
          edges: edgesRef.current as unknown[],
        });
        const nextId = String(res?.id || "").trim();
        if (!nextId) return "";
        if (!isUnmountingRef.current) {
          setInspirationDrawId(nextId);
        }
        return nextId;
      })().finally(() => {
        ensureDrawIdPromiseRef.current = null;
      });
    }

    return ensureDrawIdPromiseRef.current;
  }, [inspirationDrawId, workId]);

  const saveCanvasSilently = useCallback(async () => {
    const summary = summarizeCanvasPersistenceState(
      nodesRef.current,
      edgesRef.current as CustomEdge[]
    );
    if (shouldBlockCanvasPersistence(summary)) {
      pendingStablePersistenceRef.current = true;
      return;
    }

    const drawId = await ensureInspirationDrawId();
    if (!drawId) return;
    await saveInspirationCanvasReq(drawId, {
      nodes: nodesRef.current as unknown[],
      edges: edgesRef.current as unknown[],
    });
  }, [ensureInspirationDrawId, inspirationDrawId, workId]);
  const saveCanvasSilentlyRef = useRef(saveCanvasSilently);
  saveCanvasSilentlyRef.current = saveCanvasSilently;

  const flushCanvasPersistence = useCallback(async () => {
    if (canvasAutoSaveTimerRef.current) {
      window.clearTimeout(canvasAutoSaveTimerRef.current);
      canvasAutoSaveTimerRef.current = null;
    }
    await saveCanvasSilently();
  }, [inspirationDrawId, saveCanvasSilently, workId]);

  const scheduleCanvasAutoSave = useCallback((delayMs = 500) => {
    if (!workId || canvasAutoSaveSuppressedRef.current) return;
    if (canvasAutoSaveTimerRef.current) {
      window.clearTimeout(canvasAutoSaveTimerRef.current);
    }
    canvasAutoSaveTimerRef.current = window.setTimeout(() => {
      canvasAutoSaveTimerRef.current = null;
      void saveCanvasSilently().catch(() => { });
    }, delayMs);
  }, [inspirationDrawId, saveCanvasSilently, workId]);

  useEffect(() => {
    if (!pendingStablePersistenceRef.current) return;
    if (!workId) return;
    if (canvasAutoSaveSuppressedRef.current) return;

    const summary = summarizeCanvasPersistenceState(
      nodesRef.current,
      edgesRef.current as CustomEdge[]
    );
    if (shouldBlockCanvasPersistence(summary)) return;

    pendingStablePersistenceRef.current = false;
    scheduleCanvasAutoSave(0);
  }, [edges, inspirationDrawId, nodes, scheduleCanvasAutoSave, workId]);

  useEffect(() => {
    isUnmountingRef.current = false;
    return () => {
      isUnmountingRef.current = true;
      if (canvasAutoSaveTimerRef.current) {
        window.clearTimeout(canvasAutoSaveTimerRef.current);
        canvasAutoSaveTimerRef.current = null;
        void saveCanvasSilentlyRef.current?.().catch(() => { });
      }
    };
  }, [inspirationDrawId, workId]);

  const relayoutGroupsForNodeIds = useCallback((
    currentNodes: CustomNode[],
    nodeIds: string[],
    options?: Omit<GroupRelayoutOptions, "currentEdges">
  ) => {
    if (!nodeIds.length) return currentNodes;

    const groupIds = Array.from(
      new Set(
        nodeIds
          .map((nodeId) => currentNodes.find((node) => node.id === nodeId))
          .map((node) => getCanvasNodeGroupId(node))
          .filter(Boolean)
      )
    );

    if (!groupIds.length) return currentNodes;

    let nextNodes = currentNodes;
    groupIds.forEach((groupId) => {
      const beforeGroupNode = nextNodes.find((node) => node.id === groupId);
      const beforeHeight = beforeGroupNode
        ? Number((beforeGroupNode.style as any)?.height ?? getCanvasNodeLayoutSize(beforeGroupNode).height)
        : 0;

      nextNodes = compactGroupNodes(nextNodes, groupId, {
        ...options,
        currentEdges: edgesRef.current as CustomEdge[],
      });

      const afterGroupNode = nextNodes.find((node) => node.id === groupId);
      const afterHeight = afterGroupNode
        ? Number((afterGroupNode.style as any)?.height ?? getCanvasNodeLayoutSize(afterGroupNode).height)
        : beforeHeight;
      const heightDelta = Math.max(0, afterHeight - beforeHeight);
      if (heightDelta > 0 && options?.shiftOtherTopLevelNodes !== false) {
        nextNodes = shiftDownstreamTopLevelNodes(
          nextNodes,
          edgesRef.current as CustomEdge[],
          groupId,
          heightDelta
        );
      }
    });

    return nextNodes;
  }, []);

  const scheduleGroupMeasureRelayout = useCallback((
    groupId: string,
    options?: Omit<GroupRelayoutOptions, "currentEdges">
  ) => {
    if (!groupId) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setNodes((prev) => {
          const beforeGroupNode = prev.find((node) => node.id === groupId);
          const beforeHeight = beforeGroupNode
            ? Number((beforeGroupNode.style as any)?.height ?? getCanvasNodeLayoutSize(beforeGroupNode).height)
            : 0;
          let nextNodes = compactGroupNodes(prev as CustomNode[], groupId, {
            ...options,
            currentEdges: edgesRef.current as CustomEdge[],
          });
          const afterGroupNode = nextNodes.find((node) => node.id === groupId);
          const afterHeight = afterGroupNode
            ? Number((afterGroupNode.style as any)?.height ?? getCanvasNodeLayoutSize(afterGroupNode).height)
            : beforeHeight;
          const heightDelta = Math.max(0, afterHeight - beforeHeight);
          if (heightDelta > 0 && options?.shiftOtherTopLevelNodes !== false) {
            nextNodes = shiftDownstreamTopLevelNodes(
              nextNodes,
              edgesRef.current as CustomEdge[],
              groupId,
              heightDelta
            );
          }
          nodesRef.current = nextNodes;
          return nextNodes;
        });
      });
    });
  }, [setNodes]);

  const onNodesChange = useCallback((changes: any[]) => {
    setNodes((prev) => {
      const appliedNodes = applyNodeChanges(changes, prev) as CustomNode[];
      const positionChanges = changes.filter((change) => change?.type === "position");
      const movedNodeIds = positionChanges
        .map((change) => String(change.id ?? ""))
        .filter(Boolean);

      if (!movedNodeIds.length) {
        nodesRef.current = appliedNodes;
        return appliedNodes;
      }

      const hasGroupedChildMove = movedNodeIds.some((nodeId) => {
        const node = appliedNodes.find((candidate) => candidate.id === nodeId);
        return Boolean(getCanvasNodeGroupId(node));
      });

      if (!hasGroupedChildMove) {
        nodesRef.current = appliedNodes;
        return appliedNodes;
      }

      const clampedNodes = clampGroupedChildNodePositions(appliedNodes, movedNodeIds);
      const isDraggingGroupedChild = positionChanges.some((change) => {
        if (change?.dragging !== true) return false;
        const nodeId = String(change.id ?? "");
        const node = clampedNodes.find((candidate) => candidate.id === nodeId);
        return Boolean(getCanvasNodeGroupId(node));
      });

      if (isDraggingGroupedChild) {
        const draggingGroupedNodeId =
          positionChanges.find((change) => {
            if (change?.dragging !== true) return false;
            const nodeId = String(change.id ?? "");
            const node = clampedNodes.find((candidate) => candidate.id === nodeId);
            return Boolean(getCanvasNodeGroupId(node));
          })?.id ?? "";
        const previewNodes = previewGroupedSiblingPositions(
          clampedNodes,
          String(draggingGroupedNodeId)
        );
        nodesRef.current = previewNodes;
        return previewNodes;
      }

      const relayoutNodes = relayoutGroupsForNodeIds(clampedNodes, movedNodeIds);
      nodesRef.current = relayoutNodes;
      return relayoutNodes;
    });
  }, [relayoutGroupsForNodeIds, setNodes]);

  const handleNodeDragStop = useCallback(() => {
    scheduleCanvasAutoSave(300);
  }, [scheduleCanvasAutoSave]);

  useEffect(() => {
    return () => {
      if (outlineCompletionCelebrationTimerRef.current) {
        clearTimeout(outlineCompletionCelebrationTimerRef.current);
        outlineCompletionCelebrationTimerRef.current = null;
      }
      if (outlineCompletionConfettiFrameRef.current !== null) {
        cancelAnimationFrame(outlineCompletionConfettiFrameRef.current);
        outlineCompletionConfettiFrameRef.current = null;
      }
      if (loadingProgressTimerRef.current) {
        clearInterval(loadingProgressTimerRef.current);
        loadingProgressTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!outlineCompletionCelebrationVisible) return;

    const firstFrame = requestAnimationFrame(() => {
      const secondFrame = requestAnimationFrame(() => {
        outlineCompletionConfettiFrameRef.current = null;
        launchOutlineCompletionConfetti();
      });
      outlineCompletionConfettiFrameRef.current = secondFrame;
    });
    outlineCompletionConfettiFrameRef.current = firstFrame;

    return () => {
      if (outlineCompletionConfettiFrameRef.current !== null) {
        cancelAnimationFrame(outlineCompletionConfettiFrameRef.current);
        outlineCompletionConfettiFrameRef.current = null;
      }
    };
  }, [launchOutlineCompletionConfetti, outlineCompletionCelebrationVisible]);

  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const normalized = withVerticalPorts(node);
        if (normalized !== node) changed = true;
        return normalized;
      });
      return changed ? next : prev;
    });
  }, [nodes, setNodes]);

  const stopBrainstormProgress = useCallback((finalValue?: number) => {
    if (brainstormProgressTimerRef.current) {
      clearInterval(brainstormProgressTimerRef.current);
      brainstormProgressTimerRef.current = null;
    }
    if (typeof finalValue === "number") {
      brainstormProgressValueRef.current = finalValue;
      const ids = brainstormBatchIdsRef.current;
      if (ids?.length) {
        setNodes((prev) =>
          prev.map((n) =>
            ids.includes(n.id)
              ? { ...n, data: { ...(n.data as any), progress: finalValue } }
              : n
          )
        );
      }
    }
  }, [setNodes]);

  const clearBrainstormPlaceholderBatch = useCallback(() => {
    const ids = [...brainstormBatchIdsRef.current];
    stopBrainstormProgress();
    brainstormProgressValueRef.current = 0;
    brainstormBatchIdsRef.current = [];
    if (!ids.length) return;

    setNodes((prev) => prev.filter((node) => !ids.includes(node.id)));
    setEdges((prev) =>
      (prev as CustomEdge[]).filter(
        (edge) => !ids.includes(edge.source) && !ids.includes(edge.target)
      )
    );
  }, [setEdges, setNodes, stopBrainstormProgress]);

  const stopLoadingProgress = useCallback((finalValue?: number) => {
    if (loadingProgressTimerRef.current) {
      clearInterval(loadingProgressTimerRef.current);
      loadingProgressTimerRef.current = null;
    }
    if (typeof finalValue === "number") {
      const ids = loadingProgressNodeIdsRef.current;
      if (ids.length) {
        setNodes((prev) =>
          prev.map((node) =>
            ids.includes(node.id)
              ? { ...node, data: { ...(node.data as any), progress: finalValue } }
              : node
          )
        );
      }
      loadingProgressValueRef.current = finalValue;
    }
    loadingProgressNodeIdsRef.current = [];
  }, [setNodes]);

  const startLoadingProgressForNodes = useCallback((nodeIds: string[]) => {
    const normalizedIds = Array.from(
      new Set(nodeIds.map((id) => getTextValue(id)).filter(Boolean))
    );
    if (!normalizedIds.length) return;

    if (loadingProgressNodeIdsRef.current.length === 0) {
      loadingProgressValueRef.current = 0;
    }

    loadingProgressNodeIdsRef.current = Array.from(
      new Set([...loadingProgressNodeIdsRef.current, ...normalizedIds])
    );

    const currentProgress = loadingProgressValueRef.current;
    if (currentProgress > 0) {
      setNodes((prev) =>
        prev.map((node) =>
          loadingProgressNodeIdsRef.current.includes(node.id)
            ? {
              ...node,
              data: {
                ...(node.data as any),
                progress: Math.max(
                  currentProgress,
                  Number((node.data as any)?.progress ?? 0)
                ),
              },
            }
            : node
        )
      );
    }

    if (!loadingProgressTimerRef.current) {
      loadingProgressTimerRef.current = setInterval(() => {
        const cur = loadingProgressValueRef.current;
        const next = Math.min(92, cur + (cur < 30 ? 3 : cur < 70 ? 2 : 1));
        if (next === cur) return;
        loadingProgressValueRef.current = next;
        const ids = loadingProgressNodeIdsRef.current;
        if (!ids.length) return;
        setNodes((prev) =>
          prev.map((node) =>
            ids.includes(node.id)
              ? { ...node, data: { ...(node.data as any), progress: next } }
              : node
          )
        );
      }, 120);
    }
  }, [setNodes]);

  const finishLoadingProgressForNode = useCallback((nodeId?: string, finalValue = 100) => {
    const normalizedNodeId = getTextValue(nodeId);
    if (!normalizedNodeId) return;

    loadingProgressNodeIdsRef.current = loadingProgressNodeIdsRef.current.filter(
      (id) => id !== normalizedNodeId
    );
    if (!loadingProgressNodeIdsRef.current.length && loadingProgressTimerRef.current) {
      clearInterval(loadingProgressTimerRef.current);
      loadingProgressTimerRef.current = null;
      loadingProgressValueRef.current = finalValue;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdeaPlaceholderIndex((prev) => (prev + 1) % IDEA_PLACEHOLDER_OPTIONS.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const tree = useMemo(() => convertToTreeStructure(nodes, edges), [nodes, edges]);
  const currentIdeaPlaceholder = (!tree?.length && !forceCanvasView)
    ? (IDEA_PLACEHOLDER_OPTIONS[ideaPlaceholderIndex] ?? IDEA_PLACEHOLDER_OPTIONS[0])
    : "请输入指令...";

  const applyCanvasMode = useCallback((mode: "smart" | "brainstorm" | "fast") => {
    setGenerateMode(mode);
    setCanvasModeCategory("smart");
    if (mode === "smart") {
      setCanvasOutputType("auto");
      setCanvasModelType("max");
    } else if (mode === "brainstorm") {
      setCanvasOutputType("brainstorm");
      setCanvasModelType("max");
    } else {
      setCanvasModelType("fast");
    }
  }, []);

  const handleOutputTypeChange = useCallback((next: CanvasOutputType) => {
    setCanvasOutputType(next);
    if (canvasModelType === "fast") return;
    setGenerateMode(next === "brainstorm" ? "brainstorm" : "smart");
  }, [canvasModelType]);

  const handleModeCategoryChange = useCallback((next: CanvasModeCategory) => {
    setCanvasModeCategory(next);
    if (next !== "smart") return;
    if (canvasModelType === "fast") {
      setGenerateMode("fast");
      return;
    }
    setGenerateMode(canvasOutputType === "brainstorm" ? "brainstorm" : "smart");
  }, [canvasModelType, canvasOutputType]);

  const handleModelTypeChange = useCallback((next: CanvasModelType) => {
    setCanvasModelType(next);
    if (next === "fast") {
      setGenerateMode("fast");
      return;
    }
    if (canvasModeCategory !== "smart") {
      setGenerateMode("smart");
      return;
    }
    setGenerateMode(canvasOutputType === "brainstorm" ? "brainstorm" : "smart");
  }, [canvasModeCategory, canvasOutputType]);

  const modeButtonLabel = useMemo(
    () => MODE_CATEGORY_OPTIONS.find((item) => item.key === canvasModeCategory)?.label ?? "智能模式",
    [canvasModeCategory]
  );
  const outputButtonLabel = useMemo(
    () =>
      canvasOutputType === "auto"
        ? "自动"
        : OUTPUT_TYPE_OPTIONS.find((item) => item.key === canvasOutputType)?.label ?? "自动",
    [canvasOutputType]
  );
  const modelButtonLabel = useMemo(
    () => MODEL_TYPE_OPTIONS.find((item) => item.key === canvasModelType)?.label ?? "Max",
    [canvasModelType]
  );

  const openSettingsPopover = useCallback((section: SettingsSection) => {
    setActiveSettingsSection(section);
    setSettingsPopoverOpen(true);
  }, []);

  const syncReqPanelTextRefs = useCallback((
    detail: string,
    body: string,
    footer: string
  ) => {
    reqPanelDetailRef.current = detail;
    reqPanelBodyDetailRef.current = body;
    reqPanelFooterDetailRef.current = footer;
    setReqPanelDetail(detail);
    setReqPanelBodyDetail(body);
    setReqPanelFooterDetail(footer);
  }, []);

  const resetReqPanelTextRefs = useCallback(() => {
    syncReqPanelTextRefs("", "", "");
  }, [syncReqPanelTextRefs]);

  const syncCreationIdeaContent = useCallback((content: string) => {
    const normalizedContent = content.trim();
    creationIdeaContentRef.current = normalizedContent;
    setCreationIdeaContent(normalizedContent);
  }, []);

  const mergeCreationIdeaIntoFiles = useCallback((files?: Record<string, string>) => {
    const latestCreationIdea =
      creationIdeaContentRef.current.trim() || creationIdeaContent.trim();
    if (!latestCreationIdea) return files;
    return {
      ...(files || {}),
      "/创作想法.md": latestCreationIdea,
    };
  }, [creationIdeaContent]);

  const syncReqPanelWithCreationIdea = useCallback((
    detail: string,
    body: string,
    footer: string,
    nextCreationIdea?: string
  ) => {
    const resolvedCreationIdea =
      typeof nextCreationIdea === "string"
        ? nextCreationIdea.trim()
        : (creationIdeaContentRef.current.trim() || creationIdeaContent.trim());
    syncReqPanelTextRefs(detail, resolvedCreationIdea || body, footer);
  }, [creationIdeaContent, syncReqPanelTextRefs]);

  const resetGenerationSettings = useCallback(() => {
    setIdeaContent("");
    setIdeaInputSource("default");
    setGenerateMode("smart");
    setCanvasModeCategory("smart");
    setSettingsPopoverOpen(false);
    setActiveSettingsSection("mode");
    setCanvasOutputType("auto");
    setCanvasModelType("max");
  }, []);

  const { zoomIn, zoomOut, setCenter, getViewport, getNode, screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    if (hasInitialSnapshotFittedRef.current) return;
    if (nodes.length === 0) return;
    hasInitialSnapshotFittedRef.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void fitView({ duration: 500, padding: 0.2 });
      });
    });
  }, [fitView, nodes.length]);

  const rememberLatestGeneratedNode = useCallback((nodeId?: string) => {
    const normalizedNodeId = getTextValue(nodeId);
    latestGeneratedNodeIdRef.current = normalizedNodeId;
    setLatestGeneratedNodeId(normalizedNodeId);
  }, []);

  const buildDialogReferenceFilePath = useCallback((
    filePath: string,
    label: string,
    title: string,
    nodeId: string
  ) => {
    const normalizedFilePath = getTextValue(filePath).trim();
    if (normalizedFilePath) {
      return normalizedFilePath.startsWith("/") ? normalizedFilePath : `/${normalizedFilePath}`;
    }
    const safeLabel = (label || "引用卡片").replace(/[\\:*?"<>|]/g, "-").trim() || "引用卡片";
    const safeTitle = (title || safeLabel).replace(/[\\:*?"<>|]/g, "-").trim() || safeLabel;
    return `/[${safeLabel}]/${safeTitle}-${nodeId}.md`;
  }, []);

  const mergeFileRecords = useCallback((
    ...sources: Array<Record<string, string> | undefined>
  ) => {
    const merged: Record<string, string> = {};
    sources.forEach((source) => {
      if (!source) return;
      Object.entries(source).forEach(([filePath, fileContent]) => {
        const normalizedPath = getTextValue(filePath).trim();
        if (!normalizedPath) return;
        merged[normalizedPath] = getTextValue(fileContent);
      });
    });
    return Object.keys(merged).length > 0 ? merged : undefined;
  }, []);

  const persistGeneratedWriteFiles = useCallback((writeFiles: CanvasWriteFileCall[]) => {
    if (!writeFiles.length) return;
    writeFiles.forEach((item) => {
      const filePath = getTextValue(item.filePath).trim();
      if (!filePath) return;
      generatedWriteFilesRef.current[filePath] = getTextValue(item.content);
    });
  }, []);

  const getDialogReferenceSnapshot = useCallback((nodeId: string) => {
    const currentNode = nodesRef.current.find((node) => node.id === nodeId);
    if (!currentNode) return null;

    const label = getTextValue(currentNode.data?.label) || "卡片";
    const title =
      getTextValue((currentNode.data as any)?.title) ||
      getTextValue(currentNode.data?.inspirationTheme) ||
      label;
    const filePath = buildDialogReferenceFilePath(
      getTextValue((currentNode.data as any)?.filePath),
      label,
      title,
      nodeId
    );
    const content =
      getTextValue(currentNode.data?.content) ||
      generatedWriteFilesRef.current[filePath] ||
      generatedWriteFilesRef.current[filePath.replace(/^\//, "")] ||
      "";

    return {
      nodeId,
      label,
      title,
      filePath,
      content,
    };
  }, [buildDialogReferenceFilePath]);

  const getDialogReferenceFiles = useCallback((items: DialogReferenceCard[]) => {
    const files: Record<string, string> = {};
    items.forEach((item) => {
      const snapshot = getDialogReferenceSnapshot(item.nodeId);
      if (!snapshot?.filePath || !snapshot.content.trim()) return;
      files[snapshot.filePath] = snapshot.content;
    });
    return Object.keys(files).length > 0 ? files : undefined;
  }, [getDialogReferenceSnapshot]);

  const getConnectedContextFiles = useCallback((targetId: string) => {
    const normalizedTargetId = getTextValue(targetId);
    if (!normalizedTargetId) return undefined;

    const latestNodes = nodesRef.current;
    const latestEdges = edgesRef.current as CustomEdge[];
    const nodeMap = new Map(latestNodes.map((node) => [node.id, node]));
    const adjacency = new Map<string, Set<string>>();
    const files: Record<string, string> = {};

    const connect = (from: string, to: string) => {
      const normalizedFrom = getTextValue(from);
      const normalizedTo = getTextValue(to);
      if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;
      if (!adjacency.has(normalizedFrom)) adjacency.set(normalizedFrom, new Set());
      if (!adjacency.has(normalizedTo)) adjacency.set(normalizedTo, new Set());
      adjacency.get(normalizedFrom)?.add(normalizedTo);
      adjacency.get(normalizedTo)?.add(normalizedFrom);
    };

    latestEdges.forEach((edge) => {
      connect(String(edge.source ?? ""), String(edge.target ?? ""));
    });

    latestNodes.forEach((node) => {
      const parentGroupId =
        getTextValue(node.parentId) ||
        getTextValue((node.data as any)?.roleGroupId) ||
        getTextValue((node.data as any)?.outlineGroupId);
      if (parentGroupId) {
        connect(node.id, parentGroupId);
      }
    });

    const visited = new Set<string>();
    const queue: string[] = [normalizedTargetId];

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodeMap.get(currentId);
      if (
        currentNode &&
        currentNode.type !== "roleGroup" &&
        currentNode.type !== OUTLINE_GROUP_SETTINGS_NODE_TYPE
      ) {
        const snapshot = getDialogReferenceSnapshot(currentId);
        if (snapshot?.filePath && snapshot.content.trim()) {
          files[snapshot.filePath] = snapshot.content;
        }
      }

      adjacency.get(currentId)?.forEach((relatedId) => {
        if (!visited.has(relatedId)) {
          queue.push(relatedId);
        }
      });
    }

    return Object.keys(files).length > 0 ? files : undefined;
  }, [getDialogReferenceSnapshot]);

  const getAbsoluteNodePosition = useCallback((nodeId: string) => {
    const latestNodes = nodesRef.current;
    const nodeMap = new Map(latestNodes.map((node) => [node.id, node]));
    const visit = (currentNodeId: string): { x: number; y: number } => {
      const currentNode = nodeMap.get(currentNodeId);
      if (!currentNode) return { x: 0, y: 0 };
      const parentPosition = currentNode.parentId
        ? visit(currentNode.parentId)
        : { x: 0, y: 0 };
      return {
        x: parentPosition.x + (currentNode.position?.x ?? 0),
        y: parentPosition.y + (currentNode.position?.y ?? 0),
      };
    };
    return visit(nodeId);
  }, []);

  const resolveLocateTargetNodeId = useCallback((nodeId: string, preferGroup = true) => {
    const normalizedNodeId = getTextValue(nodeId);
    if (!normalizedNodeId) return "";
    if (!preferGroup) return normalizedNodeId;

    const latestNodes = nodesRef.current;
    const targetNode = latestNodes.find((node) => node.id === normalizedNodeId);
    if (!targetNode) return normalizedNodeId;

    const parentGroupId =
      getTextValue(targetNode.parentId) ||
      getTextValue((targetNode.data as any)?.roleGroupId) ||
      getTextValue((targetNode.data as any)?.outlineGroupId);
    if (!parentGroupId) return normalizedNodeId;

    const parentGroupNode = latestNodes.find(
      (node) => node.id === parentGroupId && node.type === "roleGroup"
    );
    return parentGroupNode?.id || normalizedNodeId;
  }, []);

  const focusCanvasNode = useCallback((
    nodeId: string,
    options?: { zoom?: number; duration?: number; preferGroup?: boolean }
  ) => {
    const normalizedNodeId = resolveLocateTargetNodeId(nodeId, options?.preferGroup ?? true);
    if (!normalizedNodeId) return;

    const latestNodes = nodesRef.current;
    const targetNode = latestNodes.find((node) => node.id === normalizedNodeId);
    const internalNode = getNode(normalizedNodeId) as any;
    if (!targetNode && !internalNode) return;

    const absolutePosition =
      internalNode?.internals?.positionAbsolute ||
      internalNode?.positionAbsolute ||
      getAbsoluteNodePosition(normalizedNodeId);
    const width = Number(
      internalNode?.measured?.width ??
      internalNode?.width ??
      (targetNode as any)?.measured?.width ??
      (targetNode as any)?.style?.width ??
      300
    );
    const height = Number(
      internalNode?.measured?.height ??
      internalNode?.height ??
      (targetNode as any)?.measured?.height ??
      (targetNode as any)?.style?.height ??
      240
    );

    setNodes((prev) =>
      prev.map((node) =>
        node.id === normalizedNodeId
          ? { ...node, data: { ...node.data, highlighted: true } as any }
          : node
      )
    );

    const existingHighlightTimer = locateHighlightTimersRef.current.get(normalizedNodeId);
    if (existingHighlightTimer) {
      clearTimeout(existingHighlightTimer);
    }
    const nextHighlightTimer = setTimeout(() => {
      locateHighlightTimersRef.current.delete(normalizedNodeId);
      setNodes((prev) =>
        prev.map((node) =>
          node.id === normalizedNodeId
            ? { ...node, data: { ...node.data, highlighted: false } as any }
            : node
        )
      );
    }, 1800);
    locateHighlightTimersRef.current.set(normalizedNodeId, nextHighlightTimer);

    void setCenter(
      (absolutePosition?.x ?? 0) + width / 2,
      (absolutePosition?.y ?? 0) + height / 2,
      { zoom: options?.zoom ?? 0.95, duration: options?.duration ?? 500 } as any
    );
  }, [getAbsoluteNodePosition, getNode, resolveLocateTargetNodeId, setCenter, setNodes]);

  const focusCanvasNodeWhenReady = useCallback((
    nodeId?: string,
    options?: { zoom?: number; duration?: number; maxAttempts?: number; preferGroup?: boolean }
  ) => {
    const normalizedNodeId = getTextValue(nodeId);
    if (!normalizedNodeId) return;

    const maxAttempts = Math.max(1, options?.maxAttempts ?? 12);
    const attemptFocus = (attempt: number) => {
      const latestNodes = nodesRef.current;
      const hasTargetNode = latestNodes.some((node) => node.id === normalizedNodeId);

      if (hasTargetNode || attempt >= maxAttempts) {
        focusCanvasNode(normalizedNodeId, options);
        return;
      }

      requestAnimationFrame(() => {
        attemptFocus(attempt + 1);
      });
    };

    requestAnimationFrame(() => {
      attemptFocus(0);
    });
  }, [focusCanvasNode]);

  const normalizeCanvasFilePath = useCallback((value: unknown) => {
    const normalized = getTextValue(value).trim().replace(/\\/g, "/").replace(/^\/+/, "");
    return normalized;
  }, []);

  const focusFileByPath = useCallback((
    filePath: string,
    options?: { zoom?: number; duration?: number; maxAttempts?: number }
  ) => {
    const normalizedPath = normalizeCanvasFilePath(filePath);
    if (!normalizedPath) return false;
    const suffixPath = `/${normalizedPath}`;
    const syncPathNodeIdMap = buildCanvasSyncFileNodeIdMap(nodesRef.current);
    const syncPathMatchedNodeId =
      syncPathNodeIdMap[normalizedPath] ||
      Object.entries(syncPathNodeIdMap).find(([syncPath]) => syncPath.endsWith(suffixPath))?.[1] ||
      "";
    if (syncPathMatchedNodeId) {
      focusCanvasNodeWhenReady(syncPathMatchedNodeId, {
        ...options,
        preferGroup: false,
      });
      return true;
    }

    const reversedNodes = [...nodesRef.current].reverse();
    const matchesPath = (candidate: string) =>
      !!candidate && (candidate === normalizedPath || candidate.endsWith(suffixPath));
    const targetNode =
      reversedNodes.find((node) => {
        const nodeFilePath = normalizeCanvasFilePath((node.data as any)?.filePath);
        return nodeFilePath === normalizedPath;
      }) ||
      reversedNodes.find((node) => {
        const nodeFilePath = normalizeCanvasFilePath((node.data as any)?.filePath);
        return matchesPath(nodeFilePath);
      }) ||
      reversedNodes.find((node) => {
        const nodeIdPath = normalizeCanvasFilePath(node.id);
        return matchesPath(nodeIdPath);
      });

    if (!targetNode) return false;
    focusCanvasNodeWhenReady(targetNode.id, {
      ...options,
      preferGroup: false,
    });
    return true;
  }, [focusCanvasNodeWhenReady, normalizeCanvasFilePath]);

  const syncFileContentByPath = useCallback((filePath: string, content: string) => {
    const normalizedPath = normalizeCanvasFilePath(filePath);
    if (!normalizedPath) return false;

    const suffixPath = `/${normalizedPath}`;
    const syncPathNodeIdMap = buildCanvasSyncFileNodeIdMap(nodesRef.current);
    const matchedNodeId =
      syncPathNodeIdMap[normalizedPath] ||
      Object.entries(syncPathNodeIdMap).find(([syncPath]) => syncPath.endsWith(suffixPath))?.[1] ||
      "";
    let didUpdate = false;

    setNodes((prev) =>
      prev.map((node) => {
        const isMatchedBySyncPath = matchedNodeId ? node.id === matchedNodeId : false;
        const nodeFilePath = normalizeCanvasFilePath((node.data as any)?.filePath);
        const isMatchedByFilePath =
          !!nodeFilePath &&
          (nodeFilePath === normalizedPath || nodeFilePath.endsWith(suffixPath));
        const isMatched = isMatchedBySyncPath || isMatchedByFilePath;
        if (!isMatched) return node;

        const nextContent = String(content ?? "");
        // 命中 sync-path（由 tree/currentEditingId 驱动）时，优先将节点 filePath 对齐到该路径。
        // 这样在重命名/拖拽后，卡片保存不会继续回写旧路径，避免出现重复文件。
        const nextNodeFilePath = isMatchedBySyncPath
          ? normalizedPath
          : nodeFilePath;
        const shouldUpdateContent = String(node.data?.content ?? "") !== nextContent;
        const shouldUpdateFilePath =
          Boolean(nextNodeFilePath) &&
          getTextValue((node.data as any)?.filePath).trim() !== nextNodeFilePath;
        if (!shouldUpdateContent && !shouldUpdateFilePath) return node;

        didUpdate = true;
        return {
          ...node,
          data: {
            ...node.data,
            ...(shouldUpdateContent ? { content: nextContent } : {}),
            ...(shouldUpdateFilePath ? { filePath: nextNodeFilePath } : {}),
          },
        };
      })
    );

    return didUpdate;
  }, [normalizeCanvasFilePath, setNodes]);

  const syncFilePathByRename = useCallback((oldPath: string, newPath: string) => {
    const normalizedOldPath = normalizeCanvasFilePath(oldPath);
    const normalizedNewPath = normalizeCanvasFilePath(newPath);
    if (!normalizedOldPath || !normalizedNewPath) return false;

    let didUpdate = false;
    setNodes((prev) =>
      prev.map((node) => {
        const nodeFilePath = normalizeCanvasFilePath((node.data as any)?.filePath);
        if (!nodeFilePath) return node;

        const isExactMatch = nodeFilePath === normalizedOldPath;
        const isDirectorySubPathMatch = nodeFilePath.startsWith(`${normalizedOldPath}/`);
        if (!isExactMatch && !isDirectorySubPathMatch) return node;

        const nextNodeFilePath = isExactMatch
          ? normalizedNewPath
          : `${normalizedNewPath}/${nodeFilePath.slice(normalizedOldPath.length + 1)}`;
        if (!nextNodeFilePath || nextNodeFilePath === nodeFilePath) return node;

        didUpdate = true;
        return {
          ...node,
          data: {
            ...node.data,
            filePath: nextNodeFilePath,
          },
        };
      })
    );

    return didUpdate;
  }, [normalizeCanvasFilePath, setNodes]);

  const focusNewlyCreatedBlankNode = useCallback((nodeId?: string) => {
    const normalizedNodeId = getTextValue(nodeId);
    if (!normalizedNodeId) return;

    rememberLatestGeneratedNode(normalizedNodeId);
    focusCanvasNodeWhenReady(normalizedNodeId, { zoom: 0.95, duration: 500 });
  }, [focusCanvasNodeWhenReady, rememberLatestGeneratedNode]);

  const connectReferenceNodesToTargets = useCallback((
    sourceNodeIds: string[],
    targetNodeIds: string[]
  ) => {
    const normalizedSourceIds = Array.from(
      new Set(sourceNodeIds.map((id) => getTextValue(id)).filter(Boolean))
    );
    const normalizedTargetIds = Array.from(
      new Set(targetNodeIds.map((id) => getTextValue(id)).filter(Boolean))
    );
    if (!normalizedSourceIds.length || !normalizedTargetIds.length) return;

    setEdges((prev) => {
      const latestNodes = nodesRef.current;
      const isContainerToOwnChildEdge = (sourceId: string, targetId: string) => {
        const sourceNode = latestNodes.find((node) => node.id === sourceId);
        const targetNode = latestNodes.find((node) => node.id === targetId);
        if (!sourceNode || !targetNode) return false;

        const sourceGroupId =
          getTextValue(sourceNode.parentId) ||
          getTextValue((sourceNode.data as any)?.roleGroupId) ||
          getTextValue((sourceNode.data as any)?.outlineGroupId);
        const targetGroupId =
          getTextValue(targetNode.parentId) ||
          getTextValue((targetNode.data as any)?.roleGroupId) ||
          getTextValue((targetNode.data as any)?.outlineGroupId);

        const sourceIsGroupContainer = sourceNode.type === "roleGroup";
        const targetIsGroupContainer = targetNode.type === "roleGroup";

        return (
          (sourceIsGroupContainer && targetGroupId === sourceId) ||
          (targetIsGroupContainer && sourceGroupId === targetId)
        );
      };
      const existingPairs = new Set(
        (prev as CustomEdge[]).map((edge) => `${edge.source}->${edge.target}`)
      );
      const next = [...prev] as CustomEdge[];
      let changed = false;

      normalizedSourceIds.forEach((sourceId) => {
        normalizedTargetIds.forEach((targetId) => {
          if (!sourceId || !targetId || sourceId === targetId) return;
          if (isContainerToOwnChildEdge(sourceId, targetId)) return;
          const pairKey = `${sourceId}->${targetId}`;
          if (existingPairs.has(pairKey)) return;
          existingPairs.add(pairKey);
          next.push(createDirectedCanvasEdge(sourceId, targetId));
          changed = true;
        });
      });

      if (changed) {
        edgesRef.current = next;
        return next;
      }
      return prev;
    });
  }, [setEdges]);

  const resolveContextReferenceNodeId = useCallback((nodeId: string) => {
    const normalizedNodeId = getTextValue(nodeId);
    if (!normalizedNodeId) return "";

    const latestNodes = nodesRef.current;
    const latestEdges = edgesRef.current as CustomEdge[];
    const currentNode = latestNodes.find((node) => node.id === normalizedNodeId);
    if (!currentNode) return normalizedNodeId;

    if (currentNode.parentId) {
      const groupSourceId = latestEdges.find((edge) => edge.target === currentNode.parentId)?.source;
      if (groupSourceId) return groupSourceId;
    }

    const directParentId = latestEdges.find((edge) => edge.target === normalizedNodeId)?.source;
    return directParentId || normalizedNodeId;
  }, []);

  const appendDialogReferenceByNodeId = useCallback((nodeId: string) => {
    const snapshot = getDialogReferenceSnapshot(nodeId);
    if (!snapshot) return null;

    let added = false;
    setDialogCardPreviews((prev) => {
      if (prev.some((item) => item.nodeId === nodeId)) return prev;
      added = true;
      return [
        ...prev,
        {
          nodeId,
          title: `${snapshot.label}卡片`,
          content: snapshot.content,
          filePath: snapshot.filePath,
          label: snapshot.label,
        },
      ];
    });

    return { snapshot, added };
  }, [getDialogReferenceSnapshot]);

  const appendDialogReferencesByNodeIds = useCallback((nodeIds: string[]) => {
    let addedCount = 0;
    let duplicateCount = 0;
    let firstSnapshot: ReturnType<typeof getDialogReferenceSnapshot> | null = null;

    nodeIds.forEach((nodeId) => {
      const appended = appendDialogReferenceByNodeId(nodeId);
      if (!appended) return;
      if (!firstSnapshot) {
        firstSnapshot = appended.snapshot;
      }
      if (appended.added) {
        addedCount += 1;
      } else {
        duplicateCount += 1;
      }
    });

    return { addedCount, duplicateCount, firstSnapshot };
  }, [appendDialogReferenceByNodeId, getDialogReferenceSnapshot]);

  const getGroupChildReferenceNodeIds = useCallback((groupNodeId: string) => {
    const normalizedGroupNodeId = getTextValue(groupNodeId);
    if (!normalizedGroupNodeId) return [] as string[];

    return nodesRef.current
      .filter((node) => {
        if (node.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE) return false;
        const roleGroupId = getTextValue((node.data as any)?.roleGroupId);
        const outlineGroupId = getTextValue((node.data as any)?.outlineGroupId);
        const parentId = getTextValue(node.parentId);
        return (
          roleGroupId === normalizedGroupNodeId ||
          outlineGroupId === normalizedGroupNodeId ||
          parentId === normalizedGroupNodeId
        );
      })
      .sort((a, b) => {
        const ay = Number(a.position?.y ?? 0);
        const by = Number(b.position?.y ?? 0);
        if (ay !== by) return ay - by;
        return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
      })
      .map((node) => node.id);
  }, []);

  useEffect(() => {
    return () => {
      stopBrainstormProgress();
      locateHighlightTimersRef.current.forEach((timerId) => {
        clearTimeout(timerId);
      });
      locateHighlightTimersRef.current.clear();
    };
  }, [stopBrainstormProgress]);

  // 一次“生成”流程内的错误提示去重（跨多个卡片）
  const errorBatchRef = useRef<{ startedAt: number; messages: Set<string> } | null>(null);
  // 当前缩放百分比（用于右下角 UI 展示）
  const [zoomPercent, setZoomPercent] = useState(100);
  // 画布拖拽总开关（默认开启，支持按钮一键关闭）
  const [panMode, setPanMode] = useState(true);
  const onAutoSyncDirectoryRef = useRef(onAutoSyncDirectory);
  onAutoSyncDirectoryRef.current = onAutoSyncDirectory;
  const lastAutoSyncSignatureRef = useRef("");
  const getOrCreateCanvasSessionId = useCanvasStore((s) => s.getOrCreateCanvasSessionId);
  const createNewCanvasSessionId = useCanvasStore((s) => s.createNewCanvasSessionId);
  const clearCanvasSessionId = useCanvasStore((s) => s.clearCanvasSessionId);

  // 暂不依赖 mainCard：只要画布里有节点，就允许交互
  const hasIdea = useMemo(() => {
    return Boolean(tree && tree.length > 0);
  }, [tree]);


  const { layout: dagreLayout } = useDagreLayout();

  const msg = useCallback(
    (type: "success" | "error" | "warning", text: string) => {
      if (type === "error") {
        const now = Date.now();
        const windowMs = 1000;
        let batch = errorBatchRef.current;
        if (!batch || now - batch.startedAt > windowMs) {
          batch = { startedAt: now, messages: new Set<string>() };
          errorBatchRef.current = batch;
        }
        if (batch.messages.has(text)) {
          return;
        }
        batch.messages.add(text);
      }
      onMessage?.(type, text);

    },
    [onMessage]
  );

  const updateMainCardsPosition = useCallback(() => {
    if (hasIdea) return;
    const mainCards = nodes.filter((n) => n.type === "mainCard");
    if (mainCards.length !== 3) return;
    const cardWidth = 250;
    const cardSpacing = 25;
    const w =
      containerRef.current?.clientWidth || window.innerWidth || 1920;
    const centerX = w / 2;
    const secondX = centerX - cardWidth / 2;
    const firstX = secondX - (cardWidth + cardSpacing);
    const thirdX = secondX + (cardWidth + cardSpacing);
    const sorted = [...mainCards].sort((a, b) => {
      const ia = parseInt((a.id || "").replace("card-", ""), 10) || 0;
      const ib = parseInt((b.id || "").replace("card-", ""), 10) || 0;
      return ia - ib;
    });
    const positions = [firstX, secondX, thirdX];
    const baseY = sorted[0]?.position?.y ?? 100;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== "mainCard") return n;
        const idx = sorted.findIndex((s) => s.id === n.id);
        if (idx < 0) return n;
        return { ...n, position: { x: positions[idx], y: baseY } };
      })
    );
  }, [hasIdea, nodes, setNodes]);

  useEffect(() => {
    const ro = containerRef.current
      ? new ResizeObserver(updateMainCardsPosition)
      : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    return () => {
      if (containerRef.current && ro) ro.unobserve(containerRef.current);
    };
  }, [updateMainCardsPosition]);

  useEffect(() => {
    updateCanvasViewportWidth();
    const ro = containerRef.current
      ? new ResizeObserver(updateCanvasViewportWidth)
      : null;
    if (containerRef.current && ro) ro.observe(containerRef.current);
    return () => {
      if (containerRef.current && ro) ro.unobserve(containerRef.current);
    };
  }, [updateCanvasViewportWidth]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        // mainCard 内部有按钮等交互，保持不可拖拽避免吞点击
        if (n.type === "mainCard") return { ...n, draggable: false };
        return { ...n, draggable: canvasReady };
      })
    );
  }, [canvasReady, setNodes]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    const hasLegacyBezierEdge = edges.some(
      (edge) => getTextValue(edge?.type).toLowerCase() === "bezier"
    );
    if (!hasLegacyBezierEdge) return;
    const normalizedEdges = normalizeCanvasEdges(edges);
    edgesRef.current = normalizedEdges;
    setEdges(normalizedEdges);
  }, [edges, setEdges]);

  useEffect(() => {
    hasIdeaRef.current = hasIdea;
  }, [hasIdea]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const stopCurrentRequest = useCallback(async () => {
    const controller = canvasRequestAbortControllerRef.current;
    if (!controller || !isLoadingRef.current) return;
    abortRequestedRef.current = true;
    pausedRequestMessageRef.current = `${reqPanelUseSmartTheme ? "智能" : (cardKeyLabel || "脑洞")}喵已暂停`;
    controller.abort();

    for (let attempts = 0; attempts < 40; attempts += 1) {
      if (!isLoadingRef.current) break;
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
  }, [cardKeyLabel, reqPanelUseSmartTheme]);

  // 有「想法」结构时即允许画布交互（拖拽/缩放），包括：1）用户点击「立即创作」后 2）从服务端加载已有画布时
  useEffect(() => {
    if (hasIdea) setCanvasReady(true);
  }, [hasIdea]);

  const autoLayout = useCallback(() => {
    // 注意：autoLayout 会延迟触发，不能用闭包里的 hasIdea（可能是旧值）
    if (!hasIdeaRef.current) return;
    setTimeout(() => {
      const requestId = ++layoutRequestIdRef.current;
      void (async () => {
        try {
          const layouted = await dagreLayout(
            nodesRef.current,
            edgesRef.current,
            "TB"
          );
          if (requestId !== layoutRequestIdRef.current) return;
          const layoutedNodes = layouted as CustomNode[];
          setEdges(edgesRef.current);
          setNodes(layoutedNodes);
        } catch (e) {
          console.error("elk layout error:", e);
        }
      })();
    }, 100);
  }, [dagreLayout, setNodes, setEdges]);

  // 只重排某个 root 下的子树，避免全图抖动和“新增兄弟跑位”
  const applyGraphAndSubtreeLayout = useCallback(
    (
      nextNodes: CustomNode[],
      nextEdges: CustomEdge[],
      rootId: string,
      delayMs: number = 140
    ) => {
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      setTimeout(() => {
        if (!hasIdeaRef.current) return;
        const requestId = ++layoutRequestIdRef.current;
        void (async () => {
          try {
            const layouted = await dagreLayout(
              nextNodes,
              nextEdges,
              "TB",
              rootId
            );
            if (requestId !== layoutRequestIdRef.current) return;
            const layoutedNodes = layouted as CustomNode[];
            edgesRef.current = nextEdges;
            setEdges(nextEdges);
            setNodes(layoutedNodes);
          } catch (e) {
            console.error("elk subtree layout error:", e);
          }
        })();
      }, delayMs);
    },
    [setNodes, setEdges, dagreLayout]
  );

  const scheduleAutoLayoutForExpand = useCallback(() => {
    // 展开/折叠存在过渡动画，动画完成后做一次布局
    setTimeout(() => {
      autoLayout();
    }, 260);
  }, [autoLayout]);

  const updateNodeContent = useCallback(
    (
      nodeId: string,
      content: string,
      options?: {
        title?: string;
        filePath?: string;
        image?: string;
        images?: string[];
      }
    ) => {
      let syncedFilePath = "";
      let syncedFileContent = "";
      setNodes((nds) => {
        const nextNodes = nds.map((n) => {
          if (n.id !== nodeId) return n;

          const hasTitleUpdate = Object.prototype.hasOwnProperty.call(options ?? {}, "title");
          const hasFilePathUpdate = Object.prototype.hasOwnProperty.call(options ?? {}, "filePath");
          const nextTitle = hasTitleUpdate ? String(options?.title ?? "") : String(n.data?.title ?? "");
          const nextLabel = String(n.data?.label ?? "");
          const nextFilePath = hasFilePathUpdate
            ? String(options?.filePath ?? "")
            : hasTitleUpdate
              ? buildCanvasNodeFilePath({ label: nextLabel, title: nextTitle })
              : String(n.data?.filePath ?? "");
          const nextImage = Object.prototype.hasOwnProperty.call(options ?? {}, "image")
            ? options?.image
            : n.data?.image;
          const nextImages = Object.prototype.hasOwnProperty.call(options ?? {}, "images")
            ? options?.images
            : (n.data as { images?: string[] })?.images;

          const nextNode: CustomNode = {
            ...n,
            // 受控 nodes 模式下，必须在父层把 isStreaming 写回 false，
            // 否则子组件里 updateNodeData 的变更会被下一次 render 覆盖，导致 props.data.isStreaming 仍为 true
            data: {
              ...n.data,
              content,
              isStreaming: false,
              ...(hasTitleUpdate ? { title: nextTitle } : {}),
              ...(hasFilePathUpdate || hasTitleUpdate ? { filePath: nextFilePath } : {}),
              ...(Object.prototype.hasOwnProperty.call(options ?? {}, "image") ? { image: nextImage } : {}),
              ...(Object.prototype.hasOwnProperty.call(options ?? {}, "images") ? { images: nextImages } : {}),
            },
          };

          const previousFilePath = getTextValue((n.data as any)?.filePath).trim();
          const normalizedNextFilePath = getTextValue(nextFilePath).trim();
          if (previousFilePath && previousFilePath !== normalizedNextFilePath) {
            delete generatedWriteFilesRef.current[previousFilePath];
          }

          const nextHasContent = Boolean(String(content || "").trim());
          const nextHasImages = Array.isArray(nextImages)
            ? nextImages.filter(Boolean).length > 0
            : Boolean(nextImage);
          if (normalizedNextFilePath) {
            if (nextHasContent || nextHasImages) {
              generatedWriteFilesRef.current[normalizedNextFilePath] = buildCanvasNodeMarkdown(nextNode);
            } else {
              delete generatedWriteFilesRef.current[normalizedNextFilePath];
            }
          }

          return nextNode;
        });

        const syncPathNodeIdMap = buildCanvasSyncFileNodeIdMap(nextNodes);
        const matchedSyncPath =
          Object.entries(syncPathNodeIdMap).find(([, id]) => id === nodeId)?.[0] ?? "";
        if (matchedSyncPath) {
          const nextFiles = buildCanvasSyncFiles(nextNodes);
          syncedFilePath = matchedSyncPath;
          syncedFileContent = String(nextFiles[matchedSyncPath] ?? "");
        }

        return nextNodes;
      });
      if (syncedFilePath) {
        onCanvasFileContentChangeRef.current?.(syncedFilePath, syncedFileContent);
      }
    },
    [buildCanvasNodeFilePath, buildCanvasNodeMarkdown, setNodes]
  );

  const collectChildren = useCallback(
    (nodeId: string): Set<string> => {
      const toDelete = new Set<string>([nodeId]);
      const collect = (id: string) => {
        const out = (edges as CustomEdge[]).filter((e) => e.source === id);
        for (const e of out) {
          if (!toDelete.has(e.target)) {
            toDelete.add(e.target);
            collect(e.target);
          }
        }
        const nestedNodes = nodes.filter((node) =>
          node.parentId === id ||
          (node.data as any)?.roleGroupId === id ||
          (node.data as any)?.outlineGroupId === id
        );
        for (const childNode of nestedNodes) {
          if (!toDelete.has(childNode.id)) {
            toDelete.add(childNode.id);
            collect(childNode.id);
          }
        }
      };
      collect(nodeId);
      return toDelete;
    },
    [edges, nodes]
  );

  const deleteNode = useCallback(
    (nodeId: string, options?: { skipLayout?: boolean }) => {
      if (nodeId === "1") return;
      const toDelete = collectChildren(nodeId);
      const targetNode = nodesRef.current.find((node) => node.id === nodeId);
      const outlineGroupId =
        targetNode?.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE
          ? getTextValue(targetNode.parentId)
          : "";
      setNodes((nds) => {
        const filtered = nds.filter((n) => !toDelete.has(n.id));
        const nextNodes = outlineGroupId
          ? compactOutlineGroupNodes(filtered as CustomNode[], outlineGroupId)
          : filtered;
        nodesRef.current = nextNodes as CustomNode[];
        return nextNodes;
      });
      setEdges((eds) =>
        (eds as CustomEdge[]).filter(
          (e) => !toDelete.has(e.source) && !toDelete.has(e.target)
        )
      );
      if (!options?.skipLayout) {
        setTimeout(autoLayout, 50);
      }
      scheduleCanvasAutoSave();
    },
    [collectChildren, setNodes, setEdges, autoLayout, scheduleCanvasAutoSave]
  );

  const getParentId = useCallback(
    (targetNodeId: string, edgesArr: CustomEdge[]) => {
      return edgesArr.find((e) => e.target === targetNodeId)?.source;
    },
    []
  );

  const getTopAncestorId = useCallback(
    (startNodeId: string, edgesArr: CustomEdge[]) => {
      let current = startNodeId;
      let parent = getParentId(current, edgesArr);
      while (parent) {
        current = parent;
        parent = getParentId(current, edgesArr);
      }
      return current;
    },
    [getParentId]
  );

  const generateStorySettings = useCallback(
    (sourceNodeId: string) => {
      const source = nodes.find((n) => n.id === sourceNodeId);
      if (!source) return;
      const baseX = source.position.x + 400;
      const spacing = 120;
      const parentY = source.position.y;
      const ys = [parentY - spacing, parentY, parentY + spacing];
      const newNodes: CustomNode[] = [];
      const newEdges: CustomEdge[] = [];
      for (let i = 0; i < 3; i++) {
        const nid = `story-setting-${Date.now()}-${i}`;
        newNodes.push({
          id: nid,
          type: "settingCard",
          position: { x: baseX, y: ys[i] },
          draggable: hasIdea,
          data: {
            label: "故事设定",
            content: "",
            isStreaming: true,
            inspirationWord: source.data?.inspirationWord,
            inspirationTheme: source.data?.inspirationTheme,
            shortSummary: source.data?.content,
            inspirationDrawId,
          },
        });
        newEdges.push({
          id: `e${sourceNodeId}-${nid}`,
          source: sourceNodeId,
          target: nid,
          type: "default",
          animated: true,
        });
      }
      const nextNodes = [...nodes, ...newNodes];
      const nextEdges = [...(edges as CustomEdge[]), ...newEdges];
      const layoutRootId = getTopAncestorId(sourceNodeId, edges as CustomEdge[]);
      // 生成子节点时提升到最高祖先重排，确保 A/B 同时生成时跨分支也能互相避让
      applyGraphAndSubtreeLayout(
        nextNodes,
        nextEdges,
        layoutRootId
      );
      scheduleCanvasAutoSave();
    },
    [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndSubtreeLayout, getTopAncestorId, scheduleCanvasAutoSave]
  );

  const addSummaryCard = useCallback(
    (sourceNodeId: string, opts?: CanvasAddCardOptions) => {
      const source = nodes.find((n) => n.id === sourceNodeId);
      if (!source) return "";

      const edgesArr = edges as CustomEdge[];
      const position = getLinkedCardPosition(sourceNodeId, nodes, edgesArr, "attribute");

      const newNodeId = `summaryCard-${Date.now()}`;
      const newNode: CustomNode = {
        id: newNodeId,
        type: "summaryCard",
        position,
        draggable: hasIdea,
        data: {
          label: opts?.label ?? "梗概",
          title: opts?.title ?? "",
          filePath: opts?.filePath ?? "",
          content: opts?.content ?? "",
          image: opts?.image ?? "",
          fromApi: opts?.fromApi,
          isStreaming: opts?.isStreaming ?? true,
          generateLabel: opts?.generateLabel,
          allowTitleEdit: opts?.allowTitleEdit,
          allowImageUpload: opts?.allowImageUpload,
          inspirationWord: opts?.inspirationWord ?? source.data?.inspirationWord,
          inspirationTheme: opts?.inspirationTheme ?? source.data?.inspirationTheme,
          shortSummary: opts?.shortSummary ?? source.data?.shortSummary,
          storySetting: opts?.storySetting ?? source.data?.storySetting,
          inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          skipAutoStream: opts?.skipAutoStream ?? false,
        },
      };

      const newEdge = createDirectedCanvasEdge(sourceNodeId, newNodeId);
      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [...prev, newEdge]);
      setCanvasReady(true);
      scheduleCanvasAutoSave();
      return newNodeId;
    },
    [nodes, edges, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, setEdges, setNodes]
  );

  const handleMainCardCreate = useCallback(
    (nodeId: string) => {
      const source = nodes.find((n) => n.id === nodeId);
      if (!source) return;
      // 先立即创建节点，避免等待接口导致“点了按钮但画布不出节点”
      const baseX = source.position.x + 400;
      const spacing = 120;
      const parentY = source.position.y;
      const ys = [parentY - spacing, parentY, parentY + spacing];
      const newNodes: CustomNode[] = [];
      const newEdges: CustomEdge[] = [];
      for (let i = 0; i < 3; i++) {
        const nid = `summaryCard-${Date.now()}-${i}`;
        newNodes.push({
          id: nid,
          type: "summaryCard",
          position: { x: baseX, y: ys[i] },
          draggable: hasIdea,
          isCreated: true,
          data: {
            label: "梗概",
            content: "",
            inspirationWord: source.data?.inspirationWord,
            inspirationTheme: source.data?.inspirationTheme,
            inspirationDrawId: inspirationDrawId || undefined,
            isStreaming: true,
          },
        });
        newEdges.push({
          id: `e${nodeId}-${nid}`,
          source: nodeId,
          target: nid,
          type: "default",
          animated: true,
        });
      }

      const mainCards = nodes.filter(
        (n) => n.type === "mainCard" && n.id !== nodeId
      );
      const toRemove = new Set(mainCards.map((n) => n.id));
      const nextNodes: CustomNode[] = [
        ...nodes.filter((n) => n.type !== "mainCard" || n.id === nodeId),
        ...newNodes,
      ];
      const nextEdges: CustomEdge[] = [
        ...(edges as CustomEdge[]).filter(
          (e) => !toRemove.has(e.source) && !toRemove.has(e.target)
        ),
        ...newEdges,
      ];

      applyGraphAndSubtreeLayout(nextNodes, nextEdges, nodeId);
      setCanvasReady(true);
      scheduleCanvasAutoSave();

      // 后台生成 drawId，成功后回写到状态与各节点 data 中
      void (async () => {
        try {
          const { generateInspirationDrawIdReq } = await import("@/api/works");
          const res: any = await generateInspirationDrawIdReq(workId, {
            nodes: nextNodes,
            edges: nextEdges,
          });
          if (!res?.id) return;
          const drawId = String(res.id);
          setInspirationDrawId(drawId);
          setNodes((nds) =>
            nds.map((n) => ({
              ...n,
              data: { ...n.data, inspirationDrawId: drawId },
            }))
          );
        } catch {
          // ignore
        }
      })();
    },
    [workId, nodes, edges, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, setNodes, applyGraphAndSubtreeLayout]
  );

  const addSettingCard = useCallback(
    (sourceNodeId: string, opts?: CanvasAddCardOptions) => {
      const source = nodes.find((n) => n.id === sourceNodeId);
      if (!source) return "";
      const edgesArr = edges as CustomEdge[];
      const nid = `story-setting-${Date.now()}`;
      const kind = opts?.label === "信息" ? "info" : "attribute";
      const position = getLinkedCardPosition(sourceNodeId, nodes, edgesArr, kind);
      const newNode: CustomNode = {
        id: nid,
        type: "settingCard",
        position,
        sourcePosition: opts?.label === "信息" ? Position.Right : Position.Bottom,
        targetPosition: opts?.label === "信息" ? Position.Left : Position.Top,
        draggable: hasIdea,
        data: {
          label: opts?.label ?? "故事设定",
          title: opts?.title ?? "",
          filePath: opts?.filePath ?? "",
          content: opts?.content ?? "",
          image: opts?.image ?? "",
          fromApi: opts?.fromApi,
          isStreaming: opts?.isStreaming ?? true,
          expandable: true,
          generateLabel: opts?.generateLabel,
          allowTitleEdit: opts?.allowTitleEdit,
          allowImageUpload: opts?.allowImageUpload,
          inspirationWord: source.data?.inspirationWord,
          inspirationTheme: source.data?.inspirationTheme,
          shortSummary: source.data?.shortSummary,
          storySetting: source.data?.storySetting,
          inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          skipAutoStream: opts?.skipAutoStream ?? false,
        },
      };
      const newEdge = createDirectedCanvasEdge(
        sourceNodeId,
        nid,
        opts?.label === "信息"
          ? {
            sourceHandle: "source-right",
            targetHandle: "target-left",
          }
          : undefined
      );
      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [...prev, newEdge]);
      setCanvasReady(true);
      scheduleCanvasAutoSave();
      return nid;
    },
    [nodes, edges, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, setEdges, setNodes]
  );

  async function generateOutlineNodes(sourceNodeId: string) {
    const source = nodes.find((n) => n.id === sourceNodeId);
    if (!source) return;
    const outlineSourceId = String(
      (source.data as any)?.outlineSourceId ??
      (edges as CustomEdge[]).find((edge) => edge.target === sourceNodeId)?.source ??
      sourceNodeId
    );
    const request = buildRoleRequestPayload(outlineSourceId);
    const summaryNode = getNearestSummaryNode(sourceNodeId);
    const summaryTitle =
      getTextValue((summaryNode?.data as any)?.title) ||
      getTextValue((source.data as any)?.title) ||
      "当前链路内容";
    const summaryIntro =
      getTextValue(summaryNode?.data?.content) ||
      request.description ||
      getTextValue(source.data?.content);

    const settingsContent = getTextValue(source.data?.content);
    const chapterNumMatch =
      settingsContent.match(/(?:章节(?:数|数量)?|章数|总章数)\s*[:：]?\s*(\d{1,3})/) ??
      settingsContent.match(/(\d{1,3})\s*章/);
    const chapterNumRaw = Number(chapterNumMatch?.[1] ?? (source.data as any)?.chapterNum ?? 10);
    const chapterNum = Number.isFinite(chapterNumRaw)
      ? Math.min(200, Math.max(1, Math.round(chapterNumRaw)))
      : 10;

    setReqPanelVisible(true);
    setReqPanelUseSmartTheme(false);
    setCardKeyLabel("大纲");
    setPendingContextActionLabel("");
    setReqPanelStatus("loading");
    setReqPanelDetail("正在根据当前梗概与设置生成故事大纲，请稍等...");
    setReqPanelAction(null);
    try {
      const { postDocTemplateStreamOutline } = await import("@/api/writing-templates");
      let outlineMarkdown = "";
      let outlineJson: { outline_dict?: Array<Record<string, unknown>> } | undefined;
      await postDocTemplateStreamOutline(
        {
          description: [request.description, settingsContent].filter(Boolean).join("\n"),
          brainStorm: {
            title: summaryTitle,
            intro: summaryIntro,
          },
          roleCard: request.roleCard,
          chapterNum,
        } as any,
        (streamData: any) => {
          if (streamData?.event === "messages/partial") {
            outlineMarkdown = String(streamData?.data?.[0]?.content?.[0]?.text ?? outlineMarkdown);
          }
          if (streamData?.event === "updates") {
            outlineJson = streamData?.data?.generate_writing_template?.result?.outline ?? outlineJson;
          }
        },
        (error: any) => {
          throw error;
        },
        () => { }
      );

      const content =
        outlineJson?.outline_dict && outlineJson.outline_dict.length
          ? formatOutlineMarkdown(outlineJson.outline_dict)
          : outlineMarkdown;
      addOutlineCard(sourceNodeId, {
        label: "大纲",
        title: "大纲",
        content,
        allowTitleEdit: true,
        allowImageUpload: false,
        isStreaming: false,
        fromApi: true,
      });
      setReqPanelStatus("success");
      setReqPanelDetail("大纲喵搞定了！已经根据当前梗概与设置生成故事大纲。");
    } catch (error: any) {
      setReqPanelStatus("error");
      setReqPanelDetail(`状态：失败\n原因：${String(error?.message ?? "未知错误")}`);
      msg("error", String(error?.message ?? "故事大纲生成失败"));
    }
  }

  const addOutlineCard = useCallback(
    (sourceNodeId: string, opts?: CanvasAddCardOptions) => {
      const source = nodes.find((n) => n.id === sourceNodeId);
      if (!source) return "";
      const edgesArr = edges as CustomEdge[];
      const nid = `outline-${Date.now()}`;
      const position = getLinkedCardPosition(sourceNodeId, nodes, edgesArr, "attribute");
      const newNode: CustomNode = {
        id: nid,
        type: "outlineCard",
        position,
        draggable: hasIdea,
        data: {
          label: opts?.label ?? "故事大纲",
          title: opts?.title ?? "",
          content: opts?.content ?? "",
          image: opts?.image ?? "",
          fromApi: opts?.fromApi,
          isStreaming: opts?.isStreaming ?? true,
          expandable: true,
          generateLabel: opts?.generateLabel,
          allowTitleEdit: opts?.allowTitleEdit,
          allowImageUpload: opts?.allowImageUpload,
          inspirationWord: source.data?.inspirationWord,
          inspirationTheme: source.data?.inspirationTheme,
          shortSummary: source.data?.shortSummary,
          storySetting: source.data?.storySetting,
          inspirationDrawId: source.data?.inspirationDrawId ?? inspirationDrawId,
          skipAutoStream: opts?.skipAutoStream ?? false,
        },
      };
      const newEdge = createDirectedCanvasEdge(sourceNodeId, nid);
      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [...prev, newEdge]);
      setCanvasReady(true);
      scheduleCanvasAutoSave();
      return nid;
    },
    [nodes, edges, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, setEdges, setNodes]
  );

  const getIncomingContextNodes = useCallback(
    (targetId: string) => {
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const visited = new Set<string>();
      const ordered: CustomNode[] = [];

      const visit = (nodeId: string) => {
        if (!nodeId || visited.has(nodeId)) return;
        visited.add(nodeId);
        const current = nodeMap.get(nodeId);
        if (!current) return;
        if (current.parentId) visit(current.parentId);
        (edges as CustomEdge[])
          .filter((edge) => edge.target === nodeId)
          .forEach((edge) => visit(edge.source));
        ordered.push(current);
      };

      visit(targetId);
      return ordered;
    },
    [nodes, edges]
  );

  const getNearestConnectedSummaryNode = useCallback(
    (targetId: string) => {
      const normalizedTargetId = getTextValue(targetId);
      if (!normalizedTargetId) return undefined;

      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const adjacency = new Map<string, Set<string>>();
      const connect = (from: string, to: string) => {
        const normalizedFrom = getTextValue(from);
        const normalizedTo = getTextValue(to);
        if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;
        if (!adjacency.has(normalizedFrom)) adjacency.set(normalizedFrom, new Set());
        if (!adjacency.has(normalizedTo)) adjacency.set(normalizedTo, new Set());
        adjacency.get(normalizedFrom)?.add(normalizedTo);
        adjacency.get(normalizedTo)?.add(normalizedFrom);
      };

      (edges as CustomEdge[]).forEach((edge) => {
        connect(String(edge.source ?? ""), String(edge.target ?? ""));
      });

      nodes.forEach((node) => {
        const parentGroupId =
          getTextValue(node.parentId) ||
          getTextValue((node.data as any)?.roleGroupId) ||
          getTextValue((node.data as any)?.outlineGroupId);
        if (parentGroupId) {
          connect(node.id, parentGroupId);
        }
      });

      const visited = new Set<string>();
      const queue: string[] = [normalizedTargetId];

      while (queue.length > 0) {
        const currentId = queue.shift() as string;
        if (!currentId || visited.has(currentId)) continue;
        visited.add(currentId);

        const currentNode = nodeMap.get(currentId);
        if (
          currentNode &&
          currentId !== normalizedTargetId &&
          String(currentNode.data?.label ?? "").includes("梗概")
        ) {
          return currentNode;
        }

        adjacency.get(currentId)?.forEach((relatedId) => {
          if (!visited.has(relatedId)) {
            queue.push(relatedId);
          }
        });
      }

      return undefined;
    },
    [edges, nodes]
  );

  const getNearestSummaryNode = useCallback(
    (targetId: string) => {
      const contextNodes = getIncomingContextNodes(targetId);
      const currentNode = contextNodes.find((node) => node.id === targetId);
      if (currentNode && String(currentNode.data?.label ?? "").includes("梗概")) {
        return currentNode;
      }
      const incomingSummaryNode = contextNodes
        .reverse()
        .find((node) => node.id !== targetId && String(node.data?.label ?? "").includes("梗概"));
      return incomingSummaryNode || getNearestConnectedSummaryNode(targetId);
    },
    [getIncomingContextNodes, getNearestConnectedSummaryNode]
  );

  const buildContextDescription = useCallback(
    (targetId: string) =>
      getIncomingContextNodes(targetId)
        .filter((node) => node.type !== "roleGroup")
        .map((node) => {
          const label = String(node.data?.label ?? "");
          const title = getTextValue((node.data as any)?.title);
          const content = getTextValue(node.data?.content);
          return [label, title, content].filter(Boolean).join("：");
        })
        .filter(Boolean)
        .join("\n"),
    [getIncomingContextNodes]
  );

  const buildRoleRequestPayload = useCallback(
    (targetId: string) => {
      const current = nodes.find((node) => node.id === targetId);
      const summaryNode = getNearestSummaryNode(targetId);
      return {
        description: buildContextDescription(targetId),
        brainStorm: summaryNode
          ? {
            title: getTextValue((summaryNode.data as any)?.title) || "故事梗概",
            synopsis: getTextValue(summaryNode.data?.content),
          }
          : undefined,
        roleCard: {
          name: getTextValue((current?.data as any)?.title) || "角色",
          definition: getTextValue(current?.data?.content),
        },
      };
    },
    [buildContextDescription, getNearestSummaryNode, nodes]
  );

  const formatSynopsisMarkdown = (result: Record<string, unknown>) => {
    const synopsis = getFirstTextValue(result.synopsis, result.summary, result.intro);
    return synopsis || formatRecordMarkdown(result, ["title"]);
  };

  const formatInfoCardMarkdown = (result: Record<string, unknown>) =>
    formatRecordMarkdown(result, ["title", "synopsis", "summary", "intro"]);

  const focusRoleGroup = useCallback(
    (groupId: string) => {
      focusCanvasNode(groupId, { zoom: 0.9, duration: 500 });
    },
    [focusCanvasNode]
  );

  const appendRoleCardsToGroup = useCallback(
    (
      sourceNodeId: string,
      roleCards: Array<{
        title?: string;
        filePath?: string;
        content?: string;
        image?: string;
        isStreaming?: boolean;
        fromApi?: boolean;
        isBlankDraft?: boolean;
        skipAutoStream?: boolean;
      }>
    ) => {
      const latestNodes = nodesRef.current;
      const latestEdges = edgesRef.current as CustomEdge[];
      const source = latestNodes.find((node) => node.id === sourceNodeId);
      if (!source || !roleCards.length) return { groupId: "", roleNodeIds: [] as string[] };

      const isSourceRoleGroup = source.type === "roleGroup";
      const groupId = isSourceRoleGroup ? source.id : source.parentId || `role-group-${sourceNodeId}`;
      const roleCardWidth = ROLE_GROUP_CARD_WIDTH;
      const roleCardHeight = ROLE_GROUP_CARD_HEIGHT;
      const gapX = ROLE_GROUP_CARD_GAP_X;
      const gapY = ROLE_GROUP_CARD_GAP_Y;
      const cols = ROLE_GROUP_MAX_COLS;
      const groupPaddingTop = ROLE_GROUP_PADDING_TOP;
      const groupPadding = ROLE_GROUP_PADDING;
      const minGroupWidth = 340;
      const existingGroup = latestNodes.find((node) => node.id === groupId);
      const groupSourceId = isSourceRoleGroup
        ? (latestEdges.find((edge) => edge.target === groupId)?.source ?? "")
        : source.parentId
          ? (latestEdges.find((edge) => edge.target === groupId)?.source ?? sourceNodeId)
          : sourceNodeId;
      const groupSourceNode =
        (groupSourceId ? latestNodes.find((node) => node.id === groupSourceId) : undefined) ?? source;
      const groupPosition = existingGroup
        ? existingGroup.position
        : getLinkedCardPosition(groupSourceId || sourceNodeId, latestNodes, latestEdges, "attribute");
      const groupX = groupPosition.x;
      const groupY = groupPosition.y;
      const roleNodeIds = roleCards.map(() => getNextCanvasNodeId("role"));

      setNodes((prev) => {
        const currentSource = prev.find((node) => node.id === sourceNodeId);
        const currentGroupSource =
          (groupSourceId ? prev.find((node) => node.id === groupSourceId) : undefined) ?? currentSource;
        if (!currentSource || !currentGroupSource) return prev;
        const existingRoles = prev
          .filter((node) => {
            const belongsToGroup =
              node.parentId === groupId ||
              getTextValue((node.data as any)?.roleGroupId) === groupId;
            if (!belongsToGroup) return false;
            return node.type === "settingCard" && getTextValue(node.data?.label) === "角色";
          })
          .sort((a, b) => {
            const ay = Number(a.position?.y ?? 0);
            const by = Number(b.position?.y ?? 0);
            if (ay !== by) return ay - by;
            return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
          });

        const roleNodes = roleCards.map((item, index) => {
          const idx = existingRoles.length + index;
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          return {
            id: roleNodeIds[index],
            type: "settingCard",
            parentId: groupId,
            position: {
              x: groupPadding + col * (roleCardWidth + gapX),
              y: groupPaddingTop + row * (roleCardHeight + gapY),
            },
            draggable: hasIdea,
            data: {
              label: "角色",
              title: item.title ?? "",
              filePath: item.filePath ?? "",
              content: item.content ?? "",
              image: item.image ?? "",
              fromApi: item.fromApi ?? true,
              roleGroupId: groupId,
              isStreaming: item.isStreaming ?? false,
              isBlankDraft: item.isBlankDraft ?? false,
              isBlankBrainstormDraft: false,
              expandable: true,
              allowTitleEdit: true,
              allowImageUpload: true,
              inspirationWord: currentGroupSource.data?.inspirationWord,
              inspirationTheme: currentGroupSource.data?.inspirationTheme,
              shortSummary: currentGroupSource.data?.shortSummary,
              storySetting: currentGroupSource.data?.storySetting,
              inspirationDrawId: currentGroupSource.data?.inspirationDrawId ?? inspirationDrawId,
              skipAutoStream: item.skipAutoStream ?? false,
            } as any,
          } as CustomNode;
        });
        const totalCount = existingRoles.length + roleNodes.length;
        const rows = Math.max(1, Math.ceil(totalCount / cols));
        const colsUsed = Math.max(1, Math.min(cols, totalCount));
        const nextGroupWidth = Math.max(
          minGroupWidth,
          groupPadding * 2 + colsUsed * roleCardWidth + Math.max(0, colsUsed - 1) * gapX
        );
        const nextGroupHeight = Math.max(
          ROLE_GROUP_MIN_HEIGHT,
          groupPaddingTop + rows * roleCardHeight + Math.max(0, rows - 1) * gapY + groupPadding
        );
        const next = [...prev];
        const hasGroup = next.some((node) => node.id === groupId);
        if (!hasGroup) {
          next.push({
            id: groupId,
            type: "roleGroup",
            position: { x: groupX, y: groupY },
            draggable: hasIdea,
            dragHandle: ".role-group-drag-handle",
            selectable: true,
            data: { label: "角色" } as any,
            style: { width: nextGroupWidth, height: nextGroupHeight, zIndex: 0 } as any,
          } as any);
        }
        const groupIndex = next.findIndex((node) => node.id === groupId);
        if (groupIndex >= 0) {
          const currentGroup = next[groupIndex] as any;
          const currentGroupHeight = Number(
            currentGroup?.style?.height ?? getCanvasNodeLayoutSize(currentGroup).height
          );
          next[groupIndex] = {
            ...currentGroup,
            style: {
              ...(currentGroup?.style ?? {}),
              width: Math.max(Number(currentGroup?.style?.width ?? 0), nextGroupWidth),
              height: Math.max(Number(currentGroup?.style?.height ?? 0), nextGroupHeight),
              zIndex: Number(currentGroup?.style?.zIndex ?? 0),
            },
          };
          const groupHeightDelta = Math.max(0, nextGroupHeight - currentGroupHeight);
          if (groupHeightDelta > 0) {
            const shifted = shiftDownstreamTopLevelNodes(next, latestEdges, groupId, groupHeightDelta);
            if (shifted !== next) {
              next.length = 0;
              next.push(...shifted);
            }
          }
        }
        next.push(...roleNodes);
        const normalizedNext = compactGroupNodes(next as CustomNode[], groupId, {
          currentEdges: latestEdges,
        });
        nodesRef.current = normalizedNext;
        return normalizedNext;
      });

      setEdges((prev) => {
        const next = [...prev];
        const groupEdgeId = `e${groupSourceId}-${groupId}`;
        if (groupSourceId && !next.some((edge) => edge.id === groupEdgeId)) {
          next.push({
            id: groupEdgeId,
            source: groupSourceId,
            target: groupId,
            type: "default",
            animated: true,
          });
        }
        edgesRef.current = next;
        return next;
      });
      setCanvasReady(true);
      scheduleGroupMeasureRelayout(groupId);
      scheduleCanvasAutoSave();

      return { groupId, roleNodeIds };
    },
    [getNextCanvasNodeId, getNode, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, scheduleGroupMeasureRelayout, setNodes, setEdges]
  );

  const appendOutlineSettingsToGroup = useCallback(
    (
      sourceNodeId: string,
      options?: {
        files?: Record<string, string>;
        title?: string;
      }
    ) => {
      const latestNodes = nodesRef.current;
      const latestEdges = edgesRef.current as CustomEdge[];
      if (!latestNodes.find((node) => node.id === sourceNodeId)) return { groupId: "", settingsNodeId: "" };

      const groupId = `outline-group-${sourceNodeId}`;
      const settingsNodeId = `${groupId}-settings`;
      const groupWidth = OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2;
      const groupHeight =
        OUTLINE_GROUP_SETTINGS_TOP + OUTLINE_GROUP_SETTINGS_CARD_HEIGHT + OUTLINE_GROUP_HORIZONTAL_PADDING;
      const existingGroup = latestNodes.find((node) => node.id === groupId);
      const existingSettingsNode = latestNodes.find((node) => node.id === settingsNodeId);
      const groupPosition = existingGroup
        ? existingGroup.position
        : getLinkedCardPosition(sourceNodeId, latestNodes, latestEdges, "attribute");

      setNodes((prev) => {
        const next = [...prev];
        const groupIndex = next.findIndex((node) => node.id === groupId);
        if (groupIndex < 0) {
          next.push({
            id: groupId,
            type: "roleGroup",
            position: groupPosition,
            draggable: hasIdea,
            dragHandle: ".role-group-drag-handle",
            selectable: true,
            data: {
              label: "大纲",
              outlineSourceId: sourceNodeId,
              files: options?.files,
              title: options?.title,
            } as any,
            style: { width: groupWidth, height: groupHeight, zIndex: 0 } as any,
          } as any);
        } else {
          next[groupIndex] = {
            ...next[groupIndex],
            data: {
              ...next[groupIndex].data,
              outlineSourceId: sourceNodeId,
              files: options?.files,
              title: options?.title,
            } as any,
            style: {
              ...(next[groupIndex].style ?? {}),
              width: Math.max(Number((next[groupIndex].style as any)?.width ?? 0), groupWidth),
              height: Math.max(Number((next[groupIndex].style as any)?.height ?? 0), groupHeight),
            } as any,
          };
        }

        const settingsIndex = next.findIndex((node) => node.id === settingsNodeId);
        const nextSettingsData = {
          ...(existingSettingsNode?.data ?? {}),
          label: "大纲设置",
          outlineSourceId: sourceNodeId,
          files: options?.files,
          title: options?.title,
          outlineSettingCollapsed: Boolean((existingSettingsNode?.data as any)?.outlineSettingCollapsed),
          outlinePerspective: getTextValue((existingSettingsNode?.data as any)?.outlinePerspective),
          outlineArticleType: getTextValue((existingSettingsNode?.data as any)?.outlineArticleType),
          outlineChapterTag:
            getTextValue((existingSettingsNode?.data as any)?.outlineChapterTag) || "10章",
          outlineStructure: getTextValue((existingSettingsNode?.data as any)?.outlineStructure),
        } as any;

        if (settingsIndex < 0) {
          next.push({
            id: settingsNodeId,
            type: OUTLINE_GROUP_SETTINGS_NODE_TYPE,
            parentId: groupId,
            position: { x: OUTLINE_GROUP_HORIZONTAL_PADDING, y: OUTLINE_GROUP_SETTINGS_TOP },
            draggable: false,
            selectable: true,
            style: {
              width: OUTLINE_GROUP_SETTINGS_CARD_WIDTH,
              height: OUTLINE_GROUP_SETTINGS_CARD_HEIGHT,
            } as any,
            data: nextSettingsData,
          } as CustomNode);
        } else {
          next[settingsIndex] = {
            ...next[settingsIndex],
            parentId: groupId,
            position: { x: OUTLINE_GROUP_HORIZONTAL_PADDING, y: OUTLINE_GROUP_SETTINGS_TOP },
            draggable: false,
            selectable: true,
            style: {
              ...((next[settingsIndex] as any)?.style ?? {}),
              width: Boolean((nextSettingsData as any)?.outlineSettingCollapsed)
                ? Math.max(
                  Number((next[groupIndex] as any)?.style?.width ?? groupWidth) - OUTLINE_GROUP_HORIZONTAL_PADDING * 2,
                  OUTLINE_GROUP_SETTINGS_CARD_WIDTH
                )
                : OUTLINE_GROUP_SETTINGS_CARD_WIDTH,
              height: Boolean((nextSettingsData as any)?.outlineSettingCollapsed)
                ? OUTLINE_GROUP_SETTINGS_COLLAPSED_HEIGHT
                : OUTLINE_GROUP_SETTINGS_CARD_HEIGHT,
            } as any,
            data: nextSettingsData,
          } as CustomNode;
        }

        nodesRef.current = next;
        return next;
      });

      setEdges((prev) => {
        const next = [...prev];
        const groupEdgeId = `e${sourceNodeId}-${groupId}`;
        if (!next.some((edge) => edge.id === groupEdgeId)) {
          next.push({
            id: groupEdgeId,
            source: sourceNodeId,
            target: groupId,
            type: "default",
            animated: true,
          });
        }
        edgesRef.current = next;
        return next;
      });
      setCanvasReady(true);
      scheduleCanvasAutoSave();
      return { groupId, settingsNodeId };
    },
    [hasIdea, scheduleCanvasAutoSave, setEdges, setNodes]
  );

  const getDraftCardSize = useCallback(
    (key: CanvasCardKey) => {
      if (key === "summary" || key === "info") {
        return { width: 600, height: 900 };
      }
      if (key === "role" || key === "brainstorm") {
        return { width: ROLE_GROUP_CARD_WIDTH, height: ROLE_GROUP_CARD_HEIGHT };
      }
      return { width: OUTLINE_GROUP_CARD_WIDTH, height: OUTLINE_GROUP_CARD_HEIGHT };
    },
    [OUTLINE_GROUP_CARD_HEIGHT, OUTLINE_GROUP_CARD_WIDTH, ROLE_GROUP_CARD_HEIGHT, ROLE_GROUP_CARD_WIDTH]
  );

  const getViewportCenteredCanvasPosition = useCallback(
    (width: number, height: number) => {
      const containerEl = containerRef.current;
      if (!containerEl) {
        return getStandaloneNextRowPosition(nodesRef.current);
      }

      const viewport = getViewport();
      const { clientWidth, clientHeight } = containerEl;
      const centerX = (-viewport.x + clientWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + clientHeight / 2) / viewport.zoom;

      return {
        x: centerX - width / 2,
        y: centerY - height / 2,
      };
    },
    [getViewport]
  );

  const isBlankDraftNode = useCallback((node?: CustomNode | null) => {
    if (!node) return false;
    const nodeData = (node.data ?? {}) as any;
    return Boolean(nodeData.isBlankDraft ?? nodeData.isBlankBrainstormDraft);
  }, []);

  const createStandaloneRoleGroupDraftCard = useCallback(
    (options?: { insertPosition?: "center" | "right" }) => {
      const groupId = getNextCanvasNodeId("role-group");
      const roleNodeId = getNextCanvasNodeId("role");
      const roleCardWidth = ROLE_GROUP_CARD_WIDTH;
      const roleCardHeight = ROLE_GROUP_CARD_HEIGHT;
      const groupPaddingTop = ROLE_GROUP_PADDING_TOP;
      const groupPadding = ROLE_GROUP_PADDING;
      const minGroupWidth = 340;
      const groupWidth = Math.max(minGroupWidth, groupPadding * 2 + roleCardWidth);
      const groupHeight = Math.max(
        ROLE_GROUP_MIN_HEIGHT,
        groupPaddingTop + roleCardHeight + groupPadding
      );
      const groupPosition = options?.insertPosition === "right"
        ? getStandaloneNextRightInsertPosition(nodesRef.current)
        : getViewportCenteredCanvasPosition(groupWidth, groupHeight);

      setCanvasReady(true);
      setNodes((prev) => {
        const next = [
          ...prev,
          {
            id: groupId,
            type: "roleGroup",
            position: groupPosition,
            draggable: hasIdea,
            dragHandle: ".role-group-drag-handle",
            selectable: true,
            data: { label: "角色" } as any,
            style: { width: groupWidth, height: groupHeight, zIndex: 0 } as any,
          } as CustomNode,
          {
            id: roleNodeId,
            type: "settingCard",
            parentId: groupId,
            position: {
              x: groupPadding,
              y: groupPaddingTop,
            },
            draggable: hasIdea,
            data: {
              label: "角色",
              title: "",
              filePath: "",
              content: "",
              image: "",
              fromApi: false,
              roleGroupId: groupId,
              isStreaming: false,
              isBlankDraft: true,
              isBlankBrainstormDraft: false,
              expandable: true,
              allowTitleEdit: true,
              allowImageUpload: true,
              autoEdit: true,
              inspirationDrawId: inspirationDrawId || undefined,
              skipAutoStream: false,
            } as any,
          } as CustomNode,
        ];
        nodesRef.current = next;
        return next;
      });
      scheduleGroupMeasureRelayout(groupId);
      scheduleCanvasAutoSave();

      return { groupId, roleNodeId };
    },
    [
      getNextCanvasNodeId,
      getStandaloneNextRightInsertPosition,
      getViewportCenteredCanvasPosition,
      hasIdea,
      inspirationDrawId,
      scheduleCanvasAutoSave,
      scheduleGroupMeasureRelayout,
      setNodes,
    ]
  );

  const createStandaloneOutlineSettingsGroup = useCallback(
    (options?: {
      files?: Record<string, string>;
      title?: string;
      insertPosition?: "center" | "right";
    }) => {
      const groupId = getNextCanvasNodeId("outline-group");
      const settingsNodeId = `${groupId}-settings`;
      const groupWidth = OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2;
      const groupHeight =
        OUTLINE_GROUP_SETTINGS_TOP + OUTLINE_GROUP_SETTINGS_CARD_HEIGHT + OUTLINE_GROUP_HORIZONTAL_PADDING;
      const groupPosition = options?.insertPosition === "right"
        ? getStandaloneNextRightInsertPosition(nodesRef.current)
        : getViewportCenteredCanvasPosition(groupWidth, groupHeight);

      setCanvasReady(true);
      setNodes((prev) => {
        const next = [
          ...prev,
          {
            id: groupId,
            type: "roleGroup",
            position: groupPosition,
            draggable: hasIdea,
            dragHandle: ".role-group-drag-handle",
            selectable: true,
            data: {
              label: "大纲",
              outlineSourceId: "",
              files: options?.files,
              title: options?.title,
            } as any,
            style: { width: groupWidth, height: groupHeight, zIndex: 0 } as any,
          } as any,
          {
            id: settingsNodeId,
            type: OUTLINE_GROUP_SETTINGS_NODE_TYPE,
            parentId: groupId,
            position: { x: OUTLINE_GROUP_HORIZONTAL_PADDING, y: OUTLINE_GROUP_SETTINGS_TOP },
            draggable: false,
            selectable: true,
            style: {
              width: OUTLINE_GROUP_SETTINGS_CARD_WIDTH,
              height: OUTLINE_GROUP_SETTINGS_CARD_HEIGHT,
            } as any,
            data: {
              label: "大纲设置",
              outlineSourceId: "",
              files: options?.files,
              title: options?.title,
              outlineSettingCollapsed: false,
              outlinePerspective: "",
              outlineArticleType: "",
              outlineChapterTag: "10章",
              outlineStructure: "",
            } as any,
          } as CustomNode,
        ];
        nodesRef.current = next;
        return next;
      });

      scheduleCanvasAutoSave();
      return { groupId, settingsNodeId };
    },
    [getNextCanvasNodeId, getViewportCenteredCanvasPosition, hasIdea, scheduleCanvasAutoSave, setNodes]
  );

  const openOutlineSettingsForRequest = useCallback(
    (options?: {
      sourceNodeId?: string;
      files?: Record<string, string>;
      title?: string;
      insertPosition?: "center" | "right";
    }) => {
      const resolvedSourceNodeId = getTextValue(options?.sourceNodeId);
      const result =
        resolvedSourceNodeId && nodesRef.current.some((node) => node.id === resolvedSourceNodeId)
          ? appendOutlineSettingsToGroup(resolvedSourceNodeId, {
            files: options?.files,
            title: options?.title,
          })
          : createStandaloneOutlineSettingsGroup({
            files: options?.files,
            title: options?.title,
            insertPosition: options?.insertPosition,
          });

      const focusNodeId = result.settingsNodeId || result.groupId;
      if (focusNodeId) {
        rememberLatestGeneratedNode(focusNodeId);
        focusCanvasNodeWhenReady(focusNodeId, { zoom: 0.95, duration: 500, preferGroup: false });
      }

      return result;
    },
    [
      appendOutlineSettingsToGroup,
      createStandaloneOutlineSettingsGroup,
      focusCanvasNodeWhenReady,
      getTextValue,
      rememberLatestGeneratedNode,
    ]
  );

  const appendOutlineCardsToGroup = useCallback(
    (
      sourceNodeId: string,
      outlineCards: Array<{
        title?: string;
        filePath?: string;
        content?: string;
        image?: string;
        isStreaming?: boolean;
        fromApi?: boolean;
        skipAutoStream?: boolean;
      }>
    ) => {
      const latestNodes = nodesRef.current;
      const latestEdges = edgesRef.current as CustomEdge[];
      const source = latestNodes.find((node) => node.id === sourceNodeId);
      if (!source || !outlineCards.length) return { groupId: "", outlineNodeIds: [] as string[] };

      const isSourceOutlineGroup =
        source.type === "roleGroup" && getTextValue(source.data?.label) === "大纲";
      const groupId = isSourceOutlineGroup ? source.id : `outline-group-${sourceNodeId}`;
      const cardWidth = OUTLINE_GROUP_CARD_WIDTH;
      const cardHeight = OUTLINE_GROUP_CARD_HEIGHT;
      const gapX = OUTLINE_GROUP_CARD_GAP_X;
      const gapY = OUTLINE_GROUP_CARD_GAP_Y;
      const cols = OUTLINE_GROUP_MAX_COLS;
      const settingsHeight = getOutlineGroupSettingsHeight(latestNodes, groupId);
      const hasSettingsNode = settingsHeight > 0;
      const groupPaddingTop = getOutlineGroupCardsTop(settingsHeight);
      const groupPadding = OUTLINE_GROUP_HORIZONTAL_PADDING;
      const minGroupWidth = hasSettingsNode
        ? OUTLINE_GROUP_SETTINGS_CARD_WIDTH + OUTLINE_GROUP_HORIZONTAL_PADDING * 2
        : 340;
      const existingGroup = latestNodes.find((node) => node.id === groupId);
      const groupSourceId = isSourceOutlineGroup
        ? getTextValue((source.data as any)?.outlineSourceId) ||
        getTextValue(latestEdges.find((edge) => edge.target === groupId)?.source) ||
        sourceNodeId
        : sourceNodeId;
      const groupPosition = existingGroup
        ? existingGroup.position
        : getLinkedCardPosition(groupSourceId, latestNodes, latestEdges, "attribute");
      const outlineNodeIds = outlineCards.map(() => getNextCanvasNodeId("outline-group-card"));

      setNodes((prev) => {
        const currentSource = prev.find((node) => node.id === sourceNodeId);
        if (!currentSource) return prev;
        const existingOutlineNodes = prev
          .filter((node) => {
            const belongsToGroup =
              node.parentId === groupId ||
              getTextValue((node.data as any)?.outlineGroupId) === groupId;
            if (!belongsToGroup) return false;
            return node.type === "outlineCard";
          })
          .sort((a, b) => {
            const ay = Number(a.position?.y ?? 0);
            const by = Number(b.position?.y ?? 0);
            if (ay !== by) return ay - by;
            return Number(a.position?.x ?? 0) - Number(b.position?.x ?? 0);
          });
        const startIndex = existingOutlineNodes.length;
        const outlineNodes = outlineCards.map((item, index) => {
          const idx = startIndex + index;
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          return {
            id: outlineNodeIds[index],
            type: "outlineCard",
            parentId: groupId,
            position: {
              x: groupPadding + col * (cardWidth + gapX),
              y: groupPaddingTop + row * (cardHeight + gapY),
            },
            draggable: hasIdea,
            data: {
              label: "大纲",
              title: item.title ?? "",
              filePath: item.filePath ?? "",
              content: item.content ?? "",
              image: item.image ?? "",
              fromApi: item.fromApi ?? true,
              outlineGroupId: groupId,
              isStreaming: item.isStreaming ?? false,
              expandable: true,
              allowTitleEdit: true,
              allowImageUpload: false,
              inspirationWord: currentSource.data?.inspirationWord,
              inspirationTheme: currentSource.data?.inspirationTheme,
              shortSummary: currentSource.data?.shortSummary,
              storySetting: currentSource.data?.storySetting,
              inspirationDrawId: currentSource.data?.inspirationDrawId ?? inspirationDrawId,
              skipAutoStream: item.skipAutoStream ?? false,
            } as any,
          } as CustomNode;
        });
        const totalCount = existingOutlineNodes.length + outlineNodes.length;
        const rows = Math.max(1, Math.ceil(totalCount / cols));
        const colsUsed = Math.min(cols, totalCount);
        const nextGroupWidth = Math.max(
          minGroupWidth,
          groupPadding * 2 + colsUsed * cardWidth + Math.max(0, colsUsed - 1) * gapX
        );
        const nextGroupHeight = hasSettingsNode
          ? Math.max(
            OUTLINE_GROUP_SETTINGS_TOP + settingsHeight + groupPadding,
            groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding
          )
          : groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding;
        const next = [...prev];
        const hasGroup = next.some((node) => node.id === groupId);
        if (!hasGroup) {
          next.push({
            id: groupId,
            type: "roleGroup",
            position: groupPosition,
            draggable: hasIdea,
            dragHandle: ".role-group-drag-handle",
            selectable: true,
            data: { label: "大纲", outlineSourceId: sourceNodeId } as any,
            style: { width: nextGroupWidth, height: nextGroupHeight, zIndex: 0 } as any,
          } as any);
        }
        const groupIndex = next.findIndex((node) => node.id === groupId);
        if (groupIndex >= 0) {
          const currentGroup = next[groupIndex] as any;
          next[groupIndex] = {
            ...currentGroup,
            style: {
              ...(currentGroup?.style ?? {}),
              width: Math.max(Number(currentGroup?.style?.width ?? 0), nextGroupWidth),
              height: Math.max(Number(currentGroup?.style?.height ?? 0), nextGroupHeight),
              zIndex: Number(currentGroup?.style?.zIndex ?? 0),
            },
          };
        }
        next.push(...outlineNodes);
        const normalizedNext = compactGroupNodes(next as CustomNode[], groupId, {
          currentEdges: latestEdges,
        });
        nodesRef.current = normalizedNext;
        return normalizedNext;
      });

      setEdges((prev) => {
        if (isSourceOutlineGroup) {
          edgesRef.current = prev as CustomEdge[];
          return prev;
        }
        const next = [...prev];
        const groupEdgeId = `e${sourceNodeId}-${groupId}`;
        if (!next.some((edge) => edge.id === groupEdgeId)) {
          next.push({
            id: groupEdgeId,
            source: sourceNodeId,
            target: groupId,
            type: "default",
            animated: true,
          });
        }
        edgesRef.current = next;
        return next;
      });
      setCanvasReady(true);
      scheduleCanvasAutoSave();
      return { groupId, outlineNodeIds };
    },
    [getNextCanvasNodeId, hasIdea, inspirationDrawId, scheduleCanvasAutoSave, setEdges, setNodes]
  );

  const createCardByKey = useCallback(
    (
      key: CanvasCardKey,
      options?: {
        title?: string;
        filePath?: string;
        content?: string;
        image?: string;
        fromApi?: boolean;
        isStreaming?: boolean;
        allowTitleEdit?: boolean;
        allowImageUpload?: boolean;
        autoEdit?: boolean;
        skipAutoStream?: boolean;
        insertPosition?: "center" | "right";
        position?: { x: number; y: number };
      }
    ) => {
      const typeToCreate: CustomNode["type"] =
        key === "role" || key === "info"
          ? "settingCard"
          : key === "outline"
            ? "outlineCard"
            : "summaryCard";
      const labelToCreate =
        key === "brainstorm"
          ? "脑洞"
          : key === "summary"
            ? "故事梗概"
            : key === "role"
              ? "角色"
              : key === "info"
                ? "信息"
                : "大纲";

      const idToCreate = getNextCanvasNodeId(typeToCreate);

      setCanvasReady(true);
      setNodes((prev) => {
        const isBlankDraft =
          !options?.title &&
          !options?.content &&
          !options?.image &&
          !options?.filePath &&
          !options?.fromApi;
        const { x, y } = options?.position
          ? options.position
          : isBlankDraft
            ? options?.insertPosition === "right"
              ? getStandaloneNextRightInsertPosition(prev)
              : getViewportCenteredCanvasPosition(
                getDraftCardSize(key).width,
                getDraftCardSize(key).height
              )
            : getStandaloneNextRowPosition(prev);
        const newNode: CustomNode = {
          id: idToCreate,
          type: typeToCreate,
          position: { x, y },
          sourcePosition: key === "info" ? Position.Right : Position.Bottom,
          targetPosition: key === "info" ? Position.Left : Position.Top,
          draggable: true,
          data: {
            label: labelToCreate,
            title: options?.title ?? "",
            filePath: options?.filePath ?? "",
            content: options?.content ?? "",
            image: options?.image ?? "",
            fromApi: options?.fromApi ?? false,
            isStreaming: options?.isStreaming ?? false,
            inspirationDrawId: inspirationDrawId || undefined,
            allowTitleEdit: options?.allowTitleEdit ?? true,
            allowImageUpload: options?.allowImageUpload ?? true,
            autoEdit: options?.autoEdit ?? true,
            isBlankDraft,
            isBlankBrainstormDraft: key === "brainstorm" && isBlankDraft,
            brainstormAiMode: false,
            pendingGenerate: false,
            highlighted: false,
            skipAutoStream: options?.skipAutoStream ?? false,
          } as any,
        };
        return [...prev, newNode];
      });
      scheduleCanvasAutoSave();
      return idToCreate;
    },
    [getDraftCardSize, getNextCanvasNodeId, getViewportCenteredCanvasPosition, inspirationDrawId, scheduleCanvasAutoSave, setNodes]
  );

  const addInfoCardFromExternalFile = useCallback(
    (options: {
      title: string;
      content: string;
      filePath: string;
      clientX?: number;
      clientY?: number;
    }) => {
      setForceCanvasView(true);
      const nodeId = createCardByKey("info", {
        title: options.title,
        content: options.content,
        filePath: options.filePath,
        allowTitleEdit: true,
        allowImageUpload: false,
        autoEdit: true,
        insertPosition: "right",
      });
      rememberLatestGeneratedNode(nodeId);
      focusCanvasNodeWhenReady(nodeId, { zoom: 0.95, duration: 500 });
      return nodeId;
    },
    [
      createCardByKey,
      focusCanvasNodeWhenReady,
      rememberLatestGeneratedNode,
    ]
  );

  const handlePrepareBrainstormCard = useCallback(
    (nodeId: string) => {
      const currentNode = nodesRef.current.find((node) => node.id === nodeId);
      if (!currentNode) return;

      const normalizedLabel = getTextValue((currentNode.data as any)?.label);
      const outputType =
        normalizedLabel === "角色"
          ? "role"
          : normalizedLabel === "故事梗概" || normalizedLabel === "梗概"
            ? "summary"
            : normalizedLabel === "信息"
              ? "info"
              : normalizedLabel === "大纲" || normalizedLabel === "故事大纲"
                ? "outline"
                : "brainstorm";
      const promptSuffix =
        outputType === "role"
          ? "角色"
          : outputType === "summary"
            ? "故事梗概"
            : outputType === "info"
              ? "信息"
              : outputType === "outline"
                ? "故事大纲"
                : "脑洞";
      const title = getTextValue((currentNode.data as any)?.title).trim() || "中元节";
      const brainstormPrompt = `帮我生成${title}${promptSuffix}`;

      preparedGenerateSourceNodeIdRef.current = nodeId;
      preparedContextFilesRef.current = undefined;
      ignoreDialogReferencesForNextRequestRef.current = false;
      clearDialogPreviewsForNextRequestRef.current = undefined;
      handleOutputTypeChange(outputType);

      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? {
              ...node,
              data: {
                ...node.data,
                brainstormAiMode: true,
                pendingGenerate: true,
                highlighted: true,
              } as any,
            }
            : node
        )
      );

      setIdeaInputSource("default");
      setIdeaContent(brainstormPrompt);
      setForceCanvasView(true);
      setCanvasReady(true);
      focusCanvasNodeWhenReady(nodeId, { zoom: 0.95, duration: 500, preferGroup: false });
      msg("success", "已填充到输入框，请发送开始生成");
    },
    [focusCanvasNodeWhenReady, handleOutputTypeChange, msg, setNodes]
  );

  const startBrainstormPlaceholderBatch = useCallback((
    files: CanvasWriteFileCall[],
    mode: "replace" | "append" = "replace"
  ) => {
    const markdownFiles = files.filter((item) => item.filePath.endsWith(".md"));
    if (!markdownFiles.length) return brainstormBatchIdsRef.current;

    const existingIds = [...brainstormBatchIdsRef.current];
    if (!existingIds.length) {
      stopBrainstormProgress();
      brainstormProgressValueRef.current = 0;
    }

    const missingCount = markdownFiles.length - existingIds.length;
    if (missingCount <= 0) return existingIds;

    const batchTs = Date.now();
    const w = containerRef.current?.clientWidth || window.innerWidth || 1920;
    const cardWidth = 250;
    const cardSpacing = 25;
    const startY = 100;
    const centerX = w / 2;
    const totalWidth =
      markdownFiles.length * cardWidth + Math.max(0, markdownFiles.length - 1) * cardSpacing;
    const replaceBaseX = centerX - totalWidth / 2;
    const currentNodes = nodesRef.current;
    const appendBasePosition = getStandaloneNextRowPosition(currentNodes);
    const currentProgress = brainstormProgressValueRef.current;
    const nextIds = [
      ...existingIds,
      ...Array.from({ length: missingCount }, (_, index) => `brainstorm-${batchTs}-${existingIds.length + index + 1}`),
    ];
    const newPlaceholderIds = nextIds.slice(existingIds.length);
    brainstormBatchIdsRef.current = nextIds;

    const placeholderNodes = newPlaceholderIds.map((id, index) => {
      const globalIndex = existingIds.length + index;
      return {
        id,
        type: "summaryCard",
        position:
          mode === "replace" && existingIds.length === 0
            ? { x: replaceBaseX + globalIndex * (cardWidth + cardSpacing), y: startY }
            : {
              x: appendBasePosition.x + index * (cardWidth + cardSpacing),
              y: appendBasePosition.y,
            },
        draggable: true,
        data: {
          label: "脑洞",
          title: "",
          content: "",
          image: "",
          fromApi: true,
          progress: currentProgress,
          inspirationWord: "",
          inspirationTheme: "",
          inspirationDrawId: inspirationDrawId || undefined,
          allowTitleEdit: true,
          allowImageUpload: true,
          isStreaming: false,
        } as any,
      } as CustomNode;
    });

    setCanvasReady(true);
    if (mode === "replace" && existingIds.length === 0) {
      edgesRef.current = [];
      nodesRef.current = placeholderNodes;
      setEdges([]);
      setNodes(placeholderNodes);
    } else {
      nodesRef.current = [...currentNodes, ...placeholderNodes];
      setNodes((prev) => [...prev, ...placeholderNodes]);
    }
    if (!brainstormProgressTimerRef.current) {
      brainstormProgressTimerRef.current = setInterval(() => {
        const cur = brainstormProgressValueRef.current;
        const next = Math.min(92, cur + (cur < 30 ? 3 : cur < 70 ? 2 : 1));
        if (next === cur) return;
        brainstormProgressValueRef.current = next;
        const ids = brainstormBatchIdsRef.current;
        setNodes((prev) =>
          prev.map((n) =>
            ids.includes(n.id) ? { ...n, data: { ...(n.data as any), progress: next } } : n
          )
        );
      }, 120);
    }

    return nextIds;
  }, [inspirationDrawId, setEdges, setNodes, stopBrainstormProgress]);

  const updateBrainstormPlaceholderBatch = useCallback((
    files: CanvasWriteFileCall[],
    fallbackTitle: string,
    isFinalWrite: boolean
  ) => {
    const markdownFiles = files.filter((item) => item.filePath.endsWith(".md"));
    const ids = [...brainstormBatchIdsRef.current];
    if (isFinalWrite) {
      stopBrainstormProgress(100);
    }
    const progressValue = isFinalWrite ? 100 : brainstormProgressValueRef.current;
    setNodes((prev) => {
      const next: CustomNode[] = [];
      prev.forEach((node) => {
        const idx = ids.indexOf(node.id);
        if (idx < 0) {
          next.push(node);
          return;
        }
        const item = markdownFiles[idx];
        if (!item) {
          next.push(node);
          return;
        }
        next.push({
          ...node,
          type: "summaryCard",
          draggable: true,
          data: {
            ...(node.data as any),
            label: "脑洞",
            title: extractWriteFileTitle(item.filePath, `${fallbackTitle}${idx + 1}`),
            content: item.content,
            image: extractMarkdownImage(item.content),
            fromApi: true,
            progress: progressValue,
            inspirationDrawId: inspirationDrawId || undefined,
            allowTitleEdit: true,
            allowImageUpload: true,
            isStreaming: false,
          } as any,
        });
      });
      return next;
    });
  }, [inspirationDrawId, setNodes, stopBrainstormProgress]);

  const updateLoadingCard = useCallback((
    nodeId: string,
    key: CanvasCardKey,
    options?: {
      title?: string;
      filePath?: string;
      content?: string;
      image?: string;
      fromApi?: boolean;
      isStreaming?: boolean;
      allowTitleEdit?: boolean;
      allowImageUpload?: boolean;
      autoEdit?: boolean;
      isBlankDraft?: boolean;
      isBlankBrainstormDraft?: boolean;
      brainstormAiMode?: boolean;
      pendingGenerate?: boolean;
      highlighted?: boolean;
      skipAutoStream?: boolean;
    }
  ) => {
    const nextType: CustomNode["type"] =
      key === "role" || key === "info"
        ? "settingCard"
        : key === "outline"
          ? "outlineCard"
          : "summaryCard";
    const nextLabel =
      key === "brainstorm"
        ? "脑洞"
        : key === "summary"
          ? "故事梗概"
          : key === "role"
            ? "角色"
            : key === "info"
              ? "信息"
              : "大纲";
    const targetGroupId = getCanvasNodeGroupId(
      nodesRef.current.find((node) => node.id === nodeId)
    );
    setNodes((prev) => {
      const updatedNodes = prev.map((node) =>
        node.id !== nodeId
          ? node
          : {
            ...node,
            type: nextType,
            sourcePosition: key === "info" ? Position.Right : Position.Bottom,
            targetPosition: key === "info" ? Position.Left : Position.Top,
            data: {
              ...node.data,
              label: nextLabel,
              title: options?.title ?? "",
              filePath: options?.filePath ?? getTextValue((node.data as any)?.filePath),
              content: options?.content ?? "",
              image: options?.image ?? "",
              fromApi: options?.fromApi ?? true,
              isStreaming: options?.isStreaming ?? false,
              progress: options?.isStreaming ? (node.data as any)?.progress ?? 0 : 100,
              inspirationDrawId: inspirationDrawId || undefined,
              allowTitleEdit: options?.allowTitleEdit ?? true,
              allowImageUpload: options?.allowImageUpload ?? (key !== "outline" && key !== "info"),
              autoEdit: options?.autoEdit ?? true,
              isBlankDraft: options?.isBlankDraft ?? false,
              isBlankBrainstormDraft: options?.isBlankBrainstormDraft ?? false,
              brainstormAiMode: options?.brainstormAiMode ?? false,
              pendingGenerate: options?.pendingGenerate ?? false,
              highlighted: options?.highlighted ?? false,
              skipAutoStream: options?.skipAutoStream ?? false,
            } as any,
          }
      );
      const relayoutNodes = relayoutGroupsForNodeIds(updatedNodes, [nodeId], {
        shiftOtherTopLevelNodes: false,
      });
      nodesRef.current = relayoutNodes;
      return relayoutNodes;
    });
    if (targetGroupId) {
      scheduleGroupMeasureRelayout(targetGroupId, {
        shiftOtherTopLevelNodes: false,
      });
    }
  }, [inspirationDrawId, relayoutGroupsForNodeIds, scheduleGroupMeasureRelayout, setNodes]);

  const removeLoadingCard = useCallback((nodeId: string) => {
    const currentNode = nodes.find((node) => node.id === nodeId);
    const parentId = currentNode?.parentId;
    const shouldRemoveParent =
      parentId &&
      nodes.filter((node) => node.parentId === parentId).length <= 1;

    finishLoadingProgressForNode(nodeId, 0);

    setNodes((prev) =>
      prev.filter((node) => node.id !== nodeId && (!shouldRemoveParent || node.id !== parentId))
    );
    if (shouldRemoveParent && parentId) {
      setEdges((prev) =>
        prev.filter((edge) => edge.source !== parentId && edge.target !== parentId)
      );
    }
  }, [finishLoadingProgressForNode, nodes, setEdges, setNodes]);

  const handleGenerateOutlineFromContext = useCallback(
    async (
      nodeId: string,
      options?: CanvasGenerateOutlineOptions
    ) => {
      handleOutputTypeChange("outline");
      const shouldOpenOutlineConfig =
        !options ||
        (!Number.isFinite(Number(options.chapterNum)) && !String(options.requirement ?? "").trim());
      if (shouldOpenOutlineConfig) {
        const result = openOutlineSettingsForRequest({
          sourceNodeId: nodeId,
          files: options?.files,
          title: options?.title,
        });
        if (!result.groupId) {
          msg("warning", "无法创建大纲组");
        }
        return;
      }
      const chapterNumRaw = Number(options?.chapterNum ?? 10);
      const chapterNum = Number.isFinite(chapterNumRaw)
        ? Math.min(200, Math.max(1, Math.round(chapterNumRaw)))
        : 10;
      const requirement = String(options?.requirement ?? "").trim();
      const outlineIdea = [
        `章节数：${chapterNum}`,
        requirement,
      ]
        .filter(Boolean)
        .join("\n");
      const linkedFiles = getConnectedContextFiles(nodeId);
      const mergedFiles = mergeFileRecords(options?.files, linkedFiles);
      void handleGenerateInsRef.current?.(
        "manual",
        outlineIdea,
        "outline",
        nodeId,
        mergedFiles,
        options?.actionLabel,
        undefined,
        false,
        options?.includeDialogReferences ?? true,
        options?.clearDialogPreviewsAfterRequest
      );
    },
    [getConnectedContextFiles, handleOutputTypeChange, mergeFileRecords, msg, openOutlineSettingsForRequest]
  );

  const buildParentChain = useCallback(
    (targetId: string): ParentNode | null => {
      const edge = (edges as CustomEdge[]).find((e) => e.target === targetId);
      if (!edge) return null;
      const parent = nodes.find((n) => n.id === edge.source);
      if (!parent) return null;
      const parentChain = buildParentChain(edge.source);
      const node: ParentNode = {
        id: parent.id,
        type: parent.type,
        label: parent.data?.label ?? "",
        data: parent.data,
        next: null,
      };
      if (parentChain) {
        let tail = parentChain;
        while (tail.next) tail = tail.next;
        tail.next = node;
        return parentChain;
      }
      return node;
    },
    [nodes, edges]
  );

  const handleOutlineGenerate = useCallback(
    (nodeId: string) => {
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (!currentNode) return;
      let chain = buildParentChain(nodeId);
      const current: ParentNode = {
        id: currentNode.id,
        type: currentNode.type,
        label: currentNode.data?.label ?? "",
        data: currentNode.data,
        next: null,
      };
      if (chain) {
        let tail = chain;
        while (tail.next) tail = tail.next;
        tail.next = current;
      } else chain = current;
      setCurrentChain(chain);
      setInitWorkDialogShow(true);
    },
    [nodes, buildParentChain]
  );

  const generateFiles = useCallback((): Record<string, string> => {
    const files: Record<string, string> = {
      "大纲.md": "",
      "故事设定/故事简介.md": "",
      "故事设定/故事设定.md": "",
    };
    if (!currentChain) return files;
    let cur: ParentNode | null = currentChain;
    while (cur) {
      if (cur.type === "summaryCard" && cur.data?.content)
        files["故事设定/故事简介.md"] = cur.data.content;
      if (cur.type === "settingCard" && cur.data?.content)
        files["故事设定/故事设定.md"] = cur.data.content;
      if (cur.type === "outlineCard" && cur.data?.content)
        files["大纲.md"] = cur.data.content;
      cur = cur.next;
    }
    return files;
  }, [currentChain]);

  const handleCreateHere = useCallback(() => {
    const files = generateFiles();
    onCreateHere?.(files, currentChain);
    setInitWorkDialogShow(false);
  }, [generateFiles, currentChain, onCreateHere]);

  const handleCreateNew = useCallback(() => {
    const files = generateFiles();
    onCreateNew?.(files, currentChain);
    setInitWorkDialogShow(false);
  }, [generateFiles, currentChain, onCreateNew]);

  const handleGenerateIns = useCallback(async (
    requestType: "auto" | "manual" = "auto",
    ideaOverride?: string,
    outputTypeOverride?: CanvasOutputType,
    sourceNodeId?: string,
    filesOverride?: Record<string, string>,
    contextActionLabelOverride?: string,
    requestSourceOverride?: "default" | "carousel",
    resetOutputTypeAfterFinish = false,
    includeDialogReferencesOverride = true,
    clearDialogPreviewsAfterRequestOverride?: boolean
  ) => {

    if (isLoading) return;
    const ideaSource = typeof ideaOverride === "string" ? ideaOverride : ideaContent;
    const trimmedIdea = ideaSource?.trim?.() ? ideaSource.trim() : "";
    const effectiveOutputType = outputTypeOverride ?? canvasOutputType;
    if (outputTypeOverride && outputTypeOverride !== canvasOutputType) {
      handleOutputTypeChange(outputTypeOverride);
    }
    const cardOutputType: Exclude<CanvasOutputType, "auto"> =
      effectiveOutputType === "auto" ? "brainstorm" : effectiveOutputType;
    const isAutoRequest = requestType === "auto";
    const isAutoEmptyRequest = isAutoRequest && !trimmedIdea;
    const effectiveSourceNodeId =
      getTextValue(sourceNodeId) || getTextValue(preparedGenerateSourceNodeIdRef.current);
    const sourceNode = effectiveSourceNodeId
      ? nodes.find((node) => node.id === effectiveSourceNodeId)
      : undefined;
    const sourceNodeData = (sourceNode?.data ?? {}) as any;
    const isContextGenerateAction = Boolean(getTextValue(contextActionLabelOverride));
    const shouldReuseSourceDraftNode =
      !isAutoRequest &&
      !isContextGenerateAction &&
      Boolean(effectiveSourceNodeId) &&
      (
        (cardOutputType === "brainstorm" && Boolean(sourceNodeData?.isBlankBrainstormDraft)) ||
        ((cardOutputType === "summary" || cardOutputType === "info") && Boolean(sourceNodeData?.isBlankDraft))
      );
    const sourceNodeFilePath = getTextValue((sourceNode?.data as any)?.filePath);
    const sourceNodeFileContent = getTextValue(sourceNode?.data?.content);
    const shouldIncludeDialogReferences =
      includeDialogReferencesOverride && !ignoreDialogReferencesForNextRequestRef.current;
    const shouldClearDialogPreviews =
      clearDialogPreviewsAfterRequestOverride ??
      clearDialogPreviewsForNextRequestRef.current ??
      true;
    const selectedDialogReferences = shouldIncludeDialogReferences ? [...dialogCardPreviews] : [];
    const selectedDialogReferenceIds = selectedDialogReferences
      .map((item) => getTextValue(item.nodeId))
      .filter(Boolean);
    const selectedDialogReferenceEdgeSourceIds =
      sourceNode?.type === "roleGroup" && cardOutputType === "info"
        ? selectedDialogReferenceIds.filter((referenceNodeId) => {
          const referenceNode = nodesRef.current.find((node) => node.id === referenceNodeId);
          if (!referenceNode || !effectiveSourceNodeId) return true;
          const parentGroupId =
            getTextValue(referenceNode.parentId) ||
            getTextValue((referenceNode.data as any)?.roleGroupId) ||
            getTextValue((referenceNode.data as any)?.outlineGroupId);
          return parentGroupId !== effectiveSourceNodeId;
        })
        : selectedDialogReferenceIds;
    const selectedDialogReferenceFiles = getDialogReferenceFiles(selectedDialogReferences);
    const shouldUseSmartThemeForRequest = selectedDialogReferences.length > 0;
    const effectiveRequestSource = requestSourceOverride ?? ideaInputSource;
    const shouldUseCarouselSmartTheme =
      effectiveRequestSource === "carousel" &&
      !sourceNodeId &&
      !filesOverride &&
      !contextActionLabelOverride;
    const shouldUseDefaultSmartTheme =
      isAutoRequest &&
      effectiveRequestSource !== "carousel" &&
      !sourceNodeId &&
      !filesOverride &&
      !contextActionLabelOverride;
    const baseRequestFiles = mergeFileRecords(
      filesOverride && Object.keys(filesOverride).length > 0
        ? filesOverride
        : sourceNodeFilePath
          ? { [sourceNodeFilePath]: sourceNodeFileContent }
          : undefined,
      preparedContextFilesRef.current,
      selectedDialogReferenceFiles
    );
    const hasReferenceFiles = Boolean(baseRequestFiles && Object.keys(baseRequestFiles).length > 0);
    const requestFiles = hasReferenceFiles ? mergeCreationIdeaIntoFiles(baseRequestFiles) : undefined;
    const outlineConfigFiles = mergeFileRecords(
      requestFiles,
      trimmedIdea ? { "/大纲需求.md": trimmedIdea } : undefined
    );
    preparedContextFilesRef.current = undefined;
    preparedGenerateSourceNodeIdRef.current = undefined;
    ignoreDialogReferencesForNextRequestRef.current = false;
    clearDialogPreviewsForNextRequestRef.current = undefined;
    if (shouldClearDialogPreviews) {
      setDialogCardPreviews([]);
    }
    const shouldOpenOutlineConfigFromDock =
      !isAutoRequest &&
      cardOutputType === "outline" &&
      !isContextGenerateAction &&
      effectiveRequestSource === "default" &&
      resetOutputTypeAfterFinish;
    if (shouldOpenOutlineConfigFromDock) {
      setPendingContextActionLabel("");
      setReqPanelVisible(false);
      setReqPanelUseSmartTheme(false);
      setSmartSuggestionsActive(false);
      setSmartSuggestions([]);
      resetReqPanelTextRefs();
      setReqPanelAction(null);
      setForceCanvasView(true);
      setCanvasReady(true);
      const result = openOutlineSettingsForRequest({
        sourceNodeId: effectiveSourceNodeId,
        files: outlineConfigFiles,
        title: trimmedIdea,
      });
      if (!result.groupId) {
        msg("warning", "无法创建大纲组");
      }
      return;
    }
    const hasExplicitCardTypeInIdea =
      !isAutoRequest &&
      (
        trimmedIdea.includes("故事梗概卡") ||
        trimmedIdea.includes("梗概卡") ||
        trimmedIdea.includes("角色卡") ||
        trimmedIdea.includes("故事大纲卡") ||
        trimmedIdea.includes("大纲卡") ||
        trimmedIdea.includes("信息卡") ||
        trimmedIdea.includes("脑洞卡")
      );
    const outputTypeLabel =
      OUTPUT_TYPE_OPTIONS.find((item) => item.key === cardOutputType)?.label ?? cardOutputType;
    let shouldAutoSaveAfterStream = false;
    let shouldResetOutputTypeToAuto = false;
      abortRequestedRef.current = false;
      pausedRequestMessageRef.current = "";
    canvasRequestAbortControllerRef.current?.abort();
    const requestAbortController = new AbortController();
    canvasRequestAbortControllerRef.current = requestAbortController;
    try {
      setPendingContextActionLabel(contextActionLabelOverride?.trim?.() || "");
      setReqPanelVisible(true);
      setReqPanelUseSmartTheme(
        shouldUseSmartThemeForRequest ||
        shouldUseCarouselSmartTheme ||
        shouldUseDefaultSmartTheme
      );
      setSmartSuggestionsActive(false);
      setSmartSuggestions([]);
      resetReqPanelTextRefs();
      setReqPanelAction(null);

      setForceCanvasView(true);
      setCanvasReady(true);
      resetGenerationSettings();
      if (effectiveOutputType !== "auto") {
        handleOutputTypeChange(effectiveOutputType);
      }
      rememberLatestGeneratedNode("");

      if (isAutoRequest) {
        shouldResetOutputTypeToAuto = true;
        setIsLoading(true);
        setCardKeyLabel(isAutoEmptyRequest ? "智能" : outputTypeLabel);
        setReqPanelTitle(isAutoEmptyRequest ? "随机选题" : `${outputTypeLabel}卡`);
        setReqPanelStatus("loading");
        setReqPanelDetail("");
        activeCanvasRequestAbortCleanupRef.current = () => {
          setPendingSuggestionIdea("");
          setSmartSuggestions([]);
          setSmartSuggestionsActive(false);
        };
        const { postCanvasChoicesStream } = await import("@/api/works");
        let streamError: any = null;
        let hasChoiceList = false;
        let hasUpdatesContent = false;
        let hasWriteFileSuggestions = false;
        const persistedReplySegments: ReplySegments = { start: "", middle: "", end: "" };
        const partialPanelOrderedIds = new Set<string>();
        const partialPanelContentById = new Map<string, string>();

        await postCanvasChoicesStream(
          {
            prompt: isAutoEmptyRequest
              ? "随机生成一个脑洞"
              : `${trimmedIdea}`,
            mode: canvasModelType,
            type: requestType,
            files: requestFiles,
          },
          (streamData: any) => {
            if (streamData?.event === "messages/partial") {
              const changed = collectPartialPanelMessagesById(
                streamData?.data,
                partialPanelOrderedIds,
                partialPanelContentById
              );
              if (changed) {
                const { detail, body, footer } = getPanelTextsFromMessageMap(
                  partialPanelOrderedIds,
                  partialPanelContentById
                );
                // syncReqPanelTextRefs(detail, body, footer);
              }
              return;
            }
            if (streamData?.event === "end") {
              setPendingSuggestionIdea('');
            }
            if (streamData?.event !== "updates") return;
            const replySegments = extractReplySegmentsFromToolFiles(streamData?.data);
            if (replySegments.start) persistedReplySegments.start = replySegments.start;
            if (replySegments.middle) persistedReplySegments.middle = replySegments.middle;
            if (replySegments.end) persistedReplySegments.end = replySegments.end;
            const hasReplySegmentContent = Boolean(
              persistedReplySegments.start ||
              persistedReplySegments.middle ||
              persistedReplySegments.end
            );
            if (hasReplySegmentContent) {
              syncReqPanelTextRefs(
                persistedReplySegments.start || reqPanelDetailRef.current,
                persistedReplySegments.middle || reqPanelBodyDetailRef.current,
                persistedReplySegments.end || reqPanelFooterDetailRef.current
              );
              hasUpdatesContent = true;
            }
            const latestCreationIdea = extractCreationIdeaFileContent(streamData?.data);
            if (latestCreationIdea) {
              syncCreationIdeaContent(latestCreationIdea);
            }
            const writeFiles = extractUpdateToolFiles(streamData?.data);
            persistGeneratedWriteFiles(writeFiles);
            const nextTaskPanelLabel = getNextTaskPanelLabelFromStream(streamData?.data);
            if (nextTaskPanelLabel) {
              nextReqPanelTaskLabelRef.current = nextTaskPanelLabel;
            }
            if (!hasWriteFileSuggestions) {
              const choicesContent = extractChoicesToolFileContent(streamData?.data);
              if (choicesContent) {
                const suggestionItems = parseChoicesSuggestionItems(choicesContent);
                if (suggestionItems.length > 0) {
                  hasUpdatesContent = true;
                  hasChoiceList = true;
                  hasWriteFileSuggestions = true;
                  setSmartSuggestions(suggestionItems);
                  setSmartSuggestionsActive(true);
                }
              }
            }
            const toolFileContent = extractDisplayToolFileContent(streamData?.data);
            const updatesContent =
              toolFileContent || extractUpdatesMessageContentWithoutReadFile(streamData?.data);
            if (!updatesContent && !latestCreationIdea) return;

            hasUpdatesContent = true;
            const { head, middle, tail } = updatesContent
              ? splitAutoUpdatesContent(updatesContent)
              : {
                head: reqPanelDetailRef.current || `正在生成${outputTypeLabel}卡，请稍等...`,
                middle: [] as string[],
                tail: reqPanelFooterDetailRef.current,
              };

            setReqPanelTitle(isAutoEmptyRequest ? "随机选题" : `${outputTypeLabel}卡`);
            const mergedDetail = persistedReplySegments.start || head || updatesContent;
            const mergedBody = persistedReplySegments.middle || middle.join("\n\n");
            const mergedFooter = persistedReplySegments.end || tail;
            syncReqPanelWithCreationIdea(
              mergedDetail,
              mergedBody,
              mergedFooter,
              persistedReplySegments.middle ? undefined : latestCreationIdea
            );

            if (hasWriteFileSuggestions) {
              setReqPanelAction(null);
            } else {
              hasChoiceList = false;
              setSmartSuggestions([]);
              setSmartSuggestionsActive(false);
              setReqPanelAction(null);
            }

          },
          (error: any) => {
            streamError = error;
          },
          () => { },
          { signal: requestAbortController.signal, showError: false }
        );

          if (abortRequestedRef.current) {
            activeCanvasRequestAbortCleanupRef.current?.();
            setReqPanelStatus("paused");
            setReqPanelDetail("");
            setReqPanelBodyDetail("");
            setReqPanelFooterDetail("");
            setReqPanelAction(null);
            setPendingSuggestionIdea("");
            setPendingContextActionLabel("");
            setSmartSuggestions([]);
            setSmartSuggestionsActive(false);
            setIsLoading(false);
            stopLoadingProgress();
            return;
          }

        if (streamError) {
          throw streamError;
        }

        if (hasUpdatesContent || hasChoiceList) {
          setReqPanelStatus("success");
          if (!hasChoiceList) {
            setSmartSuggestionsActive(false);
          }
        } else {
          setReqPanelStatus("error");
          setReqPanelDetail("");
          msg("warning", "返回数据格式不正确，请重试");
        }
        setIsLoading(false);
        return;
      } else {
        shouldResetOutputTypeToAuto = true;
        canvasAutoSaveSuppressedRef.current = true;
        setIsLoading(true);
        setCardKeyLabel(outputTypeLabel);
        setReqPanelTitle(`${outputTypeLabel}卡`);
        setReqPanelStatus("loading");
        setReqPanelDetail("");
        const { postCanvasChoicesStream } = await import("@/api/works");
        let streamError: any = null;
        let hasChoiceList = false;
        const partialPanelOrderedIds = new Set<string>();
        const partialPanelContentById = new Map<string, string>();
        const collectedWriteFilesByPath = new Map<string, CanvasWriteFileCall>();
        const persistedReplySegments: ReplySegments = { start: "", middle: "", end: "" };
        const streamedNodeIdsByCallId = new Map<string, string>();
        const streamedNodeIdsByFilePath = new Map<string, string>();
        const streamPendingNodeIds = new Set<string>();
        const standaloneGroupIdsByKey = new Map<"role" | "outline", string>();
        const requestedCardKey =
          ({
            brainstorm: "brainstorm",
            role: "role",
            summary: "summary",
            outline: "outline",
            info: "info",
          }[cardOutputType] as CanvasCardKey);
        const resolveReusableRoleDraftNodeId = () => {
          if (requestedCardKey !== "role" || !effectiveSourceNodeId) return "";
          const latestNodes = nodesRef.current;
          const source =
            latestNodes.find((node) => node.id === effectiveSourceNodeId) ||
            nodes.find((node) => node.id === effectiveSourceNodeId);
          if (!source) return "";
          const groupId =
            source.type === "roleGroup"
              ? source.id
              : getTextValue(source.parentId) || getTextValue((source.data as any)?.roleGroupId);
          if (!groupId) return "";
          const sourceIsReusable =
            source.type === "settingCard" &&
            getTextValue(source.data?.label) === "角色" &&
            Boolean((source.data as any)?.isBlankDraft) &&
            !isRelationshipWriteFile(getTextValue((source.data as any)?.filePath));
          if (sourceIsReusable) return source.id;
          return latestNodes.find((node) => {
            if (node.type !== "settingCard") return false;
            const belongsToGroup =
              getTextValue(node.parentId) === groupId ||
              getTextValue((node.data as any)?.roleGroupId) === groupId;
            if (!belongsToGroup) return false;
            if (getTextValue(node.data?.label) !== "角色") return false;
            if (!Boolean((node.data as any)?.isBlankDraft)) return false;
            if (Boolean((node.data as any)?.pendingGenerate) || Boolean((node.data as any)?.isStreaming)) {
              return false;
            }
            return !isRelationshipWriteFile(getTextValue((node.data as any)?.filePath));
          })?.id ?? "";
        };
        const useContextLinkedCreation = Boolean(effectiveSourceNodeId);
        const reusableRoleDraftNodeId = resolveReusableRoleDraftNodeId();
        const isReusingRoleDraftNode =
          requestedCardKey === "role" && Boolean(reusableRoleDraftNodeId);
        // 统一脑洞/梗概多卡的占位与布局逻辑：
        // 脑洞不再走专用 batch placeholder 流程，直接复用梗概当前的
        // loadingCard + task_num 补占位 + 横向排布逻辑。
        const useBrainstormBatchLoading = false;
        if (useBrainstormBatchLoading) {
          // Reset cross-request batch state to avoid replacing previous brainstorm cards.
          stopBrainstormProgress();
          brainstormBatchIdsRef.current = [];
          brainstormProgressValueRef.current = 0;
        }
        // manual 请求一开始就创建占位；角色/大纲优先创建分组占位。
        // 当“AI生成”来自可复用的空白草稿（脑洞/梗概/信息）时，应直接复用当前草稿卡。
        const shouldCreateLoadingCard = !useBrainstormBatchLoading;
        const createStandaloneGroupedCardByKey = (
          key: "role" | "outline",
          options?: {
            title?: string;
            filePath?: string;
            content?: string;
            image?: string;
            fromApi?: boolean;
            isStreaming?: boolean;
            skipAutoStream?: boolean;
          }
        ) => {
          const cardWidth = key === "role" ? ROLE_GROUP_CARD_WIDTH : OUTLINE_GROUP_CARD_WIDTH;
          const cardHeight = key === "role" ? ROLE_GROUP_CARD_HEIGHT : OUTLINE_GROUP_CARD_HEIGHT;
          const gapX = key === "role" ? ROLE_GROUP_CARD_GAP_X : OUTLINE_GROUP_CARD_GAP_X;
          const gapY = key === "role" ? ROLE_GROUP_CARD_GAP_Y : OUTLINE_GROUP_CARD_GAP_Y;
          const cols = key === "role" ? ROLE_GROUP_MAX_COLS : OUTLINE_GROUP_MAX_COLS;
          const groupPaddingTop = key === "role" ? ROLE_GROUP_PADDING_TOP : OUTLINE_GROUP_DEFAULT_TOP;
          const groupPadding = key === "role" ? ROLE_GROUP_PADDING : OUTLINE_GROUP_HORIZONTAL_PADDING;
          const minGroupWidth = 340;
          const groupLabel = key === "role" ? "角色" : "大纲";
          const groupId =
            standaloneGroupIdsByKey.get(key) || getNextCanvasNodeId(`${key}-group-loading`);
          const createdNodeId = getNextCanvasNodeId(`${key}-group-card-loading`);
          standaloneGroupIdsByKey.set(key, groupId);

          setCanvasReady(true);
          setNodes((prev) => {
            const next = [...prev];
            let groupNode = next.find((node) => node.id === groupId) || null;

            if (!groupNode) {
              const { x, y } = getStandaloneNextRowPosition(prev);
              groupNode = {
                id: groupId,
                type: "roleGroup",
                position: { x, y },
                draggable: hasIdea,
                dragHandle: ".role-group-drag-handle",
                selectable: true,
                data:
                  key === "outline"
                    ? ({ label: groupLabel, outlineSourceId: "" } as any)
                    : ({ label: groupLabel } as any),
                style: {
                  width: minGroupWidth,
                  height:
                    key === "role"
                      ? Math.max(ROLE_GROUP_MIN_HEIGHT, groupPaddingTop + cardHeight + groupPadding)
                      : groupPaddingTop + cardHeight + groupPadding,
                  zIndex: 0,
                } as any,
              } as any;
              next.push(groupNode as CustomNode);
            }
            const existingChildren = next.filter((node) => {
              if (key === "role") {
                return (
                  node.type === "settingCard" &&
                  getTextValue(node.data?.label) === "角色" &&
                  (node.data as any)?.roleGroupId === groupId
                );
              }
              return node.type === "outlineCard" && (node.data as any)?.outlineGroupId === groupId;
            });
            const idx = existingChildren.length;
            const col = idx % cols;
            const row = Math.floor(idx / cols);

            next.push({
              id: createdNodeId,
              type: key === "role" ? "settingCard" : "outlineCard",
              parentId: groupId,
              position: {
                x: groupPadding + col * (cardWidth + gapX),
                y: groupPaddingTop + row * (cardHeight + gapY),
              },
              draggable: hasIdea,
              data: {
                label: key === "role" ? "角色" : "大纲",
                title: options?.title ?? "",
                filePath: options?.filePath ?? "",
                content: options?.content ?? "",
                image: options?.image ?? "",
                fromApi: options?.fromApi ?? true,
                isStreaming: options?.isStreaming ?? false,
                allowTitleEdit: true,
                allowImageUpload: key === "role",
                autoEdit: true,
                inspirationDrawId: inspirationDrawId || undefined,
                skipAutoStream: options?.skipAutoStream ?? false,
                ...(key === "role"
                  ? { roleGroupId: groupId }
                  : { outlineGroupId: groupId, expandable: true }),
              } as any,
            } satisfies CustomNode);

            const totalCount = existingChildren.length + 1;
            const rows = Math.max(1, Math.ceil(totalCount / cols));
            const colsUsed = Math.min(cols, totalCount);
            const nextGroupWidth = Math.max(
              minGroupWidth,
              groupPadding * 2 + colsUsed * cardWidth + Math.max(0, colsUsed - 1) * gapX
            );
            const nextGroupHeight =
              key === "role"
                ? Math.max(
                  ROLE_GROUP_MIN_HEIGHT,
                  groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding
                )
                : groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding;
            const groupIndex = next.findIndex((node) => node.id === groupId);
            if (groupIndex >= 0) {
              const currentGroup = next[groupIndex] as any;
              next[groupIndex] = {
                ...currentGroup,
                style: {
                  ...(currentGroup?.style ?? {}),
                  width: Math.max(Number(currentGroup?.style?.width ?? 0), nextGroupWidth),
                  height: Math.max(Number(currentGroup?.style?.height ?? 0), nextGroupHeight),
                  zIndex: Number(currentGroup?.style?.zIndex ?? 0),
                },
              };
            }

            const normalizedNext = compactGroupNodes(next as CustomNode[], groupId, {
              currentEdges: edgesRef.current as CustomEdge[],
            });
            nodesRef.current = normalizedNext;
            return normalizedNext;
          });
          scheduleGroupMeasureRelayout(groupId, {
            shiftOtherTopLevelNodes: false,
          });

          return createdNodeId;
        };
        const createContextLinkedSingleCardsBatch = (
          key: "brainstorm" | "summary" | "info",
          sourceId: string,
          cards: Array<{
            title?: string;
            filePath?: string;
            content?: string;
            image?: string;
            fromApi?: boolean;
            isStreaming?: boolean;
            allowTitleEdit?: boolean;
            allowImageUpload?: boolean;
            autoEdit?: boolean;
            skipAutoStream?: boolean;
          }>
        ) => {
          const normalizedSourceId = getTextValue(sourceId);
          if (!normalizedSourceId || !cards.length) return [] as string[];

          const sourceNode = nodesRef.current.find((node) => node.id === normalizedSourceId);
          if (!sourceNode) return [] as string[];

          const nextNodes = [...nodesRef.current];
          const nextEdges = [...(edgesRef.current as CustomEdge[])];
          const createdIds: string[] = [];

          cards.forEach((card) => {
            const isInfoCard = key === "info";
            const nodeId = getNextCanvasNodeId(isInfoCard ? "settingCard" : "summaryCard");
            const position = getLinkedCardPosition(
              normalizedSourceId,
              nextNodes,
              nextEdges,
              isInfoCard ? "info" : "attribute"
            );

            const nextNode: CustomNode = {
              id: nodeId,
              type: isInfoCard ? "settingCard" : "summaryCard",
              position,
              sourcePosition: isInfoCard ? Position.Right : Position.Bottom,
              targetPosition: isInfoCard ? Position.Left : Position.Top,
              draggable: hasIdea,
              data: {
                label: isInfoCard ? "信息" : key === "brainstorm" ? "脑洞" : "梗概",
                title: card.title ?? "",
                filePath: card.filePath ?? "",
                content: card.content ?? "",
                image: card.image ?? "",
                fromApi: card.fromApi,
                isStreaming: card.isStreaming ?? false,
                expandable: isInfoCard ? true : undefined,
                allowTitleEdit: card.allowTitleEdit,
                allowImageUpload: card.allowImageUpload,
                autoEdit: card.autoEdit,
                inspirationWord: sourceNode.data?.inspirationWord,
                inspirationTheme: sourceNode.data?.inspirationTheme,
                shortSummary: sourceNode.data?.shortSummary,
                storySetting: sourceNode.data?.storySetting,
                inspirationDrawId: sourceNode.data?.inspirationDrawId ?? inspirationDrawId,
                skipAutoStream: card.skipAutoStream ?? false,
              } as any,
            };

            const nextEdge = createDirectedCanvasEdge(
              normalizedSourceId,
              nodeId,
              isInfoCard
                ? {
                  sourceHandle: "source-right",
                  targetHandle: "target-left",
                }
                : undefined
            );

            nextNodes.push(nextNode);
            nextEdges.push(nextEdge);
            createdIds.push(nodeId);
          });

          setCanvasReady(true);
          nodesRef.current = nextNodes;
          edgesRef.current = nextEdges;
          setNodes(nextNodes);
          setEdges(nextEdges);
          scheduleCanvasAutoSave();

          return createdIds;
        };
        const createManualLoadingCard = () => {
          if (!shouldCreateLoadingCard) return "";

          if (shouldReuseSourceDraftNode && effectiveSourceNodeId) {
            return effectiveSourceNodeId;
          }

          const commonOptions = {
            title: "",
            content: "",
            image: "",
            fromApi: true,
            isStreaming: true,
            skipAutoStream: true,
          };

          if (requestedCardKey === "role") {
            if (isReusingRoleDraftNode) {
              return reusableRoleDraftNodeId;
            }
            if (useContextLinkedCreation && effectiveSourceNodeId) {
              return appendRoleCardsToGroup(effectiveSourceNodeId, [commonOptions]).roleNodeIds[0] ?? "";
            }
            return createStandaloneGroupedCardByKey("role", commonOptions);
          }

          if (requestedCardKey === "outline") {
            if (useContextLinkedCreation && effectiveSourceNodeId) {
              return appendOutlineCardsToGroup(effectiveSourceNodeId, [commonOptions]).outlineNodeIds[0] ?? "";
            }
            return createStandaloneGroupedCardByKey("outline", commonOptions);
          }

          if (useContextLinkedCreation && effectiveSourceNodeId) {
            if (requestedCardKey === "summary") {
              return addSummaryCard(effectiveSourceNodeId, {
                ...commonOptions,
                allowTitleEdit: true,
                allowImageUpload: true,
              });
            }
            if (requestedCardKey === "info") {
              return addSettingCard(effectiveSourceNodeId, {
                ...commonOptions,
                label: "信息",
                allowTitleEdit: true,
                allowImageUpload: false,
              });
            }
          }

          return createCardByKey(requestedCardKey, {
            ...commonOptions,
            allowTitleEdit: true,
            allowImageUpload: requestedCardKey !== "info",
            autoEdit: true,
          }) ?? "";
        };
        const loadingCardId = shouldCreateLoadingCard
          ? createManualLoadingCard()
          : "";
        const brainstormPlaceholderIds = useBrainstormBatchLoading
          ? startBrainstormPlaceholderBatch(
            [{ filePath: `brainstorm-placeholder-${Date.now()}.md`, content: "" }],
            brainstormBatchIdsRef.current.length > 0 || nodesRef.current.length > 0
              ? "append"
              : "replace"
          )
          : [];
        const brainstormLoadingCardId =
          brainstormPlaceholderIds[brainstormPlaceholderIds.length - 1] ?? "";
        const restoreReusedRoleDraftNode = (nodeId: string) => {
          if (!nodeId || !isReusingRoleDraftNode || nodeId !== reusableRoleDraftNodeId) return;
          finishLoadingProgressForNode(nodeId, 0);
          updateLoadingCard(nodeId, "role", {
            title: "",
            filePath: "",
            content: "",
            image: "",
            fromApi: false,
            isStreaming: false,
            allowTitleEdit: true,
            allowImageUpload: true,
            autoEdit: true,
            isBlankDraft: true,
            isBlankBrainstormDraft: false,
            brainstormAiMode: false,
            pendingGenerate: false,
            highlighted: false,
            skipAutoStream: false,
          });
        };
        const cleanupLoadingCard = (nodeId: string) => {
          if (!nodeId) return;
          if (isReusingRoleDraftNode && nodeId === reusableRoleDraftNodeId) {
            restoreReusedRoleDraftNode(nodeId);
            return;
          }
          removeLoadingCard(nodeId);
        };
        const extraLoadingCardIdsByKey = new Map<CanvasCardKey, string[]>();
        const registerExtraLoadingCardIds = (key: CanvasCardKey, nodeIds: string[]) => {
          if (!nodeIds.length) return;
          const existingIds = extraLoadingCardIdsByKey.get(key) ?? [];
          const dedupedIds = nodeIds.filter((nodeId) => nodeId && !existingIds.includes(nodeId));
          if (!dedupedIds.length) return;
          extraLoadingCardIdsByKey.set(key, [...existingIds, ...dedupedIds]);
        };
        const removeExtraLoadingCardId = (key: CanvasCardKey, nodeId: string) => {
          if (!nodeId) return;
          const existingIds = extraLoadingCardIdsByKey.get(key) ?? [];
          if (!existingIds.length) return;
          const nextIds = existingIds.filter((id) => id !== nodeId);
          if (nextIds.length > 0) {
            extraLoadingCardIdsByKey.set(key, nextIds);
          } else {
            extraLoadingCardIdsByKey.delete(key);
          }
        };
        const getUnboundPlaceholderNodes = (key?: CanvasCardKey) => {
          const boundNodeIds = new Set<string>([
            ...Array.from(streamedNodeIdsByCallId.values()),
            ...Array.from(streamedNodeIdsByFilePath.values()),
          ]);
          const currentNodes = nodesRef.current;
          const isPlaceholderNode = (node: CustomNode, targetKey: CanvasCardKey) => {
            if (!node || boundNodeIds.has(node.id) || node.id === loadingCardId) return false;
            const nodeData = (node.data ?? {}) as any;
            const isPendingPlaceholder =
              Boolean(nodeData.fromApi) &&
              (Boolean(nodeData.isStreaming) || Boolean(nodeData.pendingGenerate));
            if (!isPendingPlaceholder) return false;
            if (targetKey === "role") {
              return (
                node.type === "settingCard" &&
                getTextValue(nodeData.label) === "角色" &&
                !isRelationshipWriteFile(getTextValue(nodeData.filePath))
              );
            }
            if (targetKey === "outline") {
              return node.type === "outlineCard";
            }
            if (targetKey === "summary") {
              return node.type === "summaryCard" && getTextValue(nodeData.label) === "故事梗概";
            }
            if (targetKey === "brainstorm") {
              return node.type === "summaryCard" && getTextValue(nodeData.label) === "脑洞";
            }
            return node.type === "settingCard" && getTextValue(nodeData.label) === "信息";
          };
          const keys: CanvasCardKey[] = key
            ? [key]
            : ["role", "outline", "summary", "brainstorm", "info"];
          return currentNodes.filter((node) =>
            keys.some((targetKey) => isPlaceholderNode(node, targetKey))
          );
        };
        const isStableWriteFilePath = (filePath: string) => {
          const normalizedPath = getTextValue(filePath);
          if (!normalizedPath || normalizedPath === "/" || normalizedPath.endsWith("/")) {
            return false;
          }
          const fileName = normalizedPath.split("/").pop() ?? "";
          return /\.[a-z0-9]+$/i.test(fileName);
        };
        const findExistingUnboundPlaceholderNodeId = (key: CanvasCardKey) => {
          const unboundPlaceholderNode = getUnboundPlaceholderNodes(key)[0];
          return unboundPlaceholderNode?.id ?? "";
        };
        const consumeExtraLoadingCardId = (key: CanvasCardKey) => {
          const existingIds = extraLoadingCardIdsByKey.get(key) ?? [];
          while (existingIds.length > 0) {
            const nextNodeId = existingIds.shift() ?? "";
            if (!nextNodeId) continue;
            if (!nodesRef.current.some((node) => node.id === nextNodeId)) continue;
            if (existingIds.length > 0) {
              extraLoadingCardIdsByKey.set(key, [...existingIds]);
            } else {
              extraLoadingCardIdsByKey.delete(key);
            }
            return nextNodeId;
          }
          extraLoadingCardIdsByKey.delete(key);
          const fallbackNodeId = findExistingUnboundPlaceholderNodeId(key);
          if (fallbackNodeId) {
            removeExtraLoadingCardId(key, fallbackNodeId);
          }
          return fallbackNodeId;
        };
        const cleanupExtraLoadingCards = () => {
          Array.from(extraLoadingCardIdsByKey.values())
            .flat()
            .forEach((nodeId) => {
              cleanupLoadingCard(nodeId);
            });
          extraLoadingCardIdsByKey.clear();
        };
        const createAdditionalManualLoadingCards = (key: CanvasCardKey, count: number) => {
          if (count <= 0) return [] as string[];
          if (key === "brainstorm" && useBrainstormBatchLoading) {
            const placeholderFiles = Array.from({ length: count }, (_, index) => ({
              filePath: `brainstorm-placeholder-${Date.now()}-${index + 1}.md`,
              content: "",
            }));
            const nextPlaceholderIds = startBrainstormPlaceholderBatch(
              placeholderFiles,
              brainstormBatchIdsRef.current.length > 0 || nodesRef.current.length > 0
                ? "append"
                : "replace"
            );
            return nextPlaceholderIds.slice(-count);
          }

          const commonOptions = {
            title: "",
            content: "",
            image: "",
            fromApi: true,
            isStreaming: true,
            skipAutoStream: true,
          };

          if (key === "role") {
            if (useContextLinkedCreation && effectiveSourceNodeId) {
              return appendRoleCardsToGroup(
                effectiveSourceNodeId,
                Array.from({ length: count }, () => ({ ...commonOptions }))
              ).roleNodeIds;
            }
            return Array.from({ length: count }, () => createStandaloneGroupedCardByKey("role", commonOptions))
              .filter(Boolean);
          }

          if (key === "outline") {
            if (useContextLinkedCreation && effectiveSourceNodeId) {
              return appendOutlineCardsToGroup(
                effectiveSourceNodeId,
                Array.from({ length: count }, () => ({ ...commonOptions }))
              ).outlineNodeIds;
            }
            return Array.from({ length: count }, () => createStandaloneGroupedCardByKey("outline", commonOptions))
              .filter(Boolean);
          }

          if ((key === "summary" || key === "brainstorm") && useContextLinkedCreation && effectiveSourceNodeId) {
            return createContextLinkedSingleCardsBatch(key, effectiveSourceNodeId, Array.from({ length: count }, () => ({
              ...commonOptions,
              allowTitleEdit: true,
              allowImageUpload: true,
              autoEdit: true,
            })));
          }

          if (key === "info" && useContextLinkedCreation && effectiveSourceNodeId) {
            return createContextLinkedSingleCardsBatch(key, effectiveSourceNodeId, Array.from({ length: count }, () => ({
              ...commonOptions,
              allowTitleEdit: true,
              allowImageUpload: false,
              autoEdit: true,
            })));
          }

          const cardWidth = getDraftCardSize(key).width;
          const anchorNode =
            key === requestedCardKey && loadingCardId
              ? nodesRef.current.find((node) => node.id === loadingCardId) ?? null
              : null;
          const positions = getStandaloneBatchRowPositions(
            nodesRef.current,
            cardWidth,
            count,
            anchorNode
          );

          return Array.from({ length: count }, (_, index) =>
            createCardByKey(key, {
              ...commonOptions,
              allowTitleEdit: true,
              allowImageUpload: true,
              autoEdit: true,
              position: positions[index],
            })
          ).filter(Boolean);
        };
        const ensureTaskPlaceholderCount = (key: CanvasCardKey, taskNum: number) => {
          if (taskNum <= 0) return;
          if (key === "brainstorm" && useBrainstormBatchLoading) {
            createAdditionalManualLoadingCards(key, taskNum);
            return;
          }
          const reservedCount = (extraLoadingCardIdsByKey.get(key) ?? []).length;
          const baseCount =
            key === requestedCardKey && loadingCardId
              ? 1
              : 0;
          const missingCount = taskNum - baseCount - reservedCount;
          if (missingCount <= 0) return;
          const createdIds = createAdditionalManualLoadingCards(key, missingCount);
          if (!createdIds.length) return;
          registerExtraLoadingCardIds(key, createdIds);
          rememberLatestGeneratedNode(createdIds[createdIds.length - 1] ?? "");
          connectReferenceNodesToTargets(selectedDialogReferenceEdgeSourceIds, createdIds);
          startLoadingProgressForNodes(createdIds);
        };
        if (loadingCardId) {
          if (shouldReuseSourceDraftNode || (isReusingRoleDraftNode && loadingCardId === reusableRoleDraftNodeId)) {
            updateLoadingCard(loadingCardId, requestedCardKey, {
              title: "",
              filePath:
                shouldReuseSourceDraftNode
                  ? getTextValue((sourceNode?.data as any)?.filePath)
                  : "",
              content: "",
              image: "",
              fromApi: true,
              isStreaming: true,
              allowTitleEdit: true,
              allowImageUpload: requestedCardKey !== "outline" && requestedCardKey !== "info",
              autoEdit: true,
            }) ?? "";
          };
          rememberLatestGeneratedNode(loadingCardId);
          connectReferenceNodesToTargets(selectedDialogReferenceEdgeSourceIds, [loadingCardId]);
          startLoadingProgressForNodes([loadingCardId]);
          focusCanvasNodeWhenReady(loadingCardId, { zoom: 0.95, duration: 500 });
        } else if (brainstormLoadingCardId) {
          rememberLatestGeneratedNode(brainstormLoadingCardId);
          connectReferenceNodesToTargets(selectedDialogReferenceEdgeSourceIds, [brainstormLoadingCardId]);
          focusCanvasNodeWhenReady(brainstormLoadingCardId, { zoom: 0.95, duration: 500 });
        }
        let loadingCardConsumed = false;
        const resolveRoleTargetSourceNodeId = () => {
          if (requestedCardKey !== "role") return effectiveSourceNodeId;
          const loadingNode = loadingCardId
            ? nodesRef.current.find((node) => node.id === loadingCardId)
            : undefined;
          const loadingGroupId =
            getTextValue(loadingNode?.parentId) ||
            getTextValue((loadingNode?.data as any)?.roleGroupId) ||
            "";
          if (loadingGroupId) {
            const loadingGroupNode = nodesRef.current.find((node) => node.id === loadingGroupId);
            if (loadingGroupNode?.type === "roleGroup") {
              return loadingGroupNode.id;
            }
          }
          const resolvedGroupId = resolveRoleRelationGroupId();
          if (resolvedGroupId) return resolvedGroupId;
          return effectiveSourceNodeId;
        };

        const getWriteFileFallbackTitle = (filePath: string, fallback: string) =>
          filePath.split("/").pop()?.replace(/\.md$/i, "") || fallback;
        const resolveWriteFileCardKey = (filePath: string): CanvasCardKey => {
          const inferredCardKey = inferCardKeyFromWriteFilePath(filePath);
          if (inferredCardKey !== "info") return inferredCardKey;
          if (requestedCardKey === "role") {
            return "role";
          }
          return requestedCardKey;
        };
        const resolveRoleRelationGroupId = () => {
          if (requestedCardKey !== "role") return "";
          const relationSourceNodeId = effectiveSourceNodeId || sourceNodeId;
          const relationSourceNode = relationSourceNodeId
            ? nodesRef.current.find((node) => node.id === relationSourceNodeId)
            : undefined;
          if (relationSourceNode?.type === "roleGroup") return relationSourceNode.id;
          const groupIdFromSource = (
            getTextValue(relationSourceNode?.parentId) ||
            getTextValue((relationSourceNode?.data as any)?.roleGroupId) ||
            ""
          );
          if (groupIdFromSource) return groupIdFromSource;

          const loadingNode = loadingCardId
            ? nodesRef.current.find((node) => node.id === loadingCardId)
            : undefined;
          const groupIdFromLoadingNode = getTextValue(loadingNode?.parentId) ||
            getTextValue((loadingNode?.data as any)?.roleGroupId);
          if (groupIdFromLoadingNode) return groupIdFromLoadingNode;

          // 空白脑洞卡 -> 生成角色 场景下，source 不是 roleGroup，需要通过连线反查它新建出的角色组。
          if (relationSourceNodeId) {
            const linkedRoleGroup = nodesRef.current.find((node) => {
              if (node.type !== "roleGroup") return false;
              if (getTextValue(node.data?.label) !== "角色") return false;
              return (edgesRef.current as CustomEdge[]).some(
                (edge) =>
                  getTextValue(edge.source) === relationSourceNodeId &&
                  getTextValue(edge.target) === node.id
              );
            });
            if (linkedRoleGroup?.id) return linkedRoleGroup.id;
          }

          return "";
        };
        const findExistingRoleRelationNodeId = () => {
          if (requestedCardKey !== "role") return "";
          const relationSourceNodeId = effectiveSourceNodeId || sourceNodeId;
          const relationSourceNode = relationSourceNodeId
            ? nodesRef.current.find((node) => node.id === relationSourceNodeId)
            : undefined;
          const relationGroupId = relationSourceNode
            ? relationSourceNode.type === "roleGroup"
              ? relationSourceNode.id
              : getTextValue(relationSourceNode.parentId) ||
              getTextValue((relationSourceNode.data as any)?.roleGroupId)
            : "";
          const relationGroupSourceId = relationGroupId
            ? (edgesRef.current as CustomEdge[]).find((edge) => edge.target === relationGroupId)?.source ?? ""
            : "";
          const relationCandidateSourceIds = new Set(
            [relationSourceNodeId, relationGroupId, relationGroupSourceId]
              .map((value) => getTextValue(value))
              .filter(Boolean)
          );
          if (!relationCandidateSourceIds.size && !relationGroupId) return "";
          const relationNodeInGroup = relationGroupId
            ? nodesRef.current.find((node) => {
              if (node.type !== "settingCard") return false;
              const belongsToRelationGroup =
                getTextValue(node.parentId) === relationGroupId ||
                getTextValue((node.data as any)?.roleGroupId) === relationGroupId;
              if (!belongsToRelationGroup) return false;
              const filePath = getTextValue((node.data as any)?.filePath);
              const title = getTextValue((node.data as any)?.title);
              return isRelationshipWriteFile(filePath) || /角色关系/i.test(title);
            })
            : undefined;
          if (relationNodeInGroup?.id) {
            return relationNodeInGroup.id;
          }
          const groupChildCards = relationGroupId
            ? nodesRef.current
              .filter((node) =>
                getTextValue(node.parentId) === relationGroupId ||
                getTextValue((node.data as any)?.roleGroupId) === relationGroupId
              )
              .map((node) => ({
                id: node.id,
                type: node.type,
                label: getTextValue((node.data as any)?.label),
                title: getTextValue((node.data as any)?.title),
                filePath: getTextValue((node.data as any)?.filePath),
                parentId: getTextValue(node.parentId),
                roleGroupId: getTextValue((node.data as any)?.roleGroupId),
              }))
            : [];
          const existingNode = nodesRef.current.find((node) => {
            if (node.type !== "settingCard") return false;
            const filePath = getTextValue((node.data as any)?.filePath);
            const title = getTextValue((node.data as any)?.title);
            const isRelationNode =
              isRelationshipInfoWriteFile(filePath) || /角色关系/i.test(title);
            if (!isRelationNode) return false;
            const belongsToRelationGroup =
              Boolean(relationGroupId) &&
              (
                getTextValue(node.parentId) === relationGroupId ||
                getTextValue((node.data as any)?.roleGroupId) === relationGroupId
              );
            if (belongsToRelationGroup) return true;
            return (edgesRef.current as CustomEdge[]).some(
              (edge) =>
                relationCandidateSourceIds.has(getTextValue(edge.source)) &&
                edge.target === node.id
            );
          });
          return existingNode?.id ?? "";
        };
        const findRoleGroupPlaceholderNodeId = (groupId: string) => {
          if (!groupId) return "";
          if (loadingCardId) {
            const loadingNode = nodesRef.current.find((node) => node.id === loadingCardId);
            const loadingBelongsToGroup =
              getTextValue(loadingNode?.parentId) === groupId ||
              getTextValue((loadingNode?.data as any)?.roleGroupId) === groupId;
            const loadingIsPlaceholder =
              Boolean((loadingNode?.data as any)?.fromApi) &&
              (
                Boolean((loadingNode?.data as any)?.isStreaming) ||
                Boolean((loadingNode?.data as any)?.pendingGenerate)
              );
            if (loadingBelongsToGroup && loadingIsPlaceholder) {
              return loadingCardId;
            }
          }
          const placeholder = nodesRef.current.find((node) => {
            if (node.type !== "settingCard") return false;
            const belongsToGroup =
              getTextValue(node.parentId) === groupId ||
              getTextValue((node.data as any)?.roleGroupId) === groupId;
            if (!belongsToGroup) return false;
            if (isRelationshipWriteFile(getTextValue((node.data as any)?.filePath))) return false;
            return (
              Boolean((node.data as any)?.fromApi) &&
              (
                Boolean((node.data as any)?.isStreaming) ||
                Boolean((node.data as any)?.pendingGenerate)
              )
            );
          });
          return placeholder?.id ?? "";
        };
        const findRoleGroupPendingRoleNodeId = (groupId: string) => {
          if (!groupId) return "";
          const pendingRoleNode = nodesRef.current.find((node) => {
            if (node.type !== "settingCard") return false;
            const belongsToGroup =
              getTextValue(node.parentId) === groupId ||
              getTextValue((node.data as any)?.roleGroupId) === groupId;
            if (!belongsToGroup) return false;
            if (isRelationshipWriteFile(getTextValue((node.data as any)?.filePath))) return false;
            if (getTextValue(node.data?.label) !== "角色") return false;
            return (
              Boolean((node.data as any)?.fromApi) &&
              (
                Boolean((node.data as any)?.isStreaming) ||
                Boolean((node.data as any)?.pendingGenerate)
              )
            );
          });
          return pendingRoleNode?.id ?? "";
        };
        const findExistingRoleRelationshipCardNodeId = () => {
          if (requestedCardKey !== "role") return "";
          const relationSourceNodeId = effectiveSourceNodeId || sourceNodeId;
          const relationSourceNode = relationSourceNodeId
            ? nodesRef.current.find((node) => node.id === relationSourceNodeId)
            : undefined;
          const relationGroupId = relationSourceNode
            ? relationSourceNode.type === "roleGroup"
              ? relationSourceNode.id
              : getTextValue(relationSourceNode.parentId) ||
              getTextValue((relationSourceNode.data as any)?.roleGroupId)
            : "";
          if (!relationGroupId) return "";
          const existingNode = nodesRef.current.find((node) => {
            if (node.type !== "settingCard") return false;
            const filePath = getTextValue((node.data as any)?.filePath);
            const title = getTextValue((node.data as any)?.title);
            const belongsToRelationGroup =
              getTextValue(node.parentId) === relationGroupId ||
              getTextValue((node.data as any)?.roleGroupId) === relationGroupId;
            if (!belongsToRelationGroup) return false;
            return isRelationshipWriteFile(filePath) || /角色关系/i.test(title);
          });
          return existingNode?.id ?? "";
        };
        const rememberStreamNodeBinding = (item: CanvasWriteFileCall, nodeId: string) => {
          if (!nodeId) return;
          const filePath = getTextValue(item.filePath);
          const callId = getTextValue(item.callId);
          if (isStableWriteFilePath(filePath)) {
            streamedNodeIdsByFilePath.set(filePath, nodeId);
          }
          if (callId) {
            streamedNodeIdsByCallId.set(callId, nodeId);
          }
        };
        const consumeBrainstormPlaceholderNodeId = () => {
          const boundNodeIds = new Set<string>([
            ...Array.from(streamedNodeIdsByCallId.values()),
            ...Array.from(streamedNodeIdsByFilePath.values()),
          ]);
          const candidateStates = brainstormBatchIdsRef.current.map((nodeId) => {
            const node = nodesRef.current.find((item) => item.id === nodeId);
            return {
              nodeId,
              isBound: boundNodeIds.has(nodeId),
              existsInNodesRef: Boolean(node),
            };
          });
          const nextNodeId = (
            candidateStates.find(
              (item) =>
                item.nodeId &&
                !item.isBound &&
                item.existsInNodesRef
            )?.nodeId ?? ""
          );
          return nextNodeId;
        };
        const shouldConsumeLoadingCardForKey = (key: CanvasCardKey) =>
          Boolean(loadingCardId) && !loadingCardConsumed && key === requestedCardKey;
        const bindWriteFileToLoadingCard = (
          item: CanvasWriteFileCall,
          key: CanvasCardKey,
          isFinalWrite: boolean
        ) => {
          if (!shouldConsumeLoadingCardForKey(key) || !loadingCardId) return "";
          const filePath = getTextValue(item.filePath);
          if (!filePath) return "";
          loadingCardConsumed = true;
          streamPendingNodeIds.add(loadingCardId);
          rememberStreamNodeBinding(item, loadingCardId);

          if (!isFinalWrite) {
            startLoadingProgressForNodes([loadingCardId]);
          }
          return loadingCardId;
        };
        const shouldConsumeReservedPlaceholderForWriteFile = (filePath: string) =>
          !isRelationshipWriteFile(filePath) && !isRelationshipInfoWriteFile(filePath);
        const ensureStreamNodeId = (item: CanvasWriteFileCall, key: CanvasCardKey) => {
          const filePath = getTextValue(item.filePath);
          const callId = getTextValue(item.callId);
          const finalizeResolvedNodeId = (resolvedNodeId: string, stage: string) => {
            if (!resolvedNodeId) return "";
            rememberStreamNodeBinding(item, resolvedNodeId);
            streamPendingNodeIds.add(resolvedNodeId);
            rememberLatestGeneratedNode(resolvedNodeId);
            connectReferenceNodesToTargets(selectedDialogReferenceEdgeSourceIds, [resolvedNodeId]);
            return resolvedNodeId;
          };
          const existingNodeId =
            (callId ? streamedNodeIdsByCallId.get(callId) || "" : "") ||
            (isStableWriteFilePath(filePath) ? streamedNodeIdsByFilePath.get(filePath) || "" : "") ||
            "";
          if (existingNodeId) {
            rememberStreamNodeBinding(item, existingNodeId);
            streamPendingNodeIds.add(existingNodeId);
            return existingNodeId;
          }

          let nextNodeId = "";
          const allowImageUpload = key !== "outline" && key !== "info";

          if (shouldConsumeLoadingCardForKey(key)) {
            nextNodeId = loadingCardId;
            loadingCardConsumed = true;
          }

          if (!nextNodeId && shouldConsumeReservedPlaceholderForWriteFile(filePath)) {
            nextNodeId = consumeExtraLoadingCardId(key);
            if (nextNodeId) {
              return finalizeResolvedNodeId(nextNodeId, "reserved-placeholder");
            }
          }

          if (!nextNodeId && key === "brainstorm" && useBrainstormBatchLoading) {
            nextNodeId = consumeBrainstormPlaceholderNodeId();
            if (nextNodeId) {
              return finalizeResolvedNodeId(nextNodeId, "brainstorm-batch-placeholder");
            }
          }

          if (!nextNodeId && useContextLinkedCreation && effectiveSourceNodeId) {
            if (shouldReuseSourceDraftNode && key === requestedCardKey) {
              nextNodeId = effectiveSourceNodeId;
            } else if (key === "brainstorm") {
              nextNodeId = effectiveSourceNodeId;
            } else if (key === "summary") {
              nextNodeId = addSummaryCard(effectiveSourceNodeId, {
                title: "",
                content: "",
                image: "",
                fromApi: true,
                isStreaming: true,
                allowTitleEdit: true,
                allowImageUpload: true,
                skipAutoStream: true,
              });
            } else if (key === "info") {
              const isRoleRelationInfo =
                requestedCardKey === "role" && isRelationshipInfoWriteFile(filePath);
              const relationGroupId = isRoleRelationInfo ? resolveRoleRelationGroupId() : "";
              nextNodeId = findExistingRoleRelationNodeId();
              if (!nextNodeId && isRoleRelationInfo) {
                nextNodeId = findRoleGroupPlaceholderNodeId(relationGroupId);
              }
              // 角色关系文件只在“已有关系节点”或“组内占位节点”上替换，不新建节点。
              if (isRoleRelationInfo && !nextNodeId) {
                return "";
              }
              if (!nextNodeId) {
                nextNodeId = addSettingCard(effectiveSourceNodeId, {
                  label: "信息",
                  title: "",
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  allowTitleEdit: true,
                  allowImageUpload: false,
                  skipAutoStream: true,
                });
              }
            } else if (key === "outline") {
              nextNodeId = appendOutlineCardsToGroup(effectiveSourceNodeId, [{
                title: "",
                content: "",
                image: "",
                fromApi: true,
                isStreaming: true,
                skipAutoStream: true,
              }]).outlineNodeIds[0] ?? "";
            } else if (key === "role") {
              const relationGroupId = isRelationshipWriteFile(filePath) ? resolveRoleRelationGroupId() : "";
              if (isRelationshipWriteFile(filePath)) {
                nextNodeId = findExistingRoleRelationshipCardNodeId();
                if (!nextNodeId) {
                  nextNodeId = findRoleGroupPlaceholderNodeId(relationGroupId);
                }
                if (!nextNodeId) {
                  nextNodeId = findRoleGroupPendingRoleNodeId(relationGroupId);
                }
              }
              if (!nextNodeId) {
                const roleTargetSourceNodeId = resolveRoleTargetSourceNodeId();
                nextNodeId = appendRoleCardsToGroup(roleTargetSourceNodeId, [{
                  title: "",
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }]).roleNodeIds[0] ?? "";
              }
            }
          } else {
            if (key === "role") {
              const roleTargetSourceNodeId = resolveRoleTargetSourceNodeId() || sourceNodeId || effectiveSourceNodeId;
              if (roleTargetSourceNodeId) {
                nextNodeId = appendRoleCardsToGroup(roleTargetSourceNodeId, [{
                  title: "",
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }]).roleNodeIds[0] ?? "";
              } else {
                // 仅在完全无法解析 source 的极端场景，才允许 standalone 兜底。
                nextNodeId = createStandaloneGroupedCardByKey("role", {
                  title: "",
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }) ?? "";
              }
            } else if (key === "outline") {
              nextNodeId = createStandaloneGroupedCardByKey(key, {
                title: "",
                content: "",
                image: "",
                fromApi: true,
                isStreaming: true,
                skipAutoStream: true,
              }) ?? "";
            } else {
              nextNodeId = createCardByKey(key, {
                title: "",
                content: "",
                image: "",
                fromApi: true,
                isStreaming: true,
                allowTitleEdit: true,
                allowImageUpload,
                autoEdit: true,
                skipAutoStream: true,
              }) ?? "";
            }
          }

          if (nextNodeId) {
            return finalizeResolvedNodeId(nextNodeId, "create-or-context");
          }
          return "";
        };
        const updateWriteFilePlaceholderCard = (
          nodeId: string,
          key: CanvasCardKey
        ) => {
          if (!nodeId) return;
          const reuseSourceDraft =
            shouldReuseSourceDraftNode &&
            key === requestedCardKey &&
            nodeId === effectiveSourceNodeId;
          startLoadingProgressForNodes([nodeId]);
          updateLoadingCard(nodeId, key, {
            title: "",
            filePath: "",
            content: "",
            image: "",
            fromApi: true,
            isStreaming: true,
            allowTitleEdit: true,
            allowImageUpload: key !== "outline" && key !== "info",
            autoEdit: true,
            isBlankDraft: false,
            isBlankBrainstormDraft: false,
            brainstormAiMode: reuseSourceDraft,
            pendingGenerate: true,
            highlighted: reuseSourceDraft,
            skipAutoStream: true,
          });
        };
        const applyWriteFileResultToNode = (
          nodeId: string,
          key: CanvasCardKey,
          item: CanvasWriteFileCall
        ) => {
          if (!nodeId) return;
          const filePath = getTextValue(item.filePath);
          const fallbackTitle = getWriteFileFallbackTitle(filePath, trimmedIdea || "卡片");
          rememberStreamNodeBinding(item, nodeId);
          finishLoadingProgressForNode(nodeId);
          updateLoadingCard(nodeId, key, {
            title: extractWriteFileTitle(filePath, fallbackTitle),
            filePath,
            content: getTextValue(item.content),
            image: extractMarkdownImage(item.content),
            fromApi: true,
            isStreaming: false,
            allowTitleEdit: true,
            allowImageUpload: key !== "outline" && key !== "info",
            autoEdit: true,
            isBlankDraft: false,
            isBlankBrainstormDraft: false,
            brainstormAiMode: false,
            pendingGenerate: false,
            highlighted: false,
            skipAutoStream: true,
          });
        };
        const applyPartialWriteFileSnapshotToNode = (
          nodeId: string,
          key: CanvasCardKey,
          item: CanvasWriteFileCall
        ) => {
          if (!nodeId) return;
          const filePath = getTextValue(item.filePath);
          const fallbackTitle = getWriteFileFallbackTitle(filePath, trimmedIdea || "卡片");
          rememberStreamNodeBinding(item, nodeId);
          startLoadingProgressForNodes([nodeId]);
          updateLoadingCard(nodeId, key, {
            title: extractWriteFileTitle(filePath, fallbackTitle),
            filePath,
            content: getTextValue(item.content),
            image: extractMarkdownImage(item.content),
            fromApi: true,
            isStreaming: true,
            allowTitleEdit: true,
            allowImageUpload: key !== "outline" && key !== "info",
            autoEdit: true,
            isBlankDraft: false,
            isBlankBrainstormDraft: false,
            brainstormAiMode: false,
            pendingGenerate: true,
            highlighted: false,
            skipAutoStream: true,
          });
        };
        const applyCollectedWriteFilesToStreamNodes = () => {
          getLatestWriteFiles(collectedWriteFilesByPath).forEach((item) => {
            const filePath = getTextValue(item.filePath);
            if (!filePath) return;
            const key = resolveWriteFileCardKey(filePath);
            const nodeId = streamedNodeIdsByFilePath.get(filePath) || "";
            if (!nodeId) return;
            applyWriteFileResultToNode(nodeId, key, item);
          });
        };
        const syncWriteFileCard = (
          item: CanvasWriteFileCall,
          isFinalWrite: boolean
        ) => {
          const filePath = getTextValue(item.filePath);
          if (!filePath) return;
          if (!isFinalWrite && !isStableWriteFilePath(filePath)) {
            return;
          }
          if (shouldSkipWriteFileCardCreation(filePath)) {
            return;
          }
          const key = resolveWriteFileCardKey(filePath);
          const boundLoadingNodeId = bindWriteFileToLoadingCard(item, key, isFinalWrite);
          const nodeId = boundLoadingNodeId || ensureStreamNodeId(item, key);
          if (!nodeId) return;
          streamPendingNodeIds.add(nodeId);
          if (isFinalWrite) {
            applyWriteFileResultToNode(nodeId, key, item);
            return;
          }
          if (!boundLoadingNodeId) {
            updateWriteFilePlaceholderCard(nodeId, key);
          }
          applyPartialWriteFileSnapshotToNode(nodeId, key, item);
        };
        const replaceLoadingCardWithFinalFile = (
          placeholderNodeId: string,
          key: CanvasCardKey,
          item: CanvasWriteFileCall,
          fallbackTitle: string
        ) => {
          const normalizedPath = getTextValue(item.filePath);
          const duplicateNodeId = normalizedPath
            ? streamedNodeIdsByFilePath.get(normalizedPath)
            : "";

          finishLoadingProgressForNode(placeholderNodeId);
          updateLoadingCard(placeholderNodeId, key, {
            title: extractWriteFileTitle(item.filePath, fallbackTitle),
            filePath: normalizedPath,
            content: item.content,
            image: extractMarkdownImage(item.content),
            fromApi: true,
            isStreaming: true,
            allowTitleEdit: true,
            allowImageUpload: key !== "outline" && key !== "info",
            autoEdit: true,
            isBlankDraft: false,
            isBlankBrainstormDraft: false,
            brainstormAiMode: false,
            pendingGenerate: true,
            highlighted: false,
            skipAutoStream: true,
          });

          if (normalizedPath) {
            streamedNodeIdsByFilePath.set(normalizedPath, placeholderNodeId);
          }

          if (duplicateNodeId && duplicateNodeId !== placeholderNodeId) {
            setNodes((prev) => {
              const next = prev.filter((node) => node.id !== duplicateNodeId);
              nodesRef.current = next;
              return next;
            });
            setEdges((prev) => {
              const next = (prev as CustomEdge[]).filter(
                (edge) => edge.source !== duplicateNodeId && edge.target !== duplicateNodeId
              );
              edgesRef.current = next;
              return next;
            });
          }
        };
        const finalizePendingStreamNodes = () => {
          if (loadingCardId) {
            streamPendingNodeIds.add(loadingCardId);
          }
          if (streamPendingNodeIds.size === 0) return;
          setNodes((prev) =>
            prev.map((node) =>
              streamPendingNodeIds.has(node.id)
                ? {
                  ...node,
                  data: {
                    ...node.data,
                    isStreaming: false,
                    pendingGenerate: false,
                    brainstormAiMode: false,
                    highlighted: false,
                    progress: 100,
                  } as any,
                }
                : node
            )
          );
        };

        activeCanvasRequestAbortCleanupRef.current = () => {
          stopLoadingProgress();
          if (loadingCardId) cleanupLoadingCard(loadingCardId);
          if (useBrainstormBatchLoading) {
            clearBrainstormPlaceholderBatch();
            brainstormBatchIdsRef.current = [];
          }
          setPendingSuggestionIdea("");
        };

        await postCanvasChoicesStream(
          {
            prompt:
              shouldReuseSourceDraftNode
                ? trimmedIdea
                : !isAutoRequest
                  ? (hasExplicitCardTypeInIdea
                    ? trimmedIdea
                    : sourceNodeId
                      ? (trimmedIdea || `帮我生成一个${outputTypeLabel}卡`)
                      : `帮我生成${trimmedIdea}${outputTypeLabel}卡`)
                  : `生成一个关于${trimmedIdea}${outputTypeLabel}卡`,
            mode: canvasModelType,
            type: requestType,
            files: requestFiles,
          },
          (streamData: any) => {
            const isFinalWrite = streamData?.event === "updates";
            const isPartialWrite = streamData?.event === "messages/partial";
            if (!isFinalWrite && !isPartialWrite) return;
            const currentTaskPanelLabel = getCurrentTaskPanelLabelFromStream(streamData?.data);
            if (currentTaskPanelLabel) {
              setReqPanelTaskLabel(currentTaskPanelLabel);
            }
            const currentTaskPlaceholderConfig = getCurrentTaskPlaceholderConfigFromStream(streamData?.data);
            if (currentTaskPlaceholderConfig) {
              ensureTaskPlaceholderCount(
                currentTaskPlaceholderConfig.key,
                currentTaskPlaceholderConfig.taskNum
              );
            }
            if (isPartialWrite) {
              const changed = collectPartialPanelMessagesById(
                streamData?.data,
                partialPanelOrderedIds,
                partialPanelContentById
              );
              if (changed) {
                const { detail, body, footer } = getPanelTextsFromMessageMap(
                  partialPanelOrderedIds,
                  partialPanelContentById
                );
                syncReqPanelTextRefs(detail, body, footer);
              }
              const partialWriteFiles = extractPartialWriteToolFiles(streamData?.data);
              if (partialWriteFiles.length) {
                partialWriteFiles.forEach((item) => {
                  const normalizedPath = getTextValue(item.filePath);
                  if (!normalizedPath) return;
                  if (shouldSkipWriteFileCardCreation(normalizedPath)) return;
                  const normalizedItem: PartialCanvasWriteFileCall = {
                    filePath: normalizedPath,
                    content: getTextValue(item.content),
                    callId: getTextValue(item.callId),
                  };
                  if (isStableWriteFilePath(normalizedPath)) {
                    collectedWriteFilesByPath.set(normalizedPath, normalizedItem);
                  }
                  syncWriteFileCard(normalizedItem, false);
                });
              }
              return;
            }
            const updatesContent = isFinalWrite
              ? (
                extractDisplayToolFileContent(streamData?.data) ||
                extractUpdatesMessageContentWithoutReadFile(streamData?.data)
              )
              : "";
            const latestCreationIdea = isFinalWrite
              ? extractCreationIdeaFileContent(streamData?.data)
              : "";
            if (latestCreationIdea) {
              syncCreationIdeaContent(latestCreationIdea);
            }
            if (isFinalWrite) {
              const choicesContent = extractChoicesWriteFileContent(streamData?.data);
              if (choicesContent) {
                const parsedSuggestions = parseChoicesSuggestionItems(choicesContent);
                if (parsedSuggestions.length) {
                  syncReqPanelTextRefs("为你生成了一些可选操作，点击下方按钮可直接填入输入框。", "", "");
                  hasChoiceList = true;
                  setSmartSuggestions(parsedSuggestions);
                  setSmartSuggestionsActive(true);
                }
              }
            }
            const writeFiles = extractUpdateToolFiles(streamData?.data);
            persistGeneratedWriteFiles(writeFiles);
            if (writeFiles.length) {
              writeFiles.forEach((item) => {
                const normalizedPath = getTextValue(item.filePath);
                if (!normalizedPath) return;
                if (shouldSkipWriteFileCardCreation(normalizedPath)) return;
                const normalizedItem = {
                  filePath: normalizedPath,
                  content: getTextValue(item.content),
                  callId: getTextValue(item.callId),
                };
                collectedWriteFilesByPath.set(normalizedPath, normalizedItem);
                syncWriteFileCard(normalizedItem, true);
              });
            }
            const replySegments = extractReplySegmentsFromToolFiles(streamData?.data);
            if (replySegments.start) persistedReplySegments.start = replySegments.start;
            if (replySegments.middle) persistedReplySegments.middle = replySegments.middle;
            if (replySegments.end) persistedReplySegments.end = replySegments.end;
            const hasReplySegmentContent = Boolean(
              persistedReplySegments.start ||
              persistedReplySegments.middle ||
              persistedReplySegments.end
            );
            if (hasReplySegmentContent) {
              syncReqPanelTextRefs(
                persistedReplySegments.start || reqPanelDetailRef.current,
                persistedReplySegments.middle || reqPanelBodyDetailRef.current,
                persistedReplySegments.end || reqPanelFooterDetailRef.current
              );
            }
            const effectiveFiles = getLatestWriteFiles(collectedWriteFilesByPath).filter(
              (item) => !shouldSkipWriteFileCardCreation(getTextValue(item.filePath))
            );
            if (useBrainstormBatchLoading) {
              if (!effectiveFiles.length) return;
              if (streamedNodeIdsByFilePath.size > 0 || streamedNodeIdsByCallId.size > 0) {
                // updates 事件可能按文件逐个到达；这里仅做已绑定节点的增量回填，
                // 不能提前清空 batch ids，否则后续文件会失去剩余占位卡并重新建卡。
                applyCollectedWriteFilesToStreamNodes();
                finalizePendingStreamNodes();
                return;
              }
              startBrainstormPlaceholderBatch(
                effectiveFiles,
                brainstormBatchIdsRef.current.length > 0 || nodesRef.current.length > 0 ? "append" : "replace"
              );
              setReqPanelFooterDetail("");
              updateBrainstormPlaceholderBatch(effectiveFiles, trimmedIdea || "脑洞", isFinalWrite);
              return;
            }
            if (!isFinalWrite) return;
            if (updatesContent || latestCreationIdea) {
              const { head, middle, tail } = updatesContent
                ? splitAutoUpdatesContent(updatesContent)
                : {
                  head: reqPanelDetailRef.current,
                  middle: [] as string[],
                  tail: reqPanelFooterDetailRef.current,
                };
              setReqPanelTitle(`${outputTypeLabel}卡`);
              const mergedDetail = persistedReplySegments.start || head || updatesContent;
              const mergedBody = persistedReplySegments.middle || middle.join("\n\n");
              const mergedFooter = persistedReplySegments.end || tail;
              syncReqPanelWithCreationIdea(
                mergedDetail,
                mergedBody,
                mergedFooter,
                persistedReplySegments.middle ? undefined : latestCreationIdea
              );
            }
            if (streamData?.event === "end") {
              setPendingSuggestionIdea('');
            }
          },
          (error: any) => {
            streamError = error;
          },
          () => { },
          { signal: requestAbortController.signal, showError: false }
        );

          if (abortRequestedRef.current) {
            activeCanvasRequestAbortCleanupRef.current?.();
            setReqPanelStatus("paused");
            setReqPanelDetail("");
            setReqPanelBodyDetail("");
            setReqPanelFooterDetail("");
            setReqPanelAction(null);
            setPendingSuggestionIdea("");
            setPendingContextActionLabel("");
            setSmartSuggestions([]);
            setSmartSuggestionsActive(false);
            setIsLoading(false);
            stopLoadingProgress();
            if (loadingCardId) cleanupLoadingCard(loadingCardId);
            cleanupExtraLoadingCards();
            if (useBrainstormBatchLoading) clearBrainstormPlaceholderBatch();
            return;
          }

        if (streamError) {
          stopLoadingProgress();
          if (loadingCardId) cleanupLoadingCard(loadingCardId);
          if (useBrainstormBatchLoading) clearBrainstormPlaceholderBatch();
          throw streamError;
        }

        const effectiveFiles = getLatestWriteFiles(collectedWriteFilesByPath).filter(
          (item) => !shouldSkipWriteFileCardCreation(getTextValue(item.filePath))
        );

        if (effectiveFiles.length) {
          shouldAutoSaveAfterStream = true;
          setReqPanelStatus("success");

          if (useBrainstormBatchLoading) {
            updateBrainstormPlaceholderBatch(effectiveFiles, trimmedIdea || "脑洞", true);
            finalizePendingStreamNodes();
            brainstormBatchIdsRef.current = [];
            cleanupExtraLoadingCards();
            setIsLoading(false);
            return;
          }
          if (effectiveOutputType === "outline") {
            triggerOutlineCompletionCelebration();
          }
          if (streamedNodeIdsByFilePath.size > 0) {
            applyCollectedWriteFilesToStreamNodes();
            if (loadingCardId && !loadingCardConsumed) {
              cleanupLoadingCard(loadingCardId);
            }
            cleanupExtraLoadingCards();
            finalizePendingStreamNodes();
            setIsLoading(false);
            return;
          }
          if (loadingCardId) {
            if (effectiveOutputType === "role") {
              const roleFiles = effectiveFiles.filter(
                (item) => item.filePath.endsWith(".md") && !isRelationshipInfoWriteFile(item.filePath)
              );
              if (roleFiles.length) {
                const firstRole = roleFiles[0];
                const firstTitleFallback =
                  firstRole.filePath.split("/").pop()?.replace(/\.md$/i, "") || "角色1";
                replaceLoadingCardWithFinalFile(
                  loadingCardId,
                  "role",
                  firstRole,
                  firstTitleFallback
                );
              }
            } else {
              const primaryFile =
                effectiveFiles.find((item) => item.filePath.endsWith(".md")) ?? effectiveFiles[0];
              const targetCardKey =
                ({
                  brainstorm: "brainstorm",
                  role: "role",
                  summary: "summary",
                  outline: "outline",
                  info: "info",
                }[cardOutputType] as CanvasCardKey);
              replaceLoadingCardWithFinalFile(
                loadingCardId,
                targetCardKey,
                primaryFile,
                trimmedIdea
              );
            }
          }
          if (effectiveOutputType === "role") {
            const roleFiles = effectiveFiles.filter(
              (item) => item.filePath.endsWith(".md") && !isRelationshipInfoWriteFile(item.filePath)
            );
            const relationFiles = effectiveFiles.filter(
              (item) => item.filePath.endsWith(".md") && isRelationshipInfoWriteFile(item.filePath)
            );

            if (roleFiles.length) {
              const roleCardWidth = ROLE_GROUP_CARD_WIDTH;
              const loadingNode = loadingCardId
                ? nodesRef.current.find((node) => node.id === loadingCardId)
                : null;
              const basePosition = loadingNode?.position ?? getStandaloneNextRowPosition(nodesRef.current);

              if (loadingCardId) {
                const firstRole = roleFiles[0];
                const firstTitleFallback =
                  firstRole.filePath.split("/").pop()?.replace(/\.md$/i, "") || "角色1";
                updateLoadingCard(loadingCardId, "role", {
                  title: extractWriteFileTitle(firstRole.filePath, firstTitleFallback),
                  filePath: firstRole.filePath,
                  content: firstRole.content,
                  image: extractMarkdownImage(firstRole.content),
                });
              }

              if (roleFiles.length > (loadingCardId ? 1 : 0)) {
                const remainingRoleFiles = roleFiles.slice(loadingCardId ? 1 : 0);
                if (useContextLinkedCreation && sourceNodeId) {
                  appendRoleCardsToGroup(
                    sourceNodeId,
                    remainingRoleFiles.map((item, index) => {
                      const titleFallback =
                        item.filePath.split("/").pop()?.replace(/\.md$/i, "") ||
                        `角色${index + (loadingCardId ? 2 : 1)}`;
                      return {
                        title: extractWriteFileTitle(item.filePath, titleFallback),
                        filePath: item.filePath,
                        content: item.content,
                        image: extractMarkdownImage(item.content),
                        fromApi: true,
                        isStreaming: false,
                      };
                    })
                  );
                } else {
                  setCanvasReady(true);
                  setNodes((prev) => [
                    ...prev,
                    ...remainingRoleFiles.map((item, index) => {
                      const titleFallback =
                        item.filePath.split("/").pop()?.replace(/\.md$/i, "") ||
                        `角色${index + (loadingCardId ? 2 : 1)}`;
                      const image = extractMarkdownImage(item.content);
                      return {
                        id: `role-stream-${Date.now()}-${index}`,
                        type: "settingCard",
                        position: {
                          x: basePosition.x + (index + (loadingCardId ? 1 : 0)) * (roleCardWidth + CARD_LAYOUT_GAP_X),
                          y: basePosition.y,
                        },
                        draggable: true,
                        data: {
                          label: "角色",
                          title: extractWriteFileTitle(item.filePath, titleFallback),
                          filePath: item.filePath,
                          content: item.content,
                          image,
                          fromApi: true,
                          isStreaming: false,
                          inspirationDrawId: inspirationDrawId || undefined,
                          allowTitleEdit: true,
                          allowImageUpload: true,
                          autoEdit: true,
                        } as any,
                      } satisfies CustomNode;
                    }),
                  ]);
                }
              }
            } else if (loadingCardId && !relationFiles.length) {
              cleanupLoadingCard(loadingCardId);
            }

            relationFiles.forEach((item) => {
              const fallbackTitle = item.filePath.split("/").pop()?.replace(/\.md$/i, "") || "角色关系";
              const nextTitle = extractWriteFileTitle(item.filePath, fallbackTitle);
              const nextImage = extractMarkdownImage(item.content);
              const relationSourceNodeId = effectiveSourceNodeId || sourceNodeId;
              const relationGroupId = resolveRoleRelationGroupId();
              const existingRelationNodeId = findExistingRoleRelationNodeId();
              const placeholderRelationNodeId = !existingRelationNodeId
                ? findRoleGroupPlaceholderNodeId(relationGroupId)
                : "";
              const pendingRoleNodeId =
                !existingRelationNodeId && !placeholderRelationNodeId
                  ? findRoleGroupPendingRoleNodeId(relationGroupId)
                  : "";
              const relationTargetNodeId = existingRelationNodeId || placeholderRelationNodeId || pendingRoleNodeId;
              if (relationTargetNodeId) {
                setNodes((prev) => {
                  const next = prev.map((node) =>
                    node.id !== relationTargetNodeId
                      ? node
                      : {
                        ...node,
                        data: {
                          ...node.data,
                          label: "角色",
                          title: nextTitle,
                          filePath: item.filePath,
                          content: item.content,
                          image: nextImage,
                          fromApi: true,
                          isStreaming: false,
                          allowTitleEdit: true,
                          allowImageUpload: true,
                          autoEdit: true,
                        } as any,
                      }
                  );
                  nodesRef.current = next;
                  return next;
                });
                rememberLatestGeneratedNode(relationTargetNodeId);
                return;
              }
            });
          } else {
            const primaryFile =
              effectiveFiles.find((item) => item.filePath.endsWith(".md")) ?? effectiveFiles[0];
            const targetCardKey =
              ({
                brainstorm: "brainstorm",
                role: "role",
                summary: "summary",
                outline: "outline",
                info: "info",
              }[cardOutputType] as CanvasCardKey);
            const createStandaloneSingleCardsInRow = (
              files: CanvasWriteFileCall[],
              anchorNodeId?: string
            ) => {
              if (!files.length) return;
              const anchorNode = anchorNodeId
                ? nodesRef.current.find((node) => node.id === anchorNodeId) ?? null
                : null;
              const positions = getStandaloneBatchRowPositions(
                nodesRef.current,
                getDraftCardSize(targetCardKey).width,
                files.length,
                anchorNode
              );

              files.forEach((item, index) => {
                createCardByKey(targetCardKey, {
                  title: extractWriteFileTitle(item.filePath, trimmedIdea),
                  filePath: item.filePath,
                  content: item.content,
                  image: extractMarkdownImage(item.content),
                  fromApi: true,
                  isStreaming: false,
                  allowTitleEdit: true,
                  allowImageUpload: targetCardKey !== "info",
                  autoEdit: true,
                  position: positions[index],
                });
              });
            };
            if (loadingCardId) {
              updateLoadingCard(loadingCardId, targetCardKey, {
                title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                filePath: primaryFile.filePath,
                content: primaryFile.content,
                image: extractMarkdownImage(primaryFile.content),
              });
              if (useContextLinkedCreation && effectiveSourceNodeId && targetCardKey === "outline" && effectiveFiles.length > 1) {
                appendOutlineCardsToGroup(
                  effectiveSourceNodeId,
                  effectiveFiles.slice(1).map((item) => ({
                    title: extractWriteFileTitle(item.filePath, trimmedIdea),
                    filePath: item.filePath,
                    content: item.content,
                    image: extractMarkdownImage(item.content),
                    fromApi: true,
                    isStreaming: false,
                  }))
                );
              } else if (
                useContextLinkedCreation &&
                effectiveSourceNodeId &&
                targetCardKey !== "outline" &&
                effectiveFiles.length > 1
              ) {
                createContextLinkedSingleCardsBatch(
                  targetCardKey as "brainstorm" | "summary" | "info",
                  effectiveSourceNodeId,
                  effectiveFiles.slice(1).map((item) => ({
                    title: extractWriteFileTitle(item.filePath, trimmedIdea),
                    filePath: item.filePath,
                    content: item.content,
                    image: extractMarkdownImage(item.content),
                    fromApi: true,
                    isStreaming: false,
                    allowTitleEdit: true,
                    allowImageUpload: targetCardKey !== "info",
                    autoEdit: true,
                  }))
                );
              } else if (!useContextLinkedCreation && targetCardKey !== "outline" && effectiveFiles.length > 1) {
                createStandaloneSingleCardsInRow(effectiveFiles.slice(1), loadingCardId);
              }
            } else if (useContextLinkedCreation && effectiveSourceNodeId) {
              if (targetCardKey === "brainstorm") {
                updateLoadingCard(effectiveSourceNodeId, targetCardKey, {
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                });
              } else if (targetCardKey === "summary") {
                addSummaryCard(effectiveSourceNodeId, {
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                  fromApi: true,
                  isStreaming: false,
                  allowTitleEdit: true,
                  allowImageUpload: true,
                });
              } else if (targetCardKey === "info") {
                addSettingCard(effectiveSourceNodeId, {
                  label: "信息",
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                  fromApi: true,
                  isStreaming: false,
                  allowTitleEdit: true,
                  allowImageUpload: false,
                });
              } else if (targetCardKey === "outline") {
                appendOutlineCardsToGroup(effectiveSourceNodeId, [{
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                  fromApi: true,
                  isStreaming: false,
                }]);
              } else {
                createCardByKey(targetCardKey, {
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                });
              }
              if (targetCardKey !== "outline" && effectiveFiles.length > 1) {
                createContextLinkedSingleCardsBatch(
                  targetCardKey as "brainstorm" | "summary" | "info",
                  effectiveSourceNodeId,
                  effectiveFiles.slice(1).map((item) => ({
                    title: extractWriteFileTitle(item.filePath, trimmedIdea),
                    filePath: item.filePath,
                    content: item.content,
                    image: extractMarkdownImage(item.content),
                    fromApi: true,
                    isStreaming: false,
                    allowTitleEdit: true,
                    allowImageUpload: targetCardKey !== "info",
                    autoEdit: true,
                  }))
                );
              }
            } else {
              if (targetCardKey !== "outline" && effectiveFiles.length > 1) {
                createStandaloneSingleCardsInRow(effectiveFiles);
              } else {
                createCardByKey(targetCardKey, {
                  title: extractWriteFileTitle(primaryFile.filePath, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                });
              }
            }
            cleanupExtraLoadingCards();
            finalizePendingStreamNodes();
          }
        } else if (hasChoiceList) {
          if (useBrainstormBatchLoading) clearBrainstormPlaceholderBatch();
          cleanupExtraLoadingCards();
          setReqPanelStatus("success");
        } else {
          if (loadingCardId) cleanupLoadingCard(loadingCardId);
          if (useBrainstormBatchLoading) clearBrainstormPlaceholderBatch();
          cleanupExtraLoadingCards();
          setReqPanelStatus("error");
          setReqPanelDetail("");
          msg("warning", "返回数据格式不正确，请重试");
        }
        setIsLoading(false);
        stopLoadingProgress();
        return;
      }
    } catch (e: any) {
      const isAbortError = e?.name === "AbortError";
      stopLoadingProgress();
      if (isAbortError) {
        activeCanvasRequestAbortCleanupRef.current?.();
        setReqPanelStatus("paused");
        setReqPanelDetail("");
        setReqPanelBodyDetail("");
        setReqPanelFooterDetail("");
        setReqPanelAction(null);
        setPendingSuggestionIdea("");
        setPendingContextActionLabel("");
        setSmartSuggestions([]);
        setSmartSuggestionsActive(false);
      } else {
        setReqPanelStatus("error");
        setReqPanelDetail("");
        msg("error", e.message);
      }
      if (trimmedIdea || isAbortError) {
        setIsLoading(false);
      }
    } finally {
      if (isAutoEmptyRequest) {
        setIsLoading(false);
      }
      const shouldScheduleAutoSave = shouldAutoSaveAfterStream;
      canvasAutoSaveSuppressedRef.current = false;
      if (shouldScheduleAutoSave) {
        scheduleCanvasAutoSave(0);
      }
      if (shouldResetOutputTypeToAuto || resetOutputTypeAfterFinish) {
        handleOutputTypeChange("auto");
      }
      if (canvasRequestAbortControllerRef.current === requestAbortController) {
        canvasRequestAbortControllerRef.current = null;
      }
        abortRequestedRef.current = false;
        pausedRequestMessageRef.current = "";
      activeCanvasRequestAbortCleanupRef.current = null;
    }
  }, [
    canvasOutputType,
    createCardByKey,
    ideaContent,
    ideaInputSource,
    isLoading,
    dialogCardPreviews,
    msg,
    addSettingCard,
    addSummaryCard,
    appendOutlineCardsToGroup,
    appendRoleCardsToGroup,
    connectReferenceNodesToTargets,
    clearBrainstormPlaceholderBatch,
    focusCanvasNode,
    openOutlineSettingsForRequest,
    getDialogReferenceFiles,
    mergeFileRecords,
    persistGeneratedWriteFiles,
    removeLoadingCard,
    startBrainstormPlaceholderBatch,
    updateBrainstormPlaceholderBatch,
    updateLoadingCard,
    resetGenerationSettings,
    resetReqPanelTextRefs,
    syncReqPanelTextRefs,
    rememberLatestGeneratedNode,
    startLoadingProgressForNodes,
    finishLoadingProgressForNode,
    stopLoadingProgress,
    stopBrainstormProgress,
    triggerOutlineCompletionCelebration,
    mergeCreationIdeaIntoFiles,
    scheduleCanvasAutoSave,
    syncCreationIdeaContent,
    syncReqPanelWithCreationIdea,
    isBlankDraftNode,
  ]);

  useEffect(() => {
    handleGenerateInsRef.current = handleGenerateIns;
  }, [handleGenerateIns]);

  const handlePrepareGenerateToDialog = useCallback(
    (
      nodeId: string,
      _outputType: CanvasOutputType,
      options?: CanvasGenerateOptions
    ) => {
      const targetOutputType: CanvasOutputType = "auto";
      const currentNode = nodes.find((node) => node.id === nodeId);
      const contextIdea = getTextValue(options?.title) || getTextValue((currentNode?.data as any)?.title);
      const hasFiles = Boolean(options?.files && Object.keys(options.files).length > 0);
      if (!contextIdea.trim() && !hasFiles) {
        msg("warning", "当前卡片暂无可用标题");
        return;
      }
      preparedGenerateSourceNodeIdRef.current = nodeId;
      const isGroupNode = currentNode?.type === "roleGroup";
      const shouldIncludeDialogReferences = options?.includeDialogReferences ?? true;
      ignoreDialogReferencesForNextRequestRef.current = !shouldIncludeDialogReferences;
      clearDialogPreviewsForNextRequestRef.current = options?.clearDialogPreviewsAfterRequest;
      const appended = shouldIncludeDialogReferences
        ? (
          isGroupNode
            ? appendDialogReferencesByNodeIds(getGroupChildReferenceNodeIds(nodeId))
            : appendDialogReferenceByNodeId(nodeId)
        )
        : null;
      if (options?.files && Object.keys(options.files).length > 0) {
        preparedContextFilesRef.current = mergeFileRecords(
          preparedContextFilesRef.current,
          options.files
        );
      }
      if (!ideaContent.trim()) {
        const appendedTitle = (() => {
          if (isGroupNode && appended && "firstSnapshot" in appended) {
            return getTextValue((appended.firstSnapshot as any)?.title);
          }
          if (!isGroupNode && appended && "snapshot" in appended) {
            return getTextValue((appended.snapshot as any)?.title);
          }
          return "";
        })();
        const fallbackTitle = appendedTitle || contextIdea || "当前内容";
        const outputLabel =
          targetOutputType === "auto"
            ? "内容"
            : OUTPUT_TYPE_OPTIONS.find((item) => item.key === targetOutputType)?.label ?? targetOutputType;
        setIdeaInputSource("default");
        setIdeaContent(`使用[${fallbackTitle}]生成${outputLabel}`);
      }
      handleOutputTypeChange(targetOutputType);
      setForceCanvasView(true);
      setCanvasReady(true);
      msg("success", "已加入对话引用，请发送开始生成");
    },
    [
      appendDialogReferenceByNodeId,
      appendDialogReferencesByNodeIds,
      getGroupChildReferenceNodeIds,
      handleOutputTypeChange,
      ideaContent,
      mergeFileRecords,
      msg,
      nodes,
    ]
  );

  const buildContextGeneratePrompt = useCallback(
    (rawTitle: string, outputType: CanvasOutputType) => {
      const normalizedTitle = getTextValue(rawTitle).trim();
      const outputLabel =
        OUTPUT_TYPE_OPTIONS.find((item) => item.key === outputType)?.label ?? outputType;
      if (!normalizedTitle) {
        return `生成${outputLabel}卡`;
      }
      if (normalizedTitle === outputLabel || normalizedTitle.endsWith(outputLabel)) {
        return `生成${outputLabel}卡`;
      }
      if (normalizedTitle.includes(`${outputLabel}卡`)) {
        return normalizedTitle;
      }
      return `生成${normalizedTitle}${outputLabel}卡`;
    },
    [getTextValue]
  );

  const handleGenerateInsFromContext = useCallback(
    (
      nodeId: string,
      outputType: CanvasOutputType,
      options?: CanvasGenerateOptions
    ) => {
      if (outputType !== "auto") {
        handleOutputTypeChange(outputType);
      }
      const currentNode = nodes.find((node) => node.id === nodeId);
      const nodeLabel = getTextValue(currentNode?.data?.label) || "当前内容";
      const hasOptionFiles = Boolean(options?.files && Object.keys(options.files).length > 0);
      const contextIdea = getTextValue(options?.title) ||
        (hasOptionFiles ? nodeLabel : getTextValue((currentNode?.data as any)?.title));
      const hasFiles = Boolean(options?.files && Object.keys(options.files).length > 0);
      if (!contextIdea.trim() && !hasFiles) {
        msg("warning", "当前卡片暂无可用标题");
        return;
      }
      const promptIdea = buildContextGeneratePrompt(
        contextIdea || nodeLabel,
        outputType
      );
      void handleGenerateIns(
        "manual",
        promptIdea,
        outputType,
        nodeId,
        options?.files,
        options?.actionLabel,
        undefined,
        false,
        options?.includeDialogReferences ?? true,
        options?.clearDialogPreviewsAfterRequest
      );
    },
    [buildContextGeneratePrompt, getTextValue, handleGenerateIns, handleOutputTypeChange, msg, nodes]
  );

  const createSingleSuggestionCard = useCallback(
    (suggestionId: string, suggestionIndex: number) => {
      const suggestion = smartSuggestions.find((item) => item.id === suggestionId);
      if (!suggestion) return;
      const suggestionTheme = getTextValue(suggestion.theme);
      const detectedCardMeta = (() => {
        if (suggestionTheme.includes("故事梗概卡") || suggestionTheme.includes("梗概卡")) {
          return {
            outputType: "summary" as Exclude<CanvasOutputType, "auto">,
            cardLabel: "梗概",
            cardTitle: "梗概卡",
          };
        }
        if (suggestionTheme.includes("角色卡")) {
          return {
            outputType: "role" as Exclude<CanvasOutputType, "auto">,
            cardLabel: "角色",
            cardTitle: "角色卡",
          };
        }
        if (suggestionTheme.includes("故事大纲卡") || suggestionTheme.includes("大纲卡")) {
          return {
            outputType: "outline" as Exclude<CanvasOutputType, "auto">,
            cardLabel: "大纲",
            cardTitle: "大纲卡",
          };
        }
        if (suggestionTheme.includes("信息卡")) {
          return {
            outputType: "info" as Exclude<CanvasOutputType, "auto">,
            cardLabel: "信息",
            cardTitle: "信息卡",
          };
        }
        if (suggestionTheme.includes("脑洞卡")) {
          return {
            outputType: "brainstorm" as Exclude<CanvasOutputType, "auto">,
            cardLabel: "脑洞",
            cardTitle: "脑洞卡",
          };
        }
        return null;
      })();
      const persistentCreationIdeaFiles = mergeCreationIdeaIntoFiles({});
      const normalizedSuggestionCount = smartSuggestions.length;
      const shouldUseThreeOptionBrainstormFlow = normalizedSuggestionCount === 3;
      const shouldUseTwoOptionFlow = normalizedSuggestionCount === 2;
      const nextRequestType: "auto" | "manual" = shouldUseThreeOptionBrainstormFlow
        ? "manual"
        : shouldUseTwoOptionFlow
          ? suggestionIndex === 0
            ? "manual"
            : "auto"
          : detectedCardMeta
            ? "manual"
            : "manual";
      const nextOutputType: Exclude<CanvasOutputType, "auto"> = shouldUseThreeOptionBrainstormFlow
        ? "brainstorm"
        : detectedCardMeta?.outputType ?? "brainstorm";
      const nextCardLabel = shouldUseThreeOptionBrainstormFlow
        ? "脑洞"
        : detectedCardMeta?.cardLabel ?? "脑洞";
      const nextCardTitle = shouldUseThreeOptionBrainstormFlow
        ? "脑洞卡"
        : detectedCardMeta?.cardTitle ?? `${nextCardLabel}卡`;
      const nextIdeaContent = shouldUseThreeOptionBrainstormFlow
        ? `${suggestionTheme}生成脑洞卡`
        : suggestionTheme;
      const shouldUseTwoOptionOutlineConfigFlow =
        shouldUseTwoOptionFlow &&
        suggestionIndex === 0 &&
        nextOutputType === "outline";

      stopBrainstormProgress();
      brainstormBatchIdsRef.current = [];
      setIdeaInputSource("default");
      setIdeaContent(suggestion.theme);
      setCardKeyLabel(nextCardLabel);
      setReqPanelTitle(nextCardTitle);
      setSmartSuggestionsActive(false);
      setPendingContextActionLabel("");
      setReqPanelStatus("loading");
      setReqPanelDetail(`正在根据所选${nextCardTitle}生成卡片，请稍等...`);
      setReqPanelFooterDetail("");
      setPendingSuggestionIdea(suggestion.theme);
      void handleGenerateIns(
        nextRequestType,
        nextIdeaContent,
        nextOutputType,
        undefined,
        persistentCreationIdeaFiles,
        undefined,
        shouldUseTwoOptionOutlineConfigFlow ? "default" : undefined,
        shouldUseTwoOptionOutlineConfigFlow
      );
    },
    [getTextValue, handleGenerateIns, mergeCreationIdeaIntoFiles, smartSuggestions, stopBrainstormProgress]
  );

  const handleAddCardToDialog = useCallback(
    (nodeId: string) => {
      const appended = appendDialogReferenceByNodeId(nodeId);
      if (!appended) return;
      const { snapshot, added } = appended;
      const cardType = snapshot.label;

      if (!ideaContent.trim()) {
        setIdeaInputSource("default");
        setIdeaContent(`使用[${cardType}卡片]，生成 ${snapshot.title}信息`);
      }
      setReqPanelVisible(false);
      setReqPanelExpanded(false);
      msg(added ? "success" : "warning", added ? "已添加到对话" : "该卡片已在引用列表中");
    },
    [appendDialogReferenceByNodeId, ideaContent, msg]
  );

  const handleAddGroupToDialog = useCallback(
    (groupNodeId: string) => {
      const normalizedGroupNodeId = getTextValue(groupNodeId);
      if (!normalizedGroupNodeId) return;

      const latestNodes = nodesRef.current;
      const childNodeIds = getGroupChildReferenceNodeIds(normalizedGroupNodeId);
      if (childNodeIds.length === 0) {
        msg("warning", "当前卡片组暂无可引用卡片");
        return;
      }

      const result = appendDialogReferencesByNodeIds(childNodeIds);
      if (!result) return;

      const groupNode = latestNodes.find((node) => node.id === normalizedGroupNodeId);
      const groupLabel = getTextValue((groupNode?.data as any)?.label) || "卡片";

      if (!ideaContent.trim()) {
        setIdeaInputSource("default");
        setIdeaContent(`使用[${groupLabel}卡片组]生成信息卡`);
      }

      if (result.addedCount > 0) {
        msg("success", `已添加 ${result.addedCount} 张卡片到对话`);
        return;
      }

      msg("warning", result.duplicateCount > 0 ? "该卡片组已在引用列表中" : "当前卡片组暂无可引用卡片");
    },
    [appendDialogReferencesByNodeIds, getGroupChildReferenceNodeIds, ideaContent, msg]
  );

  const addNewCanvas = useCallback(() => {
    stopBrainstormProgress();
    brainstormBatchIdsRef.current = [];
    brainstormProgressValueRef.current = 0;
    errorBatchRef.current = null;
    layoutRequestIdRef.current += 1;
    nodesRef.current = [];
    edgesRef.current = [];
    setIsLoading(false);
    setIdeaInputSource("default");
    setIdeaContent("");
    setIdeaPlaceholderIndex(0);
    setGenerateMode("smart");
    setCanvasModeCategory("smart");
    setSettingsPopoverOpen(false);
    setActiveSettingsSection("mode");
    setCanvasOutputType("auto");
    setCanvasModelType("max");
    setReqPanelVisible(false);
    setReqPanelExpanded(false);
    setCardKeyLabel("脑洞");
    setReqPanelUseSmartTheme(false);
    setReqPanelTitle("");
    setReqPanelStatus("idle");
    setReqPanelDetail("");
    setReqPanelBodyDetail("");
    setReqPanelFooterDetail("");
    setCreationIdeaContent("");
    creationIdeaContentRef.current = "";
    generatedWriteFilesRef.current = {};
    preparedContextFilesRef.current = undefined;
    ignoreDialogReferencesForNextRequestRef.current = false;
    clearDialogPreviewsForNextRequestRef.current = undefined;
    setLatestGeneratedNodeId("");
    latestGeneratedNodeIdRef.current = "";
    setReqPanelAction(null);
    setSmartSuggestionsActive(false);
    setSmartSuggestions([]);
    setPendingSuggestionIdea("");
    setDialogCardPreviews([]);
    setInitWorkDialogShow(false);
    setHistoryDialogShow(false);
    setMoreActionsOpen(false);
    setCurrentChain(null);
    setCanvasReady(false);
    setZoomPercent(100);
    setPanMode(true);
    setInputDockResetKey((prev) => prev + 1);
    setNodes([]);
    setEdges([]);
    setInspirationDrawId("");
    setForceCanvasView(false);
    setHasEnteredCanvasView(false);
    createNewCanvasSessionId(workId);
  }, [createNewCanvasSessionId, setNodes, setEdges, stopBrainstormProgress, workId]);

  const handleSaveCanvas = useCallback(async (sessionIdOverride?: string) => {
    const targetId = await ensureInspirationDrawId();
    if (!targetId) {
      msg("warning", "请先创建画布");
      return;
    }
    try {
      await saveCanvasSilently();
      msg("success", "保存成功");
    } catch {
      msg("error", "保存失败，请稍后重试");
    }
  }, [ensureInspirationDrawId, msg, saveCanvasSilently]);

  const getCanvasSessionId = useCallback(() => {
    if (!workId) return "";
    return getOrCreateCanvasSessionId(workId);
  }, [getOrCreateCanvasSessionId, workId]);

  useEffect(() => {
    return () => {
      clearCanvasSessionId(workId);
    };
  }, [clearCanvasSessionId, workId]);

  const openHistory = useCallback(() => setHistoryDialogShow(true), []);

  useImperativeHandle(
    canvasRef,
    () => ({
      addNewCanvas,
      addInfoCardFromExternalFile,
      focusFileByPath,
      syncFileContentByPath,
      syncFilePathByRename,
      openHistory,
      flushPersistence: flushCanvasPersistence,
      stopCurrentRequest,
      saveCanvas: handleSaveCanvas,
      inspirationDrawId,
      isLoading,
    }),
    [addNewCanvas, addInfoCardFromExternalFile, focusFileByPath, syncFileContentByPath, syncFilePathByRename, openHistory, flushCanvasPersistence, stopCurrentRequest, handleSaveCanvas, inspirationDrawId, isLoading]
  );

  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;
  const onCanvasFileContentChangeRef = useRef(onCanvasFileContentChange);
  onCanvasFileContentChangeRef.current = onCanvasFileContentChange;
  const onCanvasOpenFileRequestRef = useRef(onCanvasOpenFileRequest);
  onCanvasOpenFileRequestRef.current = onCanvasOpenFileRequest;
  useEffect(() => {
    onCanvasReadyRef.current?.();
  }, [inspirationDrawId, isLoading]);

  useEffect(() => {
    if (!autoSyncDirectory) return;
    const nextFiles = buildCanvasSyncFiles(nodes);
    const nextSignature = JSON.stringify(
      Object.keys(nextFiles)
        .sort()
        .map((key) => [key, nextFiles[key] ?? ""])
    );
    if (lastAutoSyncSignatureRef.current === nextSignature) return;
    lastAutoSyncSignatureRef.current = nextSignature;
    onAutoSyncDirectoryRef.current?.(nextFiles);
  }, [autoSyncDirectory, nodes]);

  const handleRestoreVersion = useCallback(
    (version: InspirationVersion) => {
      try {
        if (version.content) {
          const data = JSON.parse(version.content);
          if (data.nodes && data.edges) {
            const normalizedEdges = normalizeCanvasEdges(data.edges);
            setNodes(data.nodes);
            edgesRef.current = normalizedEdges;
            setEdges(normalizedEdges);
            setInspirationDrawId(String(version?.inspirationDrawId ?? ""));
            msg("success", "版本恢复成功");
            setTimeout(autoLayout, 100);
          } else {
            msg("error", "版本数据格式错误");
          }
        } else {
          msg("error", "版本数据为空");
        }
      } catch (e) {
        msg("error", "恢复版本失败");
      }
    },
    [setNodes, setEdges, msg, autoLayout]
  );

  const requestOpenFileByPath = useCallback((target: string) => {
    const normalizedTarget = normalizeCanvasFilePath(target);
    if (!normalizedTarget) {
      console.warn("[canvas-open-debug] request-open-empty-target", { target });
      return;
    }

    const syncPathNodeIdMap = buildCanvasSyncFileNodeIdMap(nodesRef.current);
    const matchedNode = nodesRef.current.find((node) => node.id === target);
    const targetCandidates = Array.from(new Set([
      normalizedTarget,
      normalizedTarget.replace(/^角色卡\//, "[角色卡]/"),
      normalizedTarget.replace(/^脑洞卡\//, "[脑洞卡]/"),
      normalizedTarget.replace(/^梗概卡\//, "[梗概卡]/"),
      normalizedTarget.replace(/^设定卡\//, "[设定卡]/"),
      normalizedTarget.replace(/^大纲卡\//, "[大纲卡]/"),
    ]));
    const matchedSyncPath =
      Object.entries(syncPathNodeIdMap).find(([, nodeId]) => nodeId === target)?.[0] ||
      targetCandidates.find((candidate) => syncPathNodeIdMap[candidate]) ||
      Object.keys(syncPathNodeIdMap).find((syncPath) =>
        targetCandidates.some((candidate) => syncPath.endsWith(`/${candidate}`))
      ) ||
      "";
    onCanvasOpenFileRequestRef.current?.(matchedSyncPath || normalizedTarget);
  }, [normalizeCanvasFilePath]);

  const handlers = useMemo(
    () => ({
      handleMainCardCreate,
      handleAddCardToDialog,
      handleAddGroupToDialog,
      requestOpenFileByPath,
      handlePrepareGenerateToDialog,
      handlePrepareBrainstormCard,
      handleGroupDelete: deleteNode,
      handleGenerateIns: handleGenerateInsFromContext,
      handleGenerateOutlineFromContext,
      handleSummaryGenerate: generateStorySettings,
      handleSummaryAdd: addSummaryCard,
      handleSummaryDelete: deleteNode,
      handleSummaryUpdate: (
        id: string,
        c: string,
        options?: {
          title?: string;
          filePath?: string;
          image?: string;
          images?: string[];
        }
      ) => {
        updateNodeContent(id, c, options);
        // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
      },
      handleSummaryExpand: () => scheduleAutoLayoutForExpand(),
      handleSettingGenerate: generateOutlineNodes,
      handleSettingAdd: addSettingCard,
      handleSettingDelete: deleteNode,
      handleSettingUpdate: (
        id: string,
        c: string,
        options?: {
          title?: string;
          filePath?: string;
          image?: string;
          images?: string[];
        }
      ) => {
        updateNodeContent(id, c, options);
        // 不触发 autoLayout，与 addSummaryCard 一致，避免流式输出时新节点被 dagre 排到顶部
      },
      handleSettingExpand: () => scheduleAutoLayoutForExpand(),
      handleOutlineGenerate,
      handleOutlineAdd: addOutlineCard,
      handleOutlineDelete: deleteNode,
      handleOutlineUpdate: (
        id: string,
        c: string,
        options?: {
          title?: string;
          filePath?: string;
          image?: string;
          images?: string[];
        }
      ) => {
        updateNodeContent(id, c, options);
        // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
      },
      handleOutlineExpand: () => scheduleAutoLayoutForExpand(),
      getCanvasSessionId,
      msg,
    }),
    [
      handleMainCardCreate,
      handleAddCardToDialog,
      handleAddGroupToDialog,
      requestOpenFileByPath,
      handlePrepareGenerateToDialog,
      handlePrepareBrainstormCard,
      deleteNode,
      handleGenerateInsFromContext,
      handleGenerateOutlineFromContext,
      generateStorySettings,
      addSummaryCard,
      updateNodeContent,
      scheduleAutoLayoutForExpand,
      generateOutlineNodes,
      addSettingCard,
      handleOutlineGenerate,
      addOutlineCard,
      getCanvasSessionId,
      msg
    ]
  );

  // 有已回显的画布数据时，优先展示 React Flow，而不是初始化引导态。
  const hasCanvasSnapshotData = nodes.length > 0 || edges.length > 0;
  useEffect(() => {
    if (!hasEnteredCanvasView && (forceCanvasView || hasCanvasSnapshotData)) {
      setHasEnteredCanvasView(true);
    }
  }, [forceCanvasView, hasCanvasSnapshotData, hasEnteredCanvasView]);
  const showInit = !hasEnteredCanvasView && !forceCanvasView && !hasCanvasSnapshotData;

  const dockRef = useRef<HTMLDivElement | null>(null);
  const prevShowInitRef = useRef(showInit);
  useLayoutEffect(() => {
    const prev = prevShowInitRef.current;
    prevShowInitRef.current = showInit;
    const el = dockRef.current;
    if (!el) return;

    // 回到初始化态时，清掉上一段动画留下的内联 transform，
    // 让位置重新完全由 className 控制，避免输入框停在偏上的画布态残留位置。
    el.getAnimations?.().forEach((a) => a.cancel());
    if (showInit) {
      el.style.transform = "";
      return;
    }

    // 仅在“从初始化态进入画布态”时触发下落动画
    if (!prev || showInit) return;

    // 11.25rem = bottom-50(12.5rem) - bottom-5(1.25rem)
    // 画布态保留一个轻微上抬的停靠位，避免输入框贴到底部。
    el.animate(
      [
        { transform: "translateY(-11.25rem)" },
        { transform: "translateY(0.25rem)", offset: 0.82 },
        { transform: `translateY(${CANVAS_DOCK_REST_OFFSET_REM}rem)` },
      ],
      {
        duration: 720,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      }
    );
  }, [showInit]);

  const panelThemeLabel = reqPanelUseSmartTheme ? "智能" : (cardKeyLabel || "脑洞");
  const panelTitleText =
    reqPanelStatus === "loading"
      ? `${panelThemeLabel}喵思考中`
      : reqPanelStatus === "success"
        ? `${panelThemeLabel}喵搞定了！`
        : reqPanelStatus === "paused"
          ? pausedRequestMessageRef.current || `${panelThemeLabel}喵已暂停`
        : reqPanelStatus === "error"
          ? `${panelThemeLabel}喵出错了`
          : reqPanelUseSmartTheme
            ? "智能喵"
            : reqPanelTitle || (showInit ? `${panelThemeLabel}喵` : `${cardKeyLabel || "脑洞"}`);
  const panelTitleBackgroundImage = useMemo(() => {
    if (panelTitleText.includes("梗概")) {
      return "linear-gradient(90deg, #DBEAFE 0%, rgba(219,234,254,0) 100%)";
    }
    if (panelTitleText.includes("角色")) {
      return "linear-gradient(90deg, #E2FEDB 0%, rgba(226,254,219,0) 100%)";
    }
    if (panelTitleText.includes("大纲")) {
      return "linear-gradient(90deg, #F9DBFE 0%, rgba(249,219,254,0) 100%)";
    }
    if (panelTitleText.includes("智能")) {
      return "linear-gradient(90deg, #E5E7EB 0%, rgba(229,231,235,0) 100%)";
    }
    return "linear-gradient(90deg, #F9EECE 0%, rgba(249,238,206,0) 100%)";
  }, [panelTitleText]);
  const panelTitleIconColor = useMemo(() => {
    if (panelTitleText.includes("梗概")) {
      return "#3B82F6";
    }
    if (panelTitleText.includes("角色")) {
      return "#5AF63B";
    }
    if (panelTitleText.includes("大纲")) {
      return "#ED3BF6";
    }
    if (panelTitleText.includes("智能")) {
      return "#737373 ";
    }
    return "#EFAF00";
  }, [panelTitleText]);

  const rawPanelDetailText = reqPanelDetail.trim();
  const panelDetailText = useMemo(
    () =>
      rawPanelDetailText ||
      (reqPanelStatus === "paused"
        ? `当前${pausedRequestMessageRef.current || `${panelThemeLabel}喵已暂停`}思考`
        : "收到了~容喵想想"),
    [panelThemeLabel, rawPanelDetailText, reqPanelStatus]
  );
  const panelBodyText = reqPanelBodyDetail.trim();
  const panelFooterText = reqPanelFooterDetail.trim();
  const hasSmartSuggestions = smartSuggestions.length > 0;
  const hasLongPanelDetail =
    rawPanelDetailText.length > 120 || rawPanelDetailText.includes("\n");
  const canToggleReqPanelExpanded =
    hasSmartSuggestions ||
    Boolean(panelBodyText) ||
    Boolean(panelFooterText) ||
    hasLongPanelDetail;
  // 面板至少需要以标题作为可见内容基线；即使 start/middle/end 都为空串，也不应触发“塌陷”样式分支。
  const hasReqPanelHeaderExtraContent = Boolean(
    panelTitleText || panelDetailText || latestGeneratedNodeId || reqPanelAction
  );
  const shouldAttachReqPanelToInput = reqPanelVisible;
  const shouldForceExpandReqPanel =
    smartSuggestionsActive && reqPanelStatus === "success" && hasSmartSuggestions;
  const shouldLockReqPanelCollapsed = !canToggleReqPanelExpanded;
  useEffect(() => {
    if (shouldForceExpandReqPanel) {
      setReqPanelExpanded(true);
    }
  }, [shouldForceExpandReqPanel]);
  useEffect(() => {
    if (shouldLockReqPanelCollapsed) {
      setReqPanelExpanded(false);
    }
  }, [shouldLockReqPanelCollapsed]);
  const isReqPanelExpanded = shouldLockReqPanelCollapsed ? false : reqPanelExpanded;
  const shouldReleaseReqPanelOverlap =
    !isReqPanelExpanded &&
    hasReqPanelHeaderExtraContent;
  const toggleReqPanelExpanded = () => {
    if (shouldLockReqPanelCollapsed) return;
    setReqPanelExpanded((v) => !v);
  };
  const inputTriggerRequestType: "auto" | "manual" =
    canvasOutputType === "auto" ? "auto" : "manual";

  const IdeaInputPanel = (
    <div
      className={cn(
        "w-full max-w-[500px] pointer-events-auto transition-transform duration-300 ease-out",
      )}
    >
      <div
        className={cn(
          "relative w-full border border-[#f3f4f6] bg-white px-[15px] pt-[12px] shadow-[0px_22px_44px_0px_rgba(0,0,0,0.1)]",
          shouldAttachReqPanelToInput
            ? "rounded-b-[21px] rounded-t-none border-t-0"
            : "rounded-[21px]",
          dialogCardPreviews.length > 0 ? "min-h-[8.5rem]" : "h-[clamp(5rem,12vh,6.125rem)]"
        )}
      >
        {dialogCardPreviews.length > 0 ? (
          <div
            className="nowheel mb-2 max-h-[3rem] overflow-y-auto overscroll-contain"
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="flex flex-wrap gap-2 pr-5">
              {dialogCardPreviews.map((item) => (
                <div
                  key={item.nodeId}
                  className="relative h-[50px] w-[80px] overflow-hidden rounded-[10px] bg-[#EEEEEE] px-2 py-1"
                >
                  <button
                    type="button"
                    className="absolute right-1 top-1 inline-flex size-3 items-center justify-center rounded-full text-[#737373] hover:bg-black/5 hover:text-[#000000]"
                    aria-label="关闭卡片预览"
                    onClick={() => {
                      setDialogCardPreviews((prev) => prev.filter((card) => card.nodeId !== item.nodeId));
                    }}
                  >
                    <X className="size-[10px]" />
                  </button>
                  <div className="truncate text-[12px] font-medium leading-4 text-[#000000]">
                    {item.title}
                  </div>
                  <div className="mt-0.5 overflow-hidden text-[10px] leading-3 text-[#737373]">
                    {item.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <Textarea
          className="min-h-0 w-full border-0 p-0 outline-none ring-0 shadow-none focus-within:ring-0"
          areaClassName={cn(
            "min-h-0 resize-none border-0 bg-transparent p-0 text-[12px] leading-5 text-foreground shadow-none outline-none",
            "placeholder:text-[#d9d9d9] focus:border-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60"
          )}
          value={ideaContent}
          onChange={(e) => {
            setIdeaInputSource("default");
            setIdeaContent(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            handleGenerateIns(
              inputTriggerRequestType,
              undefined,
              canvasOutputType === "auto" ? "auto" : undefined,
              undefined,
              undefined,
              undefined,
              "default",
              true
            );
          }}
          placeholder={currentIdeaPlaceholder}
          rows={2}
          disabled={isLoading}
        />
        <div className="absolute inset-x-[10px] bottom-[8px] flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-[26px] rounded-full border border-[#e5e7eb] bg-white text-muted-foreground hover:bg-muted"
                  disabled={true}
                  aria-label="打开工具"
                  title="打开工具"
                >
                  <Iconfont unicode="&#xe643;" className="size-4 leading-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="text-[12px]">
              暂未开放该功能，尽情期待
            </TooltipContent>
          </Tooltip>

          <div className="ml-auto">
            <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
              <PopoverTrigger asChild>
                <div className="flex items-center rounded-full bg-white p-1 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)]">
                  <Button
                    className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${activeSettingsSection === "mode"
                        ? "bg-transparent text-[#efaf00] hover:text-white"
                        : "bg-transparent text-[#111] hover:bg-[#f5f5f5]"
                      }`}
                    onClick={() => {
                      openSettingsPopover("mode");
                    }}
                    disabled={isLoading}
                  >
                    {modeButtonLabel}
                  </Button>
                  <span aria-hidden className="mx-1 h-4 w-px bg-[#e5e7eb] opacity-90" />
                  <Button
                    className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${activeSettingsSection === "output"
                        ? "bg-transparent text-[#efaf00] hover:text-white"
                        : "bg-transparent text-[#111] hover:bg-[#f5f5f5]"
                      }`}
                    onClick={() => {
                      openSettingsPopover("output");
                    }}
                    disabled={isLoading}
                  >
                    {outputButtonLabel}
                  </Button>
                  <span aria-hidden className="mx-1 h-4 w-px bg-[#e5e7eb] opacity-90" />
                  <Button
                    className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${activeSettingsSection === "model"
                        ? "bg-transparent text-[#efaf00] hover:text-white"
                        : "bg-transparent text-[#111] hover:bg-[#f5f5f5]"
                      }`}
                    onClick={() => {
                      openSettingsPopover("model");
                    }}
                    disabled={isLoading}
                  >
                    {modelButtonLabel}
                  </Button>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={10}
                className="w-[300px] rounded-[10px] border border-[#E5E7EB] bg-[#F8F9FA] p-4 shadow-[0px_12px_25px_0px_rgba(0,0,0,0.18)]"
              >
                <div className="flex gap-5">
                  <div className="w-[96px] shrink-0">
                    <div className="mb-3 text-[11px] font-semibold text-[#1A1A1A]">模式</div>
                    <div className="space-y-1">
                      {MODE_CATEGORY_OPTIONS.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          aria-disabled={item.disabled}
                          title={item.disabled ? "暂未开放该功能，尽情期待" : undefined}
                          className={cn(
                            "w-full rounded-[8px] px-2.5 py-1.5 text-left text-[11px] transition-colors",
                            item.disabled
                              ? "cursor-not-allowed text-[#9CA3AF]"
                              : "cursor-pointer",
                            canvasModeCategory === item.key
                              ? "bg-white font-medium text-[#EFAF00] shadow-[0px_0.5px_1px_0px_rgba(0,0,0,0.05)]"
                              : "text-[#4B5563] hover:bg-white/70"
                          )}
                          onClick={() => {
                            if (item.disabled) {
                              msg("warning", "暂未开放该功能，尽情期待");
                              return;
                            }
                            handleModeCategoryChange(item.key);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={cn(
                      "rounded-[8px] transition-colors",
                      activeSettingsSection === "output" && "bg-white/40"
                    )}>
                      <div className="mb-3 text-[11px] font-semibold text-[#1A1A1A]">输出类型</div>
                      <div className="flex flex-wrap gap-x-1 gap-y-2">
                        {OUTPUT_TYPE_OPTIONS.map((item) => {
                          const active = canvasOutputType === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              className={cn(
                                "rounded-[6px] cursor-pointer px-2.5 py-1 text-[10px] transition-colors",
                                active
                                  ? "bg-[#F8F3DF] text-[#EFAF00]"
                                  : "text-[#6B7280] hover:bg-white/70"
                              )}
                              onClick={() => handleOutputTypeChange(item.key)}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className={cn(
                      "mt-5 rounded-[8px] transition-colors",
                      activeSettingsSection === "model" && "bg-white/40"
                    )}>
                      <div className="mb-3 text-[11px] font-semibold text-[#1A1A1A]">模型类型</div>
                      <div className="flex gap-2">
                        {MODEL_TYPE_OPTIONS.map((item) => {
                          const active = canvasModelType === item.key;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              className={cn(
                                "rounded-[6px] cursor-pointer px-3 py-1.5 text-[11px] font-medium transition-colors",
                                active
                                  ? "bg-[#F8F3DF] text-[#EFAF00]"
                                  : "text-[#6B7280] hover:bg-white/70"
                              )}
                              onClick={() => handleModelTypeChange(item.key)}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Button
            type="button"
            className={cn(
              'rounded-full bg-[#efaf00] px-3 text-[12px] text-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1)] hover:bg-[#e2a300]',
              ideaContent === '' && showInit ? 'h-[35px]' : 'h-[28px] w-[28px]',
            )}
            aria-label={isLoading ? "暂停生成" : "发送"}
            title={isLoading ? "暂停生成" : "发送"}
            onClick={() => {
              if (isLoading) {
                void stopCurrentRequest();
                return;
              }
              void handleGenerateIns(
                inputTriggerRequestType,
                undefined,
                canvasOutputType === "auto" ? "auto" : undefined,
                undefined,
                undefined,
                undefined,
                "default",
                true
              );
            }}
          >
            {isLoading ? (
              <svg
                className="h-4 w-4 [color:inherit]"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <rect x="4" y="4" width="12" height="12" rx="0.5" fill="currentColor" />
              </svg>
            ) : ideaContent === '' && showInit ? (
              <span className="flex items-center gap-1.5">
                <span>随机选题</span>
                <Iconfont unicode="&#xe7e2;" className="shrink-0 !text-[10px] text-white" />
              </span>
            ) : (
              <ArrowUp className="text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const IdeaInputDock = (
    <div
      key={inputDockResetKey}
      ref={dockRef}
      className={cn(
        "pointer-events-none absolute inset-x-0 z-50 flex justify-center px-4",
        "bottom-5 will-change-transform",
        showInit ? "-translate-y-[8.5rem]" : "translate-y-[-0.75rem]"
      )}
    >
      <div className="pointer-events-none flex w-full max-w-[500px] flex-col">
        {outlineCompletionCelebrationVisible ? (
          <div className="pointer-events-none mb-3 flex justify-center">
            <div className="relative w-full overflow-hidden px-4 py-3">
              <div
                ref={outlineCompletionMessageRef}
                className="relative flex flex-col items-center text-center ins-celebration-pop"
              >
                <p className="mt-2 text-[13px] leading-5 text-[#374151]">
                  <span className="mr-1 inline-block ins-celebration-emoji">🎉</span>
                  恭喜您已经完成一篇小说的伟大设想，点击左上角-&gt;写作可以定制化代写正文哦~
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {reqPanelVisible && (
          <div
            className={cn(
              "pointer-events-auto relative z-10 w-full overflow-hidden rounded-[18px] rounded-b-none border border-[#f3f4f6] bg-[#FFFBED] shadow-[0px_10px_28px_0px_rgba(0,0,0,0.10)]",
              isReqPanelExpanded
                ? panelFooterText
                  ? "-mb-[clamp(0.125rem,0.5vh,0.25rem)]"
                  : "-mb-[clamp(0.5rem,1vh,0.75rem)]"
                : shouldReleaseReqPanelOverlap
                  ? "-mb-px"
                  : hasReqPanelHeaderExtraContent
                    ? "-mb-[clamp(0.25rem,0.75vh,0.5rem)]"
                    : "-mb-[clamp(0.75rem,1.5vh,1.25rem)]",
              "transition-[margin,transform] duration-300 ease-out",
              shouldReleaseReqPanelOverlap
                ? "translate-y-0"
                : "translate-y-1 sm:translate-y-2 md:translate-y-3 lg:translate-y-5"
            )}
          >
            <div
              className={cn(
                "flex w-full items-start gap-3 px-4 text-left",
                hasReqPanelHeaderExtraContent
                  ? "py-3.5"
                  : "py-3",
                "transition-colors duration-200",
                !shouldLockReqPanelCollapsed && "cursor-pointer"
              )}
              onClick={!shouldLockReqPanelCollapsed ? toggleReqPanelExpanded : undefined}
              role={!shouldLockReqPanelCollapsed ? "button" : undefined}
              tabIndex={!shouldLockReqPanelCollapsed ? 0 : undefined}
              aria-expanded={isReqPanelExpanded}
              onKeyDown={(e) => {
                if (shouldLockReqPanelCollapsed) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleReqPanelExpanded();
                }
              }}
            >
              <div
                className={cn(
                  "min-w-0 flex-1",
                  hasReqPanelHeaderExtraContent && "space-y-2"
                )}
              >
                <div
                  className="truncate inline-flex w-fit rounded-sm flex gap-1 items-center px-2 py-0.5 text-[13px] font-semibold text-[#111]"
                  style={{ backgroundImage: panelTitleBackgroundImage }}
                >
                  {/* <img src={naodongmiao} alt="脑洞喵" className="w-4 h-4" /> */}
                  <span
                    style={{
                      color: panelTitleIconColor,
                      lineHeight: 1
                    }}
                  >
                    <Iconfont unicode="&#xe789;" />
                  </span>
                  {panelTitleText}
                </div>
                {panelDetailText || latestGeneratedNodeId ? (
                  <div className="flex w-full items-start justify-between gap-2 text-[12px] text-[#6b7280]">
                    <div className="min-w-0 flex-1 overflow-visible">
                      {panelDetailText ? (
                        <span
                          className="block min-w-0 w-full overflow-hidden whitespace-pre-wrap break-all text-clip leading-5"
                          style={
                            !isReqPanelExpanded && canToggleReqPanelExpanded
                              ? ({
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                              } as any)
                              : undefined
                          }
                        >
                          {panelDetailText}
                        </span>
                      ) : null}
                    </div>
                    {latestGeneratedNodeId ? (
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-black transition-opacity hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          focusCanvasNode(latestGeneratedNodeId);
                        }}
                      >
                        <MapPin className="size-3 text-black" />
                        <span>定位</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {reqPanelAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 h-7 rounded-full border border-[#EFAF00] bg-white px-3 text-[12px] text-[#EFAF00] hover:bg-[#FFF7DB]"
                    onClick={(e) => {
                      e.stopPropagation();
                      const action = reqPanelAction;
                      if (!action) return;
                      if (action.generate) {
                        const { nodeId, outputType } = action.generate;
                        void handleGenerateInsFromContext(nodeId, outputType);
                      }
                      action.onClick?.();
                    }}
                  >
                    {reqPanelAction.label}
                  </Button>
                ) : null}
              </div>
              {canToggleReqPanelExpanded ? <Iconfont
                unicode={isReqPanelExpanded ? "&#xeaa1;" : "&#xeaa6;"}
                className={cn(
                  "shrink-0 text-[#6b7280] transition-transform cursor-pointer duration-300",
                  isReqPanelExpanded ? "rotate-0" : "rotate-0"
                )}
              /> : null}
            </div>

            <div
              className={cn(
                "flex flex-col transition-[max-height,opacity,padding] duration-300 ease-out",
                isReqPanelExpanded ? "max-h-[320px] opacity-100 px-3 pb-7 pt-2" : "max-h-0 opacity-0 px-3 pb-0 pt-0",
                !isReqPanelExpanded && "overflow-hidden"
              )}
            >
              <AutoScrollArea
                maxHeight={panelFooterText ? 148 : 200}
                autoScroll={reqPanelStatus === "loading"}
                className="w-full rounded-[14px]"
              >
                {isReqPanelExpanded && hasLongPanelDetail ? (
                  <div className="px-3 py-2 text-[12px] leading-5 text-[#111] whitespace-pre-wrap break-all">
                    {panelDetailText}
                  </div>
                ) : null}
                {panelBodyText && (smartSuggestions.length === 2 || !hasSmartSuggestions) ? (
                  <div className="px-3 py-2 text-[12px] leading-5 text-[#111]">
                    <MarkdownRenderer content={panelBodyText} />
                  </div>
                ) : null}
                {smartSuggestionsActive && reqPanelStatus === "success" && smartSuggestions.length > 0 ? (
                  <div className="w-full min-w-0 max-w-full space-y-2 px-2 py-2">
                    {smartSuggestions.map((item, idx) => (
                      <Button
                        key={item.id || `${item.theme}-${idx}`}
                        variant="default"
                        className="w-[38em] min-w-0 max-w-full justify-start overflow-hidden rounded-[12px] !border !border-[#EFAF00] bg-[#F9EECE] px-3 py-2 text-left text-[12px] leading-5 text-[#111] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#F9EECE]/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#F9EECE]"
                        title={item.theme}
                        disabled={isLoading}
                        onClick={() => {
                          if (isLoading) return;
                          createSingleSuggestionCard(item.id, idx);
                        }}
                      >
                        <span className="block min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.theme}
                        </span>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </AutoScrollArea>
              {panelFooterText ? (
                <div className="mt-2 shrink-0 px-3 pb-3 text-[12px] text-[#6b7280]">
                  <span className="block">{panelFooterText}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div
          className="pointer-events-auto relative z-20"
        >
          {IdeaInputPanel}
        </div>
      </div>
    </div>
  );

  return (
    <InsCanvasContext.Provider value={handlers}>
      <div
        ref={containerRef}
        className="relative flex h-full w-full min-w-[400px] flex-col overflow-hidden rounded-[20px] border border-[#dedede] bg-[#f1f1f1]"
      >
        {IdeaInputDock}
        {showInit ? (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 -translate-y-18 sm:-translate-y-20 md:-translate-y-22 lg:-translate-y-30">
            <InitCarousel
              isAnimate
              onPickType={(payload) => {
                setIdeaInputSource(payload.source === "img" || payload.source === "label" ? "carousel" : "default");
                const cleanedText = String(payload.text || "")
                  .replace(/^\s*脑洞[，,、:：]?\s*/i, "")
                  .trim();
                setIdeaContent(cleanedText || payload.text);
                setReqPanelUseSmartTheme(false);
                setCardKeyLabel("脑洞");
                applyCanvasMode("brainstorm");
              }}
            />
            <h1 className="z-10 mt-3 text-center text-[26px] font-semibold text-[#4f4f4f]">
              {isLoading
                ? `脑洞喵正在生成${ideaContent ? ideaContent + "选题" : "随机选题"}...`
                : "与脑洞喵一起脑洞大开地创作"}
            </h1>
            <div className="mt-4 flex gap-2">
              <Button className="rounded-full bg-white text-[#4B5563] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]" onClick={() => navigate("/workspace/creation-community/course")}>
                <Iconfont unicode="&#xe64f;" className="text-[#E5E7EB]" />
                创作灵感社区
              </Button>
              <Button className="rounded-full bg-white text-[#4B5563] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]" onClick={() => { window.open('https://icnirh1t37sj.feishu.cn/wiki/VIjgww4SUiPXkVk1Qquc6iTonLc?from=from_copylink') }}>
                <Iconfont unicode="&#xe641;" className="text-[#E5E7EB]" />
                使用指南
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative flex-1 min-h-[200px]">
            <ReactFlow
              id="main-canvas-flow"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onNodeDragStop={handleNodeDragStop}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              proOptions={{ hideAttribution: true }}
              onMove={(_, viewport) => {
                if (!viewport) return;
                setZoomPercent(Math.round((viewport.zoom || 1) * 100));
              }}
              defaultEdgeOptions={{
                type: "default",
                style: {
                  // 基础连线样式：细一点、浅灰色、圆角
                  stroke: "#EFAF00",
                  strokeWidth: 2,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                },
                // 在目标节点一侧显示与线条同色的开放箭头
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: "#EFAF00",
                  width: 18,
                  height: 18,
                },
              } as any}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              onPaneContextMenu={(e) => e.preventDefault()}
              zoomOnScroll={!showInit}
              zoomOnPinch={!showInit}
              // 画布空白区支持左/中/右键拖拽；可通过手型按钮关闭
              panOnDrag={!showInit && panMode ? [0, 1, 2] : false}
              panOnScroll={!showInit}
              panActivationKeyCode={!showInit && panMode ? 'Space' : null}
              nodesDraggable={!showInit}
              elementsSelectable={!showInit}
              multiSelectionKeyCode={null}
              nodesConnectable={!showInit}
              minZoom={!showInit ? 0.1 : 1}
              maxZoom={!showInit ? 2 : 1}
              className={`h-full w-full bg-[#f1f1f1] ${!hasIdea ? "no-idea" : ""}`}
            >
              {hasIdea && (
                <Controls
                  showZoom={false}
                  showFitView={true}
                  showInteractive={false}
                  position="top-left"
                  orientation="vertical"
                  style={{
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                  className="bg-background/90 rounded-full shadow-sm border px-1 py-2 flex flex-col items-stretch gap-2"
                >
                  <ControlButton
                    aria-label={panMode ? "关闭画布拖拽" : "开启画布拖拽"}
                    title={panMode ? "关闭画布拖拽" : "开启画布拖拽"}
                    onClick={() => setPanMode((v) => !v)}
                    className={panMode ? "!bg-primary !text-white rounded-full" : "rounded-full"}
                  >
                    {/* 简单手型图标：可以替换成你们自己的 iconfont */}
                    <span className="iconfont">&#xe86c;</span>
                  </ControlButton>
                </Controls>
              )}
              {!shouldHideCanvasAuxControls ? (
                <MiniMap
                  pannable={!showInit}
                  zoomable={!showInit}
                  // 放到左下角缩放控件上方
                  style={{ left: 5, right: "auto", bottom: 64 }}
                />
              ) : null}
              {!shouldHideCanvasAuxControls && (
                <div className="pointer-events-auto absolute bottom-4 left-4 z-50 flex items-center rounded-[12px] border border-[#e5e7eb] bg-white/90 px-2 py-1 text-xs shadow-sm backdrop-blur">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!hasIdea}
                    onClick={() => hasIdea && zoomOut()}
                    aria-label="Zoom out"
                  >
                    −
                  </Button>
                  <span className="mx-1 min-w-[3rem] text-center tabular-nums">
                    {zoomPercent}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={!hasIdea}
                    onClick={() => hasIdea && zoomIn()}
                    aria-label="Zoom in"
                  >
                    +
                  </Button>
                </div>
              )}

              <Background />
            </ReactFlow>
            {/* <div className="pointer-events-auto absolute bottom-5 right-5 z-50 flex items-center gap-2 rounded-md border bg-background/80 p-1 shadow-sm backdrop-blur">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomOut()}
                  aria-label="Zoom out"
                >
                  −
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  disabled={!hasIdea}
                  onClick={() => hasIdea && zoomIn()}
                  aria-label="Zoom in"
                >
                  +
                </Button>
              </div> */}
          </div>
        )}
        <InitWorkDialog
          open={initWorkDialogShow}
          onClose={() => setInitWorkDialogShow(false)}
          onCreateHere={handleCreateHere}
          onCreateNew={handleCreateNew}
        />
        <InspirationHistoryDialog
          open={historyDialogShow}
          onClose={() => setHistoryDialogShow(false)}
          workId={workId}
          inspirationDrawId={inspirationDrawId}
          onRestore={handleRestoreVersion}
        />

        {/* 画布右下角：+ 展开 4 个操作项（无整体背景，item 白底），展开时 + 变 - */}
        {!shouldHideCanvasAuxControls && (
          <div className="pointer-events-auto absolute bottom-5 right-5 z-50">
            <Popover open={moreActionsOpen} onOpenChange={setMoreActionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-9 rounded-[7px] border border-[#e5e7eb] bg-white text-[#111] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]"
                  aria-label={moreActionsOpen ? "收起更多操作" : "展开更多操作"}
                  title={moreActionsOpen ? "收起" : "更多"}
                >
                  <span className="text-lg leading-none">{moreActionsOpen ? "−" : "+"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                sideOffset={10}
                className="w-auto bg-transparent p-0 shadow-none"
              >
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-[155px] h-[40px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setForceCanvasView(true);
                      const nodeId = createCardByKey("brainstorm", { insertPosition: "right" });
                      focusNewlyCreatedBlankNode(nodeId);
                    }}
                  >
                    脑洞卡
                  </Button>
                  <Button
                    className="w-[155px] h-[40px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setForceCanvasView(true);
                      const nodeId = createCardByKey("summary", { insertPosition: "right" });
                      focusNewlyCreatedBlankNode(nodeId);
                    }}
                  >
                    故事梗概卡
                  </Button>
                  <Button
                    className="w-[155px] h-[40px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setForceCanvasView(true);
                      const nodeId = createStandaloneRoleGroupDraftCard({ insertPosition: "right" }).roleNodeId;
                      focusNewlyCreatedBlankNode(nodeId);
                    }}
                  >
                    角色卡
                  </Button>
                  <Button
                    className="w-[155px] h-[40px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setForceCanvasView(true);
                      const nodeId = createStandaloneOutlineSettingsGroup({ insertPosition: "right" }).groupId;
                      focusNewlyCreatedBlankNode(nodeId);
                    }}
                  >
                    大纲卡
                  </Button>
                  <Button
                    className="w-[155px] h-[40px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      setForceCanvasView(true);
                      const nodeId = createCardByKey("info", { insertPosition: "right" });
                      focusNewlyCreatedBlankNode(nodeId);
                    }}
                  >
                    空白信息卡
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
      <style>{`
          /* 统一连接线样式：细灰色圆角，和 Vue 版保持一致风格 */
          #main-canvas-flow .react-flow__edge-path {
            stroke: #DEDEDE;
            stroke-width: 2px;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
            /* 流式/高亮连线：虚线 + 流动动画 */
          #main-canvas-flow .react-flow__edge.animated .react-flow__edge-path {
            stroke-dasharray: 5;
            animation: rf-dashdraw 0.6s linear infinite;
          }

          @keyframes rf-dashdraw {
            to {
              stroke-dashoffset: -10;
            }
          }

          /* 左侧 Controls 工具栏：按钮统一圆角背景 */
          #main-canvas-flow .react-flow__controls {
            border-radius: 9999px;
            overflow: hidden;
          }

          #main-canvas-flow .react-flow__controls-button {
            border-radius: 9999px;
          }

          /* 主卡片骨架屏左到右高亮动画 */
          .ins-skeleton {
            position: relative;
            overflow: hidden;
            background-color: #e5e7eb;
          }

          .ins-skeleton::before {
            content: "";
            position: absolute;
            inset: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.9) 50%,
              rgba(255,255,255,0) 100%
            );
            opacity: 0.9;
            animation: ins-skeleton-shimmer 1.4s ease-in-out infinite;
          }

          @keyframes ins-skeleton-shimmer {
            100% {
              transform: translateX(100%);
            }
          }

          .ins-celebration-pop {
            animation: ins-celebration-pop 520ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .ins-celebration-emoji {
            transform-origin: 50% 70%;
            animation: ins-celebration-emoji-spin 1.2s ease-in-out infinite;
          }

          @keyframes ins-celebration-pop {
            0% {
              opacity: 0;
              transform: translateY(10px) scale(0.96);
            }
            60% {
              opacity: 1;
              transform: translateY(0) scale(1.02);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes ins-celebration-emoji-spin {
            0%, 100% {
              transform: rotate(0deg) scale(1);
            }
            25% {
              transform: rotate(-16deg) scale(1.06);
            }
            50% {
              transform: rotate(14deg) scale(1.1);
            }
            75% {
              transform: rotate(-10deg) scale(1.04);
            }
          }

          /* 主卡片（card-1 / card-3）倾斜效果：仅在选择前（!hasIdea）生效，点击立即创作后取消 */
          #main-canvas-flow.no-idea .react-flow__node[data-id="card-1"] .main-card,
          #main-canvas-flow.no-idea .vue-flow__node[data-id="card-1"] .main-card {
            transform: translateY(65px) rotate(-15deg);
            transform-origin: bottom left;
          }
          #main-canvas-flow.no-idea .react-flow__node[data-id="card-3"] .main-card,
          #main-canvas-flow.no-idea .vue-flow__node[data-id="card-3"] .main-card {
            transform: translateY(65px) rotate(15deg);
            transform-origin: bottom right;
          }
        `}</style>
    </InsCanvasContext.Provider>
  );
}

const InsCanvas = React.forwardRef<InsCanvasApi, InsCanvasProps>(
  (props, ref) => (
    <ReactFlowProvider>
      <InsCanvasInner
        workId={props.workId}
        nodes={props.nodes}
        edges={props.edges}
        inspirationDrawId={props.inspirationDrawId}
        onCreateHere={props.onCreateHere}
        onCreateNew={props.onCreateNew}
        onMessage={props.onMessage}
        onCanvasReady={props.onCanvasReady}
        autoSyncDirectory={props.autoSyncDirectory}
        onAutoSyncDirectory={props.onAutoSyncDirectory}
        onCanvasFileContentChange={props.onCanvasFileContentChange}
        onCanvasOpenFileRequest={props.onCanvasOpenFileRequest}
        canvasRef={ref as React.RefObject<InsCanvasApi | null>}
      />
    </ReactFlowProvider>
  )
);
InsCanvas.displayName = "InsCanvas";
export default InsCanvas;
