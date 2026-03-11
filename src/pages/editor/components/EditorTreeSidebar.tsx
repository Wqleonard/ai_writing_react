"use client"

import React, { useCallback, useState, useEffect, useRef } from "react"
import clsx from "clsx"
import { toast } from "sonner"
import IconFont from "@/components/Iconfont/Iconfont"
import { TriangleAlert } from "lucide-react"
import { ScrollArea } from "@/components/ui/ScrollArea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Collapsible, CollapsibleContent } from "@/components/ui/Collapsible"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/Popover"
import { ExportWorkMenu } from "./ExportWorkMenu"
import { useEditorStore } from "@/stores/editorStore"
import { getWorkTagsReq, updateWorkInfoReq } from "@/api/works"
import type { FileTreeNode } from "@/stores/editorStore/types"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import {
  TagSelector as WorkflowTagSelector,
  type TagCategoryDataItem,
} from "@/components/StepWorkflow/components/TagSelector"
import type { Tag as WorkflowTag } from "@/components/StepWorkflow/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip.tsx";
import { trackEvent } from "@/matomo/trackingMatomoEvent.ts";

const TREE_ICON_DIR = "\ue620"
const TREE_ICON_FILE = "\ue624"

const getTreeIcon = (node: FileTreeNode) =>
  node.isDirectory ? TREE_ICON_DIR : TREE_ICON_FILE

const checkDuplicateLabel = (
  siblings: FileTreeNode[],
  label: string,
  excludeId?: string
) => siblings.some((n) => n.id !== excludeId && n.label === label)

const generateUniqueName = (
  siblings: FileTreeNode[],
  base: string,
  isDir: boolean
): string => {
  let name = base
  let n = 1
  while (checkDuplicateLabel(siblings, name)) {
    name = `${base}${n}`
    n++
  }
  return name
}

type DropPosition = "above" | "below"

function findParentAndIndex(
  nodes: FileTreeNode[],
  nodeId: string,
  parentId: string | null = null
): { parentId: string | null; index: number } {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.id === nodeId) return { parentId, index: i }
    if (node.children?.length) {
      const found = findParentAndIndex(node.children, nodeId, node.id)
      if (found.index !== -1) return found
    }
  }
  return { parentId: null, index: -1 }
}

function reorderInSameLevel(
  nodes: FileTreeNode[],
  draggedId: string,
  targetId: string,
  position: DropPosition
): FileTreeNode[] {
  const next = structuredClone(nodes) as FileTreeNode[]

  const getChildrenByParentId = (list: FileTreeNode[], parentId: string | null): FileTreeNode[] => {
    if (parentId == null) return list
    const stack = [...list]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) break
      if (current.id === parentId) return current.children
      if (current.children?.length) stack.push(...current.children)
    }
    return list
  }

  const draggedLoc = findParentAndIndex(next, draggedId)
  const targetLoc = findParentAndIndex(next, targetId)
  if (draggedLoc.index < 0 || targetLoc.index < 0) return next
  if (draggedLoc.parentId !== targetLoc.parentId) return next

  const siblings = getChildrenByParentId(next, draggedLoc.parentId)
  const [moved] = siblings.splice(draggedLoc.index, 1)
  if (!moved) return next

  let insertIndex = position === "above" ? targetLoc.index : targetLoc.index + 1
  if (draggedLoc.index < targetLoc.index) insertIndex -= 1
  insertIndex = Math.max(0, Math.min(insertIndex, siblings.length))
  siblings.splice(insertIndex, 0, moved)

  return next
}

const removeNodeById = (nodes: FileTreeNode[], targetId: string): FileTreeNode[] =>
  nodes
    .filter((node) => node.id !== targetId)
    .map((node) =>
      node.children?.length
        ? { ...node, children: removeNodeById(node.children, targetId) }
        : node
    )

const rewriteSubtreePath = (
  node: FileTreeNode,
  oldBaseLen: number,
  newBasePath: string[]
): FileTreeNode => {
  const suffix = node.path.slice(oldBaseLen)
  const nextPath = [...newBasePath, ...suffix]
  const nextId = nextPath.join("/")
  const nextKey = nextPath.join("-")
  return {
    ...node,
    id: nextId,
    key: nextKey,
    path: nextPath,
    children: (node.children ?? []).map((child) =>
      rewriteSubtreePath(child, oldBaseLen, newBasePath)
    ),
  }
}

const renameNodeById = (
  nodes: FileTreeNode[],
  targetId: string,
  newBasePath: string[],
  newLabel: string
): FileTreeNode[] =>
  nodes.map((node) => {
    if (node.id === targetId) {
      return {
        ...rewriteSubtreePath(node, node.path.length, newBasePath),
        label: newLabel,
      }
    }
    if (!node.children?.length) return node
    return { ...node, children: renameNodeById(node.children, targetId, newBasePath, newLabel) }
  })

interface TreeNodeRowProps {
  node: FileTreeNode
  newNodeIdMap: Record<string, boolean>
  level: number
  currentKey: string
  onMarkNodeAsRead: (id: string) => void
  onAddFile: (node: FileTreeNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
  dragState: {
    draggedId: string | null
    dropTargetId: string | null
    dropPosition: DropPosition
  }
  onDragStart: (e: React.DragEvent, node: FileTreeNode) => void
  onDragOver: (e: React.DragEvent, node: FileTreeNode) => void
  onDragLeave: (e: React.DragEvent, node: FileTreeNode) => void
  onDrop: (e: React.DragEvent, node: FileTreeNode) => void
  onDragEnd: () => void
}

const TreeNodeRow = React.memo(({
                                  node,
                                  newNodeIdMap,
                                  level,
                                  currentKey,
                                  onMarkNodeAsRead,
                                  onAddFile,
                                  onContextMenu,
                                  expandedIds,
                                  onToggleExpand,
                                  dragState,
                                  onDragStart,
                                  onDragOver,
                                  onDragLeave,
                                  onDrop,
                                  onDragEnd,
                                }: TreeNodeRowProps) => {
  const isDir = node.isDirectory
  const showNewBadge = newNodeIdMap[node.id]
  const isSelected = currentKey === node.id
  const isMd = !isDir && node.fileType === "md"
  const expanded = expandedIds.has(node.id)
  const isDragged = dragState.draggedId === node.id
  const showDropLine = dragState.dropTargetId === node.id

  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)

  const handleClick = useCallback(() => {
    if (showNewBadge) {
      onMarkNodeAsRead(node.id)
    }
    if (isMd) {
      setCurrentEditingId(node.id, node)
    } else if (isDir) {
      onToggleExpand(node.id)
    }
  }, [showNewBadge, isMd, isDir, node, onMarkNodeAsRead, setCurrentEditingId, onToggleExpand])

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        draggable
        data-state={expanded ? "open" : "closed"}
        className={clsx(
          "group/node",
          "relative flex cursor-pointer items-center rounded px-2 py-1.5 text-sm transition-all duration-200",
          "min-h-[32px] rounded-[4px]",
          isSelected && "bg-[#fffef9] text-(--text-primary)",
          !isSelected && "hover:bg-[#fffef9]",
          isDir && "cursor-pointer",
          isDragged && "opacity-50 scale-[0.98]",
          showDropLine &&
          dragState.dropPosition === "above" &&
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[2px] before:rounded before:bg-(--theme-color) before:content-['']",
          showDropLine &&
          dragState.dropPosition === "below" &&
          "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded after:bg-(--theme-color) after:content-['']"
        )}
        style={{ paddingLeft: 8 + level * 16 }}
        onClick={(e) => {
          if (e.button !== 0) return
          handleClick()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={(e) => onDragLeave(e, node)}
        onDrop={(e) => onDrop(e, node)}
        onDragEnd={onDragEnd}
      >
        {/* 展开/折叠：目录节点显示旋转箭头 */}
        <div
          className={clsx(
            "mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-all duration-200",
            isDir ? "w-5 opacity-100 text-(--text-secondary) hover:text-(--theme-color)" : "opacity-0"
          )}
        >
          {isDir ? (
            <div className="flex size-3.5 items-center justify-center">
              <IconFont unicode="&#xeaa5;"
                        className="select-none transform-gpu transition-transform! duration-200! ease-out! group-data-[state=open]/node:rotate-90"/>
            </div>
          ) : (
            <span className="w-2"/>
          )}
        </div>
        <IconFont
          unicode={getTreeIcon(node)}
          className="ml-1 shrink-0 text-sm text-(--text-secondary)"
        />
        <div className="ml-1 min-w-0 flex-1 flex items-center gap-1 overflow-hidden">
          <div className="inline-block min-w-0 max-w-[calc(100%-50px)] truncate align-top text-[14px] leading-[1.4]">
            {node.label}
          </div>
          {showNewBadge && (
            <span
              className="shrink-0 select-none whitespace-nowrap self-start mt-[2px] text-[10px] leading-none font-medium text-[#f56c6c] lowercase">
              new
            </span>
          )}
        </div>
        {/* “+” 新增：仅目录节点显示，悬浮时可见 */}
        {isDir && (
          <div
            role="button"
            tabIndex={0}
            className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--theme-color) text-white text-sm font-bold opacity-0 group-hover/node:opacity-100 transition-opacity duration-200 hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation()
              onAddFile(node)
            }}
            onMouseUp={(e) => {
              e.stopPropagation()
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onAddFile(node)
              }
            }}
          >
            +
          </div>
        )}
      </div>
      {isDir && (
        <Collapsible open={expanded} className="w-full">
          <CollapsibleContent className="w-full">
            {node.children.map((child) => (
              <TreeNodeRow
                key={child.id}
                node={child}
                newNodeIdMap={newNodeIdMap}
                level={level + 1}
                currentKey={currentKey}
                onMarkNodeAsRead={onMarkNodeAsRead}
                onAddFile={onAddFile}
                onContextMenu={onContextMenu}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}, (prev, next) => {
  // 目录节点需要感知后代的展开状态变化，保守起见始终重渲染
  if (prev.node.isDirectory || next.node.isDirectory) return false

  if (prev.node !== next.node) return false
  if (prev.level !== next.level) return false
  if (prev.currentKey === prev.node.id || next.currentKey === next.node.id) {
    if (prev.currentKey !== next.currentKey) return false
  }

  const prevShowNewBadge = !!prev.newNodeIdMap[prev.node.id]
  const nextShowNewBadge = !!next.newNodeIdMap[next.node.id]
  if (prevShowNewBadge !== nextShowNewBadge) return false

  const prevExpanded = prev.expandedIds.has(prev.node.id)
  const nextExpanded = next.expandedIds.has(next.node.id)
  if (prevExpanded !== nextExpanded) return false

  const prevIsDragged = prev.dragState.draggedId === prev.node.id
  const nextIsDragged = next.dragState.draggedId === next.node.id
  if (prevIsDragged !== nextIsDragged) return false

  const prevIsDropTarget = prev.dragState.dropTargetId === prev.node.id
  const nextIsDropTarget = next.dragState.dropTargetId === next.node.id
  if (prevIsDropTarget !== nextIsDropTarget) return false
  if (nextIsDropTarget && prev.dragState.dropPosition !== next.dragState.dropPosition) {
    return false
  }

  return true
})

export interface EditorTreeSidebarProps {
  className?: string
}

export const EditorTreeSidebar = ({
                                    className,
                                  }: EditorTreeSidebarProps) => {
  const workInfo = useEditorStore((s) => s.workInfo)
  const workId = useEditorStore((s) => s.workId)
  const treeData = useEditorStore((s) => s.treeData)
  const currentEditingId = useEditorStore((s) => s.currentEditingId)
  const newNodeIdMap = useEditorStore((s) => s.newNodeIdMap)
  const markNewNodeId = useEditorStore((s) => s.markNewNodeId)
  const clearNewNodeId = useEditorStore((s) => s.clearNewNodeId)
  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo)
  const setTreeData = useEditorStore((s) => s.setTreeData)
  const saveEditorData = useEditorStore((s) => s.saveEditorData)
  const updateWorkInfo = useEditorStore((s) => s.updateWorkInfo)

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitleValue, setEditingTitleValue] = useState(workInfo.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node: FileTreeNode
  } | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [tagSelectDialogOpen, setTagSelectDialogOpen] = useState(false)
  const [tagCategories, setTagCategories] = useState<TagCategoryDataItem[]>([])
  const [selectedTags, setSelectedTags] = useState<WorkflowTag[]>([])
  const [tagSaving, setTagSaving] = useState(false)
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
  const [dragState, setDragState] = useState<{
    draggedId: string | null
    draggedParentId: string | null
    draggedIndex: number
    dropTargetId: string | null
    dropTargetParentId: string | null
    dropTargetIndex: number
    dropPosition: DropPosition
  }>({
    draggedId: null,
    draggedParentId: null,
    draggedIndex: -1,
    dropTargetId: null,
    dropTargetParentId: null,
    dropTargetIndex: -1,
    dropPosition: "above",
  })
  const tagsGroupRef = useRef<HTMLDivElement>(null)
  const [tagsDragging, setTagsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })

  useEffect(() => {
    setEditingTitleValue(workInfo.title)
  }, [workInfo.title])

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus()
  }, [isEditingTitle])

  const hideContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    const onDocClick = () => hideContextMenu()
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [hideContextMenu])

  const updateTagCategories = useCallback(async () => {
    try {
      const response: any = await getWorkTagsReq()
      if (!Array.isArray(response)) {
        setTagCategories([])
        return
      }
      const next = response.map((group: any) => ({
        category: String(group?.category ?? ""),
        categoryId: String(group?.categoryId ?? ""),
        max: Number(group?.max ?? 0),
        tags: Array.isArray(group?.tags)
          ? group.tags.map((tag: any) => ({
            id: tag?.id,
            name: String(tag?.name ?? ""),
            isOfficial: String(tag?.userId ?? "") === "1",
            category: String(group?.category ?? ""),
            categoryId: String(group?.categoryId ?? ""),
            max: Number(group?.max ?? 0),
            userId: tag?.userId,
          }))
          : [],
      }))
      setTagCategories(next)
    } catch (error) {
      console.error("获取标签数据失败:", error)
      setTagCategories([])
    }
  }, [])

  useEffect(() => {
    if (!tagSelectDialogOpen) {
      setSelectedTags([])
      return
    }
    void (async () => {
      await updateTagCategories()
      setSelectedTags(
        (workInfo.workTags ?? []).map((tag) => ({
          id: tag.id,
          name: tag.name,
          userId: tag.userId,
          isOfficial: String(tag.userId ?? "") === "1",
          categoryId: tag.categoryId,
        }))
      )
    })()
  }, [tagSelectDialogOpen, updateTagCategories, workInfo.workTags])

  const handleSaveTags = useCallback(async () => {
    if (!workId || tagSaving) return
    try {
      setTagSaving(true)
      const selectedTagIds = selectedTags
        .map((tag) => Number(tag.id))
        .filter((id) => Number.isFinite(id))
      await updateWorkInfoReq(workId, { tagIds: selectedTagIds })
      setTagSelectDialogOpen(false)
      await updateWorkInfo()
    } catch (error) {
      console.error(error)
      toast.error("保存失败,请稍后重试")
    } finally {
      setTagSaving(false)
    }
  }, [selectedTags, tagSaving, updateWorkInfo, workId])

  const handleFinishTitle = useCallback(() => {
    const v = editingTitleValue.trim()
    if (!v) {
      setEditingTitleValue(workInfo.title)
      setIsEditingTitle(false)
      return
    }
    if (v !== workInfo.title) {
      setWorkInfo({ title: v, stage: "final" })
    }
    setIsEditingTitle(false)
  }, [editingTitleValue, workInfo.title, setWorkInfo])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleFinishTitle()
    if (e.key === "Escape") {
      setEditingTitleValue(workInfo.title)
      setIsEditingTitle(false)
    }
  }

  const getSiblings = useCallback(
    (node: FileTreeNode): FileTreeNode[] => {
      const find = (nodes: FileTreeNode[], id: string): FileTreeNode[] | null => {
        for (const n of nodes) {
          if (n.id === id) return nodes
          const inChild = n.children?.length
            ? find(n.children, id)
            : null
          if (inChild) return inChild
        }
        return null
      }
      return find(treeData, node.id) ?? treeData
    },
    [treeData]
  )

  const handleAddFileUnder = useCallback(
    (parent: FileTreeNode) => {
      trackEvent('Directory', 'Add', 'File')
      const nextTreeData = structuredClone(treeData) as FileTreeNode[]
      const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children?.length) {
            const found = findNodeById(node.children, id)
            if (found) return found
          }
        }
        return null
      }

      const targetNode = findNodeById(nextTreeData, parent.id)
      if (!targetNode) return

      if (!targetNode.children) {
        targetNode.children = []
      }
      const siblings = targetNode.children
      const unique = generateUniqueName(siblings, "新文件", false)
      const newPath = [...(targetNode.path ?? []), `${unique}.md`]
      const newNodeId = newPath.join("/")
      const newNodeKey = newPath.join("-")

      const nextNode: FileTreeNode = {
        id: newNodeId,
        key: newNodeKey,
        label: unique,
        content: "",
        isDirectory: false,
        path: newPath,
        fileType: "md",
        children: [],
      }

      targetNode.children.push(nextNode)
      setTreeData([...nextTreeData])
      void saveEditorData("1")
      markNewNodeId(newNodeId)
      setCurrentEditingId(newNodeId)
      setExpandedIds((prev) => new Set(prev).add(parent.id))
    },
    [markNewNodeId, saveEditorData, setCurrentEditingId, setTreeData, treeData]
  )

  const handleAddFolderUnder = useCallback(
    (parent: FileTreeNode) => {
      trackEvent('Directory', 'Add', 'Folder')
      const nextTreeData = structuredClone(treeData) as FileTreeNode[]
      const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node
          if (node.children?.length) {
            const found = findNodeById(node.children, id)
            if (found) return found
          }
        }
        return null
      }

      const targetNode = findNodeById(nextTreeData, parent.id)
      if (!targetNode) return

      if (!targetNode.children) {
        targetNode.children = []
      }
      const siblings = targetNode.children
      const unique = generateUniqueName(siblings, "新建文件夹", true)
      const newPath = [...(targetNode.path ?? []), unique]

      const newNodeId = newPath.join("/")
      const newNodeKey = newPath.join("-")

      const nextNode: FileTreeNode = {
        id: newNodeId,
        key: newNodeKey,
        label: unique,
        content: "",
        isDirectory: true,
        path: newPath,
        fileType: "directory",
        children: [],
      }

      targetNode.children.push(nextNode)
      setTreeData([...nextTreeData])
      void saveEditorData("1")
      markNewNodeId(newNodeId)
      setExpandedIds((prev) => new Set(prev).add(parent.id))
    },
    [markNewNodeId, saveEditorData, setTreeData, treeData]
  )

  const handleRename = useCallback(() => {
    if (!contextMenu) return
    setRenameTarget(contextMenu.node)
    setRenameValue(contextMenu.node.label)
    setRenameOpen(true)
    hideContextMenu()
  }, [contextMenu, hideContextMenu])

  const handleDelete = useCallback(() => {
    if (!contextMenu) return
    setDeleteTarget(contextMenu.node)
    setDeleteOpen(true)
    hideContextMenu()
  }, [contextMenu, hideContextMenu])

  const confirmRename = useCallback(() => {
    if (!renameTarget || !renameValue.trim()) {
      setRenameOpen(false)
      return
    }
    const newName = renameValue.trim()
    const siblings = getSiblings(renameTarget)
    if (checkDuplicateLabel(siblings, newName, renameTarget.id)) {
      toast.warning("该名称已存在，请使用其他名称")
      return
    }
    const oldPath = renameTarget.id
    const lastPart = renameTarget.path[renameTarget.path.length - 1] ?? ""
    const ext = renameTarget.isDirectory ? "" : (lastPart.includes(".") ? "." + lastPart.split(".").pop() : "")
    const newPath = renameTarget.isDirectory
      ? [...renameTarget.path.slice(0, -1), newName].join("/") + "/"
      : [...renameTarget.path.slice(0, -1), newName + ext].join("/")
    const nextPathId = newPath.replace(/\/$/, "")
    const renamedTree = renameNodeById(treeData, oldPath, nextPathId.split("/").filter(Boolean), newName)
    setTreeData(renamedTree)
    void saveEditorData("1")
    if (renameTarget.isDirectory) {
      setExpandedIds((prev) => {
        const next = new Set<string>()
        prev.forEach((id) => {
          if (id === oldPath) {
            next.add(nextPathId)
            return
          }
          if (id.startsWith(`${oldPath}/`)) {
            next.add(`${nextPathId}/${id.slice(oldPath.length + 1)}`)
            return
          }
          next.add(id)
        })
        return next
      })
    }
    if (currentEditingId === oldPath) {
      setCurrentEditingId(nextPathId)
    } else if (renameTarget.isDirectory && currentEditingId.startsWith(`${oldPath}/`)) {
      const suffix = currentEditingId.slice(oldPath.length + 1)
      setCurrentEditingId(`${nextPathId}/${suffix}`)
    }
    toast.success(`已重命名为: ${newName}`)
    setRenameOpen(false)
    setRenameTarget(null)
    setRenameValue("")
  }, [renameTarget, renameValue, getSiblings, saveEditorData, setTreeData, treeData, currentEditingId, setCurrentEditingId])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) {
      setDeleteOpen(false)
      return
    }
    setTreeData(removeNodeById(treeData, deleteTarget.id))
    void saveEditorData("1")
    const prefix = deleteTarget.id + (deleteTarget.isDirectory ? "/" : "")
    if (
      currentEditingId === deleteTarget.id ||
      (deleteTarget.isDirectory && currentEditingId.startsWith(prefix))
    ) {
      setCurrentEditingId("")
    }
    setDeleteOpen(false)
    setDeleteTarget(null)
    toast.success("已删除")
  }, [deleteTarget, currentEditingId, saveEditorData, setCurrentEditingId, setTreeData, treeData])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const addFileAtRoot = useCallback(() => {
    trackEvent('Directory', 'Add', 'File')
    const nextTreeData = structuredClone(treeData) as FileTreeNode[]
    const unique = generateUniqueName(nextTreeData, "新文件", false)
    const newPath = [`${unique}.md`]
    const newNodeId = newPath.join("/")
    const newNodeKey = newPath.join("-")
    const nextNode: FileTreeNode = {
      id: newNodeId,
      key: newNodeKey,
      label: unique,
      content: "",
      isDirectory: false,
      path: newPath,
      fileType: "md",
      children: [],
    }

    nextTreeData.push(nextNode)
    setTreeData([...nextTreeData])
    void saveEditorData("1")
    markNewNodeId(newNodeId)
    setCurrentEditingId(newNodeId)
  }, [treeData, markNewNodeId, saveEditorData, setCurrentEditingId, setTreeData])

  const addFolderAtRoot = useCallback(() => {
    trackEvent('Directory', 'Add', 'Folder')
    const nextTreeData = structuredClone(treeData) as FileTreeNode[]
    const unique = generateUniqueName(nextTreeData, "新建文件夹", true)
    const newPath = [unique]
    const newNodeId = newPath.join("/")
    const newNodeKey = newPath.join("-")
    const nextNode: FileTreeNode = {
      id: newNodeId,
      key: newNodeKey,
      label: unique,
      content: "",
      isDirectory: true,
      path: newPath,
      fileType: "directory",
      children: [],
    }

    nextTreeData.push(nextNode)
    setTreeData([...nextTreeData])
    void saveEditorData("1")
    markNewNodeId(newNodeId)
    setExpandedIds((prev) => new Set(prev))
  }, [treeData, markNewNodeId, saveEditorData, setTreeData])

  const resetDragState = useCallback(() => {
    setDragState({
      draggedId: null,
      draggedParentId: null,
      draggedIndex: -1,
      dropTargetId: null,
      dropTargetParentId: null,
      dropTargetIndex: -1,
      dropPosition: "above",
    })
  }, [])

  const canDropInSameLevel = useCallback(
    (targetId: string): boolean => {
      if (!dragState.draggedId) return false
      if (dragState.draggedId === targetId) return false
      const targetLoc = findParentAndIndex(treeData, targetId)
      if (targetLoc.index < 0) return false
      return targetLoc.parentId === dragState.draggedParentId
    },
    [dragState.draggedId, dragState.draggedParentId, treeData]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, node: FileTreeNode) => {
      const loc = findParentAndIndex(treeData, node.id)
      if (loc.index < 0) return
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", node.id)
      }
      setDragState((prev) => ({
        ...prev,
        draggedId: node.id,
        draggedParentId: loc.parentId,
        draggedIndex: loc.index,
      }))
    },
    [treeData]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, node: FileTreeNode) => {
      if (!dragState.draggedId) return
      e.preventDefault()
      if (!canDropInSameLevel(node.id)) {
        if (e.dataTransfer) e.dataTransfer.dropEffect = "none"
        return
      }
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const nextPos: DropPosition =
        e.clientY < rect.top + rect.height / 2 ? "above" : "below"
      const targetLoc = findParentAndIndex(treeData, node.id)
      setDragState((prev) => ({
        ...prev,
        dropTargetId: node.id,
        dropTargetParentId: targetLoc.parentId,
        dropTargetIndex: targetLoc.index,
        dropPosition: nextPos,
      }))
    },
    [canDropInSameLevel, dragState.draggedId, treeData]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent, node: FileTreeNode) => {
      const current = e.currentTarget as HTMLElement
      const related = e.relatedTarget as Node | null
      if (related && current.contains(related)) return
      setDragState((prev) =>
        prev.dropTargetId === node.id
          ? { ...prev, dropTargetId: null, dropTargetParentId: null, dropTargetIndex: -1 }
          : prev
      )
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, node: FileTreeNode) => {
      e.preventDefault()
      e.stopPropagation()
      if (!dragState.draggedId || !canDropInSameLevel(node.id)) {
        resetDragState()
        return
      }

      const reordered = reorderInSameLevel(
        treeData,
        dragState.draggedId,
        node.id,
        dragState.dropPosition
      )
      setTreeData(reordered)
      resetDragState()
    },
    [
      canDropInSameLevel,
      dragState.draggedId,
      dragState.dropPosition,
      resetDragState,
      setTreeData,
      treeData,
    ]
  )

  return (
    <div
      className={clsx(
        "editor-tree-sidebar flex h-full flex-col overflow-hidden bg-(--bg-primary)",
        className
      )}
    >
      <div className="shrink-0 border-b border-(--border-color) pb-2">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="w-full rounded px-1 py-0.5 text-xl leading-8 outline-none bg-transparent border-none"
            value={editingTitleValue}
            onChange={(e) => setEditingTitleValue(e.target.value)}
            onBlur={handleFinishTitle}
            onKeyDown={handleTitleKeyDown}
            maxLength={30}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            className="truncate cursor-pointer rounded px-1 py-0.5 text-xl leading-8 hover:bg-(--bg-tertiary)"
            title="点击编辑作品名称"
            onClick={() => setIsEditingTitle(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsEditingTitle(true)
            }}
          >
            {workInfo.title || "未命名作品"}
          </div>
        )}
        <div
          className="mt-1 max-h-8 overflow-x-auto overflow-y-hidden scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            ref={tagsGroupRef}
            className={clsx(
              "flex items-center gap-1 overflow-x-auto scrollbar-none",
              tagsDragging && "cursor-grabbing select-none"
            )}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onMouseDown={(e) => {
              if (e.button !== 0) return
              setTagsDragging(true)
              dragStart.current = {
                x: e.pageX,
                scrollLeft: tagsGroupRef.current?.scrollLeft ?? 0,
              }
            }}
            onMouseMove={(e) => {
              if (!tagsDragging || !tagsGroupRef.current) return
              const dx = e.pageX - dragStart.current.x
              tagsGroupRef.current.scrollLeft =
                dragStart.current.scrollLeft - dx
            }}
            onMouseUp={() => setTagsDragging(false)}
            onMouseLeave={() => setTagsDragging(false)}
          >
            {workInfo.workTags.map((tag) => (
              <span
                key={tag.id}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-(--bg-tertiary)"
              >
                {tag.name}
              </span>
            ))}
            <div
              role="button"
              tabIndex={0}
              className="shrink-0 cursor-pointer text-xs underline"
              onClick={() => setTagSelectDialogOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setTagSelectDialogOpen(true)
                }
              }}
            >
              编辑标签
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="mt-2 flex-1 min-h-0">
        <div className="py-1">
          {treeData.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              newNodeIdMap={newNodeIdMap}
              level={0}
              currentKey={currentEditingId}
              onMarkNodeAsRead={clearNewNodeId}
              onAddFile={handleAddFileUnder}
              onContextMenu={(e, node) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, node })
              }}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              dragState={{
                draggedId: dragState.draggedId,
                dropTargetId: dragState.dropTargetId,
                dropPosition: dragState.dropPosition,
              }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={resetDragState}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-center gap-5 py-2.5">
        <Tooltip>
          <TooltipTrigger>
            <div
              role="button"
              tabIndex={0}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
              title="添加文件夹"
              onClick={addFolderAtRoot}
            >
              <IconFont unicode="\ue62d" className="text-2xl"/>
            </div>
          </TooltipTrigger>
          <TooltipContent side='top' align='center'>
            添加文件夹
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <div
              role="button"
              tabIndex={0}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
              title="添加文件"
              onClick={addFileAtRoot}
            >
              <IconFont unicode="\ue62c" className="text-2xl"/>
            </div>
          </TooltipTrigger>
          <TooltipContent side='top' align='center'>
            添加文件
          </TooltipContent>
        </Tooltip>

        <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
          <Tooltip>
            <PopoverAnchor asChild>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
                  title="导出作品"
                  onClick={() => {
                    setExportPopoverOpen(true)
                  }}
                >
                  <IconFont unicode="\ue62e" className="text-2xl"/>
                </div>
              </TooltipTrigger>
            </PopoverAnchor>
            <TooltipContent side="top">导出作品</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align='center'
                          className="rounded-md w-auto p-0 border border-(--border-color) shadow-lg editor-sidebar-export-popover">
            <ExportWorkMenu onClose={() => setExportPopoverOpen(false)}/>
          </PopoverContent>
        </Popover>
      </div>

      {contextMenu && (
        <div
          className="fixed z-2000 min-w-[120px] rounded border border-[#e4e7ed] bg-(--bg-dialog) p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.isDirectory && (
            <>
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-xs px-4 py-1 text-sm text-[#606266] hover:bg-(--bg-hover)"
                onClick={() => {
                  handleAddFolderUnder(contextMenu.node)
                  hideContextMenu()
                }}
              >
                添加文件夹
              </div>
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer rounded-xs px-4 py-1 text-sm text-[#606266] hover:bg-(--bg-hover)"
                onClick={() => {
                  handleAddFileUnder(contextMenu.node)
                  hideContextMenu()
                }}
              >
                添加文件
              </div>
              <div className="my-1 h-px bg-[#e4e7ed]"/>
            </>
          )}
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-xs px-4 py-1 text-sm text-[#606266] hover:bg-(--bg-hover)"
            onClick={handleRename}
          >
            重命名
          </div>
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer rounded-xs px-4 py-1 text-sm text-[#606266] hover:bg-(--bg-hover)"
            onClick={handleDelete}
          >
            删除
          </div>
        </div>
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent
          className="sm:max-w-[400px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>重命名{renameTarget?.isDirectory ? "文件夹" : "文件"}</DialogTitle>
          </DialogHeader>
          <div className="rename-dialog-content">
            <Input
              // className="w-full outline-none focus:border-none rounded border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入新名称"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename()
                if (e.key === "Escape") setRenameOpen(false)
              }}
            />
            <p className="text-right mt-2 text-xs text-muted-foreground">
              {renameValue.length}/50
            </p>
            {renameTarget && !renameTarget.isDirectory && (
              <p className="dialog-tip text-xs text-muted-foreground">
                注意：文件扩展名将自动保持
              </p>
            )}
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={!renameValue.trim()}
              variant="default"
              onClick={() => renameValue.trim() && confirmRename()}
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="sm:max-w-[400px]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>删除确认</DialogTitle>
          </DialogHeader>
          <div className="delete-dialog-content flex items-start gap-3">
            <div className="warning-icon mt-0.5 shrink-0">
              <TriangleAlert className="size-6 text-[#f56c6c]"/>
            </div>
            <div className="warning-text flex-1">
              <p className="mb-2 text-sm text-foreground last:mb-0">
                确定要删除 <strong>"{deleteTarget?.label}"</strong> 吗？
              </p>
              <p className="warning-tip text-xs text-muted-foreground">
                此操作不可撤销，请谨慎操作。
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              tabIndex={0}
              className="cursor-pointer rounded px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </Button>
            <Button
              variant='destructive'
              tabIndex={0}
              className="cursor-pointer rounded px-4 py-2 text-sm text-white bg-destructive hover:opacity-90"
              onClick={confirmDelete}
            >
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagSelectDialogOpen} onOpenChange={setTagSelectDialogOpen}>
        <DialogContent
          className="h-[80vh] max-h-[80vh] w-[820px] max-w-[95vw]"
          showCloseButton
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex flex-1 flex-col overflow-hidden px-4 py-5">
            <WorkflowTagSelector
              categories={tagCategories}
              updateTagCategories={updateTagCategories}
              selectedTags={selectedTags}
              onSelectedTagsChange={setSelectedTags}
            />
          </ScrollArea>
          <DialogFooter className="flex flex-row-reverse gap-3">
            <Button type="button" variant="outline" onClick={() => setTagSelectDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleSaveTags} disabled={tagSaving}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
