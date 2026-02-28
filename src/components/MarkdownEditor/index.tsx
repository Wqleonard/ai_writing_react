import React, { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import EmptyParagraph from '@/extensions/EmptyParagraph'
import { StreamIndicator } from '@/components/StreamIndicator'
import './MarkdownEditor.css'

export interface MarkdownEditorProps {
  className?: string
  readonly?: boolean
  placeholder?: string
  loading?: boolean
  /** 可选，最大字符数限制 */
  maxlength?: number
  /** 受控：当前 markdown 内容 */
  value?: string
  /** 受控：内容变化回调 */
  onChange?: (markdown: string) => void
}

export interface MarkdownEditorRef {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  focus: () => void
  blur: () => void
  editor: Editor | null
}

const isEmptyContent = (content: string | undefined | null): boolean => {
  return !content || content.trim() === ''
}

export const MarkdownEditor = React.forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      className = '',
      readonly = false,
      placeholder = '请输入内容...',
      loading = false,
      maxlength,
      value = '',
      onChange,
    },
    ref
  ) {
    const isInternalUpdate = useRef(false)

    const extensions = useMemo(
      () => [
        Markdown,
        EmptyParagraph,
        Placeholder.configure({ placeholder }),
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          bulletList: {},
          orderedList: {},
          blockquote: {},
          codeBlock: {},
          horizontalRule: {},
          hardBreak: {},
        }),
      ],
      [placeholder]
    )

    const editor = useEditor(
      {
        content: isEmptyContent(value) ? undefined : value,
        editable: !readonly,
        contentType: 'markdown',
        extensions,
        editorProps: {
          attributes: {
            class: 'prose prose-sm max-w-none focus:outline-none',
            style: 'min-height: 200px;',
          },
        },
        onUpdate: ({ editor }) => {
          if (readonly) return
          isInternalUpdate.current = true
          let content = (editor as Editor & { getMarkdown?: () => string }).getMarkdown?.() ?? ''
          if (maxlength != null && content.length > maxlength) {
            content = content.slice(0, maxlength)
            onChange?.(content)
            editor.commands.setContent(content, { contentType: 'markdown' })
          } else {
            onChange?.(content)
          }
          queueMicrotask(() => {
            isInternalUpdate.current = false
          })
        },
      },
      [readonly, maxlength, placeholder]
    )

    // 同步外部 value 到编辑器
    useEffect(() => {
      if (!editor || isInternalUpdate.current) return
      try {
        const currentMarkdown = (editor as Editor & { getMarkdown?: () => string }).getMarkdown?.() ?? ''
        let valueToSet = value ?? ''
        if (maxlength != null && valueToSet.length > maxlength) {
          valueToSet = valueToSet.slice(0, maxlength)
        }
        if (isEmptyContent(valueToSet)) {
          if (!editor.isEmpty) {
            editor.commands.clearContent()
          }
        } else if (valueToSet !== currentMarkdown) {
          editor.commands.setContent(valueToSet, { contentType: 'markdown' })
        }
      } catch (err) {
        console.error('Error setting editor content:', err)
      }
    }, [editor, value, maxlength])

    // 只读状态变化
    useEffect(() => {
      if (editor) {
        editor.setEditable(!readonly)
      }
    }, [editor, readonly])

    // 卸载时销毁
    useEffect(() => {
      return () => {
        editor?.destroy()
      }
    }, [editor])

    // 暴露命令给父组件
    React.useImperativeHandle(
      ref,
      () => ({
        getMarkdown: () =>
          (editor as Editor & { getMarkdown?: () => string })?.getMarkdown?.() ?? '',
        setMarkdown: (markdown: string) => {
          editor?.commands.setContent(markdown, { contentType: 'markdown' })
        },
        focus: () => editor?.commands.focus(),
        blur: () => editor?.commands.blur(),
        editor: editor ?? null,
      }),
      [editor]
    )

    return (
      <div
        className={`markdown-editor ${readonly ? 'is-readonly' : ''} ${className}`.trim()}
        style={{ width: '100%', height: '100%' }}
      >
        <EditorContent editor={editor} className="editor-content markdown-editor-content" />
        {loading && <StreamIndicator className="ml-3.5" />}
      </div>
    )
  }
)

export default MarkdownEditor
