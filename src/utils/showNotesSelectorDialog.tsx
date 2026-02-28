import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NotesSelectorDialog } from '@/components/NotesSelectorDialog'
import { useChatInputStore } from '@/stores/chatInputStore'
import type { Note } from '@/api/notes'

const UNMOUNT_DELAY_MS = 300

export interface NotesSelectorDialogOptions {
  confirmButtonText?: string
}

export interface NotesSelectorResult {
  notes: Note[]
  success: boolean
}

const Wrapper = ({
  options,
  resolve,
  reject,
  onUnmount,
}: {
  options: NotesSelectorDialogOptions
  resolve: (value: NotesSelectorResult) => void
  reject: (reason: Error) => void
  onUnmount: () => void
}) => {
  const [open, setOpen] = useState(true)
  const resolvedRef = useRef(false)

  const selectedNoteIds =
    useChatInputStore.getState().selectedNotes?.map((n) => n.id) ?? []

  const handleConfirm = (notes: Note[]) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setOpen(false)
    setTimeout(() => {
      resolve({ notes, success: true })
      onUnmount()
    }, UNMOUNT_DELAY_MS)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && !resolvedRef.current) {
      resolvedRef.current = true
      setTimeout(() => {
        reject(new Error('用户关闭对话框'))
        onUnmount()
      }, UNMOUNT_DELAY_MS)
    }
  }

  return (
    <NotesSelectorDialog
      open={open}
      onOpenChange={handleOpenChange}
      selectedNoteIds={selectedNoteIds}
      confirmButtonText={options.confirmButtonText ?? '添加到对话'}
      onConfirm={handleConfirm}
    />
  )
}

/**
 * 打开笔记选择器对话框
 * @param options 选项
 * @returns Promise，resolve 时返回 { success, notes }，reject 表示用户取消或关闭
 */
export const showNotesSelectorDialog = (
  options: NotesSelectorDialogOptions = {}
): Promise<NotesSelectorResult> => {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onUnmount = () => {
      root.unmount()
      if (document.body.contains(container)) {
        document.body.removeChild(container)
      }
    }
    root.render(
      <Wrapper options={options} resolve={resolve} reject={reject} onUnmount={onUnmount} />
    )
  })
}
