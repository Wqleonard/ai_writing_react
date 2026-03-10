import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { StreamIndicator } from '@/components/StreamIndicator'
import './index.css'

export interface MarkdownEditorProps {
  value?: string
  onChange?: (markdown: string) => void
  className?: string
  readonly?: boolean
  loading?: boolean
  maxlength?: number
  placeholder?: string
}

const isEmptyContent = (content: string | undefined | null): boolean => {
  return !content || content.trim() === ''
}

export const MarkdownEditor = ({
  value = '',
  onChange,
  className = '',
  readonly = false,
  loading = false,
  placeholder = '请输入内容...',
  maxlength,
}: MarkdownEditorProps) => {
  const isInternalUpdateRef = useRef(false)

  const extensions = useMemo(
    () => [
      Markdown,
      Placeholder.configure({ placeholder }),
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlock,
    ],
    [placeholder]
  )

  const editor = useEditor({
    content: isEmptyContent(value) ? undefined : value,
    contentType: 'markdown',
    editable: !readonly,
    extensions,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        style: 'min-height: 200px;',
      },
    },
    onUpdate: ({ editor }) => {
      if (readonly) return
      let nextMarkdown =
        (editor as Editor & { getMarkdown?: () => string }).getMarkdown?.() ?? ''
      if (maxlength != null && nextMarkdown.length > maxlength) {
        nextMarkdown = nextMarkdown.slice(0, maxlength)
        isInternalUpdateRef.current = true
        editor.commands.setContent(nextMarkdown, { contentType: 'markdown' })
      }
      onChange?.(nextMarkdown)
      queueMicrotask(() => {
        isInternalUpdateRef.current = false
      })
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readonly)
  }, [editor, readonly])

  useEffect(() => {
    if (!editor || isInternalUpdateRef.current) return
    const currentMarkdown =
      (editor as Editor & { getMarkdown?: () => string }).getMarkdown?.() ?? ''
    let nextMarkdown = value ?? ''
    if (maxlength != null && nextMarkdown.length > maxlength) {
      nextMarkdown = nextMarkdown.slice(0, maxlength)
    }
    if (nextMarkdown !== currentMarkdown) {
      editor.commands.setContent(nextMarkdown, { contentType: 'markdown' })
    }
  }, [editor, value, maxlength])

  return (
    <div
      className={`markdown-editor w-full h-full p-3 ${readonly ? 'is-readonly' : ''} ${className}`.trim()}
    >
      <EditorContent editor={editor} className="editor-content markdown-editor-content" />
      {loading ? <StreamIndicator /> : null}
    </div>
  )
}

export default MarkdownEditor
