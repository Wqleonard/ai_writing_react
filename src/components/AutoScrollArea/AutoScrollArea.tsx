import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { cn } from '@/lib/utils'

export interface AutoScrollAreaProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 最大高度，同 CSS max-height（数字为 px） */
  maxHeight?: string | number
  /** 是否启用自动滚动到底部 */
  autoScroll?: boolean
  /** 视为“在底部”的阈值（px） */
  bottomThreshold?: number
  children?: React.ReactNode
}

export interface ScrollInfo {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  distanceToBottom: number
  isAtBottom: boolean
}

export interface AutoScrollAreaRef {
  scrollToBottom: () => void
  scrollToTop: () => void
  resetScrollState: () => void
  checkAndAutoScroll: () => void
  getScrollInfo: () => ScrollInfo
  /** 容器根元素 */
  containerRef: HTMLDivElement | null
}

const AutoScrollArea = React.forwardRef<AutoScrollAreaRef, AutoScrollAreaProps>(
  (
    {
      maxHeight,
      autoScroll = true,
      bottomThreshold = 50,
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [userScrolledAway, setUserScrolledAway] = useState(false)
    const lastScrollTopRef = useRef(0)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const viewportRef = useRef<HTMLElement | null>(null)

    const getViewport = useCallback((): HTMLElement | null => {
      return containerRef.current?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null
    }, [])

    const isNearBottom = useCallback(
      (threshold = bottomThreshold): boolean => {
        const viewport = getViewport()
        if (!viewport) return false
        const { scrollTop, scrollHeight, clientHeight } = viewport
        return scrollHeight - scrollTop - clientHeight <= threshold
      },
      [getViewport, bottomThreshold]
    )

    const checkAndAutoScroll = useCallback(() => {
      if (!autoScroll || userScrolledAway) return
      const viewport = getViewport()
      if (!viewport) return
      viewport.scrollTop = viewport.scrollHeight
    }, [autoScroll, userScrolledAway, getViewport])

    const scrollToBottom = useCallback(() => {
      const viewport = getViewport()
      if (!viewport) return
      viewport.scrollTop = viewport.scrollHeight
      setUserScrolledAway(false)
    }, [getViewport])

    const scrollToTop = useCallback(() => {
      const viewport = getViewport()
      if (!viewport) return
      viewport.scrollTop = 0
    }, [getViewport])

    const resetScrollState = useCallback(() => {
      setUserScrolledAway(false)
      requestAnimationFrame(() => {
        const viewport = getViewport()
        if (viewport) viewport.scrollTop = viewport.scrollHeight
      })
    }, [getViewport])

    const getScrollInfo = useCallback((): ScrollInfo => {
      const viewport = getViewport()
      if (!viewport) {
        return {
          scrollTop: 0,
          scrollHeight: 0,
          clientHeight: 0,
          distanceToBottom: 0,
          isAtBottom: false,
        }
      }
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceToBottom = scrollHeight - scrollTop - clientHeight
      return {
        scrollTop,
        scrollHeight,
        clientHeight,
        distanceToBottom,
        isAtBottom: distanceToBottom < 2,
      }
    }, [getViewport])

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToBottom,
        scrollToTop,
        resetScrollState,
        checkAndAutoScroll,
        getScrollInfo,
        get containerRef() {
          return containerRef.current
        },
      }),
      [
        scrollToBottom,
        scrollToTop,
        resetScrollState,
        checkAndAutoScroll,
        getScrollInfo,
      ]
    )

    const handleScroll = useCallback(() => {
      const viewport = getViewport()
      if (!viewport) return
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceToBottom = scrollHeight - scrollTop - clientHeight
      if (distanceToBottom <= bottomThreshold) {
        setUserScrolledAway(false)
      } else if (Math.abs(scrollTop - lastScrollTopRef.current) > 0.5) {
        setUserScrolledAway(true)
      }
      lastScrollTopRef.current = scrollTop
    }, [getViewport, bottomThreshold])

    const handleWheel = useCallback(() => {
      // 仅当用户确实离开底部区域时，才停止自动滚动。
      // 否则在底部轻微滚轮/触控板滚动也会误触发“用户已上翻”。
      if (isNearBottom(bottomThreshold)) {
        setUserScrolledAway(false)
        return
      }
      setUserScrolledAway(true)
    }, [isNearBottom, bottomThreshold])

    useEffect(() => {
      if (!autoScroll) return
      resetScrollState()
    }, [autoScroll]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      const id = setTimeout(() => {
        const viewport = getViewport()
        const contentEl = contentRef.current
        if (!viewport || !contentEl) return
        viewportRef.current = viewport

        resizeObserverRef.current = new ResizeObserver(() => {
          checkAndAutoScroll()
        })
        resizeObserverRef.current.observe(contentEl)
        viewport.addEventListener('scroll', handleScroll, { passive: true })
        viewport.addEventListener('wheel', handleWheel, { passive: true })
        lastScrollTopRef.current = viewport.scrollTop
      }, 0)

      return () => {
        clearTimeout(id)
        const v = viewportRef.current
        if (v) {
          v.removeEventListener('scroll', handleScroll)
          v.removeEventListener('wheel', handleWheel)
          viewportRef.current = null
        }
        resizeObserverRef.current?.disconnect()
        resizeObserverRef.current = null
      }
    }, [getViewport, handleScroll, handleWheel, checkAndAutoScroll])

    const maxHeightStyle =
      typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight

    const containerStyle: React.CSSProperties = {
      ...(rest.style || {}),
    }

    // 未展开时：固定容器高度 = maxHeight，内部使用滚动
    if (maxHeightStyle && maxHeightStyle !== 'none') {
      containerStyle.maxHeight = maxHeightStyle
      containerStyle.height = maxHeightStyle
    } else if (maxHeightStyle === 'none') {
      // 展开态：恢复为自适应高度
      containerStyle.maxHeight = undefined
      containerStyle.height = 'auto'
    }

    return (
      <div
        ref={containerRef}
        className={cn('auto-scroll-area h-fit-content', className)}
        style={containerStyle}
        {...rest}
      >
        <ScrollArea className="h-full w-full" viewportClassName="overflow-x-hidden">
          <div ref={contentRef} className="min-h-full min-w-0 w-full max-w-full">
            {children}
          </div>
        </ScrollArea>
      </div>
    )
  }
)

AutoScrollArea.displayName = 'AutoScrollArea'

export { AutoScrollArea }
