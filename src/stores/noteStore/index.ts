import { create } from 'zustand'
import { getMWorkspaceNotes, type NoteItem as NoteItemApi } from '@/api/m-workspace-notes'
import { addNote, updateNote, deleteNote, type NoteSourceType } from '@/api/notes'
import type { NoteStoreState, NoteStoreActions, NoteStore, NoteItem } from './types'

const initialState: NoteStoreState = {
  noteList: [],
  loading: false,
  finished: false,
  page: 0,
  pageSize: 20,
}

export const useNoteStore = create<NoteStore>()((set, get) => ({
  ...initialState,

  loadNotes: async (reset = false) => {
    const { loading, finished, page, pageSize } = get()

    if (loading) return
    if (finished && !reset) return

    set({ loading: true })

    try {
      const currentPage = reset ? 0 : page
      const response = await getMWorkspaceNotes(currentPage, pageSize)

      if (response?.content) {
        const { content, last, number } = response

        // 将 API 返回的 NoteItemApi[] 转换为 store 需要的 NoteItem[]
        const noteItems: NoteItem[] = content.map((note) => ({
          id: note.id,
          title: note.title || '',
          content: note.content,
          createdTime: note.updatedTime, // 使用 updatedTime 作为 createdTime 的兜底
          updatedTime: note.updatedTime,
          source: note.source || '',
        }))

        if (reset) {
          set({
            noteList: noteItems,
            page: 0,
            finished: false,
          })
        } else {
          set((state) => ({
            noteList: [...state.noteList, ...noteItems],
            page: number,
          }))
        }

        set({
          finished: last || content.length === 0,
        })
      } else {
        set({ finished: true })
      }
    } catch (error) {
      console.error('加载笔记列表失败:', error)
      set({ finished: true })
    } finally {
      set({ loading: false })
    }
  },

  deleteNoteById: async (noteId: string) => {
    await deleteNote(noteId)
    // 删除后重新加载列表
    await get().loadNotes(true)
  },

  saveNote: async (title: string, content: string, source: string) => {
    await addNote(title, content, source as NoteSourceType)
  },

  updateNote: async (noteId: string, title: string, content: string) => {
    await updateNote(noteId, content, title)
  },

  resetNotes: () => {
    set(initialState)
  },
}))

export const selectNoteList = (state: NoteStore) => state.noteList
export const selectNotesLoading = (state: NoteStore) => state.loading
export const selectNotesFinished = (state: NoteStore) => state.finished
