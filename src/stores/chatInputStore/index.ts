import { create } from 'zustand'
import type { ChatInputStore, AgentTalkToolValue } from './types'
import type { Note } from '@/api/notes'
import type { FileItem, SelectedText } from '@/stores/chatStore'

export type { ChatInputStore } from './types'

const DEFAULT_TOOLS: AgentTalkToolValue[] = [
  'internet_search_tool',
  'knowledge_search_tool',
  'deep_thinking_tool',
  'auto_execute_tool',
]

export const useChatInputStore = create<ChatInputStore>((set, get) => ({
  associationTags: [],
  selectedNotes: [],
  selectedFiles: [],
  selectedTexts: [],
  selectedTools: DEFAULT_TOOLS,
  isShowAnswerTip: false,
  isShowWritingStyleTip: false,

  setShowAnswerTip: (value) => set({ isShowAnswerTip: value }),
  setShowWritingStyleTip: (value) => set({ isShowWritingStyleTip: value }),

  // 关联关系
  setAssociationTags: (tags: string[]) => set({ associationTags: [...tags] }),
  addAssociationTag: (tag: string) =>
    set((state) =>
      state.associationTags.includes(tag)
        ? state
        : { associationTags: [...state.associationTags, tag] }
    ),
  removeAssociationTag: (index: number) =>
    set((state) => {
      if (index < 0 || index >= state.associationTags.length) return state
      const next = [...state.associationTags]
      next.splice(index, 1)
      return { associationTags: next }
    }),
  clearAssociationTags: () => set({ associationTags: [] }),

  // 笔记
  addNote: (note: Note) =>
    set((state) =>
      state.selectedNotes.some((n) => n.id === note.id)
        ? state
        : { selectedNotes: [...state.selectedNotes, note] }
    ),
  removeNote: (noteId: number) =>
    set((state) => ({
      selectedNotes: state.selectedNotes.filter((n) => n.id !== noteId),
    })),
  clearSelectedNotes: () => set({ selectedNotes: [] }),
  setSelectedNotes: (notes: Note[]) => set({ selectedNotes: [...notes] }),

  // 文件
  setSelectedFiles: (files: FileItem[]) => set({ selectedFiles: [...files] }),
  addFile: (file: FileItem) =>
    set((state) => ({ selectedFiles: [...state.selectedFiles, file] })),
  removeFile: (fileId: string) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.filter((f) => f.id !== fileId),
    })),
  clearSelectedFiles: () => set({ selectedFiles: [] }),

  // 划词文本
  setSelectedTexts: (texts: SelectedText[]) =>
    set({ selectedTexts: [...texts] }),
  addSelectedText: (text: SelectedText) =>
    set((state) => ({ selectedTexts: [...state.selectedTexts, text] })),
  removeSelectedText: (textId: string) =>
    set((state) => ({
      selectedTexts: state.selectedTexts.filter((t) => t.id !== textId),
    })),
  clearSelectedTexts: () => set({ selectedTexts: [] }),

  // 工具
  setSelectedTools: (tools: AgentTalkToolValue[]) =>
    set({ selectedTools: [...tools] }),
  toggleTool: (tool: AgentTalkToolValue) =>
    set((state) => {
      const exists = state.selectedTools.includes(tool)
      return {
        selectedTools: exists
          ? state.selectedTools.filter((t) => t !== tool)
          : [...state.selectedTools, tool],
      }
    }),
  resetSelectedTools: () => set({ selectedTools: DEFAULT_TOOLS }),

  // 批量操作
  clearAll: () =>
    set((state) => ({
      associationTags: [],
      selectedNotes: [],
      selectedFiles: [],
      selectedTexts: [],
      isShowAnswerTip: false,
      isShowWritingStyleTip: state.isShowWritingStyleTip,
      // 保留 selectedTools
    })),

  initializeFromParams: (params) =>
    set((state) => ({
      associationTags:
        params.associationTags ?? state.associationTags,
      selectedNotes: params.selectedNotes ?? state.selectedNotes,
      selectedFiles: params.selectedFiles ?? state.selectedFiles,
      selectedTexts: params.selectedTexts ?? state.selectedTexts,
      selectedTools: params.selectedTools ?? state.selectedTools,
      isShowAnswerTip:
        params.isShowAnswerTip ?? state.isShowAnswerTip,
    })),
}))

