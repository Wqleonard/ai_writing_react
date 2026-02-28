"use client"

import React, { useCallback, useMemo, useState, useEffect, useRef } from "react"
import clsx from "clsx"
import { toast } from "sonner"
import IconFont from "@/components/IconFont/Iconfont"
import { TriangleAlert } from "lucide-react"
import { ScrollArea } from "@/components/ui/ScrollArea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"
import { ExportWorkMenu } from "./ExportWorkMenu"
import { useEditorStore } from "@/stores/editorStore"
import { updateWorkInfoReq } from "@/api/works"
import { serverDataToTree } from "@/stores/editorStore/utils"
import type { FileTreeNode } from "@/stores/editorStore/types"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"

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

interface TreeNodeRowProps {
  node: FileTreeNode
  level: number
  currentKey: string
  onSelect: (node: FileTreeNode) => void
  onAddFile: (node: FileTreeNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void
  expandedIds: Set<string>
  onToggleExpand: (id: string) => void
}

const TreeNodeRow = ({
  node,
  level,
  currentKey,
  onSelect,
  onAddFile,
  onContextMenu,
  expandedIds,
  onToggleExpand,
}: TreeNodeRowProps) => {
  const isDir = node.isDirectory
  const isSelected = currentKey === node.id
  const isMd = !isDir && node.fileType === "md"
  const expanded = expandedIds.has(node.id)
  const hasChildren = node.children && node.children.length > 0

  const handleClick = useCallback(() => {
    if (isMd) onSelect(node)
    else if (isDir) onToggleExpand(node.id)
  }, [isMd, isDir, node, onSelect, onToggleExpand])

  return (
    <div className="w-full group/node">
      <div
        role="button"
        tabIndex={0}
        className={clsx(
          "flex cursor-pointer items-center rounded px-2 py-1.5 text-sm transition-all duration-200",
          "min-h-[32px] rounded-[4px]",
          isSelected && "bg-[#fffef9] text-[var(--text-primary)]",
          !isSelected && "hover:bg-[#fffef9]",
          isDir && "cursor-pointer"
        )}
        style={{ paddingLeft: 8 + level * 16 }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleClick()
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {/* 展开/折叠：仅目录节点显示，悬浮时可见 */}
        <div
          className={clsx(
            "flex shrink-0 items-center justify-center w-5 h-5 cursor-pointer transition-opacity duration-200",
            isDir ? "opacity-0 group-hover/node:opacity-100" : "opacity-0"
          )}
          style={!isDir ? { width: 20, minWidth: 20 } : undefined}
          onClick={(e) => {
            if (isDir) {
              e.stopPropagation()
              onToggleExpand(node.id)
            }
          }}
        >
          {isDir ? (
            <span className="text-[var(--text-secondary)] text-xs select-none hover:text-[var(--theme-color)]">
              {expanded ? "▼" : "▶"}
            </span>
          ) : (
            <span className="w-2" />
          )}
        </div>
        <IconFont
          unicode={getTreeIcon(node)}
          className="ml-1 shrink-0 text-sm text-[var(--text-secondary)]"
        />
        <div className="ml-1 min-w-0 flex-1 truncate max-w-[calc(100%-50px)]">{node.label}</div>
        {node.new && !isDir && (
          <span className="shrink-0 text-[10px] text-red-500 font-medium">new</span>
        )}
        {/* “+” 新增：仅目录节点显示，悬浮时可见 */}
        {isDir && (
          <div
            role="button"
            tabIndex={0}
            className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--theme-color)] text-white text-sm font-bold opacity-0 group-hover/node:opacity-100 transition-opacity duration-200 hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation()
              onAddFile(node)
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
      {isDir && expanded && (
        <div className="w-full">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              level={level + 1}
              currentKey={currentKey}
              onSelect={onSelect}
              onAddFile={onAddFile}
              onContextMenu={onContextMenu}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export interface EditorTreeSidebarProps {
  className?: string
  /** 保存后回调（如刷新作品阶段） */
  onAfterSaveEditorData?: () => void
}

export const EditorTreeSidebar = ({
  className,
  onAfterSaveEditorData,
}: EditorTreeSidebarProps) => {
  const workInfo = useEditorStore((s) => s.workInfo)
  const workId = useEditorStore((s) => s.workId)
  const serverData = useEditorStore((s) => s.serverData)
  const currentEditingId = useEditorStore((s) => s.currentEditingId)
  const setCurrentEditingId = useEditorStore((s) => s.setCurrentEditingId)
  const setWorkInfo = useEditorStore((s) => s.setWorkInfo)
  const addServerDataPath = useEditorStore((s) => s.addServerDataPath)
  const deleteServerDataPath = useEditorStore((s) => s.deleteServerDataPath)
  const renameServerDataPath = useEditorStore((s) => s.renameServerDataPath)

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
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)
  const tagsGroupRef = useRef<HTMLDivElement>(null)
  const [tagsDragging, setTagsDragging] = useState(false)
  const dragStart = useRef({ x: 0, scrollLeft: 0 })

  const treeData = useMemo(() => serverDataToTree(serverData), [serverData])

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

  const handleFinishTitle = useCallback(() => {
    const v = editingTitleValue.trim()
    if (!v) {
      setEditingTitleValue(workInfo.title)
      setIsEditingTitle(false)
      return
    }
    if (v !== workInfo.title) {
      setWorkInfo({ title: v })
      updateWorkInfoReq(workId, { title: v }).catch(() =>
        toast.error("更新标题失败")
      )
    }
    setIsEditingTitle(false)
  }, [editingTitleValue, workInfo.title, workId, setWorkInfo])

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
      const siblings = parent.children ?? []
      const base = "新文件"
      const unique = generateUniqueName(siblings, base, false)
      const path =
        parent.path.length > 0
          ? [...parent.path, `${unique}.md`].join("/")
          : `${unique}.md`
      addServerDataPath(path, "")
      setCurrentEditingId(path)
    },
    [addServerDataPath, setCurrentEditingId]
  )

  const handleAddFolderUnder = useCallback(
    (parent: FileTreeNode) => {
      const siblings = parent.children ?? []
      const unique = generateUniqueName(siblings, "新文件夹", true)
      const path =
        parent.path.length > 0
          ? [...parent.path, unique].join("/") + "/"
          : unique + "/"
      addServerDataPath(path, "")
      setExpandedIds((prev) => new Set(prev).add(parent.id))
    },
    [addServerDataPath]
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
    renameServerDataPath(oldPath, newPath)
    toast.success(`已重命名为: ${newName}`)
    setRenameOpen(false)
    setRenameTarget(null)
    setRenameValue("")
  }, [renameTarget, renameValue, getSiblings, renameServerDataPath])

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) {
      setDeleteOpen(false)
      return
    }
    deleteServerDataPath(deleteTarget.id)
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
  }, [deleteTarget, currentEditingId, deleteServerDataPath, setCurrentEditingId])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const addFileAtRoot = useCallback(() => {
    const unique = generateUniqueName(treeData, "新文件", false)
    const path = `${unique}.md`
    addServerDataPath(path, "")
    setCurrentEditingId(path)
  }, [treeData, addServerDataPath, setCurrentEditingId])

  const addFolderAtRoot = useCallback(() => {
    const unique = generateUniqueName(treeData, "新文件夹", true)
    const path = unique + "/"
    addServerDataPath(path, "")
    setExpandedIds((prev) => new Set(prev))
  }, [treeData, addServerDataPath])

  return (
    <div
      className={clsx(
        "editor-tree-sidebar flex h-full flex-col overflow-hidden bg-[var(--bg-primary)]",
        className
      )}
    >
      <div className="shrink-0 border-b border-[var(--border-color)] pb-2">
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
            className="truncate cursor-pointer rounded px-1 py-0.5 text-xl leading-8 hover:bg-[var(--bg-tertiary)]"
            title="点击编辑作品名称"
            onClick={() => setIsEditingTitle(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setIsEditingTitle(true)
            }}
          >
            {workInfo.title || "未命名作品"}
            {workId ? ` (${workId})` : ""}
          </div>
        )}
        <div className="mt-1 max-h-8 overflow-x-auto overflow-y-hidden scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-tertiary)]"
              >
                {tag.name}
              </span>
            ))}
            <div
              role="button"
              tabIndex={0}
              className="shrink-0 cursor-pointer text-xs underline"
              onClick={() => toast.info("暂未开放，敬请期待")}
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
              level={0}
              currentKey={currentEditingId}
              onSelect={(n) => setCurrentEditingId(n.id)}
              onAddFile={handleAddFileUnder}
              onContextMenu={(e, node) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, node })
              }}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="flex shrink-0 items-center justify-center gap-5 py-2.5">
        <div
          role="button"
          tabIndex={0}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
          title="添加文件夹"
          onClick={addFolderAtRoot}
        >
          <IconFont unicode="\ue62d" className="text-2xl" />
        </div>
        <div
          role="button"
          tabIndex={0}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
          title="添加文件"
          onClick={addFileAtRoot}
        >
          <IconFont unicode="\ue62c" className="text-2xl" />
        </div>
        <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
          <PopoverTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-sm hover:bg-[#d3d3d3]"
              title="导出作品"
            >
              <IconFont unicode="\ue62e" className="text-2xl" />
            </div>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="w-auto p-0 rounded-[var(--popover-radius)] border border-[var(--border-color)] shadow-lg editor-sidebar-export-popover">
            <ExportWorkMenu onClose={() => setExportPopoverOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[2000] min-w-[120px] rounded border border-[#e4e7ed] bg-[var(--bg-dialog)] py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node.isDirectory && (
            <>
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer px-4 py-1 text-sm text-[#606266] hover:bg-[var(--bg-hover)]"
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
                className="cursor-pointer px-4 py-1 text-sm text-[#606266] hover:bg-[var(--bg-hover)]"
                onClick={() => {
                  handleAddFileUnder(contextMenu.node)
                  hideContextMenu()
                }}
              >
                添加文件
              </div>
              <div className="my-1 h-px bg-[#e4e7ed]" />
            </>
          )}
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer px-4 py-1 text-sm text-[#606266] hover:bg-[var(--bg-hover)]"
            onClick={handleRename}
          >
            重命名
          </div>
          <div
            role="button"
            tabIndex={0}
            className="cursor-pointer px-4 py-1 text-sm text-[#606266] hover:bg-[var(--bg-hover)]"
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
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <div className="rename-dialog-content">
            <p className="dialog-label mb-3 text-sm text-foreground">
              重命名 {renameTarget?.isDirectory ? "文件夹" : "文件"}：
            </p>
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
              className="cursor-pointer rounded px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setRenameOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={!renameValue.trim()}
              className={clsx(
                "cursor-pointer rounded px-4 py-2 text-sm text-white bg-[var(--theme-color)] hover:bg-[var(--theme-color-hover)]",
                !renameValue.trim() && "cursor-not-allowed opacity-50"
              )}
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
              <TriangleAlert className="size-6 text-[#f56c6c]" />
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
            <div
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded px-4 py-2 text-sm hover:bg-muted"
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </div>
            <div
              role="button"
              tabIndex={0}
              className="cursor-pointer rounded px-4 py-2 text-sm text-white bg-destructive hover:opacity-90"
              onClick={confirmDelete}
            >
              确定删除
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
