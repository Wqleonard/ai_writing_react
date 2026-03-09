import type { Note } from '@/api/notes'
import type { FileItem, SelectedText } from '@/stores/chatStore'

/** 与 Vue AgentTalkToolValue 对齐的工具类型 */
export type AgentTalkToolValue =
  | 'internet_search_tool'
  | 'knowledge_search_tool'
  | 'deep_thinking_tool'
  | 'auto_execute_tool'

export interface ChatInputStore {
  /** 关联关系标签列表 */
  associationTags: string[]
  /** 选中的笔记列表 */
  selectedNotes: Note[]
  /** 选中的文件列表 */
  selectedFiles: FileItem[]
  /** 选中的划词文本列表 */
  selectedTexts: SelectedText[]
  /** 选中的工具列表 */
  selectedTools: AgentTalkToolValue[]
  /** 是否展示“关闭仅回答”的提示 */
  isShowAnswerTip: boolean
  /** 是否展示“文风提示”的提示 */
  isShowWritingStyleTip: boolean
  /** 递增即表示请求打开文风选择弹窗（popover） */
  writingStylePopoverRequest: number
  /** 请求打开时希望选中的文风 id */
  requestedWritingStyleId: string | null

  setShowAnswerTip: (value: boolean) => void
  setShowWritingStyleTip: (value: boolean) => void
  requestOpenWritingStylePopover: (styleId?: string) => void
  clearWritingStylePopoverRequest: () => void

  // ========= 关联关系相关 =========
  setAssociationTags: (tags: string[]) => void
  addAssociationTag: (tag: string) => void
  removeAssociationTag: (index: number) => void
  clearAssociationTags: () => void

  // ========= 笔记相关 =========
  addNote: (note: Note) => void
  removeNote: (noteId: number) => void
  clearSelectedNotes: () => void
  setSelectedNotes: (notes: Note[]) => void

  // ========= 文件相关 =========
  setSelectedFiles: (files: FileItem[]) => void
  addFile: (file: FileItem) => void
  removeFile: (fileId: string) => void
  clearSelectedFiles: () => void

  // ========= 划词文本相关 =========
  setSelectedTexts: (texts: SelectedText[]) => void
  addSelectedText: (text: SelectedText) => void
  removeSelectedText: (textId: string) => void
  clearSelectedTexts: () => void

  // ========= 工具相关 =========
  setSelectedTools: (tools: AgentTalkToolValue[]) => void
  toggleTool: (tool: AgentTalkToolValue) => void
  resetSelectedTools: () => void

  // ========= 批量操作 =========
  clearAll: () => void
  initializeFromParams: (params: {
    associationTags?: string[]
    selectedNotes?: Note[]
    selectedFiles?: FileItem[]
    selectedTexts?: SelectedText[]
    selectedTools?: AgentTalkToolValue[]
    isShowAnswerTip?: boolean
  }) => void
}

