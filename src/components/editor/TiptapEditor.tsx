import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

const defaultContent = '# Hello World'

export function TiptapEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit, 
      Markdown
    ],
    content: defaultContent,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'data-placeholder': '在这里开始输入…',
      },
    },
  })

  if (!editor) {
    return (
      <div className="min-h-[200px] rounded-md border border-gray-200 bg-gray-50 p-4 text-gray-500">
        加载编辑器中…
      </div>
    )
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <EditorContent editor={editor} className="tiptap-editor" />
      <BubbleMenu editor={editor}>
        <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600 shadow">
          选中菜单
        </span>
      </BubbleMenu>
    </div>
  )
}
