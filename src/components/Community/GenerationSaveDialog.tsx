import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getWorksByIdReq, getWorksListReq } from '../../api/works'
import { serverData2FileTreeData } from '../../utils/aiTreeNodeConverter'
import type { FileTreeNode } from '../../utils/aiTreeNodeConverter'
import type { WorkItem } from './types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Iconfont } from '@/components/IconFont'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

export interface PathNode {
  id: string
  key: string
  label: string
  path: string[]
  children: PathNode[]
}

const DEFAULT_PATH_TREE: PathNode[] = [
  {
    id: '未命名作品',
    key: '未命名作品',
    label: '未命名作品',
    path: ['未命名作品'],
    children: [
      {
        id: '未命名作品/正文',
        key: '未命名作品-正文',
        label: '正文',
        path: ['未命名作品', '正文'],
        children: [],
      },
      {
        id: '未命名作品/知识库',

        key: '未命名作品-知识库',
        label: '知识库',
        path: ['未命名作品', '知识库'],
        children: [],
      },
    ],
  },
]

function findNodeById(nodes: PathNode[], targetId: string): PathNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

function findParentNode(
  nodes: PathNode[],
  targetId: string,
  parent: PathNode | null = null
): PathNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return parent
    if (node.children?.length) {
      const found = findParentNode(node.children, targetId, node)
      if (found !== null) return found
    }
  }
  return null
}

function getUniqueFolderName(
  parentNode: PathNode,
  baseName: string,
  excludeNodeId?: string
): string {
  const children = parentNode.children ?? []
  const existing = new Set(children.filter(c => c.id !== excludeNodeId).map(c => c.label))
  if (!existing.has(baseName)) return baseName
  let n = 1
  while (existing.has(`${baseName}(${n})`)) n++
  return `${baseName}(${n})`
}

function addChildToTree(nodes: PathNode[], parentId: string, newNode: PathNode): PathNode[] {
  return nodes.map(node => {
    if (node.id !== parentId) {
      return {
        ...node,
        children: addChildToTree(node.children, parentId, newNode),
      }
    }
    return {
      ...node,
      children: [...(node.children ?? []), newNode],
    }
  })
}

interface PathTreeRowProps {
  node: PathNode
  depth: number
  onSelectNode?: (id: string) => void
  expandedIds: Set<string>
  selectedPath: string | null
  editingNodeId: string | null
  editingNodeLabel: string
  editingInputRef: React.RefObject<HTMLInputElement | null>
  onToggleExpand: (id: string) => void
  onSelectPath: (id: string) => void
  onEditingLabelChange: (value: string) => void
  onPathInputBlur: (nodeId: string) => void
  onPathInputKeyDown: (nodeId: string, e: React.KeyboardEvent) => void
  onSaveNode: (nodeId: string) => void
  onAppend: (node: PathNode) => void
}

const PathTreeRow = ({
  node,
  depth,
  onSelectNode,
  expandedIds,
  selectedPath,
  editingNodeId,
  editingNodeLabel,
  editingInputRef,
  onToggleExpand,
  onSelectPath,
  onEditingLabelChange,
  onPathInputBlur,
  onPathInputKeyDown,
  onSaveNode,
  onAppend,
}: PathTreeRowProps) => {
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedPath === node.id
  const isEditing = editingNodeId === node.id
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    if (!isEditing) {
      hasInitializedRef.current = false
    }
  }, [isEditing])

  return (
    <div className="min-w-0 flex flex-col">
      <div
        className={cn(
          'group flex h-8 items-center gap-1 rounded-md px-1.5 text-sm',
          isSelected && 'bg-accent text-accent-foreground'
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? '折叠' : '展开'}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-none bg-transparent p-0 text-muted-foreground hover:text-foreground"
            onClick={e => {
              e.stopPropagation()
              onToggleExpand(node.id)
            }}
          >
            {isExpanded ? '−' : '+'}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          <Iconfont unicode="&#xe620;" className="text-sm" />
        </span>
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <input
              ref={el => {
                ;(editingInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
                if (el && editingNodeId === node.id && !hasInitializedRef.current) {
                  hasInitializedRef.current = true
                  requestAnimationFrame(() => {
                    el.focus()
                    el.setSelectionRange(0, el.value.length)
                  })
                }
              }}
              value={editingNodeLabel}
              onChange={e => onEditingLabelChange(e.target.value)}
              onBlur={() => onPathInputBlur(node.id)}
              onKeyDown={e => {
                e.stopPropagation()
                onPathInputKeyDown(node.id, e)
              }}
              onClick={e => e.stopPropagation()}
              className="border-input h-6 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:bg-[#959595]"
              onClick={e => {
                e.stopPropagation()
                onSaveNode(node.id)
              }}
            >
              <Iconfont unicode="&#xe610;" className="text-xs" />
            </Button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center truncate text-left"
              onClick={e => {
                e.stopPropagation()
                onSelectPath(node.id)
                onSelectNode?.(node.id)
              }}
            >
              <span className="truncate">{node.label}</span>
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm hover:bg-[#959595]"
              onClick={e => {
                e.stopPropagation()
                onAppend(node)
              }}
              aria-label="新建子目录"
            >
              +
            </Button>
          </>
        )}
      </div>
      {hasChildren &&
        isExpanded &&
        node.children!.map(child => (
          <PathTreeRow
            key={child.key}
            node={child}
            depth={depth + 1}
            onSelectNode={onSelectNode}
            expandedIds={expandedIds}
            selectedPath={selectedPath}
            editingNodeId={editingNodeId}
            editingNodeLabel={editingNodeLabel}
            editingInputRef={editingInputRef}
            onToggleExpand={onToggleExpand}
            onSelectPath={onSelectPath}
            onEditingLabelChange={onEditingLabelChange}
            onPathInputBlur={onPathInputBlur}
            onPathInputKeyDown={onPathInputKeyDown}
            onSaveNode={onSaveNode}
            onAppend={onAppend}
          />
        ))}
    </div>
  )
}

export interface GenerationSaveDialogProps {
  open: boolean
  onClose: () => void
  onConfirm?: (result: {
    fileName: string
    workType: 'new' | 'old'
    selectedWork: WorkItem | null
    selectedPath: string | null
  }) => void
  onCancel?: () => void
  fileNameDefault?: string
  fileNamePlaceholder?: string
  currentWorkId?: string
}

export const GenerationSaveDialog = ({
  open,
  onClose,
  onConfirm,
  onCancel,
  fileNameDefault = '新建文件（来自生成器）',
  fileNamePlaceholder = '请输入文件名',
  currentWorkId,
}: GenerationSaveDialogProps) => {
  const [fileName, setFileName] = useState(fileNameDefault)
  const [workType, setWorkType] = useState<'new' | 'old'>('new')
  const [workList, setWorkList] = useState<WorkItem[]>([])
  const [selectedWork, setSelectedWork] = useState<WorkItem | null>(null)
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [pathTreeData, setPathTreeData] = useState<PathNode[]>(() =>
    JSON.parse(JSON.stringify(DEFAULT_PATH_TREE))
  )
  const [selectedPath, setSelectedPath] = useState<string | null>('未命名作品/正文')
  const [showInputWarning, setShowInputWarning] = useState(false)
  const [showWorkWarning, setShowWorkWarning] = useState(false)
  const [showPathWarning, setShowPathWarning] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingNodeLabel, setEditingNodeLabel] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const all = new Set<string>()
    function collect(nodes: PathNode[]) {
      for (const n of nodes) {
        all.add(n.id)
        if (n.children?.length) collect(n.children)
      }
    }
    collect(DEFAULT_PATH_TREE)
    return all
  })
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const [pathSelectOpen, setPathSelectOpen] = useState(false)

  useEffect(() => {
    if (open) setFileName(fileNameDefault)
  }, [open, fileNameDefault])

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
      if (req.last === true) setHasMore(false)
      if (newWorks.length > 0) {
        setWorkList(prev => [...prev, ...newWorks])
        setPage(nextPage)
      } else setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [page, isLoadingMore, hasMore])

  useEffect(() => {
    if (open) {
      setPage(-1)
      setWorkList([])
      setHasMore(true)
    }
  }, [open])

  useEffect(() => {
    if (open && page === -1 && hasMore && !isLoadingMore) loadMoreWorks()
  }, [open, page, hasMore, isLoadingMore, loadMoreWorks])

  const collectAllIds = useCallback((nodes: PathNode[]): Set<string> => {
    const set = new Set<string>()
    function walk(ns: PathNode[]) {
      for (const n of ns) {
        set.add(n.id)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(nodes)
    return set
  }, [])

  const handleWorkSelect = useCallback(
    (value: string) => {
      const work = workList.find(w => String(w.id) === value)
      if (!work || work.workType === 'doc') return
      setSelectedWork(work)
      setShowWorkWarning(false)
      ;(async () => {
        try {
          const req: any = await getWorksByIdReq(String(work.id))
          const files = req?.latestWorkVersion?.content
          if (files) {
            const root = serverData2FileTreeData(JSON.parse(files))
            const children = root?.children ?? []
            const mapPath = (ns: FileTreeNode[], prefix: string, keyPrefix: string): PathNode[] =>
              ns
                .filter(n => n.isDirectory)
                .map(n => {
                  const nodeId = `${prefix}/${n.key}`
                  const nodeKey = `${keyPrefix}-${n.key}`
                  return {
                    id: nodeId,
                    key: nodeKey,
                    label: n.label,
                    path: [...n.path, n.label],
                    children: mapPath(n.children ?? [], nodeId, nodeKey),
                  }
                })
            const newTree: PathNode[] = [
              {
                id: work.title,
                key: work.title,
                label: work.title,
                path: [work.title],
                children: mapPath(children, work.title, work.title),
              },
            ]
            setPathTreeData(newTree)
            setExpandedIds(collectAllIds(newTree))
          }
        } catch {}
      })()
    },
    [workList, collectAllIds]
  )

  const handleWorkTypeChange = (type: 'new' | 'old') => {
    setWorkType(type)
    setSelectedPath(type === 'new' ? '未命名作品/正文' : null)
    setSelectedWork(null)
    setEditingNodeId(null)
    setEditingNodeLabel('')
    if (type === 'new') {
      setPathTreeData(JSON.parse(JSON.stringify(DEFAULT_PATH_TREE)))
      setExpandedIds(collectAllIds(DEFAULT_PATH_TREE))
    } else {
      setPathTreeData([])
      setExpandedIds(new Set())
    }
  }

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAppend = useCallback((node: PathNode) => {
    setPathTreeData(prev => {
      const parent = findNodeById(prev, node.id)
      if (!parent) return prev

      const folderName = getUniqueFolderName(parent, '新建文件夹')
      const newPath = [...parent.path, folderName]
      const newId = newPath.join('/')
      const newKey = newPath.join('-')
      const newNode: PathNode = {
        id: newId,
        key: newKey,
        label: folderName,
        path: newPath,
        children: [],
      }

      setExpandedIds(ids => new Set(ids).add(node.id))
      setEditingNodeId(newId)
      setEditingNodeLabel(folderName)
      setSelectedPath(newId)

      const newTree = addChildToTree(prev, node.id, newNode)
      return newTree
    })
  }, [])

  const saveNode = (nodeId: string) => {
    if (!nodeId || editingNodeId !== nodeId) return
    let newLabel = editingNodeLabel.trim()
    if (!newLabel) {
      newLabel = '新建文件夹'
    }
    const parent = findParentNode(pathTreeData, nodeId)
    if (!parent) return

    const parentNode = findNodeById(pathTreeData, parent.id) ?? parent
    newLabel = getUniqueFolderName(parentNode, newLabel, nodeId)
    const newPath = [...parent.path, newLabel]
    const newId = newPath.join('/')
    const newKey = newPath.join('-')

    const treeData = JSON.parse(JSON.stringify(pathTreeData))
    const oldNode = findNodeById(treeData, nodeId)
    if(!oldNode) return
    oldNode.label = newLabel
    oldNode.path = newPath
    oldNode.id = newId
    oldNode.key = newKey
    setSelectedPath(newId)
    setPathTreeData(treeData)
    setEditingNodeId(null)
    setEditingNodeLabel('')
  }

  const handlePathInputBlur = useCallback(
    (nodeId: string) => saveNode(nodeId),
    [saveNode]
  )

  const handlePathInputKeyDown = useCallback(
    (nodeId: string, e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        saveNode(nodeId)
      }
    },
    [saveNode]
  )

  const valid = () => {
    setShowInputWarning(false)
    setShowPathWarning(false)
    setShowWorkWarning(false)
    let ok = true
    if (!fileName.trim()) {
      setShowInputWarning(true)
      ok = false
    }
    if (workType === 'old' && !selectedWork) {
      setShowWorkWarning(true)
      ok = false
    }
    if (!selectedPath) {
      setShowPathWarning(true)
      ok = false
    }
    return ok
  }

  const handleOk = () => {
    if (!valid()) return
    let path = selectedPath
    if (path && !path.includes('/')) path = path + '/'
    onConfirm?.({
      fileName: fileName.trim(),
      workType,
      selectedWork,
      selectedPath: path,
    })
    onClose()
  }

  const pathTreeRowProps = {
    expandedIds,
    selectedPath,
    editingNodeId,
    editingNodeLabel,
    editingInputRef,
    onToggleExpand: toggleExpand,
    onSelectPath: setSelectedPath,
    onEditingLabelChange: setEditingNodeLabel,
    onPathInputBlur: handlePathInputBlur,
    onPathInputKeyDown: handlePathInputKeyDown,
    onSaveNode: saveNode,
    onAppend: handleAppend,
  }

  useEffect(() => {
    console.log('pathTreeData', pathTreeData)
  }, [pathTreeData]);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="w-[540px] max-w-[90vw] gap-4 sm:max-w-[540px]" showCloseButton>
        <DialogHeader>
          <DialogTitle>保存到作品</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 文件名 */}
          <div className="flex items-start gap-3">
            <label className="flex h-9 shrink-0 basis-20 items-center justify-end text-right text-sm font-medium">
              文件名
            </label>
            <div className="relative min-w-0 flex-1">
              <Input
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder={fileNamePlaceholder}
                className="w-full"
              />
              {showInputWarning && (
                <p className="absolute left-0 top-full mt-1 text-xs text-destructive">
                  请输入文件名
                </p>
              )}
            </div>
          </div>

          {/* 选择作品 */}
          <div className="flex items-start gap-3">
            <label className="flex h-9 shrink-0 basis-20 items-center justify-end text-right text-sm font-medium">
              选择作品
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <RadioGroup
                value={workType}
                onValueChange={v => handleWorkTypeChange(v as 'new' | 'old')}
                className="flex h-9 flex-row items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="old" id="work-type-old" />
                  <label htmlFor="work-type-old" className="cursor-pointer text-sm">
                    选择已有作品
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="work-type-new" />
                  <label htmlFor="work-type-new" className="cursor-pointer text-sm">
                    创建新作品
                  </label>
                </div>
              </RadioGroup>
              {workType === 'old' && (
                <>
                  <Select
                    value={selectedWork ? String(selectedWork.id) : ''}
                    onValueChange={handleWorkSelect}
                    onOpenChange={open => {
                      if (open && hasMore && !isLoadingMore) loadMoreWorks()
                    }}
                  >
                    <SelectTrigger className="w-full font-normal">
                      <SelectValue placeholder="点击选择作品" />
                    </SelectTrigger>
                    <SelectContent>
                      {workList.map(work => (
                        <SelectItem
                          key={work.id}
                          value={String(work.id)}
                          disabled={work.workType === 'doc'}
                          className={cn(
                            work.workType === 'doc' && 'text-muted-foreground opacity-50'
                          )}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span
                              className={cn(
                                'truncate',
                                work.workType === 'doc' && 'text-muted-foreground'
                              )}
                            >
                              {work.title}
                            </span>
                            {currentWorkId && String(work.id) === currentWorkId && (
                              <span className="shrink-0 text-xs text-muted-foreground">当前</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {showWorkWarning && <p className="text-xs text-destructive">请选择作品</p>}
                </>
              )}
            </div>
          </div>

          {/* 选择目录：Select 触发 + 下拉内 Tree（展开/选择/新建） */}
          <div className="flex items-start gap-3">
            <label className="flex h-9 shrink-0 basis-20 items-center justify-end text-right text-sm font-medium">
              选择目录
            </label>
            <div className="min-w-0 flex-1 space-y-1">
              <Select
                value={selectedPath ?? ''}
                onValueChange={v => setSelectedPath(v || null)}
                open={pathSelectOpen}
                onOpenChange={open => {
                  if (!open && editingNodeId) {
                    saveNode(editingNodeId)
                  }
                  setPathSelectOpen(open)
                }}
              >
                <SelectTrigger className="w-[400px] font-normal">
                  <span className={cn('truncate', !selectedPath && 'text-muted-foreground')}>
                    {selectedPath || '请选择目录'}
                  </span>
                </SelectTrigger>
                <SelectContent
                  className="max-h-[280px] w-full overflow-y-auto p-1"
                  position="popper"
                  align="start"
                >
                  {pathTreeData.length === 0 ? (
                    <div className="flex h-10 items-center justify-center py-2 text-sm text-muted-foreground">
                      请先选择作品
                    </div>
                  ) : (
                    pathTreeData.map(root => (
                      <PathTreeRow
                        key={root.key}
                        node={root}
                        depth={0}
                        onSelectNode={() => setPathSelectOpen(false)}
                        {...pathTreeRowProps}
                      />
                    ))
                  )}
                </SelectContent>
              </Select>
              {showPathWarning && <p className="text-xs text-destructive">请选择目录</p>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 border-0 pt-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="button" onClick={handleOk}>
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
