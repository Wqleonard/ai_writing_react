import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import { Iconfont } from '@/components/Iconfont'
import { useLoginStore, selectHasUnreadMessages } from '@/stores/loginStore'
import type { Message } from '@/stores/loginStore'
import { MessageDetailDialog } from './MessageDetailDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip'

const REFRESH_INTERVAL_MS = 30 * 60 * 1000
const SCROLL_LOAD_THRESHOLD = 100

export const InsiteMessage = () => {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = useLoginStore((s) => s.messages)
  const hasUnreadMessages = useLoginStore(selectHasUnreadMessages)
  const isLoadingMessages = useLoginStore((s) => s.isLoadingMessages)
  const hasMoreMessages = useLoginStore((s) => s.hasMoreMessages)
  const isLoggedIn = useLoginStore((s) => s.isLoggedIn)
  const updateMessages = useLoginStore((s) => s.updateMessages)
  const loadMoreMessages = useLoginStore((s) => s.loadMoreMessages)
  const markMessageAsRead = useLoginStore((s) => s.markMessageAsRead)

  useEffect(() => {
    if (isLoggedIn) {
      updateMessages()
    }
  }, [isLoggedIn, updateMessages])

  useEffect(() => {
    if (!open || !isLoggedIn) return
    const timer = setInterval(() => {
      updateMessages()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [open, isLoggedIn, updateMessages])

  const handleScroll = useCallback(() => {
    if (isLoadingMessages || !hasMoreMessages) return
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < SCROLL_LOAD_THRESHOLD) {
      loadMoreMessages()
    }
  }, [isLoadingMessages, hasMoreMessages, loadMoreMessages])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport || !open) return
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [handleScroll, open])

  const handleViewDetail = (message: Message) => {
    setCurrentMessage(message)
    setOpen(false)
    setDetailOpen(true)
    if (!message.isReaded) {
      markMessageAsRead(message.id)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
          <div
            className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm hover:bg-[#e4e4e4]"
            role="button"
            tabIndex={0}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpen((v) => !v)
              }
            }}
          >
            <Iconfont unicode="&#xe64d;" />
            {hasUnreadMessages && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-red-500"
                aria-hidden
              />
            )}
          </div>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">
          站内消息
        </TooltipContent>
        </Tooltip>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="insite-message-popover w-[370px] translate-x-[-20px] rounded-[10px] p-0"
        >
          <div ref={scrollRef} className="py-2">
            <ScrollArea className="max-h-[552px]">
              <div className="flex flex-col px-8">
                {messages.map((message) => (
                  <div
                    key={String(message.id)}
                    className="flex border-b border-gray-200 py-5 last:border-b-0"
                  >
                    <div className="flex min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 truncate text-base font-semibold text-gray-700">
                          {message.title}
                        </div>
                        {!message.isReaded && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="truncate text-base text-gray-600">
                        {message.desc}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {message.timestamp}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-center">
                      <Button
                        variant="link"
                        className="text-base font-semibold"
                        onClick={() => handleViewDetail(message)}
                      >
                        查看详情
                      </Button>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && !isLoadingMessages && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    暂无消息
                  </div>
                )}
                {isLoadingMessages && messages.length > 0 && (
                  <div className="px-4 py-4 text-center text-sm text-gray-400">
                    加载中...
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <MessageDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        message={currentMessage}
      />
    </>
  )
}
