import { useCallback, useEffect, useRef, useState } from 'react'
import { getCourses, likeCourse } from '@/api/community'
import { useNavigation } from '@/hooks/useNavigation'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { CourseCard } from './components/CourseCard'
import type { CourseData } from './types'
import { useLoginStore } from "@/stores/loginStore";

interface ApiTag {
  id: string
  name: string
  color: string
  userId: number
}

interface ApiCourse {
  id: number
  title: string
  coverImageUrl: string
  authorName: string
  description: string
  tags: ApiTag[]
  likeCount: number
  likeValue: number
  readCount: number
  updatedTime: string
  createdTime: string
  isDeleted: boolean
  isPrivate: boolean
  publishedTime: string
}

interface ApiResponse {
  totalPages: number
  totalElements: number
  size: number
  content: ApiCourse[]
  number: number
  last: boolean
  numberOfElements: number
  first: boolean
  empty: boolean
}

const transformCourseData = (apiCourse: ApiCourse): CourseData => ({
  id: String(apiCourse.id),
  title: apiCourse.title,
  readCount: apiCourse.readCount,
  tags: apiCourse.tags || [],
  description: apiCourse.description || '',
  likeCount: apiCourse.likeCount || 0,
  likeValue: apiCourse.likeValue,
  author: apiCourse.authorName || '',
  category: '',
  imageUrl: apiCourse.coverImageUrl,
  authorName: apiCourse.authorName || '',
})

const PAGE_SIZE = 12

const CoursePage = () => {
  const [courses, setCourses] = useState<CourseData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { navigateTo } = useNavigation()

  const showEmpty = !loading && courses.length === 0

  const handleCourseClick = useCallback(
    (courseId: string) => {
      navigateTo(`/workspace/creation-community/course/details/${courseId}`)
    },
    [navigateTo]
  )

  const handleLike = useCallback(async (courseId: string) => {
    const before = courses.find((c) => c.id === courseId)
    if (!before || before.likeValue === 1) return
    setCourses((prev) => {
      const index = prev.findIndex((c) => c.id === courseId)
      if (index === -1) return prev
      const data = prev[index]
      const next = [...prev]
      next[index] = { ...data, likeValue: 1, likeCount: data.likeCount + 1 }
      return next
    })
    try {
      await likeCourse(courseId, '1')
    } catch {
      toast.error('点赞失败，请稍后重试')
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? before : c))
      )
    }
  }, [courses])

  const handleDislike = useCallback(async (courseId: string) => {
    const index = courses.findIndex((c) => c.id === courseId)
    if (index === -1) return
    const data = courses[index]
    if (data.likeValue === 2) return
    const before = { ...data }

    if (before.likeValue === 2) {
      try {
        await likeCourse(courseId, '0')
        setCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, likeValue: 0 } : c))
        )
      } catch {
        toast.error('取消失败，请稍后重试')
      }
      return
    }

    setCourses((prev) => {
      const next = [...prev]
      const i = next.findIndex((c) => c.id === courseId)
      if (i === -1) return prev
      next[i] = {
        ...next[i],
        likeValue: 2,
        likeCount:
          before.likeValue === 1 && before.likeCount >= 1
            ? before.likeCount - 1
            : next[i].likeCount,
      }
      return next
    })
    try {
      await likeCourse(courseId, '2')
    } catch {
      toast.error('点踩失败，请稍后重试')
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? before : c))
      )
    }
  }, [courses])

  const loadCourses = useCallback(async (page: number, append: boolean) => {
    if (loading || (append && !hasMore)) return
    setLoading(true)
    try {
      const response = (await getCourses(page, PAGE_SIZE)) as ApiResponse
      if (response?.content) {
        const list = response.content.map(transformCourseData)
        if (append) {
          setCourses((prev) => [...prev, ...list])
        } else {
          setCourses(list)
        }
        setCurrentPage(response.number)
        setHasMore(!response.last)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore])

  const completeNewbieMissionByCode = useLoginStore(s=>s.completeNewbieMissionByCode)

  useEffect(() => {
    loadCourses(0, false)
    completeNewbieMissionByCode('USE_COURSE')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = useCallback(() => {
    if (loading || !hasMore) return
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadCourses(currentPage + 1, true)
    }
  }, [loading, hasMore, currentPage, loadCourses])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [onScroll])

  return (
    <div className="mx-auto flex h-full flex-col items-center px-2">
      <div className="flex w-265 shrink-0 items-center justify-between">
        <div className="text-2xl font-medium">创作课程</div>
      </div>

      <div
        ref={scrollAreaRef}
        className="mx-auto mt-6 min-h-0 flex-1 w-full"
      >
        <ScrollArea className="h-full w-full">
        {showEmpty ? (
          <div className="flex w-full flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-sm">暂无课程数据</p>
          </div>
        ) : (
          <div className="w-full">
            <div className="mx-auto grid w-265 grid-cols-3 gap-4 pb-8">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  data={course}
                  onClick={handleCourseClick}
                  onLike={handleLike}
                  onDislike={handleDislike}
                />
              ))}
            </div>
          </div>
        )}

        {loading && courses.length > 0 ? (
          <div className="py-2 text-center text-sm text-gray-500">
            加载中...
          </div>
        ) : null}
        </ScrollArea>
      </div>
    </div>
  )
}

export default CoursePage
