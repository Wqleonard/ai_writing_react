import { Mark, mergeAttributes } from '@tiptap/core'

export interface StreamedContentOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    streamedContent: {
      /**
       * Set a streamed content mark
       */
      setStreamedContent: () => ReturnType
      /**
       * Toggle a streamed content mark
       */
      toggleStreamedContent: () => ReturnType
      /**
       * Unset a streamed content mark
       */
      unsetStreamedContent: () => ReturnType
    }
  }
}

export const StreamedContentMark = Mark.create<StreamedContentOptions>({
  name: 'streamedContent',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'streamed-content',
      },
    }
  },

  addAttributes() {
    return {
      class: {
        default: this.options.HTMLAttributes.class,
        parseHTML: (element) => {
          if (element instanceof HTMLElement) {
            return element.getAttribute('class') || this.options.HTMLAttributes.class
          }
          return this.options.HTMLAttributes.class
        },
        renderHTML: (attributes) => {
          // ✅ 动态组合 class：基础 class + isActive 时的 active class
          let className = attributes.class || this.options.HTMLAttributes.class
          if (attributes.isActive) {
            className = `${className} streamed-content-active`.trim()
          }
          return {
            class: className,
          }
        },
      },
      // ✅ 添加 highlightId 属性支持
      highlightId: {
        default: null,
        parseHTML: (element) => {
          if (element instanceof HTMLElement) {
            return element.getAttribute('data-highlight-id')
          }
          return null
        },
        renderHTML: (attributes) => {
          if (attributes.highlightId) {
            return {
              'data-highlight-id': attributes.highlightId,
            }
          }
          return {}
        },
      },
      // ✅ 添加 isActive 属性支持（用于显示下划线）
      isActive: {
        default: false,
        parseHTML: (element) => {
          if (element instanceof HTMLElement) {
            return element.classList.contains('streamed-content-active')
          }
          return false
        },
        renderHTML: (attributes) => {
          // isActive 通过 class 来控制，不直接渲染属性
          return {}
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[class*="streamed-content"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          if (!(node instanceof HTMLElement)) return false
          return node.classList.contains('streamed-content') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setStreamedContent:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      toggleStreamedContent:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name)
        },
      unsetStreamedContent:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

export default StreamedContentMark

