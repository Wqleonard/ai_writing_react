export interface TemplateCardData {
  id: string
  title: string
  description: string
  tags: { name: string; id: string; category: string }[]
  usageCount: number
}

export interface HistoryItem {
  id: string
  name: string
  content: string
  description: string
  updatedAt: string
}
