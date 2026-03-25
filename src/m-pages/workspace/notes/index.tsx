'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNoteStore, selectNoteList, selectNotesLoading, selectNotesFinished } from '@/stores/noteStore'
import { deleteNote } from '@/api/notes'
import BOOM_CAT_ICON from '@/assets/images/boom_cat.png'
import { mtoast } from '@/components/ui/toast'
import { MConfirmDialog } from '@/components/ui/MConfirmDialog'

export default function MNotesPage() {
  const DELETE_ACTION_WIDTH = 96 // 对应 w-24
  const MAX_LEFT_OFFSET = -DELETE_ACTION_WIDTH
  const SNAP_THRESHOLD = MAX_LEFT_OFFSET / 2

  const navigate = useNavigate()
  const noteList = useNoteStore(selectNoteList)
  const loading = useNoteStore(selectNotesLoading)
  const finished = useNoteStore(selectNotesFinished)
  const loadNotes = useNoteStore((state) => state.loadNotes)

  const containerRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<number | null>(null)
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const touchStartOffset = useRef(0)

  // 初始化加载
  useEffect(() => {
    loadNotes(true)
  }, [loadNotes])

  // 触底加载更多
  const handleScroll = useCallback(() => {
    if (loading || finished) return

    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadNotes(false)
    }
  }, [loading, finished, loadNotes])

  // 触摸开始
  const handleTouchStart = useCallback((e: React.TouchEvent, noteId: number) => {
    touchStartX.current = e.touches[0].clientX
    touchStartOffset.current = activeId === noteId ? currentOffset : 0
    setActiveId(noteId)
    setCurrentOffset(touchStartOffset.current)
  }, [activeId, currentOffset])

  // 触摸移动
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!activeId) return
    touchCurrentX.current = e.touches[0].clientX
    const diff = touchCurrentX.current - touchStartX.current
    // 支持左滑打开、右滑关闭；基于触摸开始时的偏移量计算
    const nextOffset = Math.min(0, Math.max(MAX_LEFT_OFFSET, touchStartOffset.current + diff))
    setCurrentOffset(nextOffset)
  }, [activeId, MAX_LEFT_OFFSET])

  // 触摸结束
  const handleTouchEnd = useCallback(() => {
    if (!activeId) return

    if (currentOffset < SNAP_THRESHOLD) {
      // 吸附到完全展开
      setCurrentOffset(MAX_LEFT_OFFSET)
    } else {
      // 吸附到收起
      setCurrentOffset(0)
      setActiveId(null)
    }
  }, [activeId, currentOffset, MAX_LEFT_OFFSET, SNAP_THRESHOLD])

  // 打开删除确认框
  const handleDelete = useCallback((noteId: number) => {
    setPendingDeleteNoteId(noteId)
    setDeleteDialogOpen(true)
  }, [])

  // 确认删除
  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteNoteId) return

    try {
      await deleteNote(String(pendingDeleteNoteId))
      mtoast.success('删除成功')

      // 重新加载列表
      setCurrentOffset(0)
      setActiveId(null)
      setDeleteDialogOpen(false)
      setPendingDeleteNoteId(null)
      loadNotes(true)
    } catch (e: any) {
      console.error('删除失败:', e)
      mtoast.error('删除失败，请稍后重试')
    }
  }, [loadNotes, pendingDeleteNoteId])

  // 点击内容
  const handleContentClick = useCallback(
    (note: any) => {
      // 如果当前项处于展开状态，收起
      if (activeId === note.id && currentOffset !== 0) {
        setCurrentOffset(0)
        setActiveId(null)
        return
      }

      // 跳转到详情页
      navigate('/m/workspace/notes/detail', {
        state: {
          newNote: false,
          note: JSON.stringify(note),
        },
      })
    },
    [activeId, currentOffset, navigate]
  )

  // 添加笔记
  const handleAddNote = useCallback(() => {
    navigate('/m/workspace/notes/detail', {
      state: { newNote: true },
    })
  }, [navigate])

  // 格式化内容预览
  const formatContentPreview = (content: string | null | undefined): string => {
    if (!content) return '无内容'

    const plainText = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`{3}[\s\S]*?`{3}/g, '')
      .replace(/`(.+?)`/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.+?)\]\(.*?\)/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^---+$/gm, '')
      .replace(/\n+/g, ' ')
      .trim()

    if (!plainText) return '无内容'
    return plainText.length > 50 ? plainText.slice(0, 50) + '...' : plainText
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-100">
      {/* 顶部标题栏 */}
      <div className="flex items-center h-22 px-9">
        <div className="w-15 h-15 mr-4" style={{ transform: 'scaleX(-1)' }}>
          <img src={BOOM_CAT_ICON} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="text-[32px] font-semibold text-[#7f7f7f]">爆文猫写作</div>
      </div>

      {/* 笔记列表 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-9 py-4 hide-scrollbar"
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-5">
          {noteList.map((note) => (
            <div
              key={note.id}
              className="relative bg-white rounded-[16px] overflow-hidden touch-pan-y"
              onTouchStart={(e) => handleTouchStart(e, note.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* 主体内容 */}
              <div
                className="px-6 py-5 bg-white relative z-10 transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${activeId === note.id ? currentOffset : 0}px)` }}
                onClick={() => handleContentClick(note)}
              >
                <div className="text-[30px] font-semibold line-clamp-1 text-[#1a1a1a]">
                  {note.title || '无标题'}
                </div>
                <div className="flex items-end gap-2 mt-2">
                  <div className="text-[20px] text-[#a5a5a5] shrink-0">
                    {formatTime(note.updatedTime)}
                  </div>
                  <div className="text-[22px] text-[#a5a5a5] truncate flex-1">
                    {formatContentPreview(note.content)}
                  </div>
                </div>
              </div>

              {/* 右侧删除按钮 */}
              {activeId === note.id && currentOffset < 0 && (
                <div
                  className="absolute w-24 right-0 top-0 h-full flex items-center justify-center bg-[#ff4444] text-white z-0 active:bg-[#cc0000] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(note.id)
                  }}
                >
                  <span className="text-[28px]">删除</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 加载状态 */}
        {loading && (
          <div className="text-center py-4 text-gray-500 text-[24px]">加载中...</div>
        )}
        {finished && noteList.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-[28px]">暂无笔记</div>
        )}
      </div>

      {/* 添加按钮 */}
      <div
        className="iconfont size-24 z-10 rounded-full fixed bottom-60 right-20 bg-black text-[40px] leading-24 text-white font-semibold text-center cursor-pointer custom-btn"
        onClick={handleAddNote}
      >
        &#xe625;
      </div>

      <MConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setPendingDeleteNoteId(null)
          }
        }}
        title="提示"
        message="确定要删除这条笔记吗？"
        cancelText="取消"
        confirmText="删除"
        confirmClassName="text-[#ff4444] active:bg-[#fff1f1]"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
