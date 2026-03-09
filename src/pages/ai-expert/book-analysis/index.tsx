import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import {
  novelDeconstructStream,
  saveAsNewNote,
  addBookAnalysisHistory,
  updateBookAnalysisHistory,
  getBookAnalysisHistoryList,
  getBookAnalysisHistoryDetail,
} from '@/api/tools-square'
import { getWritingTemplatesListReq } from '@/api/writing-templates'
import { createWorkReq } from '@/api/works'
import type { PostStreamData } from '@/api'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { stripMarkdownAndTruncate } from '@/utils/stripMarkdown'
import { Upload } from '@/components/Upload'
import type { UploadFile } from '@/components/Upload'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { AutoScrollArea } from '@/components/AutoScrollArea'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import { HistoryCard } from './components/HistoryCard'
import { TemplateCard } from './components/TemplateCard'
import type { TemplateCardData, HistoryItem } from './types'
import { Iconfont } from "@/components/IconFont";
import { useLoginStore } from '@/stores/loginStore'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import Empty from '@/components/ui/Empty'

const SIZE_LIMIT = 8 * 1024 * 1024 // 8MB
const TEMPLATE_PAGE_SIZE = 20

const BookAnalysisPage = () => {
  const navigate = useNavigate()
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  const [showUpload, setShowUpload] = useState(true)
  const [cardsType, setCardsType] = useState<'hot' | 'history'>('hot')
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isPostStream, setIsPostStream] = useState(false)
  const [historyId, setHistoryId] = useState('')
  const [templates, setTemplates] = useState<TemplateCardData[]>([])
  const [templatePage, setTemplatePage] = useState(-1)
  const [templateHasMore, setTemplateHasMore] = useState(true)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [historyList, setHistoryList] = useState<HistoryItem[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyInitializedRef = useRef(false)
  const historyIdRef = useRef('')
  const markdownContentRef = useRef('')
  const isPostStreamRef = useRef(false)

  useEffect(() => {
    historyIdRef.current = historyId
  }, [historyId])

  useEffect(() => {
    markdownContentRef.current = markdownContent
  }, [markdownContent])

  useEffect(() => {
    isPostStreamRef.current = isPostStream
  }, [isPostStream])

  const saveHistorySnapshot = useCallback(async () => {
    const currentHistoryId = historyIdRef.current
    const latestMarkdownContent = markdownContentRef.current
    if (!currentHistoryId || !latestMarkdownContent) return
    try {
      await updateBookAnalysisHistory(latestMarkdownContent, currentHistoryId)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const saveWhenLeaving = () => {
      if (!isPostStreamRef.current) return
      void saveHistorySnapshot()
    }
    window.addEventListener('beforeunload', saveWhenLeaving)
    return () => {
      window.removeEventListener('beforeunload', saveWhenLeaving)
      saveWhenLeaving()
    }
  }, [saveHistorySnapshot])

  const handleFileChange = useCallback(() => {
    setMarkdownContent('')
    setHistoryId('')
    markdownContentRef.current = ''
    historyIdRef.current = ''
  }, [])

  const onStreamData = useCallback(
    (data: PostStreamData) => {
      switch (data.event) {
        case 'messages/partial': {
          const d = data.data
          if (!d || !Array.isArray(d) || d.length === 0) return
          const content = getContentFromPartial(d)
          if (!content) return
          setLoading(false)
          markdownContentRef.current = content
          setMarkdownContent(content)
          break
        }
        case 'updates':
          setLoading(true)
          break
        case 'end':
          setLoading(false)
          break
        default:
          break
      }
    },
    []
  )

  const onStreamError = useCallback((error: Error) => {
    console.error(error)
  }, [])

  const onStreamEnd = useCallback(async () => {
    setIsPostStream(false)
    await saveHistorySnapshot()
    const list = await getBookAnalysisHistoryList()
    if (Array.isArray(list)) {
      setHistoryList(
        list.map((item: any) => ({
          id: String(item?.id ?? ''),
          name: item?.attachmentName || '未命名',
          content: item?.deconstructResult || '暂无内容',
          description: stripMarkdownAndTruncate(item?.deconstructResult || '', 100),
          updatedAt: item?.createdTime ?? item?.updatedAt ?? '',
        }))
      )
    }
  }, [saveHistorySnapshot])

  const loadMoreTemplates = useCallback(async () => {
    if (templateLoading || !templateHasMore) return
    setTemplateLoading(true)
    try {
      const nextPage = templatePage + 1
      const res: any = await getWritingTemplatesListReq(nextPage, TEMPLATE_PAGE_SIZE)
      const content = Array.isArray(res?.content) ? res.content : []
      const newItems: TemplateCardData[] = content.map((item: any, itemIndex: number) => ({
        id: String(item.id || `template-${templatePage}-${itemIndex}`),
        title: item.title || '',
        description: item.content || '',
        usageCount: item.numberOfUses || 0,
        tags: item.tags?.map((t: any, tagIndex: number) => ({
          id: String(t?.id || `tag-${itemIndex}-${tagIndex}`),
          name: t?.name ?? '',
          category: t?.category ?? '',
        })) ?? [],
      }))
      if (newItems.length > 0) {
        setTemplates((prev) => {
          const seen = new Set<string>()
          return [...prev, ...newItems].filter((item, index) => {
            // Backend may return duplicate IDs across pages; dedupe before render.
            const dedupeKey = item.id
              ? `id:${item.id}`
              : `fallback:${item.title}-${item.description}-${index}`
            if (seen.has(dedupeKey)) return false
            seen.add(dedupeKey)
            return true
          })
        })
        setTemplatePage(nextPage)
      }
      if (res?.last === true) setTemplateHasMore(false)
    } catch {
      setTemplateHasMore(false)
    } finally {
      setTemplateLoading(false)
    }
  }, [templatePage, templateHasMore, templateLoading])

  const completeNewbieMissionByCode = useLoginStore(s=>s.completeNewbieMissionByCode)
  const requireLogin = useLoginStore((s) => s.requireLogin)

  useEffect(()=>{
    trackEvent('Dashboard', 'Click', 'Book Analysis')
  }, [])

  useEffect(() => {
    (async () => {
      loadMoreTemplates()
      await completeNewbieMissionByCode('USE_BOOK_ANALYSIS')
    })()
  }, [completeNewbieMissionByCode, loadMoreTemplates])

  const fetchHistoryList = useCallback(async () => {
    try {
      const list = await getBookAnalysisHistoryList()
      console.log('list', list)
      if (Array.isArray(list)) {
        setHistoryList(
          list.map((item: any) => ({
            id: String(item?.id ?? ''),
            name: item?.attachmentName || '未命名',
            content: item?.deconstructResult || '暂无内容',
            description: stripMarkdownAndTruncate(item?.deconstructResult || '', 100),
            updatedAt: item?.createdTime ?? item?.updatedAt ?? '',
          }))
        )
        historyInitializedRef.current = true
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const handleHistoryTabClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        await requireLogin(async () => {
          setCardsType('history')
          if (!historyInitializedRef.current) {
            await fetchHistoryList()
          }
        })
      } catch {
        // 用户取消登录时保持当前 tab，不做额外处理
      }
    },
    [fetchHistoryList, requireLogin]
  )

  const handleDoBookAnalysis = useCallback(async () => {
    trackEvent('Dashboard', 'Generate', 'Book Analysis')
    if (!uploadedFile?.response) return
    const response = uploadedFile.response as any
    const filePath = response?.putFilePath
    const fileName = response?.fileName
    setShowUpload(false)
    try {
      const hid: any = await addBookAnalysisHistory(uploadedFile.name || '')
      const nextHistoryId = typeof hid === 'object' ? String(hid.id ?? hid) : String(hid)
      if (hid != null) {
        historyIdRef.current = nextHistoryId
        setHistoryId(nextHistoryId)
      }
    } catch {
      // ignore
    }
    setLoading(true)
    setIsPostStream(true)
    try {
      await novelDeconstructStream(
        { name: fileName, path: filePath },
        onStreamData,
        onStreamError,
        onStreamEnd
      )
    } catch (e) {
      console.error(e)
      setLoading(false)
      setIsPostStream(false)
    }
  }, [uploadedFile, onStreamData, onStreamError, onStreamEnd])

  const handleReupload = useCallback(() => {
    setShowUpload(true)
    setMarkdownContent('')
    setUploadedFile(null)
    setHistoryId('')
    markdownContentRef.current = ''
    historyIdRef.current = ''
    setLoading(false)
  }, [])

  const handleAddToNote = useCallback(async () => {
    try {
      const title = `拆书仿写${uploadedFile?.name ? ':' + uploadedFile.name.replace(/\.[^.]*$/, '') : ''}`
      const noteContent =
        markdownContent +
        '\n\n添加时间：' +
        dayjs().format('YYYY-MM-DD HH:mm:ss')
      await saveAsNewNote(title, noteContent, 'PC_NOVEL_DECONSTRUCT')
      toast.success('笔记保存成功')
    } catch {
      toast.error('笔记保存失败')
    }
  }, [uploadedFile, markdownContent])

  const handleCopyNow = useCallback(async () => {
    trackEvent('Dashboard', 'Use', 'Book Analysis')
    try {
      setLoading(true)
      const req: any = await createWorkReq()
      if (!req?.id) {
        setLoading(false)
        return
      }
      sessionStorage.setItem(
        'rankingListTransmission',
        JSON.stringify({
          content: markdownContent,
          message: '仿照文件中作品信息，做出微创新，创作一篇短篇小说',
        })
      )
      navigate(`/editor/${req.id}`, { state: { isNew: false } })
    } catch {
      toast.error('创建作品失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [markdownContent, navigate])

  const handleHistoryCardClick = useCallback(
    async (item: HistoryItem) => {
      setShowUpload(false)
      setUploadedFile({ name: item.name } as UploadFile)
      historyIdRef.current = item.id
      setHistoryId(item.id)
      try {
        const detail: any = await getBookAnalysisHistoryDetail(item.id)
        console.log('detail', detail)
        const fullContent = detail?.deconstructResult || '暂无内容'
        console.log('fullContent', fullContent)
        setMarkdownContent(fullContent)
      } catch {
        setMarkdownContent(item.content || '暂无内容')
      }
    },
    []
  )

  const createFromTemplate = useCallback(
    async (template: TemplateCardData) => {
      setLoading(true)
      try {
        const req: any = await createWorkReq()
        if (!req?.id) {
          setLoading(false)
          return
        }
        sessionStorage.setItem(
          'editorInitialParams',
          JSON.stringify({
            isNew: true,
            template: JSON.stringify(template),
          })
        )
        navigate(`/editor/${req.id}`, {
          state: { isNew: true, template: JSON.stringify(template) },
        })
      } catch {
        toast.error('创建作品失败，请重试')
        setLoading(false)
      }
    },
    [navigate]
  )

  const handleTemplateClick = useCallback(
    (template: TemplateCardData) => {
      console.log(template, 'template')
      void requireLogin(createFromTemplate, template)
    },
    [createFromTemplate, requireLogin]
  )

  const onScroll = useCallback(() => {
    if (templateLoading || !templateHasMore) return
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMoreTemplates()
    }
  }, [templateLoading, templateHasMore, loadMoreTemplates])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [onScroll])

  if (showUpload) {
    return (
      <div ref={scrollRef} className="book-analysis-container-scrollbar flex h-full w-full">
        <ScrollArea className="h-full w-full">
          <div className="w-200 mx-auto flex flex-col items-center">
            <div className="mt-20 flex flex-col items-center">
              <div className="tracking-widest text-[50px] font-bold text-primary">
                拆书仿写
              </div>
              <div className="mt-1.5 text-xl text-secondary">
                输入任意长度完整文章,自动拆分出总纲
              </div>
            </div>
            <Upload
              className="mt-15 h-55 w-full"
              value={uploadedFile}
              onChange={setUploadedFile}
              onChangeFile={handleFileChange}
              accept={['.txt', '.pdf']}
              sizeLimit={SIZE_LIMIT}
            />
            <Button
              className="start-btn mt-7 h-10 w-30 text-white"
              disabled={!uploadedFile}
              onClick={handleDoBookAnalysis}
            >
              <Iconfont unicode="&#xe622;"/>
              <span>开始拆书</span>
            </Button>
            <div className="mt-5 w-full">
              <div
                className="sticky top-0 z-10 flex w-full items-center justify-between bg-[#f3f3f3] pb-2"
                role="tablist"
              >
                <div className="flex gap-4">
                  <div
                    role="tab"
                    aria-selected={cardsType === 'hot'}
                    className={`leading-8 cursor-pointer ${cardsType === 'hot' ? 'font-bold' : ''}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCardsType('hot')
                    }}
                  >
                    热门仿写
                  </div>
                  <div
                    role="tab"
                    aria-selected={cardsType === 'history'}
                    className={`leading-8 cursor-pointer ${cardsType === 'history' ? 'font-bold' : ''}`}
                    onClick={handleHistoryTabClick}
                  >
                    历史记录
                  </div>
                </div>
              </div>
              {cardsType === 'hot' ? (
                <div key="hot">
                  {templates.length > 0 ? (
                    <div className="grid w-full grid-cols-3 gap-2 pb-4">
                      {templates.map((t, index) => (
                        <TemplateCard
                          key={t.id ? `template-${t.id}` : `template-fallback-${index}-${t.title}`}
                          data={t}
                          showCreate
                          onCreate={handleTemplateClick}
                        />
                      ))}
                    </div>
                  ) : !templateLoading ? (
                    <Empty description="暂无热门仿写模板" />
                  ) : null}
                  {templateLoading ? (
                    <div className="py-4 text-center text-secondary">
                      加载中...
                    </div>
                  ) : null}
                </div>
              ) : (
                <div key="history">
                  {historyList.length > 0 ? (
                    <div className="grid w-full grid-cols-3 gap-2 pb-4">
                      {historyList.map((h, index) => (
                        <HistoryCard
                          key={h.id || `history-${index}`}
                          data={h}
                          onClick={handleHistoryCardClick}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <Empty description="暂无历史记录" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mt-10 flex flex-col items-center">
        <div className="tracking-widest text-[30px] font-bold text-primary">
          拆书仿写
          {uploadedFile?.name
            ? ':' + uploadedFile.name.replace(/\.[^.]*$/, '')
            : ''}
        </div>
        <div className="mt-1.5 text-base text-secondary">
          输入任意长度完整文章,自动拆分出总纲
        </div>
      </div>
      <div className="mt-5 flex min-h-0 flex-1 flex-col px-5">
        <AutoScrollArea
          className="flex-1 min-h-0"
          maxHeight="100%"
          autoScroll
          bottomThreshold={50}
        >
          <div className="w-200 mx-auto">
            <MarkdownEditor
              className="message-content-md"
              value={markdownContent}
              onChange={setMarkdownContent}
              readonly
              loading={loading}
            />
          </div>
        </AutoScrollArea>
        <div className="h-35 flex shrink-0 items-center justify-center gap-4">
          {!isPostStream && (
            <>
              <Button variant='outline' className="h-8" onClick={handleReupload}>
                <Iconfont unicode="&#xe613;"/>
                <span>返回上传</span>
              </Button>
              <Button className="h-8 text-white" onClick={handleAddToNote}>
                <Iconfont unicode="&#xe643;"/>
                <span>收录笔记</span>
              </Button>
              <Button className="h-8 text-white" onClick={handleCopyNow}>
                <Iconfont unicode="&#xe63f;"/>
                <span>立刻仿写</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookAnalysisPage
