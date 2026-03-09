import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ScrollArea } from '@/components/ui/ScrollArea'
import {
  getNotes,
  searchNotes,
  addNote as addNoteApi,
  updateNote,
  deleteNote as deleteNoteApi,
} from '@/api/notes'
import type { Note, NotesPageResponse } from '@/api/notes'
import { formatLocalTime } from '@/utils/formatLocalTime'
import { getNoteSourceDisplayName } from '@/utils/noteSource'
import { Search, Trash2, Check, Circle } from 'lucide-react'
import clsx from 'clsx'
import EMPTY_IMG from '@/assets/images/empty.webp'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

export interface NotesSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedNoteIds?: number[]
  confirmButtonText?: string
  onConfirm: (notes: Note[]) => void
  onClose?: () => void
}

export const NotesSelectorDialog = ({
  open,
  onOpenChange,
  selectedNoteIds = [],
  confirmButtonText = '添加到对话',
  onConfirm,
  onClose,
}: NotesSelectorDialogProps) => {
  const [notesList, setNotesList] = useState<Note[]>([])
  const [page, setPage] = useState(-1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadPage = useCallback(async (pageNum: number, keyword: string, append: boolean) => {
    let req: NotesPageResponse
    if (keyword) {
      req = await searchNotes({
        page: pageNum,
        size: PAGE_SIZE,
        keyword,
      })
    } else {
      req = await getNotes({
        page: pageNum,
        size: PAGE_SIZE,
        sortBy: 'updatedTime',
        sortDirection: 'desc',
      })
    }
    if (!req || typeof req !== 'object') return false
    const newNotes = Array.isArray(req.content) ? req.content : []
    if (req.last === true) setHasMore(false)
    if (newNotes.length > 0) {
      setNotesList(prev => (append ? [...prev, ...newNotes] : newNotes))
      setPage(pageNum)
    } else {
      setHasMore(false)
    }
    return true
  }, [])

  const loadMore = useCallback(async () => {
    if (isLoadingNotes || isLoadingMore || !hasMore) return
    const isFirst = page === -1
    if (isFirst) setIsLoadingNotes(true)
    else setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const keyword = searchText.trim()
      await loadPage(nextPage, keyword, !isFirst)
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingNotes(false)
      setIsLoadingMore(false)
    }
  }, [page, hasMore, isLoadingNotes, isLoadingMore, searchText, loadPage])

  const updateNotes = useCallback(async () => {
    setPage(-1)
    setNotesList([])
    setHasMore(true)
    setIsLoadingNotes(true)
    try {
      const keyword = searchText.trim()
      await loadPage(0, keyword, false)
    } catch {
      setHasMore(false)
    } finally {
      setIsLoadingNotes(false)
    }
  }, [searchText, loadPage])

  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    if (!open) return
    setSelectedIds([...selectedNoteIds])
    setSearchText('')
    setPage(-1)
    setNotesList([])
    setHasMore(true)
    setIsExpanded(false)
    setIsCreating(false)
    setExpandedNoteId(null)
    setEditTitle('')
    setEditContent('')
    skipNextSearchRef.current = true
    setIsLoadingNotes(true)
    loadPage(0, '', false).finally(() => setIsLoadingNotes(false))
  }, [open, selectedNoteIds]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      updateNotes()
      searchTimerRef.current = null
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [open, searchText]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const viewport = scrollRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport || isExpanded) return
    const { scrollTop, scrollHeight, clientHeight } = viewport
    if (scrollHeight - scrollTop - clientHeight < 50) loadMore()
  }, [loadMore, isExpanded])

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [handleScroll, open])

  const toggleSelection = (noteId: number) => {
    setSelectedIds(prev =>
      prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
    )
  }

  const isSelected = (noteId: number) => selectedIds.includes(noteId)

  const handleConfirm = () => {
    const selected = notesList.filter(n => selectedIds.includes(n.id))
    onConfirm(selected)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    onClose?.()
  }

  const handleDelete = async (noteId: number) => {
    if (!window.confirm('确定要删除该笔记吗？删除后无法恢复。')) return
    try {
      await deleteNoteApi(String(noteId))
      setNotesList(prev => prev.filter(n => n.id !== noteId))
      setSelectedIds(prev => prev.filter(id => id !== noteId))
    } catch {
      console.error('删除笔记失败')
    }
  }

  const expandedNote = expandedNoteId ? notesList.find(n => n.id === expandedNoteId) : null
  const expandedSource = isCreating ? '未命名作品' : getNoteSourceDisplayName(expandedNote?.source)
  const expandedTime = isCreating
    ? new Date().toLocaleString('zh-CN')
    : expandedNote
      ? formatLocalTime(expandedNote.createdTime ?? expandedNote.updatedTime)
      : ''

  const onNoteRowClick = (note: Note) => {
    setIsCreating(false)
    setExpandedNoteId(note.id)
    setEditTitle(note.title ?? '')
    setEditContent(note.content ?? '')
    setIsExpanded(true)
  }

  const handleCreateNote = () => {
    setIsCreating(true)
    setExpandedNoteId(null)
    setEditTitle('')
    setEditContent('')
    setIsExpanded(true)
  }

  const handleReturn = () => {
    setIsExpanded(false)
    setIsCreating(false)
    setExpandedNoteId(null)
    setEditTitle('')
    setEditContent('')
  }

  const handleSave = async () => {
    if (!editContent.trim()) return
    const finalTitle = editTitle.trim() || editContent.trim().split('\n')[0]?.trim() || '无标题笔记'
    try {
      setIsSaving(true)
      if (isCreating) {
        const newNote = await addNoteApi(finalTitle, editContent.trim(), 'PC_ADD')
        if (newNote && typeof newNote === 'object' && 'id' in newNote) {
          setNotesList(prev => [newNote as Note, ...prev])
        }
        handleReturn()
      } else if (expandedNoteId) {
        await updateNote(String(expandedNoteId), editContent.trim(), finalTitle)
        setNotesList(prev =>
          prev.map(n =>
            n.id === expandedNoteId
              ? {
                  ...n,
                  title: finalTitle,
                  content: editContent.trim(),
                  updatedTime: new Date().toISOString(),
                }
              : n
          )
        )
        handleReturn()
      }
    } catch {
      console.error('保存笔记失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onOpenAutoFocus={event => event.preventDefault()}
        showCloseButton
        className={clsx(
          'notes-manager-dialog w-200 gap-0 p-0 overflow-hidden h-154',
          isExpanded && 'content-expanded'
        )}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 px-6 py-4 pr-12 h-17">
          <DialogTitle className="text-lg font-semibold">使用笔记</DialogTitle>
          {!isExpanded && (
            <div className="relative w-[200px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="h-9 rounded-2xl pl-9 focus-visible:ring-1"
              />
            </div>
          )}
        </DialogHeader>

        <div ref={scrollRef} className="relative overflow-hidden bg-white h-[550px]">
          {isExpanded ? (
            <div className="px-6 h-[524px]">
              <div className="bg-[#f6f6f6] h-full rounded-lg p-2 flex flex-col">
                <Input
                  placeholder="请输入标题"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="mb-2 rounded-md bg-muted/50"
                />
                <Textarea
                  placeholder="请输入内容"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="min-h-[280px] flex-1 resize-none rounded-md"
                />
                <div className="flex items-center justify-between pt-4">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>来源: {expandedSource}</span>
                    <span>创建时间: {expandedTime}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReturn}>
                      返回
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? '保存中...' : '保存'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <ScrollArea className="h-[480px]">
                <div className="py-3 px-6 flex flex-col gap-3">
                  {isLoadingNotes && notesList.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                      <span>加载中...</span>
                    </div>
                  ) : (
                    <>
                      {notesList.map(note => (
                        <div
                          key={note.id}
                          className={clsx(
                            'flex flex-col rounded-lg bg-[#f6f6f6] p-4 transition-colors',
                            isSelected(note.id) && 'ring-2 ring-primary/50'
                          )}
                        >
                          <div
                            className="cursor-pointer"
                            onClick={() => onNoteRowClick(note)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onNoteRowClick(note)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="mb-2 font-semibold text-foreground line-clamp-1">
                              {note.title || '无标题'}
                            </div>
                            <div className="line-clamp-3 text-sm text-muted-foreground">
                              {note.content}
                            </div>
                          </div>
                          <div className="my-3 h-px bg-border" />
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-4 text-muted-foreground">
                              {note.source && (
                                <span>来源: {getNoteSourceDisplayName(note.source)}</span>
                              )}
                              <span>
                                创建时间: {formatLocalTime(note.createdTime ?? note.updatedTime)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div
                                className="cursor-pointer text-muted-foreground hover:text-destructive"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleDelete(note.id)
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <Trash2 className="size-4" />
                              </div>
                              <div
                                className="cursor-pointer"
                                onClick={e => {
                                  e.stopPropagation()
                                  toggleSelection(note.id)
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                {isSelected(note.id) ? (
                                  <Check className="size-5 text-primary" />
                                ) : (
                                  <Circle className="size-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {notesList.length === 0 && !isLoadingNotes && (
                        <div className="flex flex-col items-center justify-center py-12">
                          <img src={EMPTY_IMG} alt="" className="h-24 w-24 object-contain" />
                          <p className="mt-2 text-sm text-muted-foreground">暂无笔记</p>
                        </div>
                      )}
                      {isLoadingMore && (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          加载中...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 py-4 px-6">
                <Button variant="outline" onClick={handleCreateNote}>
                  +创建新笔记
                </Button>
                <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>
                  {confirmButtonText}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
