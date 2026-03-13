export interface NoteItem {
  id: number
  title: string
  content: string
  createdTime: string
  updatedTime: string
  source?: string
}

export interface NotesResponse {
  content: NoteItem[]
  number: number
  last: boolean
  totalElements: number
  totalPages: number
}

export interface NoteStoreState {
  noteList: NoteItem[]
  loading: boolean
  finished: boolean
  page: number
  pageSize: number
}

export interface NoteStoreActions {
  loadNotes: (reset?: boolean) => Promise<void>
  deleteNoteById: (noteId: string) => Promise<void>
  saveNote: (title: string, content: string, source: string) => Promise<void>
  updateNote: (noteId: string, title: string, content: string) => Promise<void>
  resetNotes: () => void
}

export type NoteStore = NoteStoreState & NoteStoreActions
