import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  addNovelToScriptHistory,
  getNovelToScriptHistoryList,
  postNovelToScriptStream,
  updateNovelToScriptHistory,
} from '@/api/tools-square'
import type { PostStreamData } from '@/api'
import { addNote } from '@/api/notes'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { stripMarkdownAndTruncate } from '@/utils/stripMarkdown'
import { Upload } from '@/components/Upload'
import type { UploadFile } from '@/components/Upload'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { AutoScrollArea } from '@/components/AutoScrollArea'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import { WritingStyleCard } from '@/pages/ai-expert/writing-styles/components/WritingStyleCard'
import type { WritingStyleCardData } from '@/pages/ai-expert/writing-styles/types'
import { Iconfont } from '@/components/Iconfont'
import { useLoginStore } from '@/stores/loginStore'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import clsx from 'clsx'
import Empty from '@/components/ui/Empty'
import './novel-to-script.css'

const SIZE_LIMIT = 10 * 1024 * 1024 // 10MB

const readFileContent = (file: File, fileExtension: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (fileExtension !== '.txt') {
      reject(new Error('不支持的文件格式，仅支持 .txt 文件'))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      resolve(content)
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file, 'UTF-8')
  })
}

interface ChatMessage {
  id: string
  type: 'ai'
  content: string
  timestamp: number
  isStreaming?: boolean
}

const NovelToScriptPage = () => {
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  const [showUpload, setShowUpload] = useState(true)
  const [chatArr, setChatArr] = useState<ChatMessage[]>([])
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isPostStream, setIsPostStream] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [historyId, setHistoryId] = useState('')
  const [historyList, setHistoryList] = useState<WritingStyleCardData[]>([])
  const historyIdRef = useRef('')
  const markdownContentRef = useRef('')
  const isPostStreamRef = useRef(false)

  const isLoggedIn = useLoginStore((s) => s.isLoggedIn)

  useEffect(() => {
    const next = chatArr.map((item) => item.content).join('\n\n')
    markdownContentRef.current = next
    setMarkdownContent(next)
  }, [chatArr])

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
      await updateNovelToScriptHistory(latestMarkdownContent, currentHistoryId)
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
    setChatArr([])
    setHistoryId('')
    historyIdRef.current = ''
    markdownContentRef.current = ''
  }, [])

  const fetchHistoryList = useCallback(async () => {
    if (!isLoggedIn) return
    try {
      const list = await getNovelToScriptHistoryList()
      if (Array.isArray(list)) {
        setHistoryList(
          list.map((item: any, index: number) => {
            const content = item?.novelToScriptResult || '暂无内容'
            return {
              ...item,
              name: item?.attachmentName ?? '',
              content,
              description: stripMarkdownAndTruncate(content, 100),
              id: item?.id ?? `history-${index}`,
              updatedAt: item?.createdTime ?? '',
              isAdd: item?.isAdd ?? false,
            }
          })
        )
      }
    } catch {
      // ignore
    }
  }, [isLoggedIn])

  useEffect(() => {
    trackEvent('Dashboard', 'Click', 'Novel To Script')
  }, [])

  useEffect(() => {
    void fetchHistoryList()
  }, [fetchHistoryList])

  const onStreamData = useCallback((data: PostStreamData) => {
    switch (data.event) {
      case 'messages/partial': {
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return
        const dataId = (data.data as any[])[0]?.id
        const content = getContentFromPartial(data.data)
        if (!content) return
        setLoading(false)
        setChatArr((prev) => {
          const existingIndex = prev.findIndex((msg) => msg.id === dataId)
          if (existingIndex === -1) {
            return [
              ...prev,
              {
                id: dataId ?? `ai_${Date.now()}`,
                type: 'ai',
                content,
                timestamp: Date.now(),
                isStreaming: true,
              },
            ]
          }
          const next = [...prev]
          next[existingIndex] = {
            ...next[existingIndex],
            content,
            isStreaming: true,
          }
          return next
        })
        break
      }
      case 'updates': {
        if (!data?.data) return
        const safety = (data.data as any).check_input_safety
        if (safety && !safety.input_safety_passed) {
          const errorMessage =
            safety.final_output || '抱歉，文件存在敏感信息，我无法进行小说转剧本'
          setChatArr((prev) => [
            ...prev,
            {
              id: `error_${Date.now()}`,
              type: 'ai',
              content: errorMessage,
              timestamp: Date.now(),
              isStreaming: false,
            },
          ])
          setHasError(true)
          setIsPostStream(false)
          return
        }
        setLoading(false)
        const dataId = (data as any).id
        if (dataId != null) {
          setChatArr((prev) => {
            const existingIndex = prev.findIndex((msg) => msg.id === dataId)
            if (existingIndex !== -1) {
              const next = [...prev]
              next[existingIndex] = { ...next[existingIndex], isStreaming: false }
              return next
            }
            return prev
          })
        }
        break
      }
      case 'end':
      default:
        break
    }
  }, [])

  const onStreamError = useCallback((error: Error) => {
    console.error(error)
  }, [])

  const onStreamEnd = useCallback(async () => {
    setIsPostStream(false)
    setLoading(false)
    setChatArr((prev) => {
      if (prev.length === 0) return prev
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], isStreaming: false }
      return next
    })
    await saveHistorySnapshot()
    await fetchHistoryList()
  }, [fetchHistoryList, saveHistorySnapshot])

  const handleDoAnalysis = useCallback(async () => {
    trackEvent('Dashboard', 'Generate', 'Novel To Script')
    if (!uploadedFile?.raw) {
      toast.error('请先上传文件')
      return
    }
    const file = uploadedFile.raw as File
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    setShowUpload(false)
    setHasError(false)
    setChatArr([])
    setLoading(true)

    try {
      const hid: any = await addNovelToScriptHistory(uploadedFile.name || '')
      if (hid != null) {
        const nextHistoryId = typeof hid === 'object' ? String(hid.id ?? hid) : String(hid)
        historyIdRef.current = nextHistoryId
        setHistoryId(nextHistoryId)
      }
    } catch {
      // ignore
    }

    try {
      const content = await readFileContent(file, fileExtension)
      if (!content || content.trim().length === 0) {
        toast.warning('文件内容为空')
        setShowUpload(true)
        setUploadedFile(null)
        setLoading(false)
        return
      }
      setIsPostStream(true)
      await postNovelToScriptStream(content, onStreamData, onStreamError, onStreamEnd)
    } catch (e) {
      setLoading(false)
      setIsPostStream(false)
      const msg = e instanceof Error ? e.message : '文件读取失败，请重试'
      setChatArr((prev) => [
        ...prev,
        {
          id: `ai_error_${Date.now()}`,
          type: 'ai',
          content: msg,
          timestamp: Date.now(),
        },
      ])
      setHasError(true)
      toast.error(msg)
    }
  }, [uploadedFile, onStreamData, onStreamError, onStreamEnd])

  const handleReupload = useCallback(() => {
    setShowUpload(true)
    setChatArr([])
    setUploadedFile(null)
    setHistoryId('')
    setMarkdownContent('')
    historyIdRef.current = ''
    markdownContentRef.current = ''
    setMarkdownEditing(false)
    setLoading(false)
    setIsPostStream(false)
    setHasError(false)
  }, [])

  const handleMarkdownEditing = useCallback(() => {
    setMarkdownEditing((prev) => !prev)
  }, [])

  const handleHistoryCardClick = useCallback((item: WritingStyleCardData) => {
    setShowUpload(false)
    setMarkdownEditing(false)
    setUploadedFile({ name: item.name } as UploadFile)
    setChatArr([
      {
        id: `history_${Date.now()}`,
        type: 'ai',
        content: item.content,
        timestamp: Date.now(),
      },
    ])
  }, [])

  const handleAddToNote = useCallback(async () => {
    const content = markdownContent.trim()
    if (!content) {
      toast.warning('内容为空，无法收录笔记')
      return
    }
    const fileName = uploadedFile?.name?.replace(/\.[^.]*$/, '') || '未命名文件'
    const noteTitle = `小说转剧本-${fileName}`
    try {
      await addNote(noteTitle, content, 'PC_NOVEL_TO_SCRIPT')
      toast.success('笔记添加成功')
    } catch (error) {
      console.error('添加笔记失败:', error)
      toast.error('添加笔记失败，请重试')
    }
  }, [markdownContent, uploadedFile?.name])

  if (showUpload) {
    return (
      <div className="flex h-full w-full">
        <ScrollArea className="h-full w-full">
          <div className="mx-auto flex w-200 flex-col items-center">
            <div className="mt-20 flex flex-col items-center">
              <div className="truncate tracking-widest text-[50px] font-bold text-primary">
                小说转剧本
              </div>
              <div className="mt-1.5 text-xl text-secondary">
                上传小说原文，自动转换剧本格式
              </div>
            </div>
            <Upload
              className="mt-15 h-55 w-full"
              value={uploadedFile}
              onChange={setUploadedFile}
              onChangeFile={handleFileChange}
              accept={['.txt']}
              sizeLimit={SIZE_LIMIT}
            />
            <Button
              className="start-btn mt-7 h-10 w-30 text-white"
              disabled={!uploadedFile}
              onClick={handleDoAnalysis}
            >
              <Iconfont unicode="&#xea91;" />
              <span>开始分析</span>
            </Button>
            <div className="mt-5 w-full">
              <div className="sticky top-0 z-10 flex h-10 w-full items-center justify-between bg-[#f3f3f3] pb-2">
                <div className="text-base font-bold leading-6">历史记录</div>
              </div>
              {historyList.length > 0 ? (
                <div className="mb-5 grid w-full grid-cols-3 gap-4">
                  {historyList.map((item, i) => (
                    <WritingStyleCard
                      key={item.id + String(i)}
                      data={item}
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
          </div>
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mt-10 flex flex-col items-center">
        <div className="max-w-200 truncate tracking-widest text-[30px] font-bold text-primary">
          小说转剧本
          {uploadedFile?.name ? `:${uploadedFile.name.replace(/\.[^.]*$/, '')}` : ''}
        </div>
        <div className="mt-1.5 text-base text-secondary">
          上传小说原文，自动转换剧本格式
        </div>
      </div>
      <div className="mt-5 flex min-h-0 flex-1 flex-col px-5">
        <AutoScrollArea
          className={clsx(
            'novel-to-script-auto-scroll relative flex-1 min-h-0',
            markdownEditing && 'show-border'
          )}
          maxHeight="100%"
          autoScroll
          bottomThreshold={50}
        >
          <div className="mx-auto w-200">
            <MarkdownEditor
              className="message-content-md"
              value={markdownContent}
              onChange={setMarkdownContent}
              readonly={!markdownEditing}
              loading={loading}
            />
          </div>
        </AutoScrollArea>
        <div className="h-35 flex shrink-0 items-center justify-center gap-4">
          {!isPostStream && (
            <>
              <Button variant="outline" className="h-8" onClick={handleReupload}>
                <Iconfont unicode="&#xe613;" />
                <span>返回上传</span>
              </Button>
              {!hasError && (
                <Button variant="outline" className="h-8" onClick={handleAddToNote}>
                  <Iconfont unicode="&#xe643;" />
                  <span>收录笔记</span>
                </Button>
              )}
              {!hasError && (
                <Button className="h-8 text-white" onClick={handleMarkdownEditing}>
                  <Iconfont unicode="&#xea48;" />
                  <span>{markdownEditing ? '精修完成' : '剧本精修'}</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default NovelToScriptPage
