import type { FileTreeNode } from "../../utils/aiTreeNodeConverter";

export interface PromptCategory {
  id: number;
  name: string;
}

export interface PromptItem {
  id: number;
  name: string;
  description: string;
  iconUrl: string;
  favoritesCount: number;
  isOfficial: boolean;
  status: string;
  createdTime: string;
  updatedTime: string;
  authorId: number;
  authorName: string;
  categories: PromptCategory[];
  isFavorited: boolean;
  useCount: number;
  likeCount: number;
  userExample: string;
}

export interface WorkItem {
  id: number;
  authorId: number;
  title: string;
  introduction: string;
  createdTime: string;
  updatedTime: string;
  workType: "editor" | "doc";
}

export type { FileTreeNode };

export interface ConnectedFile {
  work: WorkItem | null;
  file: FileTreeNode[];
}
