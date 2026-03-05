import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  getShareList,
  getMyShareList,
  deleteShare,
  type ShareListResponse,
} from '@/api/share'
import { useNavigation } from '@/hooks/useNavigation'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ShareCard } from './components/ShareCard'
import { MyShareCard } from './components/MyShareCard'
import type { ShareData } from './types'
import { useLoginStore } from "@/stores/loginStore";
import { trackEvent } from '@/matomo/trackingMatomoEvent'

const transformShareData = (item: {
  id: number
  title?: string
  coverImageUrl?: string
  content?: string
  username?: string
  likeCount?: number
  viewCount?: number
  createdTime?: string
  updatedTime?: string
  status?: string
}): ShareData => ({
  id: String(item.id),
  title: item.title ?? '',
  coverImageUrl: item.coverImageUrl ?? '',
  description: item.content ?? '',
  authorName: item.username ?? '',
  likeCount: item.likeCount ?? 0,
  viewCount: item.viewCount ?? 0,
  createdTime: item.createdTime ?? '',
  updatedTime: item.updatedTime ?? '',
  status: item.status ?? '',
})

const PAGE_SIZE = 12

const SharePage = () => {
  const [shares, setShares] = useState<ShareData[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { navigateTo } = useNavigation()

  const [myShareOpen, setMyShareOpen] = useState(false)
  const [myShares, setMyShares] = useState<ShareData[]>([])
  const [myShareCurrentPage, setMyShareCurrentPage] = useState(0)
  const [myShareHasMore, setMyShareHasMore] = useState(true)
  const [myShareLoading, setMyShareLoading] = useState(false)
  const myShareScrollRef = useRef<HTMLDivElement>(null)

  const showEmpty = !loading && shares.length === 0

  const handleCardClick = useCallback(
    (share: ShareData) => {
      trackEvent('Community', 'Click', 'Share', Number(share.id))
      if (!share?.id) {
        toast.warning('暂无详情')
        return
      }
      navigateTo(`/workspace/creation-community/share/details/${share.id}`)
    },
    [navigateTo]
  )

  const handleLike = useCallback((shareId: string) => {
    setShares((prev) => {
      const i = prev.findIndex((s) => s.id === shareId)
      if (i === -1) return prev
      const next = [...prev]
      next[i] = { ...next[i], likeCount: next[i].likeCount + 1 }
      return next
    })
  }, [])

  const handleDislike = useCallback((shareId: string) => {
    setShares((prev) => {
      const i = prev.findIndex((s) => s.id === shareId)
      if (i === -1) return prev
      const next = [...prev]
      next[i] = {
        ...next[i],
        dislikeCount: (next[i].dislikeCount ?? 0) + 1,
      }
      return next
    })
  }, [])

  const loadShares = useCallback(async (page: number, append: boolean) => {
    if (loading || (append && !hasMore)) return
    setLoading(true)
    try {
      const response = (await getShareList(page, PAGE_SIZE)) as ShareListResponse
      if (response?.content) {
        const list = response.content.map(transformShareData)
        if (append) {
          setShares((prev) => [...prev, ...list])
        } else {
          setShares(list)
        }
        setCurrentPage(response.number)
        setHasMore(!response.last)
      }
    } catch {
      toast.error('加载分享失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore])

  const onScroll = useCallback(() => {
    if (loading || !hasMore) return
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadShares(currentPage + 1, true)
    }
  }, [loading, hasMore, currentPage, loadShares])

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const completeNewbieMissionByCode = useLoginStore(s=>s.completeNewbieMissionByCode)

  useEffect(() => {
    loadShares(0, false)
    completeNewbieMissionByCode('USE_SHARE')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMyShares = useCallback(async (page: number, append: boolean) => {
    if (myShareLoading || (append && !myShareHasMore)) return
    setMyShareLoading(true)
    try {
      const response = (await getMyShareList(page, PAGE_SIZE)) as ShareListResponse
      if (response?.content) {
        const list = response.content.map(transformShareData)
        if (append) {
          setMyShares((prev) => [...prev, ...list])
        } else {
          setMyShares(list)
        }
        setMyShareCurrentPage(response.number)
        setMyShareHasMore(!response.last)
      }
    } catch {
      toast.error('加载我的分享失败，请稍后重试')
    } finally {
      setMyShareLoading(false)
    }
  }, [myShareLoading, myShareHasMore])

  const onMyShareScroll = useCallback(() => {
    if (myShareLoading || !myShareHasMore) return
    const viewport = myShareScrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMyShares(myShareCurrentPage + 1, true)
    }
  }, [myShareLoading, myShareHasMore, myShareCurrentPage, loadMyShares])

  useEffect(() => {
    if (!myShareOpen) return
    const viewport = myShareScrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    viewport.addEventListener('scroll', onMyShareScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onMyShareScroll)
  }, [myShareOpen, onMyShareScroll])

  const requireLogin = useLoginStore(s=>s.requireLogin)

  const openMyShare = useCallback(() => {
    setMyShareOpen(true)
    setMyShares([])
    setMyShareCurrentPage(0)
    setMyShareHasMore(true)
    loadMyShares(0, false)
  }, [loadMyShares])

  const createShare = useCallback(() => {
    trackEvent('Community', 'Create', 'Share')
    setMyShareOpen(false)
    navigateTo('/workspace/creation-community/share/create/new')
  }, [navigateTo])

  const handleMyShareClick = useCallback(() => {
    void requireLogin(openMyShare)
  }, [openMyShare, requireLogin])

  const handleCreateShare = useCallback(() => {
    void requireLogin(createShare)
  }, [createShare, requireLogin])

  const handleMyShareCardClick = useCallback(
    (share: ShareData) => {
      if (!share?.id) {
        toast.warning('暂无详情')
        return
      }
      setMyShareOpen(false)
      if (share.status === 'DRAFT') {
        navigateTo(`/workspace/creation-community/share/create/${share.id}`)
      } else {
        navigateTo(`/workspace/creation-community/share/details/${share.id}`)
      }
    },
    [navigateTo]
  )

  const handleDeleteShare = useCallback(
    async (shareId: string) => {
      if (!window.confirm('确定要删除这个分享吗？')) return
      try {
        await deleteShare(shareId)
        toast.success('删除成功')
        setMyShares([])
        setMyShareCurrentPage(0)
        setMyShareHasMore(true)
        await loadMyShares(0, false)
      } catch {
        toast.error('删除失败，请稍后重试')
      }
    },
    [loadMyShares]
  )

  const createCardData: ShareData = {
    id: 'create',
    title: '创建分享',
    coverImageUrl: '',
    description: '',
    authorName: '',
    likeCount: 0,
    viewCount: 0,
    createdTime: '',
    updatedTime: '',
    status: '',
    isCreateCard: true,
  }

  return (
    <div className="mx-auto flex h-full flex-col items-center px-2">
      <div className="flex w-265 shrink-0 items-center justify-between">
        <div className="text-2xl font-medium">创作分享</div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7.5 px-4 rounded-lg text-black"
            onClick={handleMyShareClick}
          >
            我的
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7 px-4 rounded-lg text-white"
            onClick={handleCreateShare}
          >
            创建
          </Button>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className="mx-auto mt-6 min-h-0 flex-1 w-full"
      >
        <ScrollArea className="h-full w-full">
          {showEmpty ? (
            <div className="flex w-full flex-col items-center justify-center py-12 text-gray-500">
              <p className="text-sm">暂无数据</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="mx-auto grid w-265 grid-cols-3 gap-4 pb-8">
                {shares.map((share) => (
                  <ShareCard
                    key={share.id}
                    data={share}
                    onClick={handleCardClick}
                    onLike={handleLike}
                    onDislike={handleDislike}
                  />
                ))}
              </div>
            </div>
          )}
          {loading && shares.length > 0 ? (
            <div className="py-4 text-center text-gray-500">加载中...</div>
          ) : null}
        </ScrollArea>
      </div>

      <Dialog open={myShareOpen} onOpenChange={setMyShareOpen}>
        <DialogContent className="max-w-[900px]" showCloseButton>
          <DialogTitle>我的分享</DialogTitle>
          <div ref={myShareScrollRef} className="h-[620px] w-full">
            <ScrollArea className="h-full w-full">
              {!myShareLoading && myShares.length === 0 ? (
                <div className="mt-[130px] flex w-full flex-col items-center justify-center text-gray-500">
                  <p className="text-sm">暂无分享数据</p>
                </div>
              ) : (
                <div className="w-full px-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={handleCreateShare}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleCreateShare()
                        }
                      }}
                    >
                      <MyShareCard data={createCardData} />
                    </div>
                    {myShares.map((share) => (
                      <MyShareCard
                        key={share.id}
                        data={share}
                        onClick={handleMyShareCardClick}
                        onDelete={handleDeleteShare}
                      />
                    ))}
                  </div>
                </div>
              )}
              {myShareLoading && myShares.length > 0 ? (
                <div className="py-4 text-center text-gray-500">
                  加载中...
                </div>
              ) : null}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SharePage
