import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getShareDetail, type ShareDetailResponse } from '@/api/share'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/ScrollArea'
import RichTextRender from '@/components/RichTextRender'

dayjs.extend(utc)

const ShareDetailsPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detailData, setDetailData] = useState<ShareDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const loadShareDetail = useCallback(async (detailId: string) => {
    if (!detailId) return
    setLoading(true)
    try {
      const data = await getShareDetail(detailId)
      setDetailData(data)
    } catch {
      toast.error('加载分享详情失败，请稍后重试')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (id) loadShareDetail(id)
  }, [id, loadShareDetail])

  const goBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  return (
    <div className="course-details-container flex h-full flex-col items-center px-2">
      <header className="flex h-8 w-265 items-center">
        <Button
          variant="link"
          onClick={goBack}
        >
          <ArrowLeft className="size-5" />
          <span>返回</span>
        </Button>
      </header>

      <div className="mx-auto flex min-h-0 flex-1 w-full">
        <ScrollArea className="h-full w-full">
          <div className="flex w-full flex-col items-center">
            <div className="flex w-265 flex-col items-center">
              {detailData?.coverImageUrl ? (
                <div className="flex h-[300px] w-full items-center justify-center overflow-hidden rounded-lg">
                  <img
                    src={detailData.coverImageUrl}
                    alt="分享封面"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              {loading ? (
                <div className="flex w-full items-center justify-center py-20">
                  <span className="text-gray-500">加载中...</span>
                </div>
              ) : detailData ? (
                <>
                  <div className="py-4 text-3xl font-bold">
                    {detailData.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">{detailData.username}</span>
                    <span className="text-gray-500">
                      {dayjs.utc(detailData.createdTime).format('YYYY-MM-DD HH:mm:ss')}
                    </span>
                    <span className="text-gray-500">
                      阅读量:{detailData.viewCount}
                    </span>
                  </div>

                  <RichTextRender
                    content={detailData.content || ''}
                    className="share-detail-content mt-4 mb-8 w-full max-w-[800px] whitespace-pre-wrap rounded-lg bg-gray-200 p-4"
                  />
                </>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

export default ShareDetailsPage
