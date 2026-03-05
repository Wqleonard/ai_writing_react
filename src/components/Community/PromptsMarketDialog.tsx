import { useCallback, useEffect, useRef, useState } from 'react'
import { addFavoritePrompt, cancelFavoritePrompt, getPublicPrompts } from '@/api/community-prompt'
import { PromptCard } from '@/pages/creation-community/prompt/components/PromptCard'
import { useOptionsStore } from '@/stores/optionsStore'
import type { PromptItem } from './types'
import { Dialog, DialogContent, DialogTitle, VisuallyHidden } from '@/components/ui/Dialog'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'

export interface PromptsMarketDialogProps {
  open: boolean
  onClose: () => void
  selectedCategory: string
  onSelectedCategoryChange: (id: string) => void
  onUse: (prompt: PromptItem | null) => void
}

const PAGE_SIZE = 20
const ALL_CATEGORY_VALUE = '__all__'

const MarketSkeletonCard = () => (
  <div className="h-[225px] w-full rounded-[10px] bg-[#f5f5f5] p-4">
    <div className="mb-3 flex gap-3">
      <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-20 w-full" />
  </div>
)

export const PromptsMarketDialog = ({
  open,
  onClose,
  selectedCategory,
  onSelectedCategoryChange,
  onUse,
}: PromptsMarketDialogProps) => {
  const selectCategoryValue = selectedCategory === '' ? ALL_CATEGORY_VALUE : selectedCategory

  const promptCategories = useOptionsStore(s => s.promptCategories)
  const updateCategories = useOptionsStore(s => s.updateCategories)
  const [promptsList, setPromptsList] = useState<PromptItem[]>([])
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadMorePrompts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const req: any = await getPublicPrompts(nextPage, PAGE_SIZE, 'updatedTime', selectedCategory || undefined)
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }

      const newPrompts: PromptItem[] = Array.isArray(req.content) ? req.content : []
      if (req.last === true) {
        setHasMore(false)
      }
      if (newPrompts.length > 0) {
        setPromptsList(prev => [...prev, ...newPrompts])
        setPage(nextPage)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('加载提示词列表失败:', error)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [hasMore, isLoadingMore, page, selectedCategory])

  const initExplorePrompts = useCallback(async () => {
    setPage(-1)
    setPromptsList([])
    setHasMore(true)
    setIsInitialLoading(true)
    try {
      const req: any = await getPublicPrompts(0, PAGE_SIZE, 'updatedTime', selectedCategory || undefined)
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }
      const list: PromptItem[] = Array.isArray(req.content) ? req.content : []
      setPromptsList(list)
      setPage(0)
      setHasMore(req.last !== true && list.length > 0)
    } catch (error) {
      console.error('初始化加载提示词列表失败:', error)
      setHasMore(false)
    } finally {
      setIsInitialLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    if (!open) return
    updateCategories()
    initExplorePrompts()
  }, [open, selectedCategory, updateCategories, initExplorePrompts])

  const onScroll = useCallback(() => {
    if (isLoadingMore || !hasMore || isInitialLoading) return
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMorePrompts()
    }
  }, [hasMore, isInitialLoading, isLoadingMore, loadMorePrompts])

  useEffect(() => {
    if (!open) return
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [onScroll, open])

  const handleFavoritePrompt = useCallback(async (data: PromptItem) => {
    const wasFavorited = data.isFavorited
    try {
      if (wasFavorited) await cancelFavoritePrompt(data.id)
      else await addFavoritePrompt(data.id)
      setPromptsList(prev =>
        prev.map(item =>
          item.id === data.id
            ? {
                ...item,
                isFavorited: !wasFavorited,
                favoritesCount: wasFavorited
                  ? Math.max(0, item.favoritesCount - 1)
                  : item.favoritesCount + 1,
              }
            : item
        )
      )
    } catch {
      // ignore
    }
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="min-h-[760px] w-[1020px] max-w-[90vw] bg-(--bg-editor) py-[30px] px-[60px] sm:max-w-[90vw]"
        showCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>提示词工具</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-5 shrink-0 text-2xl">提示词工具</div>
            <div className="w-30">
              <Select
                value={selectCategoryValue}
                onValueChange={value =>
                  onSelectedCategoryChange(value === ALL_CATEGORY_VALUE ? '' : value)
                }
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  {promptCategories.map(category => (
                    <SelectItem
                      key={String(category.value)}
                      value={category.value === '' ? ALL_CATEGORY_VALUE : String(category.value)}
                    >
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div ref={scrollRef} className="mt-4">
          <ScrollArea className="h-[580px]">
            <div className="grid grid-cols-3 gap-5 pb-6">
              {isInitialLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <MarketSkeletonCard key={`skeleton-${index}`} />
                ))
              ) : (
                <>
                  {promptsList.map(prompt => (
                    <PromptCard
                    data={prompt}
                    onUse={() => onUse(prompt)}
                    onFavorite={handleFavoritePrompt}
                    className='bg-[#f5f5f5]'
                  />
                  ))}
                  {isLoadingMore
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <MarketSkeletonCard key={`loading-skeleton-${index}`} />
                      ))
                    : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
