/** 分享列表项（列表/我的分享用） */
export interface ShareData {
  id: string
  title: string
  coverImageUrl: string
  description: string
  authorName: string
  likeCount: number
  viewCount: number
  createdTime: string
  updatedTime: string
  status: string
  dislikeCount?: number
  /** 仅“创建分享”卡片为 true */
  isCreateCard?: boolean
}

export interface ShareCardProps {
  data: ShareData
  onClick?: (share: ShareData) => void
  onLike?: (shareId: string) => void
  onDislike?: (shareId: string) => void
}

export interface MyShareCardProps {
  data: ShareData
  onClick?: (share: ShareData) => void
  onDelete?: (shareId: string) => void
}

export type ShareStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
