"use client"

import { useCallback, useMemo } from "react"
import clsx from "clsx"
import { toast } from "sonner"
import { exportRecordReq } from "@/api/works"
import { useEditorStore } from "@/stores/editorStore"
import { serverDataToTree, findNodeById } from "@/stores/editorStore/utils"
import type { FileTreeNode } from "@/stores/editorStore/types"
import { ExportUtils } from "@/utils/exportUtils"

interface ExportWorkMenuProps {
  onClose?: () => void
}

type ExportFormat = "word" | "txt"
type ExportScope = "chapter" | "full"

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

  const runExportTask = useCallback(
    async (task: () => Promise<void>, successMessage: string) => {
      try {
        await task()
        await exportRecordReq()
        onClose?.()
      } catch (error) {
        console.error("导出失败:", error)
        toast.error(error instanceof Error ? error.message : "导出失败")
      }
    },
    [onClose]
  )

  const exportCurrentChapter = useCallback(
    async (format: ExportFormat) => {
      const currentNode = currentEditingId ? findNodeById(treeData, currentEditingId) : null
      if (!hasSelectedChapter || !currentNode) {
        toast.warning("请先选中一个章节")
        return
      }

      const chapterExportTaskByFormat: Record<ExportFormat, () => Promise<void>> = {
        word: () => ExportUtils.exportChapterAsWord(currentNode),
        txt: () => ExportUtils.exportChapterAsTxt(currentNode),
      }
      const chapterSuccessMessageByFormat: Record<ExportFormat, string> = {
        word: "Word 文件导出成功",
        txt: "TXT 文件导出成功",
      }

      await runExportTask(chapterExportTaskByFormat[format], chapterSuccessMessageByFormat[format])
    },
    [currentEditingId, treeData, hasSelectedChapter, runExportTask]
  )

  const exportFullBook = useCallback(
    async (format: ExportFormat) => {
      if (!workNode?.label) {
        toast.warning("没有可导出的作品")
        return
      }

      const fullBookExportTaskByFormat: Record<ExportFormat, () => Promise<void>> = {
        word: () => ExportUtils.exportWorkAsZipDoc(workNode),
        txt: () => ExportUtils.exportWorkAsZipTxt(workNode),
      }
      const fullBookSuccessMessageByFormat: Record<ExportFormat, string> = {
        word: "全书 Word 文件导出成功",
        txt: "全书 TXT 文件导出成功",
      }

      await runExportTask(fullBookExportTaskByFormat[format], fullBookSuccessMessageByFormat[format])
    },
    [workNode, runExportTask]
  )

  const handleExport = useCallback(
    (scope: ExportScope, format: ExportFormat) => {
      if (scope === "chapter") {
        void exportCurrentChapter(format)
        return
      }
      void exportFullBook(format)
    },
    [exportCurrentChapter, exportFullBook]
  )

  const menuItems = useMemo(
    () => [
      { key: "chapter-word", label: "导出单章为 Word", scope: "chapter" as const, format: "word" as const, disabled: !hasSelectedChapter },
      { key: "chapter-txt", label: "导出单章为 TXT", scope: "chapter" as const, format: "txt" as const, disabled: !hasSelectedChapter },
      { key: "full-word", label: "导出全书为 Word", scope: "full" as const, format: "word" as const, disabled: false },
      { key: "full-txt", label: "导出全书为 TXT", scope: "full" as const, format: "txt" as const, disabled: false },
    ],
    [hasSelectedChapter]
  )

  return (
    <div className="w-full p-2">
      <div className="flex flex-col">
        {menuItems.map((item, index) => (
          <div key={item.key}>
            {index === 2 ? <div className="h-px bg-(--border-color) my-2 mx-3" /> : null}
            <div
              role="button"
              tabIndex={0}
              title={item.disabled ? "请先选中一个章节" : undefined}
              className={clsx(
                "rounded flex items-center px-3 py-2 text-[13px] cursor-pointer transition-all duration-200",
                item.disabled ? "opacity-50 cursor-not-allowed" : "text-(--text-primary) hover:bg-(--bg-hover)"
              )}
              onClick={() => {
                if (!item.disabled) {
                  handleExport(item.scope, item.format)
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !item.disabled) {
                  e.preventDefault()
                  handleExport(item.scope, item.format)
                }
              }}
            >
              <span className={clsx("flex-1", item.disabled ? "text-(--text-muted)" : "text-(--text-primary)")}>{item.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExportWorkMenu
