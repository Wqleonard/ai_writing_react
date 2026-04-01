/** InsCanvas 通用类型定义 */

import type { MouseEvent, RefObject } from "react";
import type { Edge, Node, XYPosition } from "@xyflow/react";

export type CanvasMessageType = "success" | "error" | "warning";
export type CanvasMsgHandler = (type: CanvasMessageType, msg: string) => void;

export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  /** 卡片标题（位于 label 下方） */
  title?: string;
  /** 对应 write_file 的落盘路径 */
  filePath?: string;
  content?: string;
  image?: string;
  /** 多图（位于内容区下方），优先于 image */
  images?: string[];
  /** 是否为接口创建的卡片（用于骨架/占位等 UI 策略） */
  fromApi?: boolean;
  isMain?: boolean;
  expandable?: boolean;
  inspirationWord?: string;
  inspirationTheme?: string;
  shortSummary?: string;
  storySetting?: string;
  inspirationDrawId?: string;
  isStreaming?: boolean;
  /** 由 canvas-chat 生成的占位卡不需要再自动触发 inspiration-stream */
  skipAutoStream?: boolean;
  /** 脑洞概念生成进度（0~100），用于 loading UI */
  progress?: number;
}

export type CustomNode = Node<CustomNodeData, string> & {
  // 兼容历史字段：有些地方还会读取 dimensions
  dimensions?: { height: number; width: number };
  position: XYPosition;
  isCreated?: boolean;
};

export type CustomEdge = Edge<Record<string, unknown>, string>;

export interface InspirationItem {
  inspirationTheme: string;
  referenceStyle: string;
}

export interface TreeNode {
  id: string;
  type: string;
  data: CustomNodeData;
  position?: { x: number; y: number };
  children?: TreeNode[];
}

export interface ParentNode {
  id: string;
  type: string;
  label: string;
  data: CustomNodeData;
  next: ParentNode | null;
}

export interface InspirationVersion {
  id: string;
  inspirationDrawId: string | number;
  saveTime: string;
  description?: string;
  workName?: string;
  content?: string;
}

export type DeleteNodeOptions = {
  skipLayout?: boolean;
};

export type UpdateNodeOptions = {
  title?: string;
  filePath?: string;
  image?: string;
  images?: string[];
};

export type SettingsSection = "mode" | "output" | "model";
export type CanvasModeCategory = "smart" | "image" | "video";
export type CanvasOutputType = "auto" | "brainstorm" | "role" | "summary" | "outline" | "info";
export type CanvasModelType = "fast" | "max";
export type CanvasCardKey = "brainstorm" | "summary" | "role" | "outline" | "info";

export type CanvasAddCardOptions = {
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

export type CanvasGenerateOptions = {
  files?: Record<string, string>;
  title?: string;
  actionLabel?: string;
  includeDialogReferences?: boolean;
  clearDialogPreviewsAfterRequest?: boolean;
};

export type CanvasGenerateOutlineOptions = CanvasGenerateOptions & {
  chapterNum?: number;
  requirement?: string;
};

export type ReqPanelAction = {
  label: string;
  onClick?: () => void;
  generate?: {
    nodeId: string;
    outputType: Exclude<CanvasOutputType, "auto">;
  };
};

export type DialogReferenceCard = {
  nodeId: string;
  title: string;
  content: string;
  filePath: string;
  label: string;
};

export type SmartSuggestionItem = {
  id: string;
  theme: string;
  content: string;
  image: string;
  inspirationWord: string;
};

export type ReplySegments = {
  start: string;
  middle: string;
  end: string;
};

export type CanvasWriteFileCall = {
  filePath: string;
  content: string;
  callId?: string;
};

export type PartialCanvasWriteFileCall = CanvasWriteFileCall & {
  callId: string;
};

export type AddInfoCardFromExternalFileOptions = {
  title: string;
  content: string;
  filePath: string;
  clientX?: number;
  clientY?: number;
};

export type FocusFileByPathOptions = {
  zoom?: number;
  duration?: number;
  maxAttempts?: number;
};

export interface InsCanvasApi {
  addNewCanvas: () => void;
  addInfoCardFromExternalFile: (options: AddInfoCardFromExternalFileOptions) => string;
  focusFileByPath: (filePath: string, options?: FocusFileByPathOptions) => boolean;
  syncFileContentByPath: (filePath: string, content: string) => boolean;
  openHistory: () => void;
  saveCanvas: (sessionId?: string) => void;
  flushPersistence: () => Promise<void>;
  inspirationDrawId: string;
  isLoading: boolean;
}

export interface InsCanvasProps {
  workId: string;
  nodes?: CustomNode[];
  edges?: CustomEdge[];
  inspirationDrawId?: string;
  onCreateHere?: (files: Record<string, string>, chain: ParentNode | null) => void;
  onCreateNew?: (files: Record<string, string>, chain: ParentNode | null) => void;
  onMessage?: CanvasMsgHandler;
  onCanvasReady?: () => void;
  autoSyncDirectory?: boolean;
  onAutoSyncDirectory?: (files: Record<string, string>) => void;
  onCanvasFileContentChange?: (filePath: string, content: string) => void;
}

export interface InsCanvasInnerProps extends InsCanvasProps {
  canvasRef?: RefObject<InsCanvasApi | null>;
}

export interface InsCanvasHandlers {
  handleMainCardCreate: (nodeId: string) => void;
  handleAddCardToDialog: (nodeId: string) => void;
  handleAddGroupToDialog: (groupNodeId: string) => void;
  handlePrepareGenerateToDialog: (
    nodeId: string,
    outputType: CanvasOutputType,
    options?: CanvasGenerateOptions
  ) => void;
  handlePrepareBrainstormCard: (nodeId: string) => void;
  handleGroupDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleGenerateIns: (
    nodeId: string,
    outputType: CanvasOutputType,
    options?: CanvasGenerateOptions
  ) => void;
  handleGenerateOutlineFromContext: (
    nodeId: string,
    options?: CanvasGenerateOutlineOptions
  ) => void;
  handleSummaryAdd: (nodeId: string, opts?: CanvasAddCardOptions) => void;
  handleSettingAdd: (nodeId: string, opts?: CanvasAddCardOptions) => void;
  handleOutlineAdd: (nodeId: string, opts?: CanvasAddCardOptions) => void;
  handleSummaryGenerate: (nodeId: string) => void;
  handleSummaryDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleSummaryUpdate: (nodeId: string, content: string, options?: UpdateNodeOptions) => void;
  handleSummaryExpand: (nodeId: string) => void;
  handleSettingGenerate: (nodeId: string) => void;
  handleSettingDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleSettingUpdate: (nodeId: string, content: string, options?: UpdateNodeOptions) => void;
  handleSettingExpand: (nodeId: string) => void;
  handleOutlineGenerate: (nodeId: string) => void;
  handleOutlineDelete: (nodeId: string, options?: DeleteNodeOptions) => void;
  handleOutlineUpdate: (nodeId: string, content: string, options?: UpdateNodeOptions) => void;
  handleOutlineExpand: (nodeId: string) => void;
  getCanvasSessionId: () => string;
  msg: CanvasMsgHandler;
}

export type CanvasFloatingAction = {
  key: string;
  label: string;
  onClick?: (event: MouseEvent) => void;
};

export interface EditableFlowCardProps {
  id: string;
  data: CustomNodeData;
  cardLabel: string;
  generateLabel: string;
  type: string;
  dragging?: boolean;
  selected?: boolean;
  onGenerate: (id: string) => void;
  onAdd: (id: string) => void;
  onDelete: (id: string, options?: DeleteNodeOptions) => void;
  onUpdate: (id: string, content: string, options?: UpdateNodeOptions) => void;
  onExpand?: (id: string) => void;
  msg: CanvasMsgHandler;
}

export interface MainCardProps {
  data: {
    label: string;
    content: string;
    image: string;
    isMain?: boolean;
    hasIdea?: boolean;
    children?: any[];
  };
  isCreated: boolean;
  id: string;
}

export interface InitWorkDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateHere: () => void;
  onCreateNew: () => void;
}

export interface InspirationHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  workId: string;
  inspirationDrawId?: string | number;
  onRestore: (version: InspirationVersion) => void;
  loadVersions?: (workId: string) => Promise<InspirationVersion[]>;
}

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  targetLabel?: string;
}

export interface Bubble {
  size: number;
  left: number;
  top: number;
  delay: number;
}

export interface BubblesContainerProps {
  bubbles?: Bubble[];
  isAnimate?: boolean;
  className?: string;
  bubbleColor?: string;
  containerWidth?: number | string;
  containerHeight?: number | string;
}