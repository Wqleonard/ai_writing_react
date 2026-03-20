import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { addNote, updateNote } from '@/api/notes'
import type { NoteSourceType } from '@/api/notes'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from "@/components/ui/Button.tsx";
import { Iconfont } from "@/components/Iconfont";
import { mtoast } from '@/components/ui/toast'

interface NoteItem {
  id: number
  title: string
  content: string
  updatedTime: string
  source: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const toEditorHtml = (content: string) => {
  if (!content.trim()) return "<p></p>"
  // 已经是 HTML 的内容直接交给编辑器解析
  if (/<[a-z][\s\S]*>/i.test(content)) return content
  return content
    .split("\n\n")
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("")
}

export default function MNotesDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [currentNote, setCurrentNote] = useState<NoteItem | null>(null)
  const [isNewNote, setIsNewNote] = useState(true)

  // 解析路由中的笔记数据
  useEffect(() => {
    const newNoteState = (location.state as any)?.newNote
    setIsNewNote(newNoteState !== false)

    const noteState = (location.state as any)?.note
    if (noteState) {
      try {
        const noteData: NoteItem =
          typeof noteState === "string" ? JSON.parse(noteState) : noteState
        setCurrentNote(noteData)
        setTitle(noteData.title || '')
      } catch (error) {
        console.error('解析笔记数据失败:', error)
      }
    }
  }, [location.state])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Placeholder.configure({
        placeholder: '记录你的灵感...',
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm focus:outline-none min-h-[50px] px-[40px] py-[24px] text-[28px] leading-[1.6] text-[#1a1a1a]',
      },
    },
    immediatelyRender: false,
  })

  // editor 就绪后再写入内容，避免首次渲染时 editor 还未创建导致丢失
  useEffect(() => {
    if (!editor || !currentNote) return
    editor.commands.setContent(toEditorHtml(currentNote.content || ""))
  }, [editor, currentNote])

  // 返回
  const handleBack = useCallback(async () => {
    // 直接返回，不保存
    navigate('/m/workspace/notes')
  }, [navigate])

  // 完成保存
  const handleComplete = useCallback(async () => {
    const content = editor?.getHTML() || '<p></p>'
    const canSave = title.trim() !== '' || content.trim() !== '<p></p>'

    if (!canSave) {
      mtoast.error("请输入标题或内容", {position: 'top-center'})
      return
    }

    if (isSaving) return

    setIsSaving(true)
    try {
      if (isNewNote) {
        const source: NoteSourceType = 'MINI_APP_ADD'
        await addNote(title.trim(), content, source)
        mtoast.success("保存成功", { position: 'top-center' })
      } else if (currentNote) {
        await updateNote(String(currentNote.id), content, title.trim())
        mtoast.success("更新成功", { position: 'top-center' })
      }
      navigate('/m/workspace/notes')
    } catch (error) {
      console.error(error)
      mtoast.error(isNewNote ? '保存失败，请稍后重试' : '更新失败，请稍后重试', { position: 'top-center' })
    } finally {
      setIsSaving(false)
    }
  }, [editor, title, isSaving, isNewNote, currentNote, navigate])

  const canSave = title.trim() !== '' || (editor?.getHTML() || '') !== '<p></p>'

  return (
    <div className="h-dvh w-full flex flex-col bg-[#f3f3f3]">
      {/* 顶部栏 */}
      <div className="flex h-20 items-center justify-between px-8 border-b border-[#ebebeb] bg-[#f3f3f3]">
        <Button
          variant="ghost"
          size="icon"
          className="size-10 leading-10 active:bg-gray-300"
          onClick={handleBack}
        >
          <Iconfont unicode="&#xeaa2;" className="text-[40px]"/>
        </Button>
        <div
          className={`text-[32px] cursor-pointer ${canSave && !isSaving ? 'text-[#1a1a1a]' : 'text-[#a5a5a5] pointer-events-none'}`}
          onClick={handleComplete}
        >
          完成
        </div>
      </div>

      {/* 编辑区域 */}
      <div className="h-[calc(100dvh-5rem)] flex flex-col overflow-hidden pt-10">
        {/* 标题输入 */}
        <div className="shrink-0 px-[40px]">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入标题"
            className="w-full text-[40px] font-semibold text-[#1a1a1a] placeholder-[#c2c2c2] outline-none border-none bg-[#f3f3f3]"
          />
        </div>

        {/* 编辑器 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {editor && (
            <EditorContent
              editor={editor}
              className="h-full overflow-y-auto memo-editor"
            />
          )}
        </div>
      </div>
    </div>
  )
}
