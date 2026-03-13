import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Iconfont } from '@/components/Iconfont'
import { cn } from '@/lib/utils'
import { getWorksByIdReq, getWorksListReq } from '@/api/works.ts'
import { serverData2FileTreeData } from '@/utils/aiTreeNodeConverter.ts'
import type { ConnectedFile, WorkItem } from './types'
import { FileTree, getCheckedNodesFromIds } from './FileTree'
import type { FileTreeNode } from "@/stores/editorStore";

const PAGE_SIZE = 20

const deduplicateAndFilterFiles = (files: FileTreeNode[]): FileTreeNode[] => {
  const seen = new Set<string>()
  const result: FileTreeNode[] = []
  const walk = (ns: FileTreeNode[]) => {
    for (const n of ns) {
      if (n.fileType === 'md') {
        if (!seen.has(n.id)) {
          seen.add(n.id)
          result.push(n)
        }
      }
      if (n.children?.length) walk(n.children)
    }
  }
  walk(files)
  return result
}

export interface SelectConnectedFileProps {
  value?: ConnectedFile
  onChange?: (value: ConnectedFile) => void
  className?: string
  placeholder?: string
  placement?: string
}

export const SelectConnectedFile = ({
  value,
  onChange,
  className,
  placeholder = '非必选项，选中后AI生成将参考关联文件内容',
}: SelectConnectedFileProps) => {
  const { workId: routeWorkId } = useParams<{ workId?: string }>()
  const currentWorkId = routeWorkId ?? null
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [workList, setWorkList] = useState<WorkItem[]>([])
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(value?.work ?? null)
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showTree, setShowTree] = useState(false)
  const [treeData, setTreeData] = useState<FileTreeNode[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set((value?.file ?? []).map(f => f.id))
  )
  const scrollRef = useRef<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value?.work) setSelectedWork(value.work)
    if (value?.file?.length) setCheckedIds(new Set(value.file.map(f => f.id)))
  }, [value?.work?.id, value?.file?.length])

  const loadMoreWorks = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const req: any = await getWorksListReq(nextPage, PAGE_SIZE)
      if (!req || typeof req !== 'object') {
        setHasMore(false)
        return
      }
      const newWorks: WorkItem[] = Array.isArray(req.content) ? req.content : []
      if (req.totalElements !== undefined) setHasMore(!req.last)
      if (newWorks.length > 0) {
        setWorkList(prev => [...prev, ...newWorks])
        setPage(nextPage)
      } else setHasMore(false)
    } catch (e) {
      console.error('加载作品列表失败:', e)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [page, isLoadingMore, hasMore])

  useEffect(() => {
    if (!open || showTree) return
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 50) loadMoreWorks()
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [open, showTree, loadMoreWorks])

  useEffect(() => {
    if (open) {
      setPage(-1)
      setWorkList([])
      setHasMore(true)
      if (value?.work && !selectedWork) setSelectedWork(value.work)
      if (value?.file?.length && checkedIds.size === 0)
        setCheckedIds(new Set(value.file.map(f => f.id)))
    }
  }, [open])

  useEffect(() => {
    if (open && !showTree && page === -1 && hasMore && !isLoadingMore) {
      loadMoreWorks()
    }
  }, [open, showTree, page, hasMore, isLoadingMore, loadMoreWorks])

  const handleWorkItemClick = useCallback(
    async (work: WorkItem) => {
      if (work.workType !== 'editor') return
      setSelectedWork(work)
      setCheckedIds(new Set())
      setShowTree(true)
      setLoading(true)
      try {
        const req: any = await getWorksByIdReq(String(work.id))
        const files = req?.latestWorkVersion?.content
        if (files) {
          const root = serverData2FileTreeData(JSON.parse(files))
          setTreeData(root?.children ?? [])
        }
        onChange?.({ work, file: [] })
      } finally {
        setLoading(false)
      }
    },
    [onChange]
  )

  const confirmFile = useCallback(() => {
    const nodes = getCheckedNodesFromIds(treeData, checkedIds, false)
    const filtered = deduplicateAndFilterFiles(nodes)
    const next: ConnectedFile = { work: selectedWork, file: filtered }
    onChange?.(next)
    setOpen(false)
  }, [selectedWork, treeData, checkedIds, onChange])

  const selectedWorkFiles = deduplicateAndFilterFiles(
    getCheckedNodesFromIds(treeData, checkedIds, false)
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={triggerRef}
          role="button"
          className={cn(
            'flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-[#dedede] px-3',
            className ?? ''
          )}
        >
          {!selectedWork || selectedWorkFiles.length === 0 ? (
            <>
              <div className="text-sm text-[#9a9a9a]">{placeholder}</div>
              <Iconfont
                unicode="&#xeaa5;"
                className={cn('text-base transition-transform duration-200', open && 'rotate-90')}
              />
            </>
          ) : (
            <>
              <div className="min-w-0 overflow-hidden text-ellipsis text-sm text-[#303133]">
                {selectedWork.title} 已选择 {selectedWorkFiles.length} 个文件
              </div>
              <Iconfont
                unicode="&#xeaa5;"
                className={cn('text-base transition-transform duration-200', open && 'rotate-90')}
              />
            </>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={12}
        className="[box-shadow:0_0_0.5rem_rgba(183,183,183,0.8)]! min-w-[280px] w-(--radix-popover-trigger-width) max-w-[min(var(--radix-popover-content-available-width),100vw)] p-2"
      >
        <div className="flex flex-col gap-1">
          {!showTree ? (
            <ScrollArea className="h-[260px] shrink-0">
              <div
                ref={el => {
                  scrollRef.current = el?.parentElement ?? null
                }}
                className="space-y-0"
                onPointerDown={() => scrollRef.current?.focus({ preventScroll: true })}
                onWheel={e => {
                  // 让浏览器默认处理滚动，但阻止事件冒泡
                  e.stopPropagation()
                }}
              >
                {workList.length === 0 && !isLoadingMore && (
                  <div className="py-10 text-center text-sm text-[#909399]">暂无作品</div>
                )}
                {workList.map(work => (
                  <div
                    key={work.id}
                    role={work.workType === 'editor' ? 'button' : undefined}
                    className={cn(
                      'flex h-[26px] cursor-default items-center justify-between rounded-lg px-2 leading-[26px]',
                      work.workType === 'editor' && 'cursor-pointer hover:bg-[#f1f1f1]'
                    )}
                    onClick={() => work.workType === 'editor' && handleWorkItemClick(work)}
                    onWheel={e => {
                      // 让浏览器默认处理滚动，但阻止事件冒泡
                      e.stopPropagation()
                    }}
                  >
                    {work.workType === 'editor' ? (
                      <>
                        <div className="truncate text-sm font-medium text-[#606266]">
                          {work.title}
                        </div>
                        {currentWorkId && String(work.id) === currentWorkId && (
                          <div className="text-xs text-[#909399]">当前</div>
                        )}
                      </>
                    ) : (
                      <div className="truncate text-sm font-medium text-[#c8c8c8]" title="快捷创作作品暂不支持添加">
                        {work.title}
                      </div>
                    )}
                  </div>
                ))}
                {isLoadingMore && (
                  <div className="py-3 text-center text-xs text-[#909399]">加载中...</div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <>
              <div
                role="button"
                className="cursor-pointer text-xs"
                onClick={() => setShowTree(false)}
              >
                <Iconfont unicode="&#xeaa2;" className="mr-1" />
                <span>上一步</span>
              </div>
              <ScrollArea className="h-[212px] shrink-0">
                {loading ? (
                  <div className="py-3 text-center text-xs text-[#909399]">加载中...</div>
                ) : (
                  <FileTree
                    data={treeData}
                    checkedIds={checkedIds}
                    onCheckedChange={setCheckedIds}
                  />
                )}
              </ScrollArea>
              <div className="mt-2 flex flex-row-reverse">
                <div
                  role="button"
                  className="cursor-pointer rounded px-2 py-1.5 text-xs text-white"
                  style={{ background: 'var(--theme-color, #409eff)' }}
                  onClick={confirmFile}
                >
                  确认
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
