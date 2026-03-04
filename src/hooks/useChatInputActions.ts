import { useCallback } from "react"
import { handleUploadFile, type FileItem } from "@/api/files"
import { showNotesSelectorDialog } from "@/utils/showNotesSelectorDialog"
import { openLoginDialog } from "@/components/LoginDialog"
import type { Note } from "@/api/notes"

interface UseChatInputActionsOptions {
  isLoggedIn: boolean
  addFile: (file: FileItem) => void
  addNote: (note: Note) => void
  clearSelectedNotes: () => void
  onOpenAssociationSelector?: () => void
}

export const useChatInputActions = (options: UseChatInputActionsOptions) => {
  const {
    isLoggedIn,
    addFile,
    addNote,
    clearSelectedNotes,
    onOpenAssociationSelector,
  } = options

  const requireLogin = useCallback(() => {
    if (isLoggedIn) return true
    openLoginDialog()
    return false
  }, [isLoggedIn])

  const handleLocalFileSelect = useCallback(() => {
    if (!requireLogin()) return
    handleUploadFile((file) => addFile(file), {
      onError: (msg) => console.warn(msg),
    })
  }, [requireLogin, addFile])

  const handleOpenAssociationSelector = useCallback(() => {
    if (!requireLogin()) return
    onOpenAssociationSelector?.()
  }, [requireLogin, onOpenAssociationSelector])

  const handleOpenNotesSelector = useCallback(async () => {
    if (!requireLogin()) return
    try {
      const { notes, success } = await showNotesSelectorDialog()
      if (success && notes?.length) {
        notes.forEach((note) => addNote(note))
      } else if (success && (!notes || notes.length === 0)) {
        clearSelectedNotes()
      }
    } catch {
      // user cancelled
    }
  }, [requireLogin, addNote, clearSelectedNotes])

  return {
    handleLocalFileSelect,
    handleOpenAssociationSelector,
    handleOpenNotesSelector,
  }
}
