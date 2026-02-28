export interface WritingStyleCardData {
  name: string
  content: string
  updatedAt: string
  isAdd: boolean
  description: string
}

export interface WritingStyleCardProps {
  data: WritingStyleCardData
  onClick?: (data: WritingStyleCardData) => void
}
