import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import EmptyParagraph from '@/extensions/EmptyParagraph'
import Mermaid from '@/extensions/Mermaid'
import { StreamIndicator } from '@/components/StreamIndicator'
import SelectionToolbarComponent, { type SelectionToolbarAction } from '@/components/editor/SelectionToolbarComponent'
import './index.css'

export interface MarkdownEditorProps {
  className?: string
  /** 字体 class，默认与 Vue 版一致使用楷体 */
  fontClassName?: string
  readonly?: boolean
  placeholder?: string
  loading?: boolean
  /** 可选，最大字符数限制 */
  maxlength?: number
  /** 受控：当前 markdown 内容 */
  value?: string
  /** 受控：内容变化回调 */
  onChange?: (markdown: string) => void
  /** 失焦回调（编辑态下离开编辑器时触发） */
  onBlur?: () => void
  /** 按键回调（如 Escape 取消编辑） */
  onKeyDown?: (e: KeyboardEvent) => void
  /** 编辑器内容区最小高度（px），传 0 可避免在卡片等场景撑高容器 */
  minHeight?: number
  /** 是否展示选中文本工具栏 */
  needSelectionToolbar?: boolean
  /** 对齐 Vue 版 btns */
  btns?: Array<'edit' | 'expand' | 'add' | 'note'>
  /** 选中文本工具栏按钮 */
  selectionToolbarBtns?: Array<'edit' | 'expand' | 'add' | 'note'>
  /** 选区工具栏统一动作回调 */
  onSelectionAction?: (payload: {
    action: 'edit' | 'expand' | 'add' | 'note'
    selectedText: string
    from: number
    to: number
  }) => void
  /** 对齐 Vue 版 @add */
  onSelectionAdd?: (selectedText: string) => void
  /** 对齐 Vue 版 @note */
  onSelectionNote?: (selectedText: string) => void
  /** 可选：扩写按钮回调 */
  onSelectionExpand?: (selectedText: string) => void
  /** 可选：改写按钮回调 */
  onSelectionEdit?: (selectedText: string) => void
  /** 可选：配图按钮回调 */
  onSelectionImage?: (selectedText: string) => void
}

export interface MarkdownEditorRef {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  focus: () => void
  blur: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  editor: Editor | null
}

const isEmptyContent = (content: string | undefined | null): boolean => {
  return !content || content.trim() === ''
}

export const MarkdownEditor = React.forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      className = '',
      fontClassName = '',
      readonly = false,
      placeholder = '请输入内容...',
      loading = false,
      maxlength,
      value = '',
      onChange,
      onBlur,
      onKeyDown,
      minHeight = 200,
      needSelectionToolbar = false,
      btns,
      selectionToolbarBtns = ['edit', 'expand', 'add', 'note'],
      onSelectionAction,
      onSelectionAdd,
      onSelectionNote,
      onSelectionExpand,
      onSelectionEdit,
      onSelectionImage,
    },
    ref
  ) {
    const isInternalUpdate = useRef(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const readonlyRef = useRef(readonly)
    const onChangeRef = useRef(onChange)
    const onKeyDownRef = useRef(onKeyDown)
    const [isSelectionToolbarPinned, setIsSelectionToolbarPinned] = useState(false)
    const [selectionToolbarRenderKey, setSelectionToolbarRenderKey] = useState(0)
    const closeSelectionToolbar = useCallback(() => {
      setIsSelectionToolbarPinned(false)
      setSelectionToolbarRenderKey((prev) => prev + 1)
    }, [])
    const effectiveSelectionBtns = useMemo(
      () => (btns && btns.length > 0 ? btns : selectionToolbarBtns),
      [btns, selectionToolbarBtns]
    )

    useEffect(() => {
      readonlyRef.current = readonly
      onChangeRef.current = onChange
      onKeyDownRef.current = onKeyDown
    }, [readonly, onChange, onKeyDown])

    const extensions = useMemo(
      () => [
        Markdown,
        Mermaid,
        EmptyParagraph,
        Placeholder.configure({ placeholder }),
        StarterKit.configure({
          codeBlock: false,
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          bulletList: {},
          orderedList: {},
          blockquote: {},
          horizontalRule: {},
          hardBreak: {},
        }),
        TableRow,
        TableHeader,
        TableCell,
        Table.configure({
          resizable: true,
        }),
        CodeBlock.extend({
          parseHTML() {
            return [
              {
                tag: 'pre',
                preserveWhitespace: 'full',
                getAttrs: (node) => {
                  if (typeof node === 'string') return false
                  if (!(node instanceof HTMLElement)) return false
                  const codeElement = node.querySelector('code')
                  if (
                    codeElement &&
                    codeElement.classList.contains('language-mermaid')
                  ) {
                    return false
                  }
                  return {}
                },
              },
            ]
          },
        }),
      ],
      [placeholder]
    )

    const editor = useEditor(
      {
        content: isEmptyContent(value) ? '' : value,
        editable: !readonly,
        contentType: 'markdown',
        extensions,
        editorProps: {
          attributes: {
            class: `prose prose-sm max-w-none focus:outline-none min-h-[${minHeight}px] ${fontClassName}`.trim(),
          },
          handleKeyDown: (_, event) => {
            const onKeyDown = onKeyDownRef.current
            if (onKeyDown) {
              onKeyDown(event)
              if (event.key === 'Escape') return true
            }
            return false
          },
        },
        onUpdate: ({ editor: currentEditor }) => {
          if (readonlyRef.current) return
          let nextMarkdown =
            (currentEditor as Editor & { getMarkdown?: () => string }).getMarkdown?.() ?? ''
          if (maxlength != null && nextMarkdown.length > maxlength) {
            nextMarkdown = nextMarkdown.slice(0, maxlength)
            isInternalUpdate.current = true
            currentEditor.commands.setContent(nextMarkdown, {
              contentType: 'markdown',
            })
          }
          onChangeRef.current?.(nextMarkdown)
          queueMicrotask(() => {
            isInternalUpdate.current = false
          })
        },
      },
      // 不把 readonly/onChange/onKeyDown 放入 deps，避免父组件重渲染导致 editor 重建（光标跳转、中文 IME 打断）
      [placeholder, minHeight]
    )

    // 同步外部 value 到编辑器（受控模式）
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
            isInternalUpdate.current = true
            editor.commands.clearContent()
            editor.commands.setTextSelection(0)
            queueMicrotask(() => {
              isInternalUpdate.current = false
            })
          }
        } else if (valueToSet !== currentMarkdown) {
          isInternalUpdate.current = true
          editor.commands.setContent(valueToSet, { contentType: 'markdown' })
          editor.commands.setTextSelection(editor.state.doc.content.size)
          queueMicrotask(() => {
            isInternalUpdate.current = false
          })
        }
      } catch (err) {
        console.error('Error setting editor content:', err)
      }
    }, [editor, value, maxlength])

    // 只读状态变化：setEditable；进入可编辑时兜底设置 DOM contenteditable 并 focus
    useEffect(() => {
      if (!editor) return
      const editable = !readonly
      editor.setEditable(editable)
      if (editable) {
        const id = setTimeout(() => {
          try {
            const view = (editor as any).view as { dom?: HTMLElement } | undefined
            if (view?.dom && typeof view.dom.setAttribute === 'function') {
              view.dom.setAttribute('contenteditable', 'true')
            }
            editor.commands.focus('end')
          } catch {
            editor.commands.focus('end')
          }
        }, 50)
        return () => clearTimeout(id)
      }
    }, [editor, readonly])

    // 失焦回调
    useEffect(() => {
      if (!editor || !onBlur) return
      const fn = () => onBlur()
      editor.on('blur', fn)
      return () => {
        editor.off('blur', fn)
      }
    }, [editor, onBlur])

    // 选区失效时自动取消 pinned，避免工具栏被“锁住”
    useEffect(() => {
      if (!editor || !isSelectionToolbarPinned) return
      const clearPinnedIfSelectionInvalid = () => {
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to).trim()
        if (from === to || !text) {
          closeSelectionToolbar()
        }
      }
      editor.on('selectionUpdate', clearPinnedIfSelectionInvalid)
      return () => {
        editor.off('selectionUpdate', clearPinnedIfSelectionInvalid)
      }
    }, [editor, isSelectionToolbarPinned, closeSelectionToolbar])

    // pinned 状态下，点击编辑器与工具栏外部区域时自动关闭
    useEffect(() => {
      if (!isSelectionToolbarPinned) return
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target as HTMLElement | null
        if (!target) return
        const inEditorContainer = !!containerRef.current?.contains(target)
        const inToolbar = !!target.closest('.selection-toolbar-popover')
        if (!inEditorContainer && !inToolbar) {
          closeSelectionToolbar()
        }
      }
      document.addEventListener('pointerdown', onPointerDown, true)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true)
      }
    }, [isSelectionToolbarPinned, closeSelectionToolbar])

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
        undo: () => {
          editor?.commands.undo()
        },
        redo: () => {
          editor?.commands.redo()
        },
        canUndo: () => editor?.can().undo() ?? false,
        canRedo: () => editor?.can().redo() ?? false,
        editor: editor ?? null,
      }),
      [editor]
    )

    return (
      <div
        ref={containerRef}
        className={`main-editor w-full h-full ${readonly ? 'is-readonly' : ''} ${fontClassName} ${className}`.trim()}
      >
        <EditorContent editor={editor} className="editor-content main-editor-content" />
        {editor && needSelectionToolbar && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => {
              if (!editor) return false
              const { from, to } = editor.state.selection
              if (from >= to) return false
              const text = editor.state.doc.textBetween(from, to).trim()
              if (!text) return false
              if (isSelectionToolbarPinned) return true
              return editor.isFocused
            }}
            options={{
              placement: 'top',
              strategy: 'absolute',
            }}
            className="z-999 selection-toolbar-popover"
          >
            <SelectionToolbarComponent
              key={selectionToolbarRenderKey}
              editor={editor}
              btns={effectiveSelectionBtns}
              onPinnedChange={(pinned) => {
                if (pinned) {
                  setIsSelectionToolbarPinned(true)
                  return
                }
                closeSelectionToolbar()
              }}
              onAdd={(selectedText) => onSelectionAdd?.(selectedText)}
              onNote={(selectedText) => onSelectionNote?.(selectedText)}
              onAction={(action, selectedText) => {
                if (action === 'edit') onSelectionEdit?.(selectedText)
                if (action === 'expand') onSelectionExpand?.(selectedText)
                // if (action === 'image') onSelectionImage?.(selectedText)
                const { from, to } = editor.state.selection
                if (from < to) {
                  onSelectionAction?.({
                    action: action as SelectionToolbarAction,
                    selectedText,
                    from,
                    to,
                  })
                }
              }}
            />
          </BubbleMenu>
        )}
        {loading && <StreamIndicator />}
      </div>
    )
  }
)

export default MarkdownEditor
