import { Node } from '@tiptap/core'

/**
 * 自定义扩展：将多个连续换行符（\n\n\n\n）渲染为空的 <p></p> 标签
 */
const EmptyParagraph = Node.create({
  name: 'emptyParagraph',

  group: 'block',

  parseHTML() {
    return [
      {
        tag: 'p',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          if (!(node instanceof HTMLElement)) return false
          const text = node.textContent?.trim() || ''
          return text === '' ? {} : false
        },
      },
    ]
  },

  renderHTML() {
    return ['p', {}]
  },

  markdownTokenizer: {
    name: 'emptyParagraph',
    level: 'block',

    start: (src: string) => {
      const match = /\n{4,}/.exec(src)
      return match ? match.index : -1
    },

    tokenize: (src, tokens, lexer) => {
      const match = /^\n{4,}/.exec(src)
      if (!match) return undefined
      return {
        type: 'emptyParagraph',
        raw: match[0],
        newlineCount: match[0].length,
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    return {
      type: 'paragraph',
      content: [],
    }
  },

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node)
    if (!content || content.trim() === '') {
      return '\n\n\n\n'
    }
    return content
  },
})

export default EmptyParagraph
