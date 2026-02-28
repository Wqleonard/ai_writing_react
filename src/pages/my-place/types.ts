import type { CreateWorkType } from '@/api/generate-dialog'

export type WorkType = 'editor' | 'doc' | 'script'

export interface WorkItem {
  id: number
  authorId: number
  title: string
  introduction: string
  createdTime: string
  updatedTime: string
  workType: WorkType
}

export interface MyWorkData {
  id: string
  authorId: string
  title: string
  description: string
  createdTime: string
  updatedTime: string
  workVersions: any[]
  sessions: any[]
  workType: WorkType
  deleteChecked?: boolean
}

export interface PageInfo {
  page: number
  pageSize: number
  total: number
}

export interface MessageDetail {
  id: string
  title: string
  desc?: string
  content: string
  timestamp: string
  isReaded?: boolean
}

export interface QuickChatInputChannelValue {
  mold: "tip" | "span" | "input";
  value: string;
  width?: string;
}

export interface QuickChatInputChannel {
  title: string;
  icon?: string;
  value: QuickChatInputChannelValue[];
  disabled?: boolean;
}
