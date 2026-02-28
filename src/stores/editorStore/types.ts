/**
 * 编辑器 Store 类型定义，与 Vue 版 editor store 对齐。
 */

/** 保存状态：'0' 用户点击保存，'1' 自动保存等 */
export type EditorSaveStatus = "0" | "1" | "2";

/** 作品标签 */
export interface WorkTag {
  id: number;
  name: string;
  userId: string;
  categoryId?: string;
}

/** 作品信息（与 Vue workInfo 一致） */
export interface WorkInfo {
  workId: string;
  title: string;
  introduction: string;
  createdTime: string;
  updatedTime: string;
  description: string;
  stage: string;
  chapterNum?: number;
  wordNum?: number;
  workTags: WorkTag[];
}

/** 服务端文件数据：路径 -> 内容（与 Vue ServerData 一致） */
export interface ServerData {
  [key: string]: string;
}

/** 文件树节点（与 Vue FileTreeNode 对齐，用于侧边栏树与 save） */
export interface FileTreeNode {
  id: string;
  key: string;
  label: string;
  content: string;
  isDirectory: boolean;
  path: string[];
  fileType?: string;
  new?: boolean;
  children: FileTreeNode[];
}
