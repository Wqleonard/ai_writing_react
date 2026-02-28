import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { debounce } from 'lodash-es'
import {
  batchDeleteWorkReq,
  createWorkReq,
  deleteWorkReq,
  getWorksByIdReq,
  getWorksListReq,
  updateWorkInfoReq,
} from '@/api/works'
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
import { useLLM } from '@/hooks/useLLM'
import { MyWorks } from './components/MyWorks'
import { AddNewWorkPopover } from './components/AddNewWorkPopover'
import { MessageDetailDialog } from './components/MessageDetailDialog'
import { ProChatContainer } from '@/components/ProChatContainer'
import { CreationInput, type CreationInputProps } from './components/CreationInput'
import type { MyWorkData, PageInfo, WorkItem, MessageDetail } from './types'
import { serverData2FileTreeData } from '@/utils/aiTreeNodeConverter'
import clsx from 'clsx'
import LOGO from '@/assets/images/logo.webp'
import DEFAULT_BOOM_CAT from '@/assets/images/my-place/default.gif'
import HOVER_BOOM_CAT from '@/assets/images/my-place/hover.gif'
import './my-place.css'

const PAGE_SIZE = 20

const convertWorkItemToMyWorkData = (item: WorkItem): MyWorkData => ({
  id: String(item.id),
  authorId: String(item.authorId),
  title: item.title,
  description: item.introduction || '',
  createdTime: item.createdTime,
  updatedTime: item.updatedTime,
  workVersions: [],
  sessions: [],
  workType: item.workType as MyWorkData['workType'],
  deleteChecked: false,
})

const isLoggedIn = () => !!localStorage.getItem('token')

const requireLogin = (callback: () => void | Promise<void>) => {
  if (!isLoggedIn()) {
    toast.error('请先登录')
    return
  }
  void callback()
}

export default function MyPlacePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSelectedWritingStyle, modelLLM, selectedWritingStyle } = useLLM()

  const [loading, setLoading] = useState(false)
  const [bannerConfig, setBannerConfig] = useState<{
    title: string
    icon: string
    btnText: string
    content: string
    canOpen?: boolean
  } | null>(null)
  const [showMessageDetailDialog, setShowMessageDetailDialog] = useState(false)
  const [messageDetail, setMessageDetail] = useState<MessageDetail | null>(null)
  const [currentTheme] = useState<'light' | 'dark' | 'eye-care'>('light')
  const [isCatHover, setIsCatHover] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [isAnswerOnly, setIsAnswerOnly] = useState(true)

  const [isBatchDelete, setIsBatchDelete] = useState(false)
  const [workList, setWorkList] = useState<MyWorkData[]>([])
  const [workListPageInfo, setWorkListPageInfo] = useState<PageInfo>({
    page: -1,
    pageSize: PAGE_SIZE,
    total: 0,
  })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const isFirstPageLoadRef = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const catHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateMyWorks = useCallback(async () => {
    setWorkListPageInfo((prev) => ({ ...prev, page: -1, total: 0 }))
    setWorkList([])
    setHasMore(true)
    const nextPage = 0
    setIsLoadingMore(true)
    try {
      const req: any = await getWorksListReq(nextPage, PAGE_SIZE)
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }
      const newWorks: WorkItem[] = Array.isArray(req.content) ? req.content : []
      if (req.totalElements !== undefined) {
        setWorkListPageInfo((prev) => ({ ...prev, total: req.totalElements }))
      }
      if (req.last === true) setHasMore(false)
      if (newWorks.length > 0) {
        const converted = newWorks.map(convertWorkItemToMyWorkData)
        setWorkList(converted)
        setWorkListPageInfo((prev) => ({ ...prev, page: nextPage }))
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [])

  const loadMoreWorks = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = workListPageInfo.page + 1
      const req: any = await getWorksListReq(nextPage, PAGE_SIZE)
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }
      const newWorks: WorkItem[] = Array.isArray(req.content) ? req.content : []
      if (req.totalElements !== undefined) {
        setWorkListPageInfo((prev) => ({ ...prev, total: req.totalElements }))
      }
      if (req.last === true) setHasMore(false)
      if (newWorks.length > 0) {
        const converted = newWorks.map(convertWorkItemToMyWorkData)
        setWorkList((prev) => [...prev, ...converted])
        setWorkListPageInfo((prev) => ({ ...prev, page: nextPage }))
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, workListPageInfo.page])

  const handleScroll = useCallback(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMoreWorks()
    }
  }, [loadMoreWorks])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleCreationSubmit = useCallback(
    async (text: string) => {
      const value = text.trim()
      if (!value) return
      if (!isLoggedIn()) {
        toast.error('请先登录')
        return
      }
      try {
        const req: any = await createWorkReq()
        if (req?.id) {
          sessionStorage.setItem(
            'editorInitialParams',
            JSON.stringify({
              message: value,
              modelLLM,
              selectedWritingStyle,
              isAnswerOnly,
            })
          )
          navigate(`/editor/${req.id}`)
        }
      } catch {
        toast.error('创建作品失败，请重试')
      }
    },
    [modelLLM, selectedWritingStyle, isAnswerOnly, navigate]
  )

  const onSubmitCreation = useMemo(
    () => debounce((text: string) => handleCreationSubmit(text), 300),
    [handleCreationSubmit]
  )

  const handleJump = useCallback(
    debounce(async (data: MyWorkData) => {
      if (!data.id) {
        toast.error('作品ID不存在，无法跳转')
        return
      }
      setLoading(true)
      try {
        const routeName =
          data.workType === 'doc'
            ? 'quick-editor-work'
            : data.workType === 'script'
              ? 'script-editor-work'
              : 'editor-work'
        navigate(`/editor/${data.id}`, { state: { workId: data.id } })
      } catch {
        toast.error('跳转失败，请重试')
      } finally {
        setLoading(false)
      }
    }, 1000, { leading: true, trailing: false }),
    [navigate]
  )

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false)

  const deleteWork = useCallback(async (workId: string) => {
    setDeleteTargetId(workId)
    setDeleteConfirmOpen(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return
    try {
      await deleteWorkReq(deleteTargetId)
      toast.success('删除成功')
      setDeleteConfirmOpen(false)
      setDeleteTargetId(null)
      await updateMyWorks()
    } catch {
      toast.error('删除失败')
    }
  }, [deleteTargetId, updateMyWorks])

  const batchDelete = useCallback((data: MyWorkData) => {
    setWorkList((prev) =>
      prev.map((w) => (w.id === data.id ? { ...w, deleteChecked: true } : { ...w, deleteChecked: false }))
    )
    setIsBatchDelete(true)
  }, [])

  const deleteCheckBox = useCallback((data: MyWorkData, checked: boolean) => {
    setWorkList((prev) =>
      prev.map((w) => (w.id === data.id ? { ...w, deleteChecked: checked } : w))
    )
  }, [])

  const cancelBatchDelete = useCallback(() => {
    setWorkList((prev) => prev.map((w) => ({ ...w, deleteChecked: false })))
    setIsBatchDelete(false)
  }, [])

  const doBatchDelete = useCallback(async () => {
    const deleteList = workList.filter((w) => w.deleteChecked).map((w) => w.id)
    if (deleteList.length === 0) return
    setBatchDeleteConfirmOpen(true)
  }, [workList])

  const confirmBatchDelete = useCallback(async () => {
    const deleteList = workList.filter((w) => w.deleteChecked).map((w) => w.id)
    if (deleteList.length === 0) {
      setBatchDeleteConfirmOpen(false)
      return
    }
    try {
      await batchDeleteWorkReq(deleteList)
      toast.success('删除成功')
      setBatchDeleteConfirmOpen(false)
      cancelBatchDelete()
      await updateMyWorks()
    } catch {
      toast.error('删除失败')
    }
  }, [workList, cancelBatchDelete, updateMyWorks])

  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<MyWorkData | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const renameWork = useCallback((data: MyWorkData) => {
    setRenameTarget(data)
    setRenameValue(data.title || '')
    setRenameDialogOpen(true)
  }, [])

  const confirmRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim() || renameValue.length > 50) return
    try {
      await updateWorkInfoReq(renameTarget.id, { title: renameValue.trim() })
      setRenameDialogOpen(false)
      setRenameTarget(null)
      await updateMyWorks()
    } catch {
      // ignore
    }
  }, [renameTarget, renameValue, updateMyWorks])

  const exportWord = useCallback(async (_workId: string) => {
    try {
      const req: any = await getWorksByIdReq(_workId)
      if (!req?.latestWorkVersion?.content) return
      const files = JSON.parse(req.latestWorkVersion.content)
      const workTitle = req.title
      const workNode = serverData2FileTreeData(files)
      workNode.key = workTitle
      workNode.id = workTitle
      workNode.label = workTitle
      // TODO: 接入 ExportUtils.exportWorkAsZipDoc 或 React 版导出
      toast.info('导出 Word 功能开发中')
    } catch {
      // ignore
    }
  }, [])

  const exportTxt = useCallback(async (_workId: string) => {
    try {
      const req: any = await getWorksByIdReq(_workId)
      if (!req?.latestWorkVersion?.content) return
      const files = JSON.parse(req.latestWorkVersion.content)
      const workTitle = req.title
      const workNode = serverData2FileTreeData(files)
      workNode.key = workTitle
      workNode.id = workTitle
      workNode.label = workTitle
      // TODO: 接入 ExportUtils.exportWorkAsZipTxt 或 React 版导出
      toast.info('导出 Txt 功能开发中')
    } catch {
      // ignore
    }
  }, [])

  const handleBannerClick = useCallback(() => {
    if (!bannerConfig?.canOpen) return
    setMessageDetail({
      id: 'banner',
      title: bannerConfig.title,
      content: bannerConfig.content,
      timestamp: '',
    })
    setShowMessageDetailDialog(true)
  }, [bannerConfig])

  const handleCatMouseEnter = useCallback(() => {
    if (catHoverTimerRef.current) {
      clearTimeout(catHoverTimerRef.current)
      catHoverTimerRef.current = null
    }
    setIsCatHover(true)
    catHoverTimerRef.current = setTimeout(() => {
      setIsCatHover(false)
      catHoverTimerRef.current = null
    }, 200)
  }, [])

  const handleCatMouseLeave = useCallback(() => {
    if (catHoverTimerRef.current) {
      clearTimeout(catHoverTimerRef.current)
      catHoverTimerRef.current = null
    }
    setIsCatHover(false)
  }, [])

  useEffect(() => {
    if (!isLoggedIn()) return
    // 避免在 React StrictMode 下初次挂载时重复请求列表
    if (!isFirstPageLoadRef.current) return
    isFirstPageLoadRef.current = false
    void updateMyWorks()
  }, [updateMyWorks])

  useEffect(() => {
    const state = location.state as { shouldAnimate?: boolean; newStyleId?: string } | null
    if (state?.shouldAnimate === true) {
      setShouldAnimate(true)
      if (state.newStyleId) {
        setSelectedWritingStyle(state.newStyleId)
      }
      const t = setTimeout(() => setShouldAnimate(false), 10000)
      return () => clearTimeout(t)
    }
  }, [location.state, setSelectedWritingStyle])

  useEffect(() => {
    return () => {
      if (catHoverTimerRef.current) {
        clearTimeout(catHoverTimerRef.current)
      }
    }
  }, [])

  return (
    <div ref={scrollRef} className="workspace-scrollbar h-full w-full">
      <ScrollArea className="h-full w-full">
        {loading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" />
        ) : null}
        <div className="workspace-container mx-auto flex h-full w-full max-w-[800px] flex-col font-['YaHei',sans-serif]">
          <header className="workspace-header">
            <div className="mb-17 mt-13">
              <div className="title-section relative flex flex-col items-center overflow-visible text-sm">
                {bannerConfig?.title && bannerConfig?.icon ? (
                  <div className="flex h-8 w-fit items-center gap-3 rounded-full bg-[#f9eece] px-2.5">
                    <div className="h-6 w-6">
                      <img src={bannerConfig.icon} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div>{bannerConfig.title}</div>
                    <div
                      className="group cursor-pointer"
                      onClick={handleBannerClick}
                    >
                      <span className="font-semibold text-[#ff9500] group-hover:opacity-80">
                        {bannerConfig.btnText}
                      </span>
                      <span className="iconfont ml-1 text-[#ff9500] group-hover:opacity-80">
                        &#xe642;
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 flex items-center justify-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full shadow-logo">
                    <img src={LOGO} alt="title" className="h-7 w-7 object-cover" />
                  </div>
                  <div className="text-[25px] font-bold text-black">爆文猫，写爆文</div>
                </div>
              </div>
            </div>
          </header>

          <main className="workspace-main w-full">
            {/* 创作输入区域 */}
            <section
              className={clsx(
                'creation-section relative flex flex-col rounded-lg',
                currentTheme
              )}
            >
              <ProChatContainer
                activeTab="chat"
                isHomePage={true}
                isAnswerOnly={isAnswerOnly}
                onAnswerOnlyChange={setIsAnswerOnly}
                onSubmit={onSubmitCreation}
              >
                <CreationInput {...({} as CreationInputProps)} />
              </ProChatContainer>
            </section>

            <section
              className={clsx(
                'works-section my-works mt-4 mb-4',
                currentTheme
              )}
            >
              <div className="section-header flex items-center justify-between">
                <div className="section-title">
                  <div className="works-section-title">我的作品</div>
                </div>
                {isBatchDelete ? (
                  <div className="flex gap-2">
                    <Button className='h-7 leading-7 text-sm! font-normal' variant="outline" onClick={cancelBatchDelete}>
                      退出
                    </Button>
                    <Button className='h-7 leading-7 text-sm! font-normal' onClick={doBatchDelete}>批量删除</Button>
                  </div>
                ) : null}
              </div>

              <div className="works-grid grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-4 pt-2">
                <AddNewWorkPopover from="Workspace" placement="bottom">
                  <div className="add-work flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-[#d9d9d9] text-[#c2c2c2] hover:shadow-md">
                    <span className="iconfont text-xl">&#xe60d;</span>
                    <div>创建新作品</div>
                  </div>
                </AddNewWorkPopover>
                {workList.map((work) => (
                  <MyWorks
                    key={work.id}
                    data={work}
                    batchDelete={isBatchDelete}
                    onJump={handleJump}
                    onDelete={deleteWork}
                    onRename={renameWork}
                    onExportWord={exportWord}
                    onExportTxt={exportTxt}
                    onBatchDelete={batchDelete}
                    onDeleteCheckbox={deleteCheckBox}
                  />
                ))}
                {isLoadingMore ? (
                  <div className="loading-more col-span-full py-5 text-center text-sm text-primary">
                    加载中...
                  </div>
                ) : null}
              </div>
            </section>
          </main>
        </div>

        {isLoggedIn() ? (
          <div
            className="fixed -bottom-4 right-28 h-24 w-24 cursor-pointer"
            onMouseEnter={handleCatMouseEnter}
            onMouseLeave={handleCatMouseLeave}
          >
            <img
              src={isCatHover ? HOVER_BOOM_CAT : DEFAULT_BOOM_CAT}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
      </ScrollArea>

      <MessageDetailDialog
        open={showMessageDetailDialog}
        onOpenChange={setShowMessageDetailDialog}
        message={messageDetail}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent showCloseButton className='w-100'>
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm">
            确定要删除这个作品吗？删除后将无法恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <DialogContent showCloseButton className='w-100'>
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm">
            确定要删除这些作品吗？删除后将无法恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmBatchDelete}>
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent showCloseButton className='w-100'>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="请输入，不得超过50个字符"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 50))}
              maxLength={50}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={confirmRename}
              disabled={!renameValue.trim() || renameValue.length > 50}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
