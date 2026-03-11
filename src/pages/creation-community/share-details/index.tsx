import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getShareDetail, type ShareDetailResponse } from '@/api/share'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/ScrollArea'
import RenderRichText from '@/components/RichTextRender'

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

                  <RenderRichText
                    content={detailData.content || ''}
                    className="share-detail-content mt-4 mb-8 w-full max-w-[800px] whitespace-pre-wrap rounded-lg bg-gray-200 p-4"
                  />
                </>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </div>

      <style>{`
        .share-detail-content {
          color: #303133;
          line-height: 1.8;
          font-size: 14px;
          font-family: 'YaHei', system-ui;
        }
        .share-detail-content p { margin: 0.5em 0; line-height: 1.8; word-break: break-word; }
        .share-detail-content p:empty { min-height: 1em; display: block; }
        .share-detail-content p:empty::before { content: '\\00a0'; white-space: pre; }
        .share-detail-content h1, .share-detail-content h2, .share-detail-content h3,
        .share-detail-content h4, .share-detail-content h5, .share-detail-content h6 {
          margin: 0.8em 0 0.4em 0; font-weight: 600; line-height: 1.4; color: #303133;
        }
        .share-detail-content h1 { font-size: 1.8em; }
        .share-detail-content h2 { font-size: 1.5em; }
        .share-detail-content h3 { font-size: 1.25em; }
        .share-detail-content h4 { font-size: 1.1em; }
        .share-detail-content ul, .share-detail-content ol {
          margin: 0.5em 0; padding-left: 2em; line-height: 1.8; list-style: decimal;
        }
        .share-detail-content li { margin: 0.3em 0; }
        .share-detail-content strong { font-weight: 600; color: #303133; }
        .share-detail-content code {
          background: #f5f5f5; padding: 2px 6px; border-radius: 3px;
          font-family: 'YaHei', 'Courier New', monospace; font-size: 0.9em; color: #26282c;
        }
        .share-detail-content pre {
          background: #f7f7f7; color: #26282c; border: 1px solid rgba(37,39,45,0.1);
          margin: 1.5em 0; padding: 1em; font-size: 1rem; border-radius: 6px;
        }
        .share-detail-content blockquote {
          position: relative; padding-left: 1em; padding-top: 0.375em; padding-bottom: 0.375em;
          margin: 1.5rem 0;
        }
        .share-detail-content blockquote::before {
          position: absolute; left: 0; top: 0; bottom: 0; width: 0.25em;
          background: #222325; content: ''; border-radius: 0;
        }
        .share-detail-content a { color: #1890ff; text-decoration: none; }
        .share-detail-content a:hover { border-bottom: 1px solid #1890ff; }
        .share-detail-content img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; display: block; }
      `}</style>
    </div>
  )
}

export default ShareDetailsPage
