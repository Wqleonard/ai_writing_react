import { Node } from '@tiptap/core'

/**
 * 自定义扩展：将多个连续换行符（\n\n\n\n）渲染为空的 <p></p> 标签
 */
const EmptyParagraph = Node.create({
  name: 'emptyParagraph',

  group: 'block',

  // 定义如何解析 HTML
  parseHTML() {
    return [
      {
        tag: 'p',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          if (!(node instanceof HTMLElement)) return false
          // 只匹配空的段落
          const text = node.textContent?.trim() || ''
          return text === '' ? {} : false
        },
      },
    ]
  },

  // 定义如何渲染为 HTML
  renderHTML() {
    return ['p', {}]
  },

  // Markdown tokenizer：识别多个连续换行符
  markdownTokenizer: {
    name: 'emptyParagraph',
    level: 'block',

    // 优化：快速检查是否包含多个换行符
    start: (src) => {
      // 查找至少 4 个连续换行符的位置
      const match = /\n{4,}/.exec(src)
      return match ? match.index : -1
    },

    // 提取多个连续换行符
    tokenize: (src, tokens, lexer) => {
      // 匹配至少 4 个连续换行符
      const match = /^\n{4,}/.exec(src)

      if (!match) {
        return undefined
      }

      return {
        type: 'emptyParagraph',
        raw: match[0], // 保留原始换行符
        newlineCount: match[0].length, // 记录换行符数量
      }
    },
  },

  // 将 token 解析为 Tiptap JSON
  parseMarkdown: (token, helpers) => {
    // 返回一个空的段落节点
    return {
      type: 'paragraph',
      content: [],
    }
  },

  // 将 Tiptap JSON 渲染回 Markdown
  renderMarkdown: (node, helpers) => {
    // 如果段落为空，返回 4 个换行符
    const content = helpers.renderChildren(node)
    if (!content || content.trim() === '') {
      return '\n\n\n\n'
    }
    return content
  },
})

export default EmptyParagraph
