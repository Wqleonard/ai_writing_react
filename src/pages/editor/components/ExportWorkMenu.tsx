"use client"

import { useCallback, useMemo } from "react"
import clsx from "clsx"
import { toast } from "sonner"
import { useEditorStore } from "@/stores/editorStore"
import { serverDataToTree, findNodeById } from "@/stores/editorStore/utils"
import type { FileTreeNode } from "@/stores/editorStore/types"
import { ExportUtils } from "@/utils/exportUtils"

interface ExportWorkMenuProps {
  onClose?: () => void
}

export const ExportWorkMenu = ({ onClose }: ExportWorkMenuProps) => {
  const workInfo = useEditorStore((s) => s.workInfo)
  const serverData = useEditorStore((s) => s.serverData)
  const currentEditingId = useEditorStore((s) => s.currentEditingId)

  const treeData = useMemo(() => serverDataToTree(serverData ?? {}), [serverData])
  const hasSelectedChapter = !!currentEditingId

  const workNode = useMemo<FileTreeNode>(
    () => ({
      id: workInfo.title,
      key: workInfo.title,
      label: workInfo.title,
      content: "",
      isDirectory: true,
      path: [],
      fileType: "directory",
      children: treeData,
    }),
    [workInfo.title, treeData]
  )

  const exportCurrentChapter = useCallback(
    async (format: "word" | "txt") => {
      const currentNode = currentEditingId ? findNodeById(treeData, currentEditingId) : null
      if (!hasSelectedChapter || !currentNode) {
        toast.warning("请先选中一个章节")
        return
      }
      try {
        if (format === "word") {
          await ExportUtils.exportChapterAsWord(currentNode)
          toast.success("Word 文件导出成功")
        } else {
          await ExportUtils.exportChapterAsTxt(currentNode)
          toast.success("TXT 文件导出成功")
        }
        onClose?.()
      } catch (error) {
        console.error("导出失败:", error)
        toast.error(error instanceof Error ? error.message : "导出失败")
      }
    },
    [currentEditingId, treeData, hasSelectedChapter, onClose]
  )

  const exportFullBook = useCallback(
    async (format: "word" | "txt") => {
      if (!workNode?.label) {
        toast.warning("没有可导出的作品")
        return
      }
      try {
        if (format === "word") {
          await ExportUtils.exportWorkAsZipDoc(workNode)
          toast.success("全书 Word 文件导出成功")
        } else {
          await ExportUtils.exportWorkAsZipTxt(workNode)
          toast.success("全书 TXT 文件导出成功")
        }
        onClose?.()
      } catch (error) {
        console.error("导出失败:", error)
        toast.error(error instanceof Error ? error.message : "导出失败")
      }
    },
    [workNode, onClose]
  )

  return (
    <div className="w-full p-2">
      <div className="flex flex-col">
        <div
          role="button"
          tabIndex={0}
          title={!hasSelectedChapter ? "请先选中一个章节" : undefined}
          className={clsx(
            "rounded flex items-center px-3 py-2 text-[13px] cursor-pointer transition-all duration-200",
            hasSelectedChapter ? "hover:bg-[var(--bg-hover)]" : "opacity-50 cursor-not-allowed"
          )}
          onClick={() => hasSelectedChapter && exportCurrentChapter("word")}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && hasSelectedChapter) {
              e.preventDefault()
              exportCurrentChapter("word")
            }
          }}
        >
          <span className={clsx("flex-1", hasSelectedChapter ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
            导出单章为 Word
          </span>
        </div>
        <div
          role="button"
          tabIndex={0}
          title={!hasSelectedChapter ? "请先选中一个章节" : undefined}
          className={clsx(
            "rounded flex items-center px-3 py-2 text-[13px] cursor-pointer transition-all duration-200",
            hasSelectedChapter ? "hover:bg-[var(--bg-hover)]" : "opacity-50 cursor-not-allowed"
          )}
          onClick={() => hasSelectedChapter && exportCurrentChapter("txt")}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && hasSelectedChapter) {
              e.preventDefault()
              exportCurrentChapter("txt")
            }
          }}
        >
          <span className={clsx("flex-1", hasSelectedChapter ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>
            导出单章为 TXT
          </span>
        </div>

        <div className="h-px bg-[var(--border-color)] my-2 mx-3" />

        <div
          role="button"
          tabIndex={0}
          className="rounded flex items-center px-3 py-2 text-[13px] text-[var(--text-primary)] cursor-pointer transition-all duration-200 hover:bg-[var(--bg-hover)]"
          onClick={() => exportFullBook("word")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              exportFullBook("word")
            }
          }}
        >
          <span className="flex-1">导出全书为 Word</span>
        </div>
        <div
          role="button"
          tabIndex={0}
          className="rounded flex items-center px-3 py-2 text-[13px] text-[var(--text-primary)] cursor-pointer transition-all duration-200 hover:bg-[var(--bg-hover)]"
          onClick={() => exportFullBook("txt")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              exportFullBook("txt")
            }
          }}
        >
          <span className="flex-1">导出全书为 TXT</span>
        </div>
      </div>
    </div>
  )
}

export default ExportWorkMenu
