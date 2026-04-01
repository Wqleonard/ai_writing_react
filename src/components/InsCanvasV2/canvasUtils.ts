import { AUTO_CARD_FIELD_LABELS, OUTLINE_GROUP_LAYOUT } from "./constant";
import type {
  CanvasCardKey,
  CanvasWriteFileCall,
  CustomNode,
  ReplySegments,
  SmartSuggestionItem,
} from "./types";

const OUTLINE_GROUP_SETTINGS_NODE_TYPE = OUTLINE_GROUP_LAYOUT.settingsNodeType;

export const getTextValue = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

export const isCanvasStreamDebugEnabled = () => {
  try {
    const globalScope = globalThis as typeof globalThis & {
      __INS_CANVAS_STREAM_DEBUG__?: boolean;
      localStorage?: Storage;
    };
    if (globalScope.__INS_CANVAS_STREAM_DEBUG__) return true;
    const storageValue = globalScope.localStorage?.getItem("ins-canvas-stream-debug");
    return storageValue === "1" || storageValue === "true";
  } catch {
    return false;
  }
};

export const logCanvasStreamDebug = (label: string, payload?: unknown) => {
  if (!isCanvasStreamDebugEnabled()) return;
  if (typeof payload === "undefined") {
    console.log(`[InsCanvas stream] ${label}`);
    return;
  }
  console.log(`[InsCanvas stream] ${label}`, payload);
};

export const getFirstTextValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = getTextValue(value);
    if (text) return text;
  }
  return "";
};

export const extractUpdatesMessageContentWithoutReadFile = (value: unknown): string => {
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
    const messageType = getTextValue((message as { type?: unknown })?.type)
      .trim()
      .toLowerCase();
    const messageName = getTextValue(message?.name).trim().toLowerCase();
    if (messageType === "tool" && messageName !== "write_file") continue;
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

export const splitAutoUpdatesContent = (content: string) => {
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

export const normalizeReplyFilePath = (
  filePath: string
): "start" | "middle" | "end" | "" => {
  const normalized = getTextValue(filePath).trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.endsWith("/start_reply.md") || normalized === "start_reply.md") return "start";
  if (normalized.endsWith("/middle_reply.md") || normalized === "middle_reply.md") return "middle";
  if (normalized.endsWith("/end_reply.md") || normalized === "end_reply.md") return "end";
  return "";
};

export const extractReplySegmentsFromToolFiles = (value: unknown): ReplySegments => {
  const result: ReplySegments = { start: "", middle: "", end: "" };

  const visit = (input: unknown) => {
    if (!input) return;
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input !== "object") return;
    const record = input as Record<string, unknown>;

    const files = (record.tools as { files?: Record<string, unknown> } | undefined)?.files;
    if (files && typeof files === "object") {
      Object.entries(files).forEach(([path, content]) => {
        const segment = normalizeReplyFilePath(path);
        if (!segment) return;
        const text = getTextValue(content).trim();
        if (!text) return;
        result[segment] = text;
      });
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return result;
};

export const collectPartialPanelMessagesById = (
  value: unknown,
  orderedIds: Set<string>,
  contentById: Map<string, string>
) => {
  let changed = false;

  const visit = (input: unknown) => {
    if (!input) return;
    if (Array.isArray(input)) {
      input.forEach(visit);
      return;
    }
    if (typeof input !== "object") return;

    const record = input as Record<string, unknown>;
    const messageId = getTextValue(record.id).trim();
    const messageContent = getTextValue(record.content).trim();
    const messageType = getTextValue(record.type).trim().toLowerCase();
    const messageName = getTextValue(record.name).trim().toLowerCase();

    const shouldIgnorePartialPanelMessage =
      messageType === "ai" ||
      messageType === "assistant" ||
      messageType === "human" ||
      messageType === "user";

    if (
      messageId &&
      messageContent &&
      !shouldIgnorePartialPanelMessage &&
      messageType !== "tool" &&
      messageName !== "read_file" &&
      messageName !== "generate_image" &&
      messageName !== "think_tool"
    ) {
      if (!orderedIds.has(messageId)) {
        orderedIds.add(messageId);
        changed = true;
      }
      if (contentById.get(messageId) !== messageContent) {
        contentById.set(messageId, messageContent);
        changed = true;
      }
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return changed;
};

export const getPanelTextsFromMessageMap = (
  orderedIds: Set<string>,
  contentById: Map<string, string>
) => {
  const contents = Array.from(orderedIds)
    .map((id) => contentById.get(id)?.trim() ?? "")
    .filter(Boolean);

  return {
    detail: contents[0] ?? "",
    body: contents[1] ?? "",
    footer: contents[2] ?? "",
  };
};

export const extractChoicesWriteFileContent = (value: unknown): string => {
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
      const directChoices = getTextValue(toolFiles["/choices.json"]);
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

export const extractChoicesToolFileContent = (value: unknown): string => {
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

export const extractDisplayToolFileContent = (value: unknown): string => {
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

export const parseChoicesSuggestionItems = (content: string): SmartSuggestionItem[] => {
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

export const extractUpdateToolFiles = (value: unknown): CanvasWriteFileCall[] => {
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
        const matchedPath = content.match(/^Updated file\s+(.+)$/)?.[1]?.trim() || "";
        if (!toolCallId || !matchedPath) return;
        callIdByPath.set(matchedPath, toolCallId);
      });
    }

    const toolFiles = record.tools?.files;
    if (toolFiles && typeof toolFiles === "object") {
      Object.entries(toolFiles).forEach(([filePath, fileContent]) => {
        const normalizedPath = getTextValue(filePath);
        if (!normalizedPath) return;
        const normalizedCallId = callIdByPath.get(normalizedPath);
        const previous = result.get(normalizedPath);
        if (previous) {
          logCanvasStreamDebug("extractUpdateToolFiles overwrite", {
            filePath: normalizedPath,
            previousCallId: previous.callId,
            nextCallId: normalizedCallId,
            previousContentLength: getTextValue(previous.content).length,
            nextContentLength: getTextValue(fileContent).length,
          });
        } else {
          logCanvasStreamDebug("extractUpdateToolFiles collect", {
            filePath: normalizedPath,
            callId: normalizedCallId,
            contentLength: getTextValue(fileContent).length,
          });
        }
        result.set(normalizedPath, {
          filePath: normalizedPath,
          content: getTextValue(fileContent),
          callId: normalizedCallId,
        });
      });
    }

    Object.values(record).forEach(visit);
  };

  visit(value);
  return Array.from(result.values());
};

export const extractCreationIdeaFileContent = (value: unknown): string => {
  if (!value) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractCreationIdeaFileContent(item);
      if (text) return text;
    }
    return "";
  }
  if (typeof value !== "object") return "";

  const record = value as {
    tools?: {
      files?: Record<string, unknown>;
    };
    tool_calls?: Array<{
      name?: string;
      args?: { file_path?: string; content?: string };
    }>;
  } & Record<string, unknown>;

  const directContent = getTextValue(record.tools?.files?.["/创作想法.md"]).trim();
  if (directContent) return directContent;

  if (Array.isArray(record.tool_calls)) {
    for (const toolCall of record.tool_calls) {
      if (getTextValue(toolCall?.name) !== "write_file") continue;
      if (getTextValue(toolCall?.args?.file_path) !== "/创作想法.md") continue;
      const content = getTextValue(toolCall?.args?.content).trim();
      if (content) return content;
    }
  }

  for (const nested of Object.values(record)) {
    const text = extractCreationIdeaFileContent(nested);
    if (text) return text;
  }
  return "";
};

export const getLatestWriteFiles = (
  filesByPath: Map<string, CanvasWriteFileCall>
): CanvasWriteFileCall[] => {
  return Array.from(filesByPath.values());
};

export const extractWriteFileTitle = (filePath: string, fallback: string) => {
  const fileName = getTextValue(filePath)
    .split("/")
    .pop()
    ?.replace(/\.md$/i, "");
  return getFirstTextValue(fileName, fallback);
};

export const extractMarkdownImage = (markdown: string) => {
  const imageMatch = markdown.match(/!\[[^\]]*\]\(([^)]+)\)/);
  return getTextValue(imageMatch?.[1]);
};

export const inferCardKeyFromWriteFilePath = (filePath: string): CanvasCardKey => {
  if (filePath.includes("[角色卡]")) return "role";
  if (filePath.includes("[梗概卡]")) return "summary";
  if (filePath.includes("[大纲卡]")) return "outline";
  if (filePath.includes("[脑洞卡]")) return "brainstorm";
  return "info";
};

export const isRelationshipWriteFile = (filePath: string) =>
  /(^|\/)relationship\.json$/i.test(filePath) || /(^|\/)角色关系\.md$/i.test(filePath);

export const shouldSkipWriteFileCardCreation = (filePath: string) =>
  /(^|\/)relationship\.json$/i.test(filePath) || Boolean(normalizeReplyFilePath(filePath));

export const isRelationshipInfoWriteFile = (filePath: string) =>
  isRelationshipWriteFile(filePath);

export const formatRecordMarkdown = (
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

export const formatOutlineMarkdown = (outlineItems: Array<Record<string, unknown>>) =>
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

export const sortCanvasNodes = (a: CustomNode, b: CustomNode) =>
  (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0);

export const sanitizeCanvasEntryName = (rawName: unknown, fallback: string) => {
  const cleaned = String(rawName ?? "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
};

export const getCanvasNodeBaseName = (node: CustomNode, fallbackIndex: number) => {
  const title = String(node.data?.title ?? "").trim();
  const label = String(node.data?.label ?? "").trim();
  return sanitizeCanvasEntryName(title || label, `卡片${fallbackIndex + 1}`);
};

export const getCanvasDirectoryName = (labelLike: unknown) => {
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

export const buildCanvasNodeMarkdown = (node: CustomNode) => {
  const title = sanitizeCanvasEntryName(
    String(node.data?.title ?? "").trim() || String(node.data?.label ?? "").trim(),
    "未命名卡片"
  );
  const body = String(node.data?.content ?? "").trim();
  const bodyHasHeading = /^\s*#{1,6}\s+.+/.test(body);
  const sections = bodyHasHeading ? [] : [`# ${title}`];
  if (body) sections.push(body);
  return sections.join("\n\n").trim();
};

export const buildCanvasNodeFilePath = ({
  label,
  title,
}: {
  label?: unknown;
  title?: unknown;
}) => {
  const directoryName = getCanvasDirectoryName(label);
  const fileBase = sanitizeCanvasEntryName(
    String(title ?? "").trim() || String(label ?? "").trim(),
    "未命名卡片"
  );
  return `/${directoryName}/${fileBase}.md`;
};

export const shouldSyncCanvasNode = (node: CustomNode) => {
  if (!node || node.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE) return false;

  const title = String(node.data?.title ?? "").trim();
  const content = String(node.data?.content ?? "").trim();
  const image = String(node.data?.image ?? "").trim();
  const images = Array.isArray((node.data as { images?: unknown[] })?.images)
    ? ((node.data as { images?: unknown[] }).images ?? []).filter(Boolean)
    : [];
  const hasMedia = Boolean(image) || images.length > 0;
  const isStreaming = Boolean((node.data as { isStreaming?: unknown })?.isStreaming);
  const isPendingGenerate = Boolean((node.data as { pendingGenerate?: unknown })?.pendingGenerate);
  const isPlaceholderDraft =
    Boolean((node.data as { isBlankDraft?: unknown })?.isBlankDraft) ||
    Boolean((node.data as { isBlankBrainstormDraft?: unknown })?.isBlankBrainstormDraft);

  if (isStreaming || isPendingGenerate || isPlaceholderDraft) return false;
  if (title || content || hasMedia) return true;

  return false;
};

const getUniqueName = (name: string, bucket: Map<string, number>) => {
  const count = bucket.get(name) ?? 0;
  bucket.set(name, count + 1);
  return count === 0 ? name : `${name}${count + 1}`;
};

const getCanvasGroupId = (node: CustomNode) =>
  getFirstTextValue(
    node.parentId,
    (node.data as { roleGroupId?: unknown })?.roleGroupId,
    (node.data as { outlineGroupId?: unknown })?.outlineGroupId
  );

const isGroupedCanvasChild = (node: CustomNode) => Boolean(getCanvasGroupId(node));

const getGroupedChildren = (nodes: CustomNode[], groupId: string) =>
  nodes
    .filter((child) => {
      if (child.type === OUTLINE_GROUP_SETTINGS_NODE_TYPE) return false;
      return getCanvasGroupId(child) === groupId;
    })
    .sort(sortCanvasNodes);

export const buildCanvasSyncFiles = (nodes: CustomNode[]): Record<string, string> => {
  if (!Array.isArray(nodes) || nodes.length === 0) return {};
  const result: Record<string, string> = {};
  const fileNameCountByDirectory = new Map<string, Map<string, number>>();

  const ensureDirectory = (directoryName: string) => {
    result[`${directoryName}/`] = "";
    if (!fileNameCountByDirectory.has(directoryName)) {
      fileNameCountByDirectory.set(directoryName, new Map<string, number>());
    }
    return fileNameCountByDirectory.get(directoryName)!;
  };

  const topLevelNodes = nodes
    .filter((node) => !isGroupedCanvasChild(node))
    .sort(sortCanvasNodes);

  topLevelNodes.forEach((node, index) => {
    if (node.type === "roleGroup") {
      const syncableChildren = getGroupedChildren(nodes, node.id).filter(shouldSyncCanvasNode);
      if (!syncableChildren.length) return;

      const directoryName = getCanvasDirectoryName(node.data?.label);
      const childNameCount = ensureDirectory(directoryName);
      syncableChildren.forEach((child, childIndex) => {
        const fileBase = getUniqueName(getCanvasNodeBaseName(child, childIndex), childNameCount);
        result[`${directoryName}/${fileBase}.md`] = buildCanvasNodeMarkdown(child);
      });
      return;
    }

    if (!shouldSyncCanvasNode(node)) return;

    const directoryName = getCanvasDirectoryName(node.data?.label ?? node.type);
    const fileNameCount = ensureDirectory(directoryName);
    const fileBase = getUniqueName(getCanvasNodeBaseName(node, index), fileNameCount);
    result[`${directoryName}/${fileBase}.md`] = buildCanvasNodeMarkdown(node);
  });

  return result;
};

export const buildCanvasSyncFileNodeIdMap = (nodes: CustomNode[]): Record<string, string> => {
  if (!Array.isArray(nodes) || nodes.length === 0) return {};
  const result: Record<string, string> = {};
  const fileNameCountByDirectory = new Map<string, Map<string, number>>();

  const ensureDirectory = (directoryName: string) => {
    if (!fileNameCountByDirectory.has(directoryName)) {
      fileNameCountByDirectory.set(directoryName, new Map<string, number>());
    }
    return fileNameCountByDirectory.get(directoryName)!;
  };

  const topLevelNodes = nodes
    .filter((node) => !isGroupedCanvasChild(node))
    .sort(sortCanvasNodes);

  topLevelNodes.forEach((node, index) => {
    if (node.type === "roleGroup") {
      const syncableChildren = getGroupedChildren(nodes, node.id).filter(shouldSyncCanvasNode);
      if (!syncableChildren.length) return;

      const directoryName = getCanvasDirectoryName(node.data?.label);
      const childNameCount = ensureDirectory(directoryName);
      syncableChildren.forEach((child, childIndex) => {
        const fileBase = getUniqueName(getCanvasNodeBaseName(child, childIndex), childNameCount);
        result[`${directoryName}/${fileBase}.md`] = child.id;
      });
      return;
    }

    if (!shouldSyncCanvasNode(node)) return;

    const directoryName = getCanvasDirectoryName(node.data?.label ?? node.type);
    const fileNameCount = ensureDirectory(directoryName);
    const fileBase = getUniqueName(getCanvasNodeBaseName(node, index), fileNameCount);
    result[`${directoryName}/${fileBase}.md`] = node.id;
  });

  return result;
};
