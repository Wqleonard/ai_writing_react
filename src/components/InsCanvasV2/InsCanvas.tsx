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
  import { AutoScrollArea } from "@/components/AutoScrollArea/AutoScrollArea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
  import { cn } from "@/lib/utils";
  import MainCardNode from "./components/MainCardNode";
  import SummaryCardNode from "./components/SummaryCardNode";
  import SettingCardNode from "./components/SettingCardNode";
  import OutlineCardNode from "./components/OutlineCardNode";
  import RoleGroupNode from "./components/RoleGroupNode";
  import InitCarousel from "./components/InitCarousel";
  import InitWorkDialog from "./components/InitWorkDialog";
  import InspirationHistoryDialog from "./components/InspirationHistoryDialog";
  import { InsCanvasContext } from "@/components/InsCanvasV2/InsCanvasContext";
  import { useDagreLayout } from "@/hooks/useDagreLayout";
  import type {
    CustomNode,
    CustomEdge,
    TreeNode,
    InspirationItem,
    ParentNode,
    InspirationVersion,
  } from "./types";
import { Iconfont } from "../Iconfont";
import { saveInspirationCanvasReq } from "@/api/works";
import { useCanvasStore } from "@/stores/canvasStore";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowUp, X } from "lucide-react";
import naodongmiao from "@/assets/images/canvas/naodongmiao.png";
  const nodeTypes = {
    mainCard: MainCardNode,
    summaryCard: SummaryCardNode,
    settingCard: SettingCardNode,
    outlineCard: OutlineCardNode,
    roleGroup: RoleGroupNode,
  };

  export interface InsCanvasApi {
    addNewCanvas: () => void;
    openHistory: () => void;
    saveCanvas: (sessionId?: string) => void;
    inspirationDrawId: string;
    isLoading: boolean;
  }

  interface InsCanvasProps {
    workId: string;
    nodes?: CustomNode[];
    edges?: CustomEdge[];
    inspirationDrawId?: string;
    onCreateHere?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onCreateNew?: (files: Record<string, string>, chain: ParentNode | null) => void;
    onMessage?: (type: "success" | "error" | "warning", msg: string) => void;
    onCanvasReady?: () => void;
    autoSyncDirectory?: boolean;
    onAutoSyncDirectory?: (files: Record<string, string>) => void;
  }

  interface InsCanvasInnerProps extends InsCanvasProps {
    canvasRef?: React.RefObject<InsCanvasApi | null>;
  }
  
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
  
  function findMainCardWithChildren(node: TreeNode): boolean {
    if (
      node.type === "mainCard" &&
      Array.isArray(node.children) &&
      node.children.length > 0
    )
      return true;
    if (node.children?.length) {
      return node.children.some(findMainCardWithChildren);
    }
    return false;
  }
  
  function createCardsFromInspiration(
    inspirationData: InspirationItem[],
    inspirationWord?: string,
    inspirationDrawId?: string,
    viewportWidth: number = 1920
  ): CustomNode[] {
    const cardWidth = 250;
    const cardSpacing = 25;
    const startY = 100;
    const centerX = viewportWidth / 2;
    const secondCardX = centerX - cardWidth / 2;
    const firstCardX = secondCardX - (cardWidth + cardSpacing);
    const thirdCardX = secondCardX + (cardWidth + cardSpacing);
    const positions = [firstCardX, secondCardX, thirdCardX];
  
    // 新版：不再创建 mainCard，统一使用 EditableFlowCard（summaryCard 形态）作为“脑洞卡”
    return inspirationData.slice(0, 3).map((item, i) => ({
      id: `brainstorm-${Date.now()}-${i + 1}`,
      type: "summaryCard",
      position: { x: positions[i], y: startY },
      draggable: true,
      data: {
        label: "脑洞",
        title: item.inspirationTheme,
        content: item.referenceStyle,
        image: "",
        fromApi: true,
        inspirationTheme: item.inspirationTheme,
        inspirationWord: inspirationWord,
        inspirationDrawId,
        allowTitleEdit: true,
        allowImageUpload: true,
        isStreaming: false,
      } as any,
    }));
  }

  type SmartSuggestionItem = {
    id: string;
    theme: string;
    content: string;
    image: string;
    inspirationWord: string;
  };

  type SettingsSection = "mode" | "output" | "model";
  type CanvasModeCategory = "smart" | "image" | "video";
  type CanvasOutputType = "auto" | "brainstorm" | "role" | "summary" | "outline" | "info";
  type CanvasModelType = "fast" | "max";
  type CanvasCardKey = "brainstorm" | "summary" | "role" | "outline" | "info";
  type CanvasAddCardOptions = {
    label?: string;
    generateLabel?: string;
    allowTitleEdit?: boolean;
    allowImageUpload?: boolean;
    title?: string;
    filePath?: string;
    content?: string;
    image?: string;
    isStreaming?: boolean;
    fromApi?: boolean;
    inspirationWord?: string;
    inspirationTheme?: string;
    shortSummary?: string;
    storySetting?: string;
    skipAutoStream?: boolean;
  };

  const MODE_CATEGORY_OPTIONS: Array<{ key: CanvasModeCategory; label: string }> = [
    { key: "smart", label: "智能模式" },
    { key: "image", label: "图片生成模式" },
    { key: "video", label: "视频生成模式" },
  ];

  const OUTPUT_TYPE_OPTIONS: Array<{ key: CanvasOutputType; label: string }> = [
    { key: "auto", label: "自动" },
    { key: "brainstorm", label: "脑洞" },
    { key: "role", label: "角色" },
    { key: "summary", label: "梗概" },
    { key: "outline", label: "大纲" },
    { key: "info", label: "信息" },
  ];

  const MODEL_TYPE_OPTIONS: Array<{ key: CanvasModelType; label: string }> = [
    { key: "fast", label: "Fast" },
    { key: "max", label: "Max" },
  ];

  const IDEA_PLACEHOLDER_OPTIONS = [
    "输入一个想法，或点随机选题试试...",
    "拖动目录任意文件到画布，变为信息卡继续发散创意吧！",
    "将卡片添加到对话，可以根据卡片内容继续创作哦~",
    "头脑风暴开始咯！",
  ] as const;

  type AutoResolvedResult =
    | {
        kind: "brainstorm";
        inspirations: InspirationItem[];
        inspirationWord?: string;
      }
    | {
        kind: "card";
        cardKey: Exclude<CanvasCardKey, "brainstorm">;
        title?: string;
        content?: string;
      };

  type ReqPanelAction = {
    label: string;
    onClick?: () => void;
    generate?: {
      nodeId: string;
      outputType: Exclude<CanvasOutputType, "auto">;
    };
  };

  const AUTO_CARD_FIELD_LABELS: Record<string, string> = {
    synopsis: "梗概",
    summary: "梗概",
    short_summary: "梗概",
    shortSummary: "梗概",
    background: "背景",
    storySetting: "故事设定",
    story_setting: "故事设定",
    highlight: "亮点",
    informationGap: "信息差",
    intro: "简介",
    description: "描述",
    definition: "设定",
    content: "内容",
    age: "年龄",
    personality: "性格",
    biography: "经历",
  };

  const getTextValue = (value: unknown) => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  };

  const getFirstTextValue = (...values: unknown[]) => {
    for (const value of values) {
      const text = getTextValue(value);
      if (text) return text;
    }
    return "";
  };

  const RANDOM_IDEA_OPTIONS_MARKER = "**三个脑洞选项：**";
  const CANVAS_DOCK_REST_OFFSET_REM = -0.75;

  const splitRandomIdeaPanelContent = (content: unknown) => {
    const text = getTextValue(content).replace(/\r/g, "");
    if (!text) {
      return { head: "", tail: "" };
    }

    const markerIndex = text.indexOf(RANDOM_IDEA_OPTIONS_MARKER);
    const normalized = markerIndex >= 0
      ? `${text.slice(0, markerIndex).trim()}\n${text.slice(markerIndex + RANDOM_IDEA_OPTIONS_MARKER.length).trim()}`
      : text;
    const lines = normalized.split("\n");
    const optionIndexes = lines
      .map((line, index) => (/^\s*\d+\.\s+/.test(line) ? index : -1))
      .filter((index) => index >= 0);

    if (!optionIndexes.length) {
      return { head: normalized.trim(), tail: "" };
    }

    const firstOptionIndex = optionIndexes[0];
    const lastOptionIndex = optionIndexes[optionIndexes.length - 1];
    const head = lines.slice(0, firstOptionIndex).join("\n").trim();
    const tail = lines.slice(lastOptionIndex + 1).join("\n").trim();
    return { head, tail };
  };

  const extractUpdatesMessageContent = (value: unknown): string => {
    if (!value) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractUpdatesMessageContent(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value !== "object") return "";

    const record = value as {
      model?: { messages?: Array<{ content?: unknown }> };
      messages?: Array<{ content?: unknown }>;
    } & Record<string, unknown>;

    const messages = Array.isArray(record.model?.messages)
      ? record.model.messages
      : Array.isArray(record.messages)
        ? record.messages
        : [];

    for (const message of messages) {
      const text = getTextValue(message?.content).trim();
      if (text) return text;
    }

    for (const nested of Object.values(record)) {
      const text = extractUpdatesMessageContent(nested);
      if (text) return text;
    }
    return "";
  };

  const extractUpdatesMessageContentWithoutReadFile = (value: unknown): string => {
    if (!value) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractUpdatesMessageContentWithoutReadFile(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value !== "object") return "";

    const record = value as {
      model?: { messages?: Array<{ content?: unknown; name?: unknown }> };
      messages?: Array<{ content?: unknown; name?: unknown }>;
    } & Record<string, unknown>;

    const messages = Array.isArray(record.model?.messages)
      ? record.model.messages
      : Array.isArray(record.messages)
        ? record.messages
        : [];

    for (const message of messages) {
      const messageName = getTextValue(message?.name).trim().toLowerCase();
      if (
        messageName === "read_file" ||
        messageName === "generate_image" ||
        messageName === "think_tool"
      ) continue;
      const text = getTextValue(message?.content).trim();
      const updatedFilePath = text.match(/^Updated file\s+(.+)$/)?.[1]?.trim() || "";
      if (updatedFilePath && /(^|\/)relationship\.json$/i.test(updatedFilePath)) continue;
      if (text) return text;
    }

    for (const nested of Object.values(record)) {
      const text = extractUpdatesMessageContentWithoutReadFile(nested);
      if (text) return text;
    }
    return "";
  };

  const splitAutoUpdatesContent = (content: string) => {
    const sections = content
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      head: sections[0] ?? "",
      middle: sections.slice(1, -1),
      tail: sections.length > 1 ? (sections[sections.length - 1] ?? "") : "",
    };
  };

  const buildAutoSuggestionItems = (sections: string[]): SmartSuggestionItem[] =>
    sections
      .map((item, idx) => {
        const parsed = parseChoicesSuggestionItems(item)[0];
        if (!parsed?.theme) return null;
        return {
          id: parsed.id || `auto-updates-${idx}-${parsed.theme}`,
          theme: parsed.theme,
          content: parsed.content || "",
          image: "",
          inspirationWord: "",
        } satisfies SmartSuggestionItem;
      })
      .filter((item: SmartSuggestionItem | null): item is SmartSuggestionItem => Boolean(item));

  const extractStreamTextContent = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractStreamTextContent(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      if (record.content != null) {
        const contentText = extractStreamTextContent(record.content);
        if (contentText) return contentText;
      }
      for (const nested of Object.values(record)) {
        const text = extractStreamTextContent(nested);
        if (text) return text;
      }
    }
    return "";
  };

  const extractChoicesWriteFileContent = (value: unknown): string => {
    if (!value) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractChoicesWriteFileContent(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value === "object") {
      const record = value as {
        tool_calls?: Array<{ name?: string; args?: { file_path?: string; content?: string } }>;
        tools?: {
          files?: Record<string, unknown>;
        };
      } & Record<string, unknown>;
      const toolFiles = record.tools?.files;
      if (toolFiles && typeof toolFiles === "object") {
        const directChoices =
          getTextValue(toolFiles["/choices.json"]);
        if (directChoices) return directChoices;
      }
      if (Array.isArray(record.tool_calls)) {
        for (const toolCall of record.tool_calls) {
          if (toolCall?.name === "write_file" && toolCall?.args?.file_path === "/choices.json") {
            return getTextValue(toolCall?.args?.content);
          }
        }
      }
      for (const nested of Object.values(record)) {
        const text = extractChoicesWriteFileContent(nested);
        if (text) return text;
      }
    }
    return "";
  };

  const extractChoicesToolFileContent = (value: unknown): string => {
    if (!value) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractChoicesToolFileContent(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value === "object") {
      const record = value as {
        tools?: {
          files?: Record<string, unknown>;
        };
      } & Record<string, unknown>;
      const directChoices = getTextValue(record.tools?.files?.["/choices.json"]);
      if (directChoices) return directChoices;
      for (const nested of Object.values(record)) {
        const text = extractChoicesToolFileContent(nested);
        if (text) return text;
      }
    }
    return "";
  };

  const extractDisplayToolFileContent = (value: unknown): string => {
    if (!value) return "";
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractDisplayToolFileContent(item);
        if (text) return text;
      }
      return "";
    }
    if (typeof value === "object") {
      const record = value as {
        model?: {
          messages?: Array<{
            tool_calls?: Array<{
              name?: string;
              args?: { file_path?: string; content?: string };
            }>;
          }>;
        };
        messages?: Array<{
          tool_calls?: Array<{
            name?: string;
            args?: { file_path?: string; content?: string };
          }>;
        }>;
        tools?: {
          files?: Record<string, unknown>;
        };
      } & Record<string, unknown>;
      const toolFiles = record.tools?.files;
      if (toolFiles && typeof toolFiles === "object") {
        const dynamicFileKey = Object.keys(toolFiles).find(
          (key) => key !== "/choices.json" && !/(^|\/)relationship\.json$/i.test(key)
        );
        if (dynamicFileKey) {
          const dynamicFileContent = getTextValue(toolFiles[dynamicFileKey]);
          if (dynamicFileContent) return dynamicFileContent;
        }
      }
      const messages = Array.isArray(record.model?.messages)
        ? record.model.messages
        : Array.isArray(record.messages)
          ? record.messages
          : [];
      for (const message of messages) {
        const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
        for (const toolCall of toolCalls) {
          if (getTextValue(toolCall?.name) !== "write_file") continue;
          const filePath = getTextValue(toolCall?.args?.file_path);
          if (!filePath || filePath === "/choices.json" || /(^|\/)relationship\.json$/i.test(filePath)) continue;
          const content = getTextValue(toolCall?.args?.content);
          if (content) return content;
        }
      }
      for (const nested of Object.values(record)) {
        const text = extractDisplayToolFileContent(nested);
        if (text) return text;
      }
    }
    return "";
  };

  const parseChoicesSuggestionItems = (content: string): SmartSuggestionItem[] => {
    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item, idx) => {
          const theme = getTextValue(item);
          if (!theme) return null;
          return {
            id: `smart-stream-${idx}-${theme}`,
            theme,
            content: "",
            image: "",
            inspirationWord: "",
          } satisfies SmartSuggestionItem;
        })
        .filter((item: SmartSuggestionItem | null): item is SmartSuggestionItem => Boolean(item));
    } catch {
      return content
        .split("\n")
        .map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          const match =
            trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*(?:\s*[-:：]\s*(.+))?$/) ??
            trimmed.match(/^\d+\.\s+(.+?)(?:\s*[-:：]\s*(.+))?$/);
          if (!match) return null;
          const title = getTextValue(match[1]);
          const suffix = getTextValue(match[2]);
          const theme = [title, suffix].filter(Boolean).join(" - ");
          if (!theme) return null;
          return {
            id: `smart-stream-${idx}-${theme}`,
            theme,
            content: suffix,
            image: "",
            inspirationWord: "",
          } satisfies SmartSuggestionItem;
        })
        .filter((item: SmartSuggestionItem | null): item is SmartSuggestionItem => Boolean(item));
    }
  };

  type CanvasWriteFileCall = {
    filePath: string;
    content: string;
    callId?: string;
  };

  type PartialCanvasWriteFileCall = CanvasWriteFileCall & {
    callId: string;
  };

  const extractWriteFileCalls = (value: unknown): CanvasWriteFileCall[] => {
    const result = new Map<string, CanvasWriteFileCall>();

    const pushFile = (filePath: string, content: string) => {
      const normalizedPath = getTextValue(filePath);
      if (!normalizedPath) return;
      const normalizedContent = getTextValue(content);
      result.set(normalizedPath, {
        filePath: normalizedPath,
        content: normalizedContent,
      });
    };

    const visit = (current: unknown) => {
      if (!current) return;
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      if (typeof current !== "object") return;

      const record = current as {
        tool_calls?: Array<{ name?: string; args?: { file_path?: string; content?: string } }>;
        tools?: {
          files?: Record<string, unknown>;
        };
      } & Record<string, unknown>;

      const toolFiles = record.tools?.files;
      if (toolFiles && typeof toolFiles === "object") {
        Object.entries(toolFiles).forEach(([filePath, fileContent]) => {
          pushFile(filePath, getTextValue(fileContent));
        });
      }

      if (Array.isArray(record.tool_calls)) {
        record.tool_calls.forEach((toolCall) => {
          if (toolCall?.name !== "write_file") return;
          pushFile(
            getTextValue(toolCall?.args?.file_path),
            getTextValue(toolCall?.args?.content)
          );
        });
      }

      Object.values(record).forEach(visit);
    };

    visit(value);
    return Array.from(result.values());
  };

  const extractPartialWriteFileCalls = (value: unknown): PartialCanvasWriteFileCall[] => {
    const result = new Map<string, PartialCanvasWriteFileCall>();

    const visit = (current: unknown) => {
      if (!current) return;
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      if (typeof current !== "object") return;

      const record = current as {
        tool_calls?: Array<{ name?: string; args?: { id?: string; file_path?: string; content?: string } }>;
      } & Record<string, unknown>;

      if (Array.isArray(record.tool_calls)) {
        record.tool_calls.forEach((toolCall) => {
          if (toolCall?.name !== "write_file") return;
          const callId = getTextValue(toolCall?.args?.id);
          if (!callId) return;
          const filePath = getTextValue(toolCall?.args?.file_path);
          result.set(callId, {
            callId,
            filePath,
            content: getTextValue(toolCall?.args?.content),
          });
        });
      }

      Object.values(record).forEach(visit);
    };

    visit(value);
    return Array.from(result.values());
  };

  const extractUpdateToolFiles = (value: unknown): CanvasWriteFileCall[] => {
    const result = new Map<string, CanvasWriteFileCall>();

    const visit = (current: unknown) => {
      if (!current) return;
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      if (typeof current !== "object") return;

      const record = current as {
        tools?: {
          files?: Record<string, unknown>;
        };
        messages?: Array<{
          content?: string;
          name?: string;
          tool_call_id?: string;
        }>;
      } & Record<string, unknown>;

      const callIdByPath = new Map<string, string>();
      if (Array.isArray(record.messages)) {
        record.messages.forEach((message) => {
          if (getTextValue(message?.name) !== "write_file") return;
          const toolCallId = getTextValue(message?.tool_call_id);
          const content = getTextValue(message?.content);
          const matchedPath =
            content.match(/^Updated file\s+(.+)$/)?.[1]?.trim() ||
            "";
          if (!toolCallId || !matchedPath) return;
          callIdByPath.set(matchedPath, toolCallId);
        });
      }

      const toolFiles = record.tools?.files;
      if (toolFiles && typeof toolFiles === "object") {
        Object.entries(toolFiles).forEach(([filePath, fileContent]) => {
          const normalizedPath = getTextValue(filePath);
          if (!normalizedPath) return;
          result.set(normalizedPath, {
            filePath: normalizedPath,
            content: getTextValue(fileContent),
            callId: callIdByPath.get(normalizedPath),
          });
        });
      }

      Object.values(record).forEach(visit);
    };

    visit(value);
    return Array.from(result.values());
  };

  const getLatestWriteFiles = (filesByPath: Map<string, CanvasWriteFileCall>): CanvasWriteFileCall[] => {
    return Array.from(filesByPath.values());
  };

  const formatWriteFilesPanelContent = (files: CanvasWriteFileCall[]) =>
    files
      .map((item, index) => {
        const filePath = getTextValue(item.filePath);
        const fileTitle =
          filePath.split("/").pop()?.replace(/\.md$/i, "") || `文件${index + 1}`;
        const content = getTextValue(item.content).trim();
        return `## ${fileTitle}${content ? `\n\n${content}` : ""}`;
      })
      .filter(Boolean)
      .join("\n\n");

  const extractMarkdownTitle = (markdown: string, fallback: string) => {
    const headingMatch = markdown.match(/^#{1,6}\s+(.+)$/m);
    return getFirstTextValue(headingMatch?.[1], fallback);
  };

  const extractMarkdownImage = (markdown: string) => {
    const imageMatch = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
    return getTextValue(imageMatch?.[1]);
  };

  const inferCardKeyFromWriteFilePath = (filePath: string): CanvasCardKey => {
    if (filePath.includes("[角色卡]")) return "role";
    if (filePath.includes("[梗概卡]")) return "summary";
    if (filePath.includes("[大纲卡]")) return "outline";
    if (filePath.includes("[脑洞卡]")) return "brainstorm";
    return "info";
  };

  const isRoleCardWriteFile = (filePath: string) => /(^|\/)\[角色卡\]\//.test(filePath);
  const isRelationshipWriteFile = (filePath: string) =>
    /(^|\/)relationship\.json$/i.test(filePath) || /(^|\/)角色关系\.md$/i.test(filePath);
  const shouldSkipWriteFileCardCreation = (filePath: string) =>
    /(^|\/)relationship\.json$/i.test(filePath);
  const isRelationshipInfoWriteFile = (filePath: string) =>
    isRelationshipWriteFile(filePath) && !isRoleCardWriteFile(filePath);

  const formatRecordMarkdown = (
    record: Record<string, unknown>,
    excludeKeys: string[] = []
  ) =>
    Object.entries(record)
      .filter(([key]) => !excludeKeys.includes(key))
      .map(([key, value]) => {
        const text = getTextValue(value);
        if (!text) return "";
        return `**${AUTO_CARD_FIELD_LABELS[key] ?? key}**：${text}`;
      })
      .filter(Boolean)
      .join("\n\n");

  const formatRoleCardsMarkdown = (roleCards: Array<Record<string, unknown>>) =>
    roleCards
      .map((item, index) => {
        const title = getFirstTextValue(item.name, item.title, `角色${index + 1}`);
        const body = formatRecordMarkdown(item, ["name", "title"]);
        return `## ${title}${body ? `\n\n${body}` : ""}`;
      })
      .join("\n\n");

  const formatOutlineMarkdown = (outlineItems: Array<Record<string, unknown>>) =>
    outlineItems
      .map((item, index) => {
        const episode = getFirstTextValue(item.episode, item.chapter, `第${index + 1}节`);
        const title = getFirstTextValue(item.episode_title, item.title);
        const note = getFirstTextValue(
          item.episode_note,
          item.note,
          item.content,
          item.summary,
          item.description
        );
        return `## ${episode}${title ? ` ${title}` : ""}${note ? `\n\n${note}` : ""}`;
      })
      .join("\n\n");

  const resolveAutoResultFromResponse = (
    response: any,
    fallbackTitle: string
  ): AutoResolvedResult | null => {
    const candidates = [response, response?.data, response?.result, response?.data?.result].filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
    );

    for (const candidate of candidates) {
      const inspirations = Array.isArray(candidate.inspirations)
        ? (candidate.inspirations as InspirationItem[]).filter(
            (item) => getTextValue(item?.inspirationTheme) || getTextValue(item?.referenceStyle)
          )
        : [];
      if (inspirations.length > 0) {
        return {
          kind: "brainstorm",
          inspirations,
          inspirationWord: getFirstTextValue(candidate.inspirationWord),
        };
      }

      const roleCards = Array.isArray(candidate.roleCards)
        ? (candidate.roleCards as Array<Record<string, unknown>>)
        : Array.isArray(candidate.characters)
          ? (candidate.characters as Array<Record<string, unknown>>)
          : Array.isArray(candidate.roles)
            ? (candidate.roles as Array<Record<string, unknown>>)
            : [];
      if (roleCards.length > 0) {
        return {
          kind: "card",
          cardKey: "role",
          title: getFirstTextValue(roleCards[0]?.name, roleCards[0]?.title, fallbackTitle),
          content: formatRoleCardsMarkdown(roleCards),
        };
      }

      const outlineItems = Array.isArray(candidate.outline_dict)
        ? (candidate.outline_dict as Array<Record<string, unknown>>)
        : Array.isArray((candidate.outline as Record<string, unknown> | undefined)?.outline_dict)
          ? (((candidate.outline as Record<string, unknown>).outline_dict as Array<Record<string, unknown>>))
          : [];
      if (outlineItems.length > 0) {
        return {
          kind: "card",
          cardKey: "outline",
          title: getFirstTextValue(candidate.title, fallbackTitle),
          content: formatOutlineMarkdown(outlineItems),
        };
      }

      const summaryContent = getFirstTextValue(
        candidate.short_summary,
        candidate.shortSummary,
        candidate.synopsis,
        candidate.summary,
        candidate.intro
      );
      if (summaryContent) {
        return {
          kind: "card",
          cardKey: "summary",
          title: getFirstTextValue(candidate.title, fallbackTitle),
          content: summaryContent,
        };
      }

      const infoContent = formatRecordMarkdown(candidate, [
        "inspirations",
        "inspirationWord",
        "roleCards",
        "characters",
        "roles",
        "outline",
        "outline_dict",
        "title",
      ]);
      if (infoContent) {
        return {
          kind: "card",
          cardKey: "info",
          title: getFirstTextValue(candidate.title, candidate.name, fallbackTitle),
          content: infoContent,
        };
      }
    }

    return null;
  };

  const sortCanvasNodes = (a: CustomNode, b: CustomNode) =>
    (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0);

  const sanitizeCanvasEntryName = (rawName: unknown, fallback: string) => {
    const cleaned = String(rawName ?? "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || fallback;
  };

  const getCanvasNodeBaseName = (node: CustomNode, fallbackIndex: number) => {
    const title = String(node.data?.title ?? "").trim();
    const label = String(node.data?.label ?? "").trim();
    return sanitizeCanvasEntryName(title || label, `卡片${fallbackIndex + 1}`);
  };

  const getCanvasDirectoryName = (labelLike: unknown) => {
    const label = String(labelLike ?? "").trim();
    const labelToDirectoryName: Record<string, string> = {
      "脑洞": "[脑洞卡]",
      "角色": "[角色卡]",
      "故事梗概": "[梗概卡]",
      "故事设定": "[设定卡]",
      "故事大纲": "[大纲卡]",
      "大纲": "[大纲卡]",
    };
    if (labelToDirectoryName[label]) return labelToDirectoryName[label];
    const normalized = sanitizeCanvasEntryName(label.replace(/卡$/g, ""), "未分类");
    return `[${normalized}卡]`;
  };

  const buildCanvasNodeMarkdown = (node: CustomNode) => {
    const title = sanitizeCanvasEntryName(
      String(node.data?.title ?? "").trim() || String(node.data?.label ?? "").trim(),
      "未命名卡片"
    );
    const body = String(node.data?.content ?? "").trim();
    const rawImages = Array.isArray((node.data as { images?: unknown[] })?.images)
      ? ((node.data as { images?: unknown[] }).images ?? []).filter(Boolean).map(String)
      : node.data?.image
        ? [String(node.data.image)]
        : [];
    const sections = [`# ${title}`];
    if (body) sections.push(body);
    if (rawImages.length > 0) {
      sections.push(rawImages.map((url, idx) => `![${title}-${idx + 1}](${url})`).join("\n\n"));
    }
    return sections.join("\n\n").trim();
  };

  const buildCanvasSyncFiles = (nodes: CustomNode[]): Record<string, string> => {
    if (!Array.isArray(nodes) || nodes.length === 0) return {};
    const result: Record<string, string> = {};
    const fileNameCountByDirectory = new Map<string, Map<string, number>>();
    const getUniqueName = (name: string, bucket: Map<string, number>) => {
      const count = bucket.get(name) ?? 0;
      bucket.set(name, count + 1);
      return count === 0 ? name : `${name}${count + 1}`;
    };
    const ensureDirectory = (directoryName: string) => {
      result[`${directoryName}/`] = "";
      if (!fileNameCountByDirectory.has(directoryName)) {
        fileNameCountByDirectory.set(directoryName, new Map<string, number>());
      }
      return fileNameCountByDirectory.get(directoryName)!;
    };

    const topLevelNodes = nodes
      .filter((node) => !node.parentId)
      .sort(sortCanvasNodes);

    topLevelNodes.forEach((node, index) => {
      if (node.type === "roleGroup") {
        const directoryName = getCanvasDirectoryName(node.data?.label);
        const childNameCount = ensureDirectory(directoryName);
        nodes
          .filter((child) => child.parentId === node.id)
          .sort(sortCanvasNodes)
          .forEach((child, childIndex) => {
            const fileBase = getUniqueName(getCanvasNodeBaseName(child, childIndex), childNameCount);
            result[`${directoryName}/${fileBase}.md`] = buildCanvasNodeMarkdown(child);
          });
        return;
      }

      const directoryName = getCanvasDirectoryName(node.data?.label ?? node.type);
      const fileNameCount = ensureDirectory(directoryName);
      const fileBase = getUniqueName(getCanvasNodeBaseName(node, index), fileNameCount);
      result[`${directoryName}/${fileBase}.md`] = buildCanvasNodeMarkdown(node);
    });

    return result;
  };

  const CARD_LAYOUT_GAP_X = 28;
  const CARD_LAYOUT_GAP_Y = 36;
  const INFO_COLUMN_GAP_X = 72;

  const getCanvasNodeLayoutSize = (node: CustomNode) => {
    const measuredWidth = Number((node as any)?.measured?.width ?? (node as any)?.dimensions?.width ?? 0);
    const measuredHeight = Number((node as any)?.measured?.height ?? (node as any)?.dimensions?.height ?? 0);
    const styledWidth = Number((node as any)?.style?.width ?? 0);
    const styledHeight = Number((node as any)?.style?.height ?? 0);

    if (measuredWidth > 0 && measuredHeight > 0) {
      return { width: measuredWidth, height: measuredHeight };
    }
    if (styledWidth > 0 && styledHeight > 0) {
      return { width: styledWidth, height: styledHeight };
    }

    const label = String(node.data?.label ?? "").trim();
    if (node.type === "settingCard" && label === "角色") return { width: 300, height: 450 };
    if (node.type === "outlineCard") return { width: 260, height: 260 };
    if (node.type === "settingCard") return { width: 260, height: 220 };
    if (node.type === "roleGroup") return { width: 340, height: 526 };
    return { width: 260, height: 220 };
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

  const createDirectedCanvasEdge = (source: string, target: string): CustomEdge => ({
    id: `e${source}-${target}-${Date.now()}`,
    source,
    target,
    type: "bezier",
    animated: false,
  });

  const withVerticalPorts = (node: CustomNode): CustomNode => {
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
    canvasRef,
  }: InsCanvasInnerProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>(initialEdges);
    // autoLayout 会被 setTimeout 调用；用 ref 避免闭包拿到旧 nodes/edges 导致把新数据覆盖回去
    const nodesRef = useRef<CustomNode[]>(initialNodes);
    const edgesRef = useRef<CustomEdge[]>(initialEdges);
    const hasIdeaRef = useRef(false);
    const layoutRequestIdRef = useRef(0);
    const [inspirationDrawId, setInspirationDrawId] = useState(initialInspirationDrawId);
    const [ideaContent, setIdeaContent] = useState("");
    const [ideaPlaceholderIndex, setIdeaPlaceholderIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [generateMode, setGenerateMode] = useState<"smart" | "brainstorm" | "fast">("smart");
    const [canvasModeCategory, setCanvasModeCategory] = useState<CanvasModeCategory>("smart");
    const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);
    const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("mode");
    const [canvasOutputType, setCanvasOutputType] = useState<CanvasOutputType>("auto");
    const [canvasModelType, setCanvasModelType] = useState<CanvasModelType>("max");
    const [reqPanelVisible, setReqPanelVisible] = useState(false);
    const [reqPanelExpanded, setReqPanelExpanded] = useState(false);
    const [cardKeyLabel, setCardKeyLabel] = useState<string>("脑洞");
    const [reqPanelTitle, setReqPanelTitle] = useState("");
    const [reqPanelStatus, setReqPanelStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [reqPanelDetail, setReqPanelDetail] = useState<string>("");
    const [reqPanelBodyDetail, setReqPanelBodyDetail] = useState<string>("");
    const [reqPanelFooterDetail, setReqPanelFooterDetail] = useState<string>("");
    const [reqPanelAction, setReqPanelAction] = useState<ReqPanelAction | null>(null);
    const [smartSuggestionsActive, setSmartSuggestionsActive] = useState(false);
    const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestionItem[]>([]);
    const [pendingSuggestionIdea, setPendingSuggestionIdea] = useState("");
    const [dialogCardPreview, setDialogCardPreview] = useState<{
      title: string;
      content: string;
    } | null>(null);
    const [inputDockResetKey, setInputDockResetKey] = useState(0);
    // 允许在“尚无节点”时也进入画布视图（例如 smart 空输入的推荐列表）
    const [forceCanvasView, setForceCanvasView] = useState(false);
    const [initWorkDialogShow, setInitWorkDialogShow] = useState(false);
    const [historyDialogShow, setHistoryDialogShow] = useState(false);
    const [moreActionsOpen, setMoreActionsOpen] = useState(false);
    const [currentChain, setCurrentChain] = useState<ParentNode | null>(null);
    // 是否在画布中
    const [canvasReady, setCanvasReady] = useState(false);
    // “随机选题创建”的 3 张脑洞卡占位（用于接口返回后回填）
    const brainstormBatchIdsRef = useRef<string[]>([]);
    // 脑洞生成进度（0~100），用于卡片 loading UI
    const brainstormProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const brainstormProgressValueRef = useRef(0);
    const handleGenerateInsRef = useRef<
      | ((
          requestType: "auto" | "manual",
          ideaOverride?: string,
          outputTypeOverride?: CanvasOutputType,
          sourceNodeId?: string
        ) => void | Promise<void>)
      | null
    >(null);

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
          ? "脑洞"
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

    useEffect(() => {
      return () => {
        stopBrainstormProgress();
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
    const getOrCreateCanvasSessionId = useCanvasStore((s) => s.getOrCreateCanvasSessionId);
    const createNewCanvasSessionId = useCanvasStore((s) => s.createNewCanvasSessionId);
    const clearCanvasSessionId = useCanvasStore((s) => s.clearCanvasSessionId);
  
    // 暂不依赖 mainCard：只要画布里有节点，就允许交互
    const hasIdea = useMemo(() => {
      return Boolean(tree && tree.length > 0);
    }, [tree]);

  
    const { zoomIn, zoomOut, setCenter, getViewport } = useReactFlow();
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
      hasIdeaRef.current = hasIdea;
    }, [hasIdea]);

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
      (nodeId: string, content: string) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  // 受控 nodes 模式下，必须在父层把 isStreaming 写回 false，
                  // 否则子组件里 updateNodeData 的变更会被下一次 render 覆盖，导致 props.data.isStreaming 仍为 true
                  data: { ...n.data, content, isStreaming: false },
                }
              : n
          )
        );
      },
      [setNodes]
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
        setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
        setEdges((eds) =>
          (eds as CustomEdge[]).filter(
            (e) => !toDelete.has(e.source) && !toDelete.has(e.target)
          )
        );
        if (!options?.skipLayout) {
          setTimeout(autoLayout, 50);
        }
      },
      [collectChildren, setNodes, setEdges, autoLayout]
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
            type: "bezier",
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
      },
      [nodes, edges, hasIdea, inspirationDrawId, applyGraphAndSubtreeLayout, getTopAncestorId]
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
        return newNodeId;
      },
      [nodes, edges, hasIdea, inspirationDrawId, setEdges, setNodes]
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
            type: "bezier",
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
      [workId, nodes, edges, hasIdea, inspirationDrawId, setNodes, applyGraphAndSubtreeLayout]
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
        const newEdge = createDirectedCanvasEdge(sourceNodeId, nid);
        setNodes((prev) => [...prev, newNode]);
        setEdges((prev) => [...prev, newEdge]);
        setCanvasReady(true);
        return nid;
      },
      [nodes, edges, hasIdea, inspirationDrawId, setEdges, setNodes]
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
        if (!summaryNode) {
          msg("warning", "请先生成故事梗概");
          return;
        }

        const settingsContent = getTextValue(source.data?.content);
        const chapterNumMatch =
          settingsContent.match(/(?:章节(?:数|数量)?|章数|总章数)\s*[:：]?\s*(\d{1,3})/) ??
          settingsContent.match(/(\d{1,3})\s*章/);
        const chapterNumRaw = Number(chapterNumMatch?.[1] ?? (source.data as any)?.chapterNum ?? 10);
        const chapterNum = Number.isFinite(chapterNumRaw)
          ? Math.min(200, Math.max(1, Math.round(chapterNumRaw)))
          : 10;

        setReqPanelVisible(true);
        setCardKeyLabel("大纲");
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
                title: getTextValue((summaryNode.data as any)?.title) || "故事梗概",
                intro: getTextValue(summaryNode.data?.content),
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
            () => {}
          );

          const content =
            outlineJson?.outline_dict && outlineJson.outline_dict.length
              ? formatOutlineMarkdown(outlineJson.outline_dict)
              : outlineMarkdown;
          addOutlineCard(sourceNodeId, {
            label: "故事大纲",
            title: "故事大纲",
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
        return nid;
      },
      [nodes, edges, hasIdea, inspirationDrawId, setEdges, setNodes]
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

    const getNearestSummaryNode = useCallback(
      (targetId: string) => {
        const contextNodes = getIncomingContextNodes(targetId);
        const currentNode = contextNodes.find((node) => node.id === targetId);
        if (currentNode && String(currentNode.data?.label ?? "").includes("梗概")) {
          return currentNode;
        }
        return contextNodes
          .reverse()
          .find((node) => node.id !== targetId && String(node.data?.label ?? "").includes("梗概"));
      },
      [getIncomingContextNodes]
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
        const groupNode = nodes.find((node) => node.id === groupId);
        if (!groupNode) return;
        const width = Number((groupNode as any)?.style?.width ?? 360);
        const height = Number((groupNode as any)?.style?.height ?? 520);
        const centerX = (groupNode.position?.x ?? 0) + width / 2;
        const centerY = (groupNode.position?.y ?? 0) + height / 2;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === groupId
              ? { ...node, data: { ...node.data, highlighted: true } as any }
              : node
          )
        );
        window.setTimeout(() => {
          setNodes((prev) =>
            prev.map((node) =>
              node.id === groupId
                ? { ...node, data: { ...node.data, highlighted: false } as any }
                : node
            )
          );
        }, 1800);
        void setCenter(centerX, centerY, { zoom: 0.9, duration: 500 } as any);
      },
      [nodes, setCenter, setNodes]
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
          skipAutoStream?: boolean;
        }>
      ) => {
        const latestNodes = nodesRef.current;
        const latestEdges = edgesRef.current as CustomEdge[];
        const source = latestNodes.find((node) => node.id === sourceNodeId);
        if (!source || !roleCards.length) return { groupId: "", roleNodeIds: [] as string[] };

        const groupId = source.parentId || `role-group-${sourceNodeId}`;
        const roleCardWidth = 300;
        const roleCardHeight = 450;
        const gapX = 20;
        const gapY = 24;
        const cols = 3;
        const groupPaddingTop = 56;
        const groupPadding = 20;
        const minGroupWidth = 340;
        const existingGroup = latestNodes.find((node) => node.id === groupId);
        const groupSourceId =
          source.parentId
            ? (latestEdges.find((edge) => edge.target === groupId)?.source ?? sourceNodeId)
            : sourceNodeId;
        const groupPosition = existingGroup
          ? existingGroup.position
          : getLinkedCardPosition(groupSourceId, latestNodes, latestEdges, "attribute");
        const groupX = groupPosition.x;
        const groupY = groupPosition.y;
        const roleNodeIds = roleCards.map((_, index) => `role-${Date.now()}-${index}`);

        setNodes((prev) => {
          const currentSource = prev.find((node) => node.id === sourceNodeId);
          if (!currentSource) return prev;
          const existingRoles = prev.filter((node) => (node.data as any)?.roleGroupId === groupId);
          const startIndex = existingRoles.length;
          const roleNodes = roleCards.map((item, index) => {
            const idx = startIndex + index;
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            return {
              id: roleNodeIds[index],
              type: "settingCard",
              parentId: groupId,
              extent: "parent" as any,
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
                expandable: true,
                allowTitleEdit: true,
                allowImageUpload: true,
                inspirationWord: currentSource.data?.inspirationWord,
                inspirationTheme: currentSource.data?.inspirationTheme,
                shortSummary: currentSource.data?.shortSummary,
                storySetting: currentSource.data?.storySetting,
                inspirationDrawId: currentSource.data?.inspirationDrawId ?? inspirationDrawId,
                skipAutoStream: item.skipAutoStream ?? false,
              } as any,
            } as CustomNode;
          });
          const totalCount = existingRoles.length + roleNodes.length;
          const rows = Math.max(1, Math.ceil(totalCount / cols));
          const colsUsed = Math.min(cols, totalCount);
          const nextGroupWidth = Math.max(
            minGroupWidth,
            groupPadding * 2 + colsUsed * roleCardWidth + Math.max(0, colsUsed - 1) * gapX
          );
          const nextGroupHeight =
            groupPaddingTop + rows * roleCardHeight + Math.max(0, rows - 1) * gapY + groupPadding;
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
          next.push(...roleNodes);
          nodesRef.current = next;
          return next;
        });

        setEdges((prev) => {
          const next = [...prev];
          const groupEdgeId = `e${groupSourceId}-${groupId}`;
          if (!next.some((edge) => edge.id === groupEdgeId)) {
            next.push({
              id: groupEdgeId,
              source: groupSourceId,
              target: groupId,
              type: "bezier",
              animated: true,
            });
          }
          edgesRef.current = next;
          return next;
        });
        setCanvasReady(true);

        return { groupId, roleNodeIds };
      },
      [hasIdea, inspirationDrawId, setNodes, setEdges]
    );

    const appendOutlineSettingsToGroup = useCallback(
      (sourceNodeId: string) => {
        if (!nodes.find((node) => node.id === sourceNodeId)) return { groupId: "" };

        const groupId = `outline-group-${sourceNodeId}`;
        const groupWidth = 340;
        const groupHeight = 180;
        const existingGroup = nodes.find((node) => node.id === groupId);
        const groupPosition = existingGroup
          ? existingGroup.position
          : getLinkedCardPosition(sourceNodeId, nodes, edges as CustomEdge[], "attribute");

        const outlineGroupNode: CustomNode | null = existingGroup
          ? null
          : ({
              id: groupId,
              type: "roleGroup",
              position: groupPosition,
              draggable: hasIdea,
              dragHandle: ".role-group-drag-handle",
              selectable: true,
              data: { label: "大纲", outlineSourceId: sourceNodeId, openOutlinePopover: true } as any,
              style: { width: groupWidth, height: groupHeight, zIndex: 0 } as any,
            } as any);

        setNodes((prev) => {
          const next = [...prev];
          if (!existingGroup && outlineGroupNode) {
            next.push(outlineGroupNode);
          } else {
            const idx = next.findIndex((node) => node.id === groupId);
            if (idx >= 0) {
              next[idx] = {
                ...next[idx],
                data: {
                  ...next[idx].data,
                  outlineSourceId: sourceNodeId,
                  openOutlinePopover: true,
                } as any,
              };
            }
          }
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
              type: "bezier",
              animated: true,
            });
          }
          return next;
        });
        setCanvasReady(true);
        return { groupId };
      },
      [nodes, edges, hasIdea, setEdges, setNodes]
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

        const groupId = `outline-group-${sourceNodeId}`;
        const cardWidth = 300;
        const cardHeight = 260;
        const gapX = 20;
        const gapY = 24;
        const cols = 3;
        const groupPaddingTop = 56;
        const groupPadding = 20;
        const minGroupWidth = 340;
        const existingGroup = latestNodes.find((node) => node.id === groupId);
        const groupPosition = existingGroup
          ? existingGroup.position
          : getLinkedCardPosition(sourceNodeId, latestNodes, latestEdges, "attribute");
        const outlineNodeIds = outlineCards.map((_, index) => `outline-group-card-${Date.now()}-${index}`);

        setNodes((prev) => {
          const currentSource = prev.find((node) => node.id === sourceNodeId);
          if (!currentSource) return prev;
          const existingOutlineNodes = prev.filter((node) => (node.data as any)?.outlineGroupId === groupId);
          const startIndex = existingOutlineNodes.length;
          const outlineNodes = outlineCards.map((item, index) => {
            const idx = startIndex + index;
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            return {
              id: outlineNodeIds[index],
              type: "outlineCard",
              parentId: groupId,
              extent: "parent" as any,
              position: {
                x: groupPadding + col * (cardWidth + gapX),
                y: groupPaddingTop + row * (cardHeight + gapY),
              },
              draggable: hasIdea,
              data: {
                label: "故事大纲",
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
          const nextGroupHeight =
            groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding;
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
              type: "bezier",
              animated: true,
            });
          }
          edgesRef.current = next;
          return next;
        });
        setCanvasReady(true);
        return { groupId, outlineNodeIds };
      },
      [hasIdea, inspirationDrawId, setEdges, setNodes]
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

        const idToCreate = `${typeToCreate}-${Date.now()}`;

        setCanvasReady(true);
        setNodes((prev) => {
          const { x, y } = getStandaloneNextRowPosition(prev);
          const isBlankBrainstormDraft =
            key === "brainstorm" && !options?.title && !options?.content && !options?.image;
          const newNode: CustomNode = {
            id: idToCreate,
            type: typeToCreate,
            position: { x, y },
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
              isBlankBrainstormDraft,
              brainstormAiMode: false,
              pendingGenerate: false,
              highlighted: false,
              skipAutoStream: options?.skipAutoStream ?? false,
            } as any,
          };
          return [...prev, newNode];
        });
        return idToCreate;
      },
      [inspirationDrawId, setNodes]
    );

    const handlePrepareBrainstormCard = useCallback(
      (nodeId: string) => {
        const currentNode = nodes.find((node) => node.id === nodeId);
        const containerEl = containerRef.current;
        if (!currentNode || !containerEl) return;

        const viewport = getViewport();
        const containerRect = containerEl.getBoundingClientRect();
        const dockRect = dockRef.current?.getBoundingClientRect();
        const cardWidth = 300;
        const cardHeight = 450;
        const gapToDock = 24;
        const dockTop = dockRect?.top ?? (containerRect.top + containerRect.height - 180);
        const targetScreenTop = Math.max(containerRect.top + 24, dockTop - cardHeight - gapToDock);
        const targetScreenLeft = containerRect.left + (containerRect.width - cardWidth) / 2;
        const targetX = (targetScreenLeft - containerRect.left - viewport.x) / viewport.zoom;
        const targetY = (targetScreenTop - containerRect.top - viewport.y) / viewport.zoom;
        const title = getTextValue((currentNode.data as any)?.title) || "中元节";
        const brainstormPrompt = `帮我生成${title}脑洞`;

        setNodes((prev) =>
          prev.map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  position: { x: targetX, y: targetY },
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

        setIdeaContent(brainstormPrompt);
        setForceCanvasView(true);
        setCanvasReady(true);
        void setCenter(targetX + cardWidth / 2, targetY + cardHeight / 2, {
          zoom: 0.9,
          duration: 500,
        } as any);
        void handleGenerateInsRef.current?.("manual", brainstormPrompt, "brainstorm", nodeId);
      },
      [getViewport, nodes, setCenter, setNodes]
    );

    const createLoadingCardByKey = useCallback((key: CanvasCardKey) => {
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
      const idToCreate = `${typeToCreate}-loading-${Date.now()}`;

      setCanvasReady(true);
      setNodes((prev) => {
        const { x, y } = getStandaloneNextRowPosition(prev);
        const newNode: CustomNode = {
          id: idToCreate,
          type: typeToCreate,
          position: { x, y },
          draggable: true,
          data: {
            label: labelToCreate,
            title: "",
            content: "",
            image: "",
            fromApi: true,
            isStreaming: false,
            progress: 0,
            inspirationDrawId: inspirationDrawId || undefined,
            allowTitleEdit: true,
            allowImageUpload: true,
            autoEdit: false,
          } as any,
        };
        return [...prev, newNode];
      });
      return idToCreate;
    }, [inspirationDrawId, setNodes]);

    const startBrainstormPlaceholderBatch = useCallback((
      files: CanvasWriteFileCall[],
      mode: "replace" | "append" = "replace"
    ) => {
      const markdownFiles = files.filter((item) => item.filePath.endsWith(".md")).slice(0, 3);
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
      const secondCardX = centerX - cardWidth / 2;
      const firstCardX = secondCardX - (cardWidth + cardSpacing);
      const thirdCardX = secondCardX + (cardWidth + cardSpacing);
      const positions = [firstCardX, secondCardX, thirdCardX];
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
              ? { x: positions[globalIndex] ?? positions[positions.length - 1], y: startY }
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
      const markdownFiles = files.filter((item) => item.filePath.endsWith(".md")).slice(0, 3);
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
              title: extractMarkdownTitle(item.content, `${fallbackTitle}${idx + 1}`),
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
      setNodes((prev) =>
        prev.map((node) =>
          node.id !== nodeId
            ? node
            : {
                ...node,
                type: nextType,
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
                  isBlankBrainstormDraft: options?.isBlankBrainstormDraft ?? false,
                  brainstormAiMode: options?.brainstormAiMode ?? false,
                  pendingGenerate: options?.pendingGenerate ?? false,
                  highlighted: options?.highlighted ?? false,
                  skipAutoStream: options?.skipAutoStream ?? false,
                } as any,
              }
        )
      );
    }, [inspirationDrawId, setNodes]);

    const removeLoadingCard = useCallback((nodeId: string) => {
      const currentNode = nodes.find((node) => node.id === nodeId);
      const parentId = currentNode?.parentId;
      const shouldRemoveParent =
        parentId &&
        nodes.filter((node) => node.parentId === parentId).length <= 1;

      setNodes((prev) =>
        prev.filter((node) => node.id !== nodeId && (!shouldRemoveParent || node.id !== parentId))
      );
      if (shouldRemoveParent && parentId) {
        setEdges((prev) =>
          prev.filter((edge) => edge.source !== parentId && edge.target !== parentId)
        );
      }
    }, [nodes, setEdges, setNodes]);

    const createCardFromOutputType = useCallback(
      (
        outputType: CanvasOutputType,
        rawIdea: string,
        options?: {
          title?: string;
          content?: string;
          image?: string;
        }
      ) => {
        const trimmedIdea = rawIdea?.trim?.() ? rawIdea.trim() : "";
        const outputTypeToCardKeyMap: Record<Exclude<CanvasOutputType, "auto">, CanvasCardKey> = {
          brainstorm: "brainstorm",
          role: "role",
          summary: "summary",
          outline: "outline",
          info: "info",
        };
        const targetCardKey = outputTypeToCardKeyMap[outputType === "auto" ? "brainstorm" : outputType];

        stopBrainstormProgress();
        brainstormBatchIdsRef.current = [];
        setForceCanvasView(true);
        setCanvasReady(true);
        setReqPanelVisible(false);
        setReqPanelExpanded(false);
        setSmartSuggestionsActive(false);
        setSmartSuggestions([]);
        createCardByKey(targetCardKey, {
          title: options?.title ?? trimmedIdea,
          content: options?.content,
          image: options?.image,
        });
      },
      [createCardByKey, setCanvasReady, setForceCanvasView, stopBrainstormProgress]
    );

    const handleRoleExpandRandom = useCallback(
      async (nodeId: string) => {
        const request = buildRoleRequestPayload(nodeId);
        setReqPanelVisible(true);
        setCardKeyLabel("角色");
        setReqPanelStatus("loading");
        setReqPanelDetail("正在随机生成更多人物，请稍等...");
        setReqPanelAction(null);

        const { groupId, roleNodeIds } = appendRoleCardsToGroup(
          nodeId,
          new Array(3).fill(null).map(() => ({ fromApi: true }))
        );
        try {
          const { getScriptCharacterSettings } = await import("@/api/generate-quick");
          const res: any = await getScriptCharacterSettings("", request.description, request.brainStorm);
          const roleCards = Array.isArray(res?.roleCards) ? res.roleCards.slice(0, 3) : [];
          if (!roleCards.length) {
            setNodes((prev) => prev.filter((node) => !roleNodeIds.includes(node.id)));
            setReqPanelStatus("error");
            setReqPanelDetail("状态：失败\n原因：未生成到新的角色，请重试");
            return;
          }

          setNodes((prev) =>
            prev
              .filter((node) => roleCards.length >= roleNodeIds.length || !roleNodeIds.slice(roleCards.length).includes(node.id))
              .map((node) => {
                const idx = roleNodeIds.indexOf(node.id);
                if (idx < 0 || !roleCards[idx]) return node;
                const item = roleCards[idx] as Record<string, unknown>;
                return {
                  ...node,
                  data: {
                    ...node.data,
                    title: getFirstTextValue(item.name, item.title, `角色${idx + 1}`),
                    content: formatRecordMarkdown(item, ["name", "title"]),
                    fromApi: true,
                    isStreaming: false,
                  },
                };
              })
          );
          setReqPanelStatus("success");
          setReqPanelDetail("角色喵搞定了！已经为你扩充了新的随机角色。");
          if (groupId) {
          const hasSummaryContext = Boolean(getNearestSummaryNode(nodeId));
          const nextOutputType: Exclude<CanvasOutputType, "auto"> = hasSummaryContext ? "outline" : "summary";
            setReqPanelAction({
            label: nextOutputType === "outline" ? "以此生成大纲" : "以此生成故事梗概",
              onClick: () => focusRoleGroup(groupId),
            generate: {
              nodeId,
              outputType: nextOutputType,
            },
            });
          }
        } catch (error: any) {
          setNodes((prev) => prev.filter((node) => !roleNodeIds.includes(node.id)));
          setReqPanelStatus("error");
          setReqPanelDetail(`状态：失败\n原因：${String(error?.message ?? "未知错误")}`);
          msg("error", String(error?.message ?? "角色生成失败"));
        }
      },
      [appendRoleCardsToGroup, buildRoleRequestPayload, focusRoleGroup, getNearestSummaryNode, msg, setNodes]
    );

    const handleGenerateSummaryFromContext = useCallback(
      async (nodeId: string) => {
        const request = buildRoleRequestPayload(nodeId);
        const currentNode = nodes.find((node) => node.id === nodeId);
        setReqPanelVisible(true);
        setCardKeyLabel("梗概");
        setReqPanelStatus("loading");
        setReqPanelDetail("正在根据当前角色与链路信息生成故事梗概，请稍等...");
        setReqPanelAction(null);
        try {
          addSummaryCard(nodeId, {
            label: "故事梗概",
            title: getFirstTextValue(
              request.brainStorm?.title,
              (currentNode?.data as any)?.title,
              "故事梗概"
            ),
            content: "",
            allowTitleEdit: true,
            allowImageUpload: true,
            isStreaming: true,
            fromApi: true,
            inspirationWord: getFirstTextValue(currentNode?.data?.inspirationWord),
            inspirationTheme: getFirstTextValue(
              (currentNode?.data as any)?.title,
              currentNode?.data?.inspirationTheme
            ),
            shortSummary: undefined,
            storySetting: request.description,
          });
          setReqPanelStatus("success");
          setReqPanelDetail("梗概喵已经开始流式生成故事梗概，请在画布中查看。");
        } catch (error: any) {
          setReqPanelStatus("error");
          setReqPanelDetail(`状态：失败\n原因：${String(error?.message ?? "未知错误")}`);
          msg("error", String(error?.message ?? "故事梗概生成失败"));
        }
      },
      [addSummaryCard, buildRoleRequestPayload, msg, nodes]
    );

    const handleGenerateOutlineFromContext = useCallback(
      async (
        nodeId: string,
        options?: {
          chapterNum?: number;
          requirement?: string;
        }
      ) => {
        if (!options) {
          const result = appendOutlineSettingsToGroup(nodeId);
          if (!result.groupId) {
            msg("warning", "无法创建大纲组");
          }
          return;
        }
        const request = buildRoleRequestPayload(nodeId);
        const summaryNode = getNearestSummaryNode(nodeId);
        if (!summaryNode) {
          msg("warning", "请先生成故事梗概");
          return;
        }
        const chapterNumRaw = Number(options?.chapterNum ?? 10);
        const chapterNum = Number.isFinite(chapterNumRaw)
          ? Math.min(200, Math.max(1, Math.round(chapterNumRaw)))
          : 10;
        const requirement = String(options?.requirement ?? "").trim();
        const currentNode = nodes.find((node) => node.id === nodeId);
        const contextIdea = [
          `故事梗概标题：${getTextValue((summaryNode.data as any)?.title) || "故事梗概"}`,
          `当前节点标题：${getTextValue((currentNode?.data as any)?.title) || request.roleCard?.name || "当前节点"}`,
          `章节数：${chapterNum}`,
          requirement,
        ]
          .filter(Boolean)
          .join("\n");
        void handleGenerateInsRef.current?.("manual", contextIdea, "outline", nodeId);
      },
      [appendOutlineSettingsToGroup, buildRoleRequestPayload, getNearestSummaryNode, msg, nodes]
    );

    const handleGenerateInfoFromContext = useCallback(
      async (nodeId: string) => {
        const request = buildRoleRequestPayload(nodeId);
        setReqPanelVisible(true);
        setCardKeyLabel("信息");
        setReqPanelStatus("loading");
        setReqPanelDetail("正在根据当前角色与链路信息整理信息卡，请稍等...");
        setReqPanelAction(null);
        try {
          const { getScriptStorySynopsisReq } = await import("@/api/generate-quick");
          const res: any = await getScriptStorySynopsisReq("", request.description);
          addSettingCard(nodeId, {
            label: "信息",
            title: getFirstTextValue(res?.title, "信息"),
            content: formatInfoCardMarkdown(res ?? {}),
            allowTitleEdit: true,
            allowImageUpload: true,
            isStreaming: false,
            fromApi: true,
          });
          setReqPanelStatus("success");
          setReqPanelDetail("信息喵搞定了！已经根据当前链路整理信息卡。");
        } catch (error: any) {
          setReqPanelStatus("error");
          setReqPanelDetail(`状态：失败\n原因：${String(error?.message ?? "未知错误")}`);
          msg("error", String(error?.message ?? "信息卡生成失败"));
        }
      },
      [addSettingCard, buildRoleRequestPayload, msg]
    );

    const handleAutoGenerateByResponse = useCallback(
      async (rawIdea: string) => {
        const trimmedIdea = rawIdea?.trim?.() ? rawIdea.trim() : "";
        const { generateInspirationReqNew, generateInspirationImageReq } = await import("@/api/works");
        const req: any = await generateInspirationReqNew(trimmedIdea || undefined);
        const resolved = resolveAutoResultFromResponse(req, trimmedIdea);

        if (!resolved) {
          setReqPanelStatus("error");
          setReqPanelDetail("状态：失败\n原因：暂时无法识别接口返回的卡片类型，请重试");
          msg("warning", "暂时无法识别接口返回的卡片类型，请重试");
          return;
        }

        if (resolved.kind === "brainstorm") {
          const w = containerRef.current?.clientWidth || window.innerWidth || 1920;
          const cards = createCardsFromInspiration(
            resolved.inspirations.slice(0, 3),
            resolved.inspirationWord,
            inspirationDrawId || undefined,
            w
          );
          setForceCanvasView(true);
          setCanvasReady(true);
          setEdges([]);
          setNodes(cards);

          const imageReq: any[] = await generateInspirationImageReq({
            inspirationWord: resolved.inspirationWord ?? "",
            inspirations: resolved.inspirations,
          }).catch(() => []);

          if (Array.isArray(imageReq)) {
            setNodes((nds) =>
              nds.map((n) => {
                const theme = String((n.data as any)?.inspirationTheme ?? "");
                if (n.type !== "summaryCard" || !theme) return n;
                const match = imageReq.find((item: any) => item?.inspirationTheme === theme);
                if (!match?.imageUrl) return n;
                return { ...n, data: { ...n.data, image: match.imageUrl } };
              })
            );
          }

          setReqPanelStatus("success");
          setReqPanelDetail("已根据接口返回自动匹配为脑洞卡。");
          msg("success", "已自动生成脑洞卡");
          return;
        }

        createCardFromOutputType("auto", trimmedIdea, {
          title: resolved.title,
          content: resolved.content,
        });
        setReqPanelStatus("success");
        setReqPanelDetail(`已根据接口返回自动匹配为${resolved.cardKey === "role" ? "角色" : resolved.cardKey === "summary" ? "梗概" : resolved.cardKey === "outline" ? "大纲" : "信息"}卡。`);
        msg("success", "已根据接口返回创建对应卡片");
      },
      [createCardFromOutputType, inspirationDrawId, msg, setEdges, setNodes]
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
      sourceNodeId?: string
    ) => {
      
      if (isLoading) return;
      const ideaSource = typeof ideaOverride === "string" ? ideaOverride : ideaContent;
      const trimmedIdea = ideaSource?.trim?.() ? ideaSource.trim() : "";
      const effectiveOutputType = outputTypeOverride ?? canvasOutputType;
      const cardOutputType: Exclude<CanvasOutputType, "auto"> =
        effectiveOutputType === "auto" ? "brainstorm" : effectiveOutputType;
      const isAutoRequest = requestType === "auto";
      const isAutoEmptyRequest = isAutoRequest && !trimmedIdea;
      const sourceNode = sourceNodeId
        ? nodes.find((node) => node.id === sourceNodeId)
        : undefined;
      const sourceNodeFilePath = getTextValue((sourceNode?.data as any)?.filePath);
      const sourceNodeFileContent = getTextValue(sourceNode?.data?.content);
      const manualRequestFiles =
        !isAutoRequest && sourceNodeFilePath
          ? { [sourceNodeFilePath]: sourceNodeFileContent }
          : undefined;
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
      try {
        setReqPanelVisible(true);
        setSmartSuggestionsActive(false);
        setSmartSuggestions([]);
        setReqPanelBodyDetail("");
        setReqPanelFooterDetail("");
        setReqPanelAction(null);

        setForceCanvasView(true);
        setCanvasReady(true);

        if (isAutoRequest) {
          setIsLoading(true);
          setCardKeyLabel(isAutoEmptyRequest ? "智能" : outputTypeLabel);
          setReqPanelTitle(isAutoEmptyRequest ? "随机选题" : `${outputTypeLabel}卡`);
          setReqPanelStatus("loading");
          setReqPanelDetail(
            isAutoEmptyRequest
              ? "为你生成一些随机选题，点击可直接填入输入框。"
              : `正在生成${outputTypeLabel}卡，请稍等...`
          );
          const { postCanvasChoicesStream } = await import("@/api/works");
          let streamError: any = null;
          let hasChoiceList = false;
          let hasUpdatesContent = false;
          let hasWriteFileSuggestions = false;

          await postCanvasChoicesStream(
            {
              prompt: isAutoEmptyRequest
                ? "随机生成一个脑洞"
                : `生成一个关于${trimmedIdea}${outputTypeLabel}卡`,
              model: isAutoEmptyRequest ? "fast" : "kimi_k2",
              type: requestType,
            },
            (streamData: any) => {
              if (streamData?.event !== "updates") return;
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
              if (!updatesContent) return;

              hasUpdatesContent = true;
              const { head, middle, tail } = splitAutoUpdatesContent(updatesContent);

              setReqPanelTitle(isAutoEmptyRequest ? "随机选题" : `${outputTypeLabel}卡`);
              setReqPanelDetail(head || updatesContent);
              setReqPanelFooterDetail(tail);
              setReqPanelBodyDetail(middle.join("\n\n"));

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
            () => {}
          );

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
            setReqPanelDetail("状态：失败\n原因：返回数据格式不正确，请重试");
            msg("warning", "返回数据格式不正确，请重试");
          }
          setIsLoading(false);
          return;
        } else {
          setIsLoading(true);
          setCardKeyLabel(outputTypeLabel);
          setReqPanelTitle(`${outputTypeLabel}卡`);
          setReqPanelStatus("loading");
          setReqPanelDetail(`正在生成${outputTypeLabel}卡，请稍等...`);
          const { postCanvasChoicesStream } = await import("@/api/works");
          let streamError: any = null;
          let hasChoiceList = false;
          const collectedWriteFilesByPath = new Map<string, CanvasWriteFileCall>();
          const partialWriteFilesByCallId = new Map<string, string>();
          const partialNodeIdsByCallId = new Map<string, string>();
          const partialFilePathByCallId = new Map<string, string>();
          const streamedNodeIdsByFilePath = new Map<string, string>();
          const finalizedWriteFilePaths = new Set<string>();
          const standaloneGroupIdsByKey = new Map<"role" | "outline", string>();
          const requestedCardKey =
            ({
              brainstorm: "brainstorm",
              role: "role",
              summary: "summary",
              outline: "outline",
              info: "info",
            }[cardOutputType] as CanvasCardKey);
          const useBrainstormBatchLoading = false;
          const useContextLinkedCreation = Boolean(sourceNodeId);
          // manual 请求一开始就创建占位；角色/大纲优先创建分组占位。
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
            let createdNodeId = "";
            const cardWidth = 300;
            const cardHeight = key === "role" ? 450 : 260;
            const gapX = 20;
            const gapY = 24;
            const cols = 3;
            const groupPaddingTop = 56;
            const groupPadding = 20;
            const minGroupWidth = 340;
            const groupLabel = key === "role" ? "角色" : "大纲";

            setCanvasReady(true);
            setNodes((prev) => {
              const next = [...prev];
              let groupId = standaloneGroupIdsByKey.get(key) || "";
              let groupNode = groupId ? next.find((node) => node.id === groupId) : null;

              if (!groupNode) {
                groupId = `${key}-group-loading-${Date.now()}`;
                standaloneGroupIdsByKey.set(key, groupId);
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
                    height: groupPaddingTop + cardHeight + groupPadding,
                    zIndex: 0,
                  } as any,
                } as any;
                next.push(groupNode as CustomNode);
              }

              const existingChildren = next.filter((node) =>
                key === "role"
                  ? (node.data as any)?.roleGroupId === groupId
                  : (node.data as any)?.outlineGroupId === groupId
              );
              const idx = existingChildren.length;
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              createdNodeId = `${key}-group-card-loading-${Date.now()}-${idx}`;

              next.push({
                id: createdNodeId,
                type: key === "role" ? "settingCard" : "outlineCard",
                parentId: groupId,
                extent: "parent" as any,
                position: {
                  x: groupPadding + col * (cardWidth + gapX),
                  y: groupPaddingTop + row * (cardHeight + gapY),
                },
                draggable: hasIdea,
                data: {
                  label: key === "role" ? "角色" : "故事大纲",
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
                groupPaddingTop + rows * cardHeight + Math.max(0, rows - 1) * gapY + groupPadding;
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

              nodesRef.current = next;
              return next;
            });

            return createdNodeId;
          };
          const createManualLoadingCard = () => {
            if (!shouldCreateLoadingCard) return "";

            const commonOptions = {
              title: "",
              content: "",
              image: "",
              fromApi: true,
              isStreaming: true,
              skipAutoStream: true,
            };

            if (requestedCardKey === "role") {
              if (useContextLinkedCreation && sourceNodeId) {
                return appendRoleCardsToGroup(sourceNodeId, [commonOptions]).roleNodeIds[0] ?? "";
              }
              return createStandaloneGroupedCardByKey("role", commonOptions);
            }

            if (requestedCardKey === "outline") {
              if (useContextLinkedCreation && sourceNodeId) {
                return appendOutlineCardsToGroup(sourceNodeId, [commonOptions]).outlineNodeIds[0] ?? "";
              }
              return createStandaloneGroupedCardByKey("outline", commonOptions);
            }

            if (useContextLinkedCreation && sourceNodeId) {
              if (requestedCardKey === "summary") {
                return addSummaryCard(sourceNodeId, {
                  ...commonOptions,
                  allowTitleEdit: true,
                  allowImageUpload: true,
                });
              }
              if (requestedCardKey === "info") {
                return addSettingCard(sourceNodeId, {
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
          let loadingCardConsumed = false;
          let loadingCardBoundToFinalFile = false;
          const getWriteFileFallbackTitle = (filePath: string, fallback: string) =>
            filePath.split("/").pop()?.replace(/\.md$/i, "") || fallback;
          const resolveWriteFileCardKey = (filePath: string): CanvasCardKey => {
            const inferredCardKey = inferCardKeyFromWriteFilePath(filePath);
            if (inferredCardKey !== "info") return inferredCardKey;
            if (requestedCardKey === "role") {
              return isRelationshipInfoWriteFile(filePath) ? "info" : "role";
            }
            return requestedCardKey;
          };
          const ensureStreamNodeId = (filePath: string, key: CanvasCardKey) => {
            const existingNodeId = streamedNodeIdsByFilePath.get(filePath);
            if (existingNodeId) return existingNodeId;

            let nextNodeId = "";
            const fallbackTitle = getWriteFileFallbackTitle(filePath, trimmedIdea || "卡片");
            const allowImageUpload = key !== "outline" && key !== "info";

            if (loadingCardId && !loadingCardConsumed) {
              nextNodeId = loadingCardId;
              loadingCardConsumed = true;
            }

            if (!nextNodeId && useContextLinkedCreation && sourceNodeId) {
              if (key === "brainstorm") {
                nextNodeId = sourceNodeId;
              } else if (key === "summary") {
                nextNodeId = addSummaryCard(sourceNodeId, {
                  title: fallbackTitle,
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  allowTitleEdit: true,
                  allowImageUpload: true,
                  skipAutoStream: true,
                });
              } else if (key === "info") {
                nextNodeId = addSettingCard(sourceNodeId, {
                  label: "信息",
                  title: fallbackTitle,
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  allowTitleEdit: true,
                  allowImageUpload: false,
                  skipAutoStream: true,
                });
              } else if (key === "outline") {
                nextNodeId = appendOutlineCardsToGroup(sourceNodeId, [{
                  title: fallbackTitle,
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }]).outlineNodeIds[0] ?? "";
              } else if (key === "role") {
                nextNodeId = appendRoleCardsToGroup(sourceNodeId, [{
                  title: fallbackTitle,
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }]).roleNodeIds[0] ?? "";
              }
            } else {
              if (key === "role" || key === "outline") {
                nextNodeId = createStandaloneGroupedCardByKey(key, {
                  title: fallbackTitle,
                  content: "",
                  image: "",
                  fromApi: true,
                  isStreaming: true,
                  skipAutoStream: true,
                }) ?? "";
              } else {
                nextNodeId = createCardByKey(key, {
                  title: fallbackTitle,
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
              streamedNodeIdsByFilePath.set(filePath, nextNodeId);
            }
            return nextNodeId;
          };
          const ensurePartialStreamNodeId = (callId: string, filePath: string, key: CanvasCardKey) => {
            const existingNodeId = partialNodeIdsByCallId.get(callId);
            if (existingNodeId) {
              const previousPath = partialFilePathByCallId.get(callId);
              if (previousPath && previousPath !== filePath) {
                streamedNodeIdsByFilePath.delete(previousPath);
              }
              if (filePath) {
                streamedNodeIdsByFilePath.set(filePath, existingNodeId);
                partialFilePathByCallId.set(callId, filePath);
              }
              return existingNodeId;
            }
            const seedPath = filePath || `__partial_write_file__/${callId}`;
            const nextNodeId = ensureStreamNodeId(seedPath, key);
            if (nextNodeId) {
              partialNodeIdsByCallId.set(callId, nextNodeId);
              if (filePath) {
                partialFilePathByCallId.set(callId, filePath);
                streamedNodeIdsByFilePath.set(filePath, nextNodeId);
              }
            }
            return nextNodeId;
          };
          const syncWriteFileCard = (
            item: CanvasWriteFileCall,
            isFinalWrite: boolean,
            partialCallId?: string
          ) => {
            if (useBrainstormBatchLoading) return;
            const filePath = getTextValue(item.filePath);
            if (!filePath && !partialCallId) return;
            if (shouldSkipWriteFileCardCreation(filePath)) return;
            const key = resolveWriteFileCardKey(filePath);
            const nodeId = partialCallId
              ? ensurePartialStreamNodeId(partialCallId, filePath, key)
              : ensureStreamNodeId(filePath, key);
            if (!nodeId) return;
            const allowImageUpload = key !== "outline" && key !== "info";
            if (!isFinalWrite) {
              const partialContent = getTextValue(item.content);
              updateLoadingCard(nodeId, key, {
                title: extractMarkdownTitle(
                  partialContent,
                  getWriteFileFallbackTitle(filePath, trimmedIdea || "卡片")
                ),
                filePath,
                content: partialContent,
                image: extractMarkdownImage(partialContent),
                fromApi: true,
                isStreaming: true,
                allowTitleEdit: true,
                allowImageUpload,
                autoEdit: true,
                isBlankBrainstormDraft: false,
                brainstormAiMode: key === "brainstorm" && nodeId === sourceNodeId,
                pendingGenerate: key === "brainstorm" && nodeId === sourceNodeId,
                highlighted: key === "brainstorm" && nodeId === sourceNodeId,
                skipAutoStream: true,
              });
              return;
            }
            updateLoadingCard(nodeId, key, {
              title: extractMarkdownTitle(
                item.content,
                getWriteFileFallbackTitle(filePath, trimmedIdea || "卡片")
              ),
              filePath,
              content: item.content,
              image: extractMarkdownImage(item.content),
              fromApi: true,
              isStreaming: false,
              allowTitleEdit: true,
              allowImageUpload,
              autoEdit: true,
              isBlankBrainstormDraft: false,
              brainstormAiMode: false,
              pendingGenerate: false,
              highlighted: false,
              skipAutoStream: true,
            });
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

            updateLoadingCard(placeholderNodeId, key, {
              title: extractMarkdownTitle(item.content, fallbackTitle),
              filePath: normalizedPath,
              content: item.content,
              image: extractMarkdownImage(item.content),
              fromApi: true,
              isStreaming: false,
              allowTitleEdit: true,
              allowImageUpload: key !== "outline" && key !== "info",
              autoEdit: true,
              isBlankBrainstormDraft: false,
              brainstormAiMode: false,
              pendingGenerate: false,
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

          await postCanvasChoicesStream(
            {
              prompt:
                !isAutoRequest && sourceNodeId
                  ? `帮我生成一个${outputTypeLabel}卡`
                  : !isAutoRequest
                    ? (hasExplicitCardTypeInIdea
                        ? trimmedIdea
                        : `帮我生成${trimmedIdea}${outputTypeLabel}卡`)
                    : `生成一个关于${trimmedIdea}${outputTypeLabel}卡`,
              model: "kimi_k2",
              type: requestType,
              files: manualRequestFiles,
            },
            (streamData: any) => {
              const isFinalWrite = streamData?.event === "updates";
              const isPartialWrite = streamData?.event === "messages/partial";
              if (!isFinalWrite && !isPartialWrite) return;
              if (isPartialWrite) {
                const partialWriteFiles = extractPartialWriteFileCalls(streamData?.data);
                partialWriteFiles.forEach((item) => {
                  const callId = getTextValue(item.callId);
                  if (!callId) return;
                  const normalizedPath = getTextValue(item.filePath);
                  if (normalizedPath && finalizedWriteFilePaths.has(normalizedPath)) return;
                  const nextContent = getTextValue(item.content);
                  partialWriteFilesByCallId.set(callId, nextContent);
                  syncWriteFileCard(
                    {
                      filePath: normalizedPath,
                      content: partialWriteFilesByCallId.get(callId) || "",
                    },
                    false,
                    callId
                  );
                });
                return;
              }
              const updatesContent = isFinalWrite
                ? (
                  extractDisplayToolFileContent(streamData?.data) ||
                  extractUpdatesMessageContentWithoutReadFile(streamData?.data)
                )
                : "";
              if (isFinalWrite) {
                const choicesContent = extractChoicesWriteFileContent(streamData?.data);
                if (choicesContent) {
                  const parsedSuggestions = parseChoicesSuggestionItems(choicesContent);
                  if (parsedSuggestions.length) {
                    setReqPanelDetail("为你生成了一些可选操作，点击下方按钮可直接填入输入框。");
                    setReqPanelFooterDetail("");
                    hasChoiceList = true;
                    setSmartSuggestions(parsedSuggestions);
                    setSmartSuggestionsActive(true);
                  }
                }
              }
              const writeFiles = extractUpdateToolFiles(streamData?.data);
              if (writeFiles.length) {
                writeFiles.forEach((item) => {
                  const normalizedPath = getTextValue(item.filePath);
                  if (!normalizedPath) return;
                  const normalizedCallId = getTextValue(item.callId);
                  const resolvedKey = resolveWriteFileCardKey(normalizedPath);
                  if (
                    loadingCardId &&
                    !loadingCardBoundToFinalFile &&
                    resolvedKey === requestedCardKey
                  ) {
                    streamedNodeIdsByFilePath.set(normalizedPath, loadingCardId);
                    loadingCardConsumed = true;
                    loadingCardBoundToFinalFile = true;
                    if (normalizedCallId) {
                      partialNodeIdsByCallId.set(normalizedCallId, loadingCardId);
                      partialFilePathByCallId.set(normalizedCallId, normalizedPath);
                    }
                  }
                  const normalizedItem = {
                    filePath: normalizedPath,
                    content: getTextValue(item.content),
                    callId: normalizedCallId,
                  };
                  finalizedWriteFilePaths.add(normalizedPath);
                  const matchedCallId =
                    normalizedItem.callId ||
                    Array.from(partialFilePathByCallId.entries()).find(
                      ([, partialPath]) => partialPath === normalizedPath
                    )?.[0];
                  if (matchedCallId) {
                    partialWriteFilesByCallId.delete(matchedCallId);
                    partialFilePathByCallId.delete(matchedCallId);
                    partialNodeIdsByCallId.delete(matchedCallId);
                  }
                  collectedWriteFilesByPath.set(normalizedPath, normalizedItem);
                  syncWriteFileCard(normalizedItem, true, normalizedItem.callId);
                });
              }
              const effectiveFiles = getLatestWriteFiles(collectedWriteFilesByPath).filter(
                (item) => !/relationship\.json$/i.test(item.filePath)
              );
              if (useBrainstormBatchLoading) {
                if (!effectiveFiles.length) return;
                startBrainstormPlaceholderBatch(
                  effectiveFiles,
                  brainstormBatchIdsRef.current.length > 0 || nodesRef.current.length > 0 ? "append" : "replace"
                );
                setReqPanelFooterDetail("");
                updateBrainstormPlaceholderBatch(effectiveFiles, trimmedIdea || "脑洞", isFinalWrite);
                return;
              }
              if (!isFinalWrite) return;
              if (updatesContent) {
                const { head, middle, tail } = splitAutoUpdatesContent(updatesContent);
                setReqPanelTitle(`${outputTypeLabel}卡`);
                setReqPanelDetail(head || updatesContent);
                setReqPanelBodyDetail(middle.join("\n\n"));
                setReqPanelFooterDetail(tail);
              }
            },
            (error: any) => {
              streamError = error;
            },
            () => {}
          );

          if (streamError) {
            if (loadingCardId) removeLoadingCard(loadingCardId);
            throw streamError;
          }

          const effectiveFiles = getLatestWriteFiles(collectedWriteFilesByPath).filter(
            (item) => !/relationship\.json$/i.test(item.filePath)
          );

          if (effectiveFiles.length) {
            setReqPanelStatus("success");

            if (useBrainstormBatchLoading) {
              updateBrainstormPlaceholderBatch(effectiveFiles, trimmedIdea || "脑洞", true);
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
            if (streamedNodeIdsByFilePath.size > 0) {
              setIsLoading(false);
              return;
            }
            if (effectiveOutputType === "role") {
              const roleFiles = effectiveFiles.filter(
                (item) => item.filePath.endsWith(".md") && !isRelationshipInfoWriteFile(item.filePath)
              );
              const relationFiles = effectiveFiles.filter(
                (item) => item.filePath.endsWith(".md") && isRelationshipInfoWriteFile(item.filePath)
              );

              if (roleFiles.length) {
                const roleCardWidth = 300;
                const loadingNode = loadingCardId
                  ? nodesRef.current.find((node) => node.id === loadingCardId)
                  : null;
                const basePosition = loadingNode?.position ?? getStandaloneNextRowPosition(nodesRef.current);

                if (loadingCardId) {
                  const firstRole = roleFiles[0];
                  const firstTitleFallback =
                    firstRole.filePath.split("/").pop()?.replace(/\.md$/i, "") || "角色1";
                  updateLoadingCard(loadingCardId, "role", {
                    title: extractMarkdownTitle(firstRole.content, firstTitleFallback),
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
                          title: extractMarkdownTitle(item.content, titleFallback),
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
                            title: extractMarkdownTitle(item.content, titleFallback),
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
              } else if (loadingCardId) {
                removeLoadingCard(loadingCardId);
              }

              relationFiles.forEach((item) => {
                const fallbackTitle = item.filePath.split("/").pop()?.replace(/\.md$/i, "") || "角色关系";
                createCardByKey("info", {
                  title: extractMarkdownTitle(item.content, fallbackTitle),
                  filePath: item.filePath,
                  content: item.content,
                });
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
              if (loadingCardId) {
                updateLoadingCard(loadingCardId, targetCardKey, {
                  title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                });
                if (useContextLinkedCreation && sourceNodeId && targetCardKey === "outline" && effectiveFiles.length > 1) {
                  appendOutlineCardsToGroup(
                    sourceNodeId,
                    effectiveFiles.slice(1).map((item) => ({
                      title: extractMarkdownTitle(item.content, trimmedIdea),
                      filePath: item.filePath,
                      content: item.content,
                      image: extractMarkdownImage(item.content),
                      fromApi: true,
                      isStreaming: false,
                    }))
                  );
                }
              } else if (useContextLinkedCreation && sourceNodeId) {
                if (targetCardKey === "brainstorm") {
                  updateLoadingCard(sourceNodeId, targetCardKey, {
                    title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                    filePath: primaryFile.filePath,
                    content: primaryFile.content,
                    image: extractMarkdownImage(primaryFile.content),
                  });
                } else if (targetCardKey === "summary") {
                  addSummaryCard(sourceNodeId, {
                    title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                    filePath: primaryFile.filePath,
                    content: primaryFile.content,
                    image: extractMarkdownImage(primaryFile.content),
                    fromApi: true,
                    isStreaming: false,
                    allowTitleEdit: true,
                    allowImageUpload: true,
                  });
                } else if (targetCardKey === "info") {
                  addSettingCard(sourceNodeId, {
                    label: "信息",
                    title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                    filePath: primaryFile.filePath,
                    content: primaryFile.content,
                    image: extractMarkdownImage(primaryFile.content),
                    fromApi: true,
                    isStreaming: false,
                    allowTitleEdit: true,
                    allowImageUpload: false,
                  });
                } else if (targetCardKey === "outline") {
                  appendOutlineCardsToGroup(sourceNodeId, [{
                    title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                    filePath: primaryFile.filePath,
                    content: primaryFile.content,
                    image: extractMarkdownImage(primaryFile.content),
                    fromApi: true,
                    isStreaming: false,
                  }]);
                } else {
                  createCardByKey(targetCardKey, {
                    title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                    filePath: primaryFile.filePath,
                    content: primaryFile.content,
                    image: extractMarkdownImage(primaryFile.content),
                  });
                }
              } else {
                createCardByKey(targetCardKey, {
                  title: extractMarkdownTitle(primaryFile.content, trimmedIdea),
                  filePath: primaryFile.filePath,
                  content: primaryFile.content,
                  image: extractMarkdownImage(primaryFile.content),
                });
              }
            }
          } else if (hasChoiceList) {
            setReqPanelStatus("success");
          } else {
            if (loadingCardId) removeLoadingCard(loadingCardId);
            setReqPanelStatus("error");
            setReqPanelDetail("状态：失败\n原因：返回数据格式不正确，请重试");
            msg("warning", "返回数据格式不正确，请重试");
          }
          setIsLoading(false);
          return;
        }
      } catch (e: any) {
        setReqPanelStatus("error");
        setReqPanelDetail(`状态：失败\n原因：${String(e?.message ?? "未知错误")}`);
        msg("error", e.message);
        if (trimmedIdea) {
          setIsLoading(false);
        }
      } finally {
        if (isAutoEmptyRequest) {
          setIsLoading(false);
        }
      }
    }, [
      canvasOutputType,
      createCardByKey,
      createLoadingCardByKey,
      ideaContent,
      isLoading,
      msg,
      addSettingCard,
      addSummaryCard,
      appendOutlineCardsToGroup,
      appendRoleCardsToGroup,
      removeLoadingCard,
      startBrainstormPlaceholderBatch,
      updateBrainstormPlaceholderBatch,
      updateLoadingCard,
    ]);

    useEffect(() => {
      handleGenerateInsRef.current = handleGenerateIns;
    }, [handleGenerateIns]);

    const handleGenerateInsFromContext = useCallback(
      (nodeId: string, outputType: CanvasOutputType) => {
        const currentNode = nodes.find((node) => node.id === nodeId);
        const contextIdea = getTextValue((currentNode?.data as any)?.title);
        if (!contextIdea.trim()) {
          msg("warning", "当前卡片暂无可用标题");
          return;
        }
        void handleGenerateIns("manual", contextIdea, outputType, nodeId);
      },
      [handleGenerateIns, msg, nodes]
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
        const nextRequestType: "auto" | "manual" = detectedCardMeta
          ? "manual"
          : smartSuggestions.length === 2 && suggestionIndex === smartSuggestions.length - 1
            ? "auto"
            : "manual";
        const nextOutputType: Exclude<CanvasOutputType, "auto"> = detectedCardMeta
          ? detectedCardMeta.outputType
          : "brainstorm";
        const nextCardLabel = detectedCardMeta?.cardLabel ?? "脑洞";
        const nextCardTitle = detectedCardMeta?.cardTitle ?? `${nextCardLabel}卡`;

        stopBrainstormProgress();
        brainstormBatchIdsRef.current = [];
        setIdeaContent(suggestion.theme);
        setCardKeyLabel(nextCardLabel);
        setReqPanelTitle(nextCardTitle);
        setSmartSuggestionsActive(false);
        setReqPanelStatus("loading");
        setReqPanelDetail(`正在根据所选${nextCardTitle}生成卡片，请稍等...`);
        setReqPanelFooterDetail("");
        setPendingSuggestionIdea(suggestion.theme);
        void handleGenerateIns(nextRequestType, suggestion.theme, nextOutputType);
      },
      [handleGenerateIns, smartSuggestions, stopBrainstormProgress]
    );

    const handleAddCardToDialog = useCallback(
      (nodeId: string) => {
        const currentNode = nodes.find((node) => node.id === nodeId);
        if (!currentNode) return;
        const cardType = getTextValue(currentNode.data?.label) || "卡片";
        const cardContent = getTextValue(currentNode.data?.content);
        const theme =
          getTextValue((currentNode.data as any)?.title) ||
          getTextValue(currentNode.data?.inspirationTheme) ||
          cardType;
        setDialogCardPreview({
          title: `${cardType}卡片`,
          content: cardContent,
        });
        setIdeaContent(`使用[${cardType}卡片]，生成 ${theme}信息`);
        msg("success", "已添加到对话");
      },
      [msg, nodes]
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
      setReqPanelTitle("");
      setReqPanelStatus("idle");
      setReqPanelDetail("");
      setReqPanelBodyDetail("");
      setReqPanelFooterDetail("");
      setReqPanelAction(null);
      setSmartSuggestionsActive(false);
      setSmartSuggestions([]);
      setPendingSuggestionIdea("");
      setDialogCardPreview(null);
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
      createNewCanvasSessionId(workId);
    }, [createNewCanvasSessionId, setNodes, setEdges, stopBrainstormProgress, workId]);

    const handleSaveCanvas = useCallback(async (sessionIdOverride?: string) => {
      if (!inspirationDrawId) {
        msg("warning", "请先创建画布");
        return;
      }
      try {
        await saveInspirationCanvasReq(inspirationDrawId, {
          nodes: nodes as unknown[],
          edges: edges as unknown[],
        });
        msg("success", "保存成功");
      } catch {
        msg("error", "保存失败，请稍后重试");
      }
    }, [inspirationDrawId, nodes, edges, msg, getOrCreateCanvasSessionId, workId]);

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
        openHistory,
        saveCanvas: handleSaveCanvas,
        inspirationDrawId,
        isLoading,
      }),
      [addNewCanvas, openHistory, handleSaveCanvas, inspirationDrawId, isLoading]
    );

    const onCanvasReadyRef = useRef(onCanvasReady);
    onCanvasReadyRef.current = onCanvasReady;
    useEffect(() => {
      onCanvasReadyRef.current?.();
    }, [inspirationDrawId, isLoading]);

    useEffect(() => {
      if (!autoSyncDirectory) return;
      onAutoSyncDirectoryRef.current?.(buildCanvasSyncFiles(nodes));
    }, [autoSyncDirectory, nodes]);

    const handleRestoreVersion = useCallback(
      (version: InspirationVersion) => {
        try {
          if (version.content) {
            const data = JSON.parse(version.content);
            if (data.nodes && data.edges) {
              setNodes(data.nodes);
              setEdges(data.edges);
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
  
    const handlers = useMemo(
      () => ({
        handleMainCardCreate,
        handleAddCardToDialog,
        handlePrepareBrainstormCard,
        handleGroupDelete: deleteNode,
        handleGenerateIns: handleGenerateInsFromContext,
        handleRoleExpandRandom,
        handleGenerateSummaryFromContext,
        handleGenerateOutlineFromContext,
        handleGenerateInfoFromContext,
        handleSummaryGenerate: generateStorySettings,
        handleSummaryAdd: addSummaryCard,
        handleSummaryDelete: deleteNode,
        handleSummaryUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
        },
        handleSummaryExpand: () => scheduleAutoLayoutForExpand(),
        handleSettingGenerate: generateOutlineNodes,
        handleSettingAdd: addSettingCard,
        handleSettingDelete: deleteNode,
        handleSettingUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，与 addSummaryCard 一致，避免流式输出时新节点被 dagre 排到顶部
        },
        handleSettingExpand: () => scheduleAutoLayoutForExpand(),
        handleOutlineGenerate,
        handleOutlineAdd: addOutlineCard,
        handleOutlineDelete: deleteNode,
        handleOutlineUpdate: (id: string, c: string) => {
          updateNodeContent(id, c);
          // 不触发 autoLayout，避免流式接口结束后新节点被 dagre 排到顶部
        },
        handleOutlineExpand: () => scheduleAutoLayoutForExpand(),
        getCanvasSessionId,
        msg,
      }),
      [
        handleMainCardCreate,
        handleAddCardToDialog,
        handlePrepareBrainstormCard,
        deleteNode,
        handleGenerateInsFromContext,
        handleRoleExpandRandom,
        handleGenerateSummaryFromContext,
        handleGenerateOutlineFromContext,
        handleGenerateInfoFromContext,
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
  
    const showInit = !forceCanvasView;

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

    const panelTitleText =
      reqPanelStatus === "loading"
        ? `${cardKeyLabel || "脑洞"}喵思考中`
        : reqPanelStatus === "success"
          ? `${cardKeyLabel || "脑洞"}喵搞定了！`
          : reqPanelStatus === "error"
            ? `${cardKeyLabel || "脑洞"}喵出错了`
            : reqPanelTitle || (showInit ? "智能喵" : `${cardKeyLabel || "脑洞"}`);

    const panelDetailText =
      reqPanelDetail ||
      (reqPanelStatus === "loading"
        ? "你已经明确表示要创作一个填充类型的故事，正在根据需求提供故事选题，请稍等..."
        : reqPanelStatus === "success"
          ? `灵感大开！已经生成了${cardKeyLabel || "脑洞"}，快在画布中查看吧`
          : "");
    const panelBodyText =
      reqPanelBodyDetail || (reqPanelFooterDetail ? "" : panelDetailText);

    const panelFooterText = reqPanelFooterDetail || "";
    const shouldForceExpandReqPanel =
      smartSuggestionsActive && reqPanelStatus === "success" && smartSuggestions.length > 0;
    const isReqPanelExpanded = shouldForceExpandReqPanel || reqPanelExpanded;
    const toggleReqPanelExpanded = () => {
      if (shouldForceExpandReqPanel) return;
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
            "relative w-full rounded-[21px] border border-[#f3f4f6] bg-white px-[15px] pt-[12px] shadow-[0px_22px_44px_0px_rgba(0,0,0,0.1)]",
            dialogCardPreview ? "min-h-[8.5rem]" : "h-[clamp(5rem,12vh,6.125rem)]"
          )}
        >
          {dialogCardPreview ? (
            <div className="relative mb-2 h-[50px] w-[80px] overflow-hidden rounded-[10px] bg-[#EEEEEE] px-2 py-1">
              <button
                type="button"
                className="absolute right-1 top-1 inline-flex size-3 items-center justify-center rounded-full text-[#737373] hover:bg-black/5 hover:text-[#000000]"
                aria-label="关闭卡片预览"
                onClick={() => setDialogCardPreview(null)}
              >
                <X className="size-[10px]" />
              </button>
              <div className="truncate text-[12px] font-medium leading-4 text-[#000000]">
                {dialogCardPreview.title}
              </div>
              <div className="mt-0.5 overflow-hidden text-[10px] leading-3 text-[#737373]">
                {dialogCardPreview.content}
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
            onChange={(e) => setIdeaContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey) return;
              e.preventDefault();
              handleGenerateIns(inputTriggerRequestType);
            }}
            placeholder={currentIdeaPlaceholder}
            rows={2}
            disabled={isLoading}
          />
          <div className="absolute inset-x-[10px] bottom-[8px] flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-[26px] rounded-full border border-[#e5e7eb] bg-white text-muted-foreground hover:bg-muted"
              disabled={isLoading}
              aria-label="打开工具"
              title="打开工具"
            >
              <Iconfont unicode="&#xe643;" className="size-4 leading-4" />
            </Button>

            <div className="ml-auto">
              <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
                <PopoverTrigger asChild>
                  <div className="flex items-center rounded-full bg-white p-1 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)]">
                    <Button
                      className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${
                        activeSettingsSection === "mode"
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
                      className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${
                        activeSettingsSection === "output"
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
                      className={`h-[28px] rounded-full px-3 text-[12px] font-medium transition-colors ${
                        activeSettingsSection === "model"
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
                            className={cn(
                              "w-full rounded-[8px] cursor-pointer px-2.5 py-1.5 text-left text-[11px] transition-colors",
                              canvasModeCategory === item.key
                                ? "bg-white font-medium text-[#EFAF00] shadow-[0px_0.5px_1px_0px_rgba(0,0,0,0.05)]"
                                : "text-[#4B5563] hover:bg-white/70"
                            )}
                            onClick={() => {
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
              disabled={isLoading}
              onClick={() => handleGenerateIns(inputTriggerRequestType)}
            >
              {ideaContent === '' && showInit ? <span className="flex items-center gap-1.5">
                <span>随机选题</span>
                <Iconfont unicode="&#xe7e2;" className="shrink-0 !text-[10px] text-white" />
              </span> : <ArrowUp className="text-white" />  }
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
          showInit ? "-translate-y-[11.25rem]" : "translate-y-[-0.75rem]"
        )}
      >
        <div className="pointer-events-none flex w-full max-w-[500px] flex-col">
          {reqPanelVisible && (
            <div
              className={cn(
                "pointer-events-auto relative z-10 w-full overflow-hidden rounded-[18px] rounded-b-none border border-[#f3f4f6] bg-[#FFFBED] shadow-[0px_10px_28px_0px_rgba(0,0,0,0.10)]",
                isReqPanelExpanded
                  ? panelFooterText
                    ? "-mb-[clamp(0.125rem,0.5vh,0.25rem)]"
                    : "-mb-[clamp(0.5rem,1vh,0.75rem)]"
                  : "-mb-[clamp(0.75rem,1.5vh,1.25rem)]",
                "transition-[margin,transform] duration-300 ease-out",
                "translate-y-1 sm:translate-y-2 md:translate-y-3 lg:translate-y-5"
              )}
            >
              <div
                className={cn(
                  "flex min-h-[clamp(4.75rem,10vh,6.25rem)] w-full items-start gap-3 px-4 py-3 text-left",
                  "transition-colors duration-200",
                )}
                onClick={toggleReqPanelExpanded}
                role="button"
                tabIndex={0}
                aria-expanded={isReqPanelExpanded}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleReqPanelExpanded();
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate inline-flex w-fit rounded-sm flex gap-1 items-center px-2 py-0.5 text-[13px] font-semibold text-[#111]"
                    style={{ backgroundImage: "linear-gradient(90deg, #F9EECE 0%, rgba(249,238,206,0) 100%)" }}
                  >
                    <img src={naodongmiao} alt="脑洞喵" className="w-4 h-4" />
                    {panelTitleText}
                  </div>
                  {panelDetailText ? (
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6b7280]">
                      <span className="truncate">{panelDetailText}</span>
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
                <Iconfont
                  unicode={isReqPanelExpanded ? "&#xeaa1;" : "&#xeaa6;"}
                  className={cn(
                    "shrink-0 text-[#6b7280] transition-transform duration-300",
                    isReqPanelExpanded ? "rotate-0" : "rotate-0"
                  )}
                />
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
                  {panelBodyText ? (
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

          <div className="pointer-events-auto relative z-20">{IdeaInputPanel}</div>
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
            <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 -translate-y-14 sm:-translate-y-16 md:-translate-y-18 lg:-translate-y-26">
              <InitCarousel
                isAnimate
                onPickType={(payload) => {
                  setIdeaContent(payload.text);
                  if (payload.source === "img") {
                    setGenerateMode("brainstorm");
                  }
                }}
              />
              <h1 className="z-10 mt-[-10px] text-center text-[26px] font-semibold text-[#4f4f4f]">
                {isLoading
                  ? `爆文猫写作正在生成${ideaContent ? ideaContent + "选题" : "随机选题"}...`
                  : "与爆文猫写作一起脑洞大开地创作"}
              </h1>
              <div className="flex gap-2 mt-2">
                <Button className="rounded-full bg-white text-[#4B5563] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]" onClick={() => navigate("/workspace/creation-community/course")}>
                  <Iconfont unicode="&#xe64f;" className="text-[#E5E7EB]" />
                  创作灵感社区
                </Button>
                <Button className="rounded-full bg-white text-[#4B5563] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]" onClick={() => {console.log('b站画布视频教程')}}>
                  <Iconfont unicode="&#xe641;" className="text-[#E5E7EB]" />
                  视频教程
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
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                onMove={(_, viewport) => {
                  if (!viewport) return;
                  setZoomPercent(Math.round((viewport.zoom || 1) * 100));
                }}
                defaultEdgeOptions={{
                  type: "bezier",
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
                <MiniMap
                  pannable={!showInit}
                  zoomable={!showInit}
                  // 上移一点，避免和右下角缩放按钮重叠
                  style={{ bottom: 48 }}
                />
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
          <div className="pointer-events-auto absolute bottom-5 right-5 z-50">
            <Popover open={moreActionsOpen} onOpenChange={setMoreActionsOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-9 rounded-full border border-[#e5e7eb] bg-white text-[#111] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.06)] hover:bg-[#f5f5f5]"
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
                    className="w-[180px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      createCardByKey("brainstorm");
                    }}
                  >
                    脑洞卡
                  </Button>
                  <Button
                    className="w-[180px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      createCardByKey("summary");
                    }}
                  >
                    故事梗概卡
                  </Button>
                  <Button
                    className="w-[180px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      createCardByKey("role");
                    }}
                  >
                    角色卡
                  </Button>
                  <Button
                    className="w-[180px] rounded-[12px] bg-white px-3 py-2 text-left text-[12px] font-medium text-[#111] shadow-[0px_6px_18px_0px_rgba(0,0,0,0.10)] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setMoreActionsOpen(false);
                      createCardByKey("outline");
                    }}
                  >
                    大纲卡
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
          canvasRef={ref as React.RefObject<InsCanvasApi | null>}
        />
      </ReactFlowProvider>
    )
  );
  InsCanvas.displayName = "InsCanvas";
  export default InsCanvas;
  