/** InsCanvas 通用类型定义 */

import type { Edge, Node, XYPosition } from "@xyflow/react";

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
    inspirationTheme: string
    referenceStyle: string
  }
  
  export interface TreeNode {
    id: string
    type: string
    data: CustomNodeData
    position?: { x: number; y: number }
    children?: TreeNode[]
  }
  
  export interface ParentNode {
    id: string
    type: string
    label: string
    data: CustomNodeData
    next: ParentNode | null
  }
  
  export interface InspirationVersion {
    id: string
    inspirationDrawId: string | number
    saveTime: string
    description?: string
    workName?: string
    content?: string
  }
  