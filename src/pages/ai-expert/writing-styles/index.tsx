import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  addWritingStyleHistory,
  getWritingStyleHistoryList,
  postWritingAnalysisStream,
  postWritingStyle,
  updateWritingStyleHistory,
} from '@/api/tools-square'
import type { PostStreamData } from '@/api'
import { getContentFromPartial } from '@/utils/getWorkFlowPartialData'
import { stripMarkdownAndTruncate } from '@/utils/stripMarkdown'
import { Upload } from '@/components/Upload'
import type { UploadFile } from '@/components/Upload'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { AutoScrollArea } from '@/components/AutoScrollArea'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { WritingStyleCard } from './components/WritingStyleCard'
import type { WritingStyleCardData } from './types'
import { useLLM } from '@/hooks/useLLM'
import clsx from 'clsx'
import './writing-styles.css'
import { Iconfont } from "@/components/Iconfont";
import { useLoginStore } from '@/stores/loginStore'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import Empty from '@/components/ui/Empty'

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
  type: 'user' | 'ai'
  content: string
  timestamp: number
  isStreaming?: boolean
  isAnalysis?: boolean
}

const WritingStylesPage = () => {
  const navigate = useNavigate()
  const { setSelectedWritingStyle } = useLLM()
  const [uploadedFile, setUploadedFile] = useState<UploadFile | null>(null)
  const [showUpload, setShowUpload] = useState(true)
  const [chatArr, setChatArr] = useState<ChatMessage[]>([])
  const [markdownContent, setMarkdownContent] = useState('')
  const [markdownEditing, setMarkdownEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showContentLoading, setShowContentLoading] = useState(false)
  const [isPostStream, setIsPostStream] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [historyId, setHistoryId] = useState('')
  const [historyList, setHistoryList] = useState<WritingStyleCardData[]>([])
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [styleName, setStyleName] = useState('')
  const [styleNameError, setStyleNameError] = useState('')
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [newAddStyleId, setNewAddStyleId] = useState('')
  const [newAddStyleName, setNewAddStyleName] = useState('')
  const historyIdRef = useRef('')
  const markdownContentRef = useRef('')
  const isPostStreamRef = useRef(false)

  const isLoggedIn = useLoginStore(s=>s.isLoggedIn)

  useEffect(() => {
    const next = chatArr
      .filter((chat) => chat.type === 'ai')
      .map((item) => item.content)
      .join('\n\n')
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
      await updateWritingStyleHistory(latestMarkdownContent, currentHistoryId)
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
      const list = await getWritingStyleHistoryList()
      if (Array.isArray(list)) {
        setHistoryList(
          list.map((item: any, index: number) => {
            const content = item?.writingAnalyzeResult || '暂无内容'
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

  const completeNewbieMissionByCode = useLoginStore(s=>s.completeNewbieMissionByCode)

  useEffect(()=>{
    trackEvent('Dashboard', 'Click', 'Style Analysis')
  },[])

  useEffect(() => {
    (async () => {
      if (!isLoggedIn) return
      fetchHistoryList()
      await completeNewbieMissionByCode('USE_WRITING_STYLE')
    })()
  }, [completeNewbieMissionByCode, fetchHistoryList, isLoggedIn])


  const onStreamData = useCallback((data: PostStreamData) => {
    switch (data.event) {
      case 'messages/partial': {
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) return
        const dataId = (data.data as any[])[0]?.id
        const content = getContentFromPartial(data.data)
        if (!content) return
        setLoading(false)
        setShowContentLoading(false)
        setChatArr((prev) => {
          const existingIndex = prev.findIndex((msg) => msg.id === dataId)
          if (existingIndex === -1) {
            return [
              ...prev,
              {
                id: dataId ?? `ai_${Date.now()}`,
                type: 'ai' as const,
                content,
                timestamp: Date.now(),
                isStreaming: true,
                isAnalysis: true,
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
            safety.final_output || '抱歉，文件存在敏感信息，我无法进行文风提炼'
          setChatArr((prev) => [
            ...prev,
            {
              id: `error_${Date.now()}`,
              type: 'ai' as const,
              content: errorMessage,
              timestamp: Date.now(),
              isStreaming: false,
              isAnalysis: true,
            },
          ])
          setHasError(true)
          setIsPostStream(false)
          setShowContentLoading(false)
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
        break
      default:
        break
    }
  }, [])

  const onStreamError = useCallback((error: Error) => {
    console.error(error)
    setShowContentLoading(false)
  }, [])

  const onStreamEnd = useCallback(async () => {
    setIsPostStream(false)
    setLoading(false)
    setShowContentLoading(false)
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
    trackEvent('Dashboard', 'Generate', 'Style Analysis')
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
    setShowContentLoading(true)

    try {
      const hid: any = await addWritingStyleHistory(uploadedFile.name || '')
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
        setShowContentLoading(false)
        return
      }
      setIsPostStream(true)
      await postWritingAnalysisStream(content, onStreamData, onStreamError, onStreamEnd)
    } catch (e) {
      setLoading(false)
      setIsPostStream(false)
      setShowContentLoading(false)
      const msg = e instanceof Error ? e.message : '文件读取失败，请重试'
      setChatArr((prev) => [
        ...prev,
        {
          id: `ai_error_${Date.now()}`,
          type: 'ai' as const,
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
    setShowContentLoading(false)
  }, [])

  const handleMarkdownEditing = useCallback(() => {
    setMarkdownEditing((prev) => !prev)
  }, [])

  const handleHistoryCardClick = useCallback((item: WritingStyleCardData) => {
    setShowUpload(false)
    setMarkdownEditing(false)
    setShowContentLoading(false)
    setChatArr([
      {
        id: `history_${Date.now()}`,
        type: 'ai' as const,
        content: item.content,
        timestamp: Date.now(),
      },
    ])
  }, [])

  const openNameDialog = useCallback(() => {
    trackEvent('Dashboard', 'Use', 'Style Analysis')
    setStyleName('')
    setStyleNameError('')
    setNameDialogOpen(true)
  }, [])

  const validateAndAddStyle = useCallback(async () => {
    const name = styleName.trim()
    if (!name) {
      setStyleNameError('请输入文风名称')
      return
    }
    if (name.length > 6) {
      setStyleNameError('不得超过6个字符')
      return
    }
    setStyleNameError('')
    setNameDialogOpen(false)
    try {
      const req: any = await postWritingStyle({ name, content: markdownContent })
      const id = req?.id
      if (!id) {
        toast.warning('文风添加失败，请稍后再试')
        return
      }
      setNewAddStyleId(String(id))
      setNewAddStyleName(name)
      setSuccessDialogOpen(true)
    } catch {
      toast.warning('文风添加失败，请稍后再试')
    }
  }, [styleName, markdownContent])

  const handleSuccessConfirm = useCallback(() => {
    setSuccessDialogOpen(false)
    setSelectedWritingStyle(newAddStyleId)
    navigate('/workspace/my-place', {
      state: { shouldAnimate: true, newStyleId: newAddStyleId, showWritingStylePop: true },
    })
  }, [newAddStyleId, setSelectedWritingStyle, navigate])

  if (showUpload) {
    return (
      <div className="flex h-full w-full">
        <ScrollArea className="h-full w-full">
          <div className="mx-auto flex w-200 flex-col items-center">
            <div className="mt-20 flex flex-col items-center">
              <div className="truncate tracking-widest text-[50px] font-bold text-primary">
                文风提炼
              </div>
              <div className="mt-1.5 text-xl text-secondary">
                添加文章或选段示例,自动提炼写作风格
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
              <Iconfont unicode="&#xea91;"/>
              <span>开始提炼</span>
            </Button>
            <div className="mt-5 w-full">
              <div
                className="sticky top-0 z-10 flex h-10 w-full items-center justify-between bg-[#f3f3f3] pb-2">
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
          文风提炼
          {uploadedFile?.name ? ':' + uploadedFile.name.replace(/\.[^.]*$/, '') : ''}
        </div>
        <div className="mt-1.5 text-base text-secondary">
          添加文章或选段示例,自动提炼写作风格
        </div>
      </div>
      <div className="mt-5 flex min-h-0 flex-1 flex-col px-5">
        <AutoScrollArea
          className={clsx(
            'writing-styles-auto-scroll relative flex-1 min-h-0',
            markdownEditing && 'show-border'
          )}
          maxHeight="100%"
          autoScroll
          bottomThreshold={50}
        >
          <div className="mx-auto w-200">
            {showContentLoading ? (
              <div className="mb-2 inline-flex items-center gap-2 text-sm text-secondary">
                <Spinner className="size-4 animate-spin" />
                <span>生成中...</span>
              </div>
            ) : null}
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
                <Iconfont unicode='&#xe613;'/>
                <span>返回上传</span>
              </Button>
              {!hasError && (
                <Button className="h-8 text-white" onClick={handleMarkdownEditing}>
                  <Iconfont unicode='&#xea48;'/>
                  <span>{markdownEditing ? '编辑完成' : '编辑文本'}</span>
                </Button>
              )}
              {!hasError && (
                <Button className="h-8 text-white" onClick={openNameDialog}>
                  <Iconfont unicode='&#xe643;'/>
                  <span>添加文风</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent showCloseButton className="w-100">
          <DialogHeader>
            <DialogTitle>给文风起个名字</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="请输入，不得超过6个字符"
              value={styleName}
              onChange={(e) => {
                setStyleName(e.target.value)
                setStyleNameError('')
              }}
              maxLength={6}
              className={styleNameError ? 'border-destructive' : ''}
            />
            {styleNameError ? (
              <p className="mt-1 text-sm text-destructive">{styleNameError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={validateAndAddStyle}
              disabled={!styleName.trim() || styleName.trim().length > 6}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent showCloseButton className="w-100">
          <DialogHeader>
            <DialogTitle>创建成功！</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm">
            您已创建<span className="text-theme">{newAddStyleName}</span>
            文风，前往我的空间开始创作吧
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessDialogOpen(false)}>
              暂不前往
            </Button>
            <Button onClick={handleSuccessConfirm}>开始创作</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WritingStylesPage
