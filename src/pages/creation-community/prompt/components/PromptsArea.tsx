import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPublicPrompts,
  getMyPrompts,
  getFavoritesPrompts,
  addFavoritePrompt,
  cancelFavoritePrompt,
} from '@/api/community-prompt'
import { useOptionsStore } from '@/stores/optionsStore'
import type { PromptItem } from '@/components/Community/types'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import clsx from 'clsx'
import { PromptCard } from './PromptCard'
import { SORT_TYPE_OPTIONS } from '../types'
import EMPTY from '@/assets/images/empty.webp'
import { UsePrompts } from '@/components/Community/UsePrompts'
import { openAddNewPromptsDialog } from '@/components/Community/openAddNewPromptsDialog'
import { useLoginStore } from '@/stores/loginStore'
import { Iconfont } from '@/components/Iconfont'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import Empty from '@/components/ui/Empty'

const PAGE_SIZE = 12
const USE_PROMPT_DEBOUNCE_MS = 500

type TabType = 'public' | 'my' | 'favorite'

function useDebouncedCallback<T extends (...args: any[]) => any>(
  fn: T,
  wait: number,
  options: { leading: boolean; trailing: boolean }
) {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (options.leading && now - lastCallRef.current >= wait) {
        lastCallRef.current = now
        fn(...args)
        return
      }
      if (options.trailing) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null
          fn(...args)
        }, wait)
      }
    },
    [fn, wait, options.leading, options.trailing]
  )
}

const getPromptsApi = (type: TabType) => {
  switch (type) {
    case 'public':
      return getPublicPrompts
    case 'my':
      return getMyPrompts
    case 'favorite':
      return getFavoritesPrompts
    default:
      return getPublicPrompts
  }
}

export interface PromptsAreaProps {
  type: TabType
  emptyLabel: string
  showStatus?: boolean
  className?: string
}

export const PromptsArea = ({
  type,
  emptyLabel,
  showStatus = false,
  className,
}: PromptsAreaProps) => {
  const promptCategories = useOptionsStore(s => s.promptCategories)
  const [selectedCategory, setSelectedCategory] = useState<string | number>('')
  const [sortType, setSortType] = useState('updatedTime')
  const [promptList, setPromptList] = useState<PromptItem[]>([])
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [promptDetailDialogOpen, setPromptDetailDialogOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const requireLogin = useLoginStore(s => s.requireLogin)

  const showEmpty = !isLoadingMore && promptList.length === 0 && !hasMore

  const loadMorePrompts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    const api = getPromptsApi(type)
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const req: any = await api(nextPage, PAGE_SIZE, sortType, String(selectedCategory || ''))
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }
      const newPrompts: PromptItem[] = Array.isArray(req.content) ? req.content : []
      if (req.last === true) setHasMore(false)
      if (newPrompts.length > 0) {
        setPromptList(prev => [...prev, ...newPrompts])
        setPage(nextPage)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [type, page, sortType, selectedCategory, hasMore, isLoadingMore])

  const loadFirstPage = useCallback(async () => {
    setPromptList([])
    setHasMore(true)
    const api = getPromptsApi(type)
    setIsLoadingMore(true)
    try {
      const req: any = await api(0, PAGE_SIZE, sortType, String(selectedCategory || ''))
      const list: PromptItem[] = Array.isArray(req?.content) ? req.content : []
      setPromptList(list)
      setPage(0)
      setHasMore(req?.last !== true)
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [type, sortType, selectedCategory])

  useEffect(() => {
    loadFirstPage()
  }, [loadFirstPage])

  const onScroll = useCallback(() => {
    if (isLoadingMore || !hasMore) return
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMorePrompts()
    }
  }, [isLoadingMore, hasMore, loadMorePrompts])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const handleUsePromptInner = useCallback(
    (prompt: PromptItem) => {
      trackEvent('Community', 'Click', 'Prompt', Number(prompt.id))
      requireLogin(() => {
        setSelectedPrompt(prompt)
        setPromptDetailDialogOpen(true)
      })
    },
    [requireLogin]
  )

  const handleUsePrompt = useDebouncedCallback(handleUsePromptInner, USE_PROMPT_DEBOUNCE_MS, {
    leading: true,
    trailing: false,
  })

  const handleOpenCreateDialog = useCallback(() => {
    trackEvent('Community', 'Create', 'Prompt Workflow')
    requireLogin(() => {
      if (type === 'my') {
        openAddNewPromptsDialog(loadFirstPage)
      } else {
        openAddNewPromptsDialog()
      }
    })
  }, [requireLogin, loadFirstPage])

  const handleFavoritePrompt = useCallback(
    async (data: PromptItem) => {
      const wasFavorited = data.isFavorited
      try {
        if (wasFavorited) {
          await cancelFavoritePrompt(data.id)
          if (type === 'favorite') {
            setPromptList(prev => prev.filter(p => p.id !== data.id))
          } else {
            setPromptList(prev =>
              prev.map(p =>
                p.id === data.id
                  ? {
                      ...p,
                      isFavorited: false,
                      favoritesCount: Math.max(0, p.favoritesCount - 1),
                    }
                  : p
              )
            )
          }
        } else {
          await addFavoritePrompt(data.id)
          setPromptList(prev =>
            prev.map(p =>
              p.id === data.id
                ? {
                    ...p,
                    isFavorited: true,
                    favoritesCount: p.favoritesCount + 1,
                  }
                : p
            )
          )
        }
      } catch {
        // ignore
      }
    },
    [type]
  )

  return (
    <div className={clsx('prompts-area flex flex-1 flex-col items-center', className)}>
      <div className="prompts-area-top w-265 my-4 flex h-6 items-center justify-between">
        <div className="prompts-area-top-left flex items-center">
          <div className="radio-group-categories flex gap-1">
            {promptCategories.map(opt => (
              <div
                key={String(opt.value)}
                className={clsx(
                  'rounded mr-2 px-2 py-1 text-xs cursor-pointer',
                  selectedCategory === opt.value ? 'bg-[#f9eece]' : ''
                )}
                onClick={() => setSelectedCategory(opt.value)}
              >
                {opt.label}
              </div>
            ))}
          </div>
          <div className="page-categories-sort ml-4 flex items-center gap-2 text-xs">
            <span className="page-categories-sort-label shrink-0">排序:</span>
            <Select value={sortType} onValueChange={setSortType}>
              <SelectTrigger className="w-20 min-h-4 h-4 border-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="prompts-area-top-right flex items-center">
          <Button
            type="button"
            className="add-prompt-btn ml-2.5 h-7.5 rounded-[10px] text-black"
            onClick={handleOpenCreateDialog}
          >
            <Iconfont unicode="&#xe625;" className="text-sm!" />
            <span>创建</span>
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="page-content-scroll flex min-h-0 flex-1 w-full">
        <ScrollArea className="h-full w-full">
          {showEmpty ? (
            <div className="flex min-h-[500px] flex-col items-center justify-center py-16">
              <Empty description={emptyLabel} />
            </div>
          ) : (
            <div className="page-content mx-auto grid w-265 grid-cols-3 gap-5 pb-6">
              {promptList.map(prompt => (
                <PromptCard
                  key={prompt.id}
                  data={prompt}
                  showStatus={showStatus}
                  onUse={handleUsePrompt}
                  onFavorite={handleFavoritePrompt}
                />
              ))}
            </div>
          )}
          {isLoadingMore && promptList.length > 0 ? (
            <div className="loading-more py-5 text-center text-sm text-gray-500">加载中...</div>
          ) : null}
        </ScrollArea>
      </div>

      <UsePrompts
        open={promptDetailDialogOpen}
        onOpenChange={setPromptDetailDialogOpen}
        data={selectedPrompt}
      />
    </div>
  )
}
