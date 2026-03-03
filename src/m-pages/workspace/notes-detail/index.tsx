import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { addNote, updateNote } from '@/api/notes'
import type { NoteSourceType } from '@/api/notes'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from "@/components/ui/Button.tsx";
import { Iconfont } from "@/components/IconFont";
import { toast } from "sonner";

interface NoteItem {
  id: number
  title: string
  content: string
  updatedTime: string
  source: string
}

export default function MNotesDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [currentNote, setCurrentNote] = useState<NoteItem | null>(null)
  const [isNewNote, setIsNewNote] = useState(true)

  // 初始化笔记数据
  useEffect(() => {
    const newNoteState = (location.state as any)?.newNote
    setIsNewNote(newNoteState !== false)

    const noteState = (location.state as any)?.note
    if (noteState) {
      try {
        const noteData: NoteItem = JSON.parse(noteState)
        setCurrentNote(noteData)
        setTitle(noteData.title || '')
        // 设置编辑器内容
        editor?.commands.setContent(noteData.content || '<p></p>')
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

  // 返回
  const handleBack = useCallback(async () => {
    // 直接返回，不保存
    navigate('/m/m-workspace-notes')
  }, [navigate])

  // 完成保存
  const handleComplete = useCallback(async () => {
    const content = editor?.getHTML() || '<p></p>'
    const canSave = title.trim() !== '' || content.trim() !== '<p></p>'

    if (!canSave) {
      toast.error("请输入标题或内容", {position: 'top-center'})
      return
    }

    if (isSaving) return

    setIsSaving(true)
    try {
      if (isNewNote) {
        const source: NoteSourceType = 'MINI_APP_ADD'
        await addNote(title.trim(), content, source)
        toast.success("保存成功", { position: 'top-center' })
      } else if (currentNote) {
        await updateNote(String(currentNote.id), content, title.trim())
        toast.success("更新成功", { position: 'top-center' })
      }
      navigate('/m/m-workspace-notes')
    } catch (error) {
      console.error(error)
      toast.error(isNewNote ? '保存失败，请稍后重试' : '更新失败，请稍后重试', { position: 'top-center' })
    } finally {
      setIsSaving(false)
    }
  }, [editor, title, isSaving, isNewNote, currentNote, navigate])

  const canSave = title.trim() !== '' || (editor?.getHTML() || '') !== '<p></p>'

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#f3f3f3]">
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
