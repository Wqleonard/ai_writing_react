<template>
  <div class="markdown-editor" :class="{ 'is-readonly': readonly }">
    <editor-content
      :editor="editor"
      class="editor-content"
    />
    <StreamIndicator class="ml-3.5" v-if="loading"/>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { type Editor, EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import EmptyParagraph from '../extensions/EmptyParagraph'

export interface MarkdownEditorProps {
  className?: string
  readonly?: boolean
  placeholder?: string
  loading?: boolean
  /** 可选，最大字符数限制 */
  maxlength?: number
}

export interface MarkdownEditorExpose {
  getMarkdown: () => string
  setMarkdown: (markdown: string) => void
  focus: () => void
  blur: () => void
  editor: Editor | null
}

// 定义 props
const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  readonly: false,
  placeholder: '请输入内容...',
  className: '',
  loading: false,
  maxlength: undefined,
})

// 使用 defineModel 实现双向绑定
const model = defineModel<string>({ default: '' })

// 是否正在内部更新（防止循环更新）
const isInternalUpdate = ref(false)

// 判断内容是否为空（空字符串或仅空白字符视为空）
const isEmptyContent = (content: string | undefined | null): boolean => {
  return !content || content.trim() === ''
}

// 初始化编辑器（空内容时不传入，让 Tiptap 自动创建空段落）
const editor = useEditor({
  content: isEmptyContent(model.value) ? undefined : model.value,
  editable: !props.readonly,
  contentType: "markdown",
  extensions: [
    Markdown,
    EmptyParagraph,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
    StarterKit.configure({
      // 启用 markdown 支持的基本功能
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
      bulletList: {},
      orderedList: {},
      blockquote: {},
      codeBlock: {},
      horizontalRule: {},
      hardBreak: {},
    }),
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none focus:outline-none',
      style: 'min-height: 200px; padding: 12px;',
    },
  },
  onUpdate: ({ editor }) => {
    // 只读模式下不触发更新
    if (props.readonly) {
      return
    }
    // 标记为内部更新，防止 watch 触发
    isInternalUpdate.value = true

    let content = editor.getMarkdown() || ''
    if (props.maxlength != null && content.length > props.maxlength) {
      content = content.slice(0, props.maxlength)
      model.value = content
      editor.commands.setContent(content, { contentType: 'markdown' })
    } else {
      model.value = content
    }

    // 下一个 tick 后重置标记
    nextTick(() => {
      isInternalUpdate.value = false
    })
  },
})

// 监听外部 value 变化，更新编辑器内容
watch(
  model,
  (newValue) => {
    // 如果是内部更新触发的，跳过
    if (isInternalUpdate.value) {
      return
    }

    if (editor.value) {
      try {
        const currentMarkdown = editor.value.getMarkdown()
        let valueToSet = newValue ?? ''
        if (props.maxlength != null && valueToSet.length > props.maxlength) {
          valueToSet = valueToSet.slice(0, props.maxlength)
        }
        // 如果新值为空，清空编辑器内容
        if (isEmptyContent(valueToSet)) {
          if (!editor.value.isEmpty) {
            editor.value.commands.clearContent()
          }
        } else if (valueToSet !== currentMarkdown) {
          // 使用 markdown 格式设置内容
          editor.value.commands.setContent(valueToSet, { contentType: 'markdown' })
        }
      } catch (error) {
        console.error('Error setting editor content:', error)
      }
    }
  },
  { flush: 'post' }
)

// 监听只读状态变化
watch(
  () => props.readonly,
  (newReadonly) => {
    if (editor.value) {
      editor.value.setEditable(!newReadonly)
    }
  }
)

// 组件卸载时销毁编辑器
onBeforeUnmount(() => {
  editor.value?.destroy()
})

// 暴露方法给父组件
defineExpose<MarkdownEditorExpose>({
  getMarkdown: () => editor.value ? editor.value.getMarkdown() : '',
  setMarkdown: (markdown: string) => {
    editor.value?.commands.setContent(markdown, { contentType: 'markdown' })
  },
  focus: () => {
    editor.value?.commands.focus()
  },
  blur: () => {
    editor.value?.commands.blur()
  },
  editor: editor.value || null,
})
</script>

<style scoped lang="less">
.markdown-editor {
  width: 100%;
  height: 100%;

  &.is-readonly {
    .editor-content {
      :deep(.ProseMirror) {
        cursor: default;
        user-select: text;

        &:focus {
          outline: none;
        }
      }
    }
  }

  .editor-content {
    width: 100%;
    height: 100%;
    overflow-y: auto;

    :deep(.ProseMirror.tiptap) {
      min-height: 24px !important;
      padding: 12px !important;
      outline: none;
      color: #303133;
      line-height: 1.8;
      font-size: 16px;

      p {
        margin: 0.5em 0;

        /* 当编辑器为空且只有一个空段落时 */

        &:first-child {
          &.is-editor-empty.is-empty::before {
            content: attr(data-placeholder);
            float: left;
            color: #adb5bd;
            pointer-events: none;
            height: 0;
          }
        }
      }

      h1, h2, h3, h4, h5, h6 {
        margin: 0;
        color: #303133;
        font-weight: 600;
        line-height: 1.4;
      }

      h1 {
        font-size: 1.5em;
      }

      h2 {
        font-size: 1.3em;
      }

      h3 {
        font-size: 1.15em;
      }

      p {
        margin: 0;
        line-height: 1.8;
        word-break: break-word;
        text-indent: 0;
      }

      ul, ol {
        margin: 0.8em 0;
        padding-left: 2em;
        line-height: 1.8;

        li {
          margin: 0.4em 0;
        }
      }

      ul {
        list-style: disc;
      }

      ol {
        list-style: decimal;
      }

      strong {
        font-weight: 600;
        color: #303133;
      }

      em {
        font-style: italic;
      }

      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.9em;
        color: #e83e8c;
      }

      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        margin: 1em 0;
        border: 1px solid #ebeef5;

        code {
          background: transparent;
          padding: 0;
          color: #303133;
        }
      }

      blockquote {
        border-left: 4px solid #409eff;
        padding-left: 1em;
        margin: 1em 0;
        color: #606266;
        background: #f0f9ff;
        padding: 12px 16px;
        border-radius: 4px;
      }

      hr {
        border: none;
        border-top: 1px solid #ebeef5;
        margin: 1.5em 0;
      }

      // 占位符样式
      p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        float: left;
        color: #adb5bd;
        pointer-events: none;
        height: 0;
      }
    }
  }
}
</style>
