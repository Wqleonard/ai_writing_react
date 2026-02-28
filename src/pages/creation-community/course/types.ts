export interface CourseData {
  id: string
  title: string
  tags: { id: string; name: string; color: string }[]
  description: string
  likeCount: number
  likeValue: number
  readCount: number
  author: string
  category: string
  imageUrl?: string
  authorName?: string
}

export interface CourseCardProps {
  data: CourseData
  onClick?: (courseId: string) => void
  onLike?: (courseId: string) => void
  onDislike?: (courseId: string) => void
}
