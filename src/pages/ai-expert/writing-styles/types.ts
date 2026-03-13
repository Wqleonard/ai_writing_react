export interface WritingStyleCardData {
  name: string
  content: string
  updatedAt: string
  isAdd: boolean
  description: string
  id: string | number
}

export interface WritingStyleCardProps {
  data: WritingStyleCardData
  onClick?: (data: WritingStyleCardData) => void
}
