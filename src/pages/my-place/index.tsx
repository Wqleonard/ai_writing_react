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
  deleteWorkReq, exportRecordReq,
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
import { useChatInputStore } from '@/stores/chatInputStore'
import { MyWorks } from './components/MyWorks'
import { AddNewWorkPopover } from '@/components/AddNewWorkPopover'
import { MessageDetailDialog } from './components/MessageDetailDialog'
import { ProChatContainer } from '@/components/ProChatContainer'
import { CreationInput, type CreationInputProps } from './components/CreationInput'
import type { MyWorkData, PageInfo, WorkItem, MessageDetail } from './types'
import { serverData2FileTreeData } from '@/utils/aiTreeNodeConverter'
import clsx from 'clsx'
import LOGO from '@/assets/images/logo.webp'
import './my-place.css'
import { useLoginStore } from "@/stores/loginStore";
import { ExportUtils } from "@/utils/exportUtils.ts";
import type { FileTreeNode } from "@/stores/editorStore";
import { useOptionsStore } from "@/stores/optionsStore";

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
  wordNum: item.wordNum,
})

export default function MyPlacePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setSelectedWritingStyle, modelLLM, selectedWritingStyle } = useLLM()
  const clearSelectedNotes = useChatInputStore((s) => s.clearSelectedNotes)
  const clearSelectedFiles = useChatInputStore((s) => s.clearSelectedFiles)
  const requestOpenWritingStylePopover = useChatInputStore((s) => s.requestOpenWritingStylePopover)

  const [loading, setLoading] = useState(false)
  const bannerConfig = useOptionsStore(s => s.bannerConfig)

  const [showMessageDetailDialog, setShowMessageDetailDialog] = useState(false)
  const [messageDetail, setMessageDetail] = useState<MessageDetail | null>(null)
  const [currentTheme] = useState<'light' | 'dark' | 'eye-care'>('light')
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = useLoginStore(s => s.isLoggedIn)
  const requireLogin = useLoginStore(s => s.requireLogin)

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
      try {
        const selectedSnapshot = useChatInputStore.getState()
        // 先触发创建作品请求，再清空当前输入区已选附件/笔记
        const reqPromise = createWorkReq()
        clearSelectedNotes()
        clearSelectedFiles()
        const req: any = await reqPromise
        if (req?.id) {
          sessionStorage.setItem(
            'editorInitialParams',
            JSON.stringify({
              message: value,
              modelLLM,
              selectedWritingStyle,
              skipRecommendDialog: true,
              isAnswerOnly,
              associationTags: selectedSnapshot.associationTags,
              selectedNotes: selectedSnapshot.selectedNotes,
              selectedFiles: selectedSnapshot.selectedFiles,
              selectedTexts: selectedSnapshot.selectedTexts,
              selectedTools: selectedSnapshot.selectedTools,
              isShowAnswerTip: selectedSnapshot.isShowAnswerTip,
            })
          )
          navigate(`/editor/${req.id}`, { state: { skipRecommendDialog: true } })
        }
      } catch {
        toast.error('创建作品失败，请重试')
      }
    },
    [
      modelLLM,
      selectedWritingStyle,
      isAnswerOnly,
      clearSelectedNotes,
      clearSelectedFiles,
      navigate,
    ]
  )

  const onSubmitCreationCallbackRef = useRef<(text: string) => void>(() => {
  })
  useEffect(() => {
    onSubmitCreationCallbackRef.current = (text: string) => {
      requireLogin(async () => {
        await handleCreationSubmit(text)
      })
    }
  }, [requireLogin, handleCreationSubmit])

  const onSubmitCreation = useRef(
    debounce((text: string) => {
      onSubmitCreationCallbackRef.current(text)
    }, 2000, { leading: true, trailing: false })
  ).current

  const handleJumpCallbackRef = useRef<(data: MyWorkData) => Promise<void>>(async () => {})

  useEffect(() => {
    handleJumpCallbackRef.current = async (data: MyWorkData) => {
      if (!data.id) {
        toast.error('作品ID不存在，无法跳转')
        return
      }
      let path = `/editor/${data.id}`
      if (data.workType == 'editor'){
        path = `/editor/${data.id}`
      } else if (data.workType == 'doc'){
        path = `/quick-editor/${data.id}`
      } else if (data.workType == 'script'){
        path = `/script-editor/${data.id}`
      }
      setLoading(true)
      try {
        navigate(path)
      } catch {
        toast.error('跳转失败，请重试')
      } finally {
        setLoading(false)
      }
    }
  }, [navigate])

  const handleJump = useRef(
    debounce((data: MyWorkData) => {
      handleJumpCallbackRef.current(data)
    }, 1000, { leading: true, trailing: false })
  ).current

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
      await ExportUtils.exportWorkAsZipDoc(workNode)
      await exportRecordReq()
    } catch {
      toast.error('导出失败，请稍后重试')
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
      await ExportUtils.exportWorkAsZipTxt(workNode)
      await exportRecordReq()
    } catch {
      toast.error('导出失败，请稍后重试')
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

  useEffect(() => {
    if (!isLoggedIn) return
    updateMyWorks()
  }, [updateMyWorks, isLoggedIn])

  useEffect(() => {
    const state = location.state as
      | { shouldAnimate?: boolean; newStyleId?: string; showWritingStylePop?: boolean }
      | null
    if (!state) return

    if (state?.shouldAnimate === true && state.newStyleId) {
      setSelectedWritingStyle(state.newStyleId)
    }

    // 与 Vue 行为对齐：创建文风后跳转到 my-place，自动打开文风弹窗、关闭仅回答、选中新文风
    if (state?.showWritingStylePop === true && state.newStyleId) {
      setIsAnswerOnly(false)
      setSelectedWritingStyle(state.newStyleId)
      // 触发 QuillChatInput 打开文风选择弹窗
      requestOpenWritingStylePopover(state.newStyleId)
      // 清掉 state，避免刷新/重渲染重复触发
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [
    location.state,
    location.pathname,
    navigate,
    requestOpenWritingStylePopover,
    setSelectedWritingStyle,
  ])


  const Banner = () => {
    return (
      <div
        className="h-8 w-fit bg-[#f9eece] rounded-full flex items-center px-2.5 gap-3"
        v-if="bannerConfig.title && bannerConfig.icon"
      >
        <div className="w-6 h-6">
          <img src={bannerConfig.icon} alt="" className="w-full h-full object-cover"/>
        </div>
        <div>
          {bannerConfig.title}
        </div>
        <div className="cursor-pointer group" onClick={handleBannerClick}>
        <span className="text-[#ff9500] font-semibold group-hover:opacity-80">
          {bannerConfig.btnText}
        </span>
          <span className="ml-1 iconfont text-[#ff9500] group-hover:opacity-80">&#xe642;</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="workspace-scrollbar h-full w-full">
      <ScrollArea className="h-full w-full">
        {loading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"/>
        ) : null}
        <div
          className="mx-auto flex h-full w-200 flex-col font-['YaHei',sans-serif]">
          <header className="workspace-header">
            <div className="mb-17 mt-13">
              <div className="title-section relative flex flex-col items-center overflow-visible text-sm">
                {bannerConfig?.title && bannerConfig?.icon ? (
                  <Banner />
                ) : null}
                <div className="mt-4 flex items-center justify-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full shadow-logo">
                    <img src={LOGO} alt="title" className="h-7 w-7 object-cover"/>
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
                'creation-section relative flex flex-col rounded-lg w-[calc(100%+2rem)] -ml-4',
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
                    <Button
                      className='h-7 leading-7 text-sm! font-normal' variant="outline"
                      onClick={cancelBatchDelete}
                    >
                      退出
                    </Button>
                    <Button className='h-7 leading-7 text-sm! font-normal' onClick={doBatchDelete}>批量删除</Button>
                  </div>
                ) : null}
              </div>

              <div className="works-grid grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-4 pt-2">
                <AddNewWorkPopover side="top" align='end' offset={-50}>
                  <div
                    className="add-work flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-[#d9d9d9] text-[#c2c2c2] hover:shadow-md">
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
                  <div className="col-span-full py-5 text-center text-sm text-(--theme-color)">
                    加载中...
                  </div>
                ) : null}
              </div>
            </section>
          </main>
        </div>

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
