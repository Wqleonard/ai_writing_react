/** InsCanvas 通用类型定义 */

import type { Edge, Node, XYPosition } from "@xyflow/react";

export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  content?: string;
  image?: string;
  isMain?: boolean;
  expandable?: boolean;
  inspirationWord?: string;
  inspirationTheme?: string;
  shortSummary?: string;
  storySetting?: string;
  inspirationDrawId?: string;
  isStreaming?: boolean;
}

export type CustomNode = Node<CustomNodeData, string> & {
  // 兼容历史字段：有些地方还会读取 dimensions
  dimensions?: { height: number; width: number };
  position: XYPosition;
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
  