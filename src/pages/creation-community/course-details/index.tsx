import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCourseDetails, type CourseDetailsResponse } from '@/api/community'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/ScrollArea'

dayjs.extend(utc)

interface CourseDetails {
  id: string
  title: string
  coverImageUrl: string
  content: string
  authorName: string
  description: string
  tags: Array<{ id: number; name: string; userId: number }>
  likeCount: number
  readCount: number
  updatedTime: string
  createdTime: string
  isDeleted: boolean
  isPrivate: boolean
  publishedTime: string
  likeValue: number
}

const transformCourseDetails = (response: CourseDetailsResponse): CourseDetails => ({
  id: String(response.id),
  title: response.title,
  coverImageUrl: response.coverImageUrl,
  content: response.content,
  authorName: response.authorName,
  description: response.description,
  tags: response.tags,
  likeCount: response.likeCount,
  readCount: response.readCount,
  updatedTime: response.updatedTime,
  createdTime: response.createdTime,
  isDeleted: response.isDeleted,
  isPrivate: response.isPrivate,
  publishedTime: response.publishedTime,
  likeValue: response.likeValue,
})

const CourseDetailsPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [courseData, setCourseData] = useState<CourseDetails | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCourseDetails = useCallback(async (detailId: string) => {
    if (!detailId) return
    setLoading(true)
    try {
      const response = await getCourseDetails(detailId)
      if (response) {
        setCourseData(transformCourseDetails(response))
      }
    } catch {
      toast.error('加载课程详情失败，请稍后重试')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (id) loadCourseDetails(id)
  }, [id, loadCourseDetails])

  const goBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  return (
    <div className="course-details-container h-full flex flex-col items-center px-2">
      <header className="w-265 h-8 flex items-center">
        <Button
          variant="link"
          onClick={goBack}
        >
          <ArrowLeft className="size-5" />
          <span>返回</span>
        </Button>
      </header>

      <div className="w-full mx-auto flex-1 min-h-0">
        <ScrollArea className="h-full w-full">
          <div className="w-full flex flex-col items-center">
            <div className="flex flex-col w-265 items-center">
              {courseData?.coverImageUrl ? (
                <div className="h-75 w-full flex items-center justify-center overflow-hidden rounded-lg shrink-0">
                  <img
                    src={courseData.coverImageUrl}
                    alt="课程封面"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : null}

              {courseData ? (
                <>
                  <div className="text-3xl font-bold py-4">{courseData.title}</div>
                  <div className="flex items-center gap-2">
                    <span className="author">{courseData.authorName}</span>
                    <span className="publish-time">
                      {dayjs.utc(courseData.publishedTime).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                    <span className="read-count">阅读量:{courseData.readCount}</span>
                    <span className="read-count">点赞量:{courseData.likeCount}</span>
                  </div>

                  <div
                    className="course-detail-content mt-4 w-200 bg-gray-200 p-4 rounded-lg mb-8 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: courseData.content || '',
                    }}
                  />
                </>
              ) : loading ? (
                <div className="flex w-full justify-center items-center py-20">
                  <span className="text-gray-500">加载中...</span>
                </div>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </div>

      <style>{`
        .course-detail-content {
          color: #303133;
          line-height: 1.8;
          font-size: 14px;
          font-family: 'YaHei', system-ui;
        }
        .course-detail-content p { margin: 0.5em 0; line-height: 1.8; word-break: break-word; }
        .course-detail-content p:empty { min-height: 1em; display: block; }
        .course-detail-content h1, .course-detail-content h2, .course-detail-content h3,
        .course-detail-content h4, .course-detail-content h5, .course-detail-content h6 {
          margin: 0.8em 0 0.4em 0; font-weight: 600; line-height: 1.4; color: #303133;
        }
        .course-detail-content h1 { font-size: 1.8em; }
        .course-detail-content h2 { font-size: 1.5em; }
        .course-detail-content h3 { font-size: 1.25em; }
        .course-detail-content strong { font-weight: 600; color: #303133; }
        .course-detail-content code {
          background: #f5f5f5; padding: 2px 6px; border-radius: 3px;
          font-size: 0.9em; color: #26282c;
        }
        .course-detail-content pre {
          background: #f7f7f7; color: #26282c; border: 1px solid rgba(37,39,45,0.1);
          margin: 1.5em 0; padding: 1em; font-size: 1rem; border-radius: 6px;
        }
        .course-detail-content a { color: #1890ff; text-decoration: none; }
        .course-detail-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; display: block; }
      `}</style>
    </div>
  )
}

export default CourseDetailsPage
