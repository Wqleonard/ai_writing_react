import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MermaidComponent from './MermaidComponent.vue'

export interface MermaidOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      /**
       * Insert a mermaid diagram
       */
      setMermaid: (options: { code: string }) => ReturnType
    }
  }
}

const Mermaid = Node.create<MermaidOptions>({
  name: 'mermaid',
  group: 'block',

  atom: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (element) => {
          // 从 <pre><code class="language-mermaid">...</code></pre> 中提取代码
          if (element instanceof HTMLElement) {
            const codeElement = element.querySelector('code.language-mermaid')
            if (codeElement) {
              // 处理 HTML 实体（如 &lt;br/&gt;）
              // textContent 会自动解码 HTML 实体
              let text = codeElement.textContent || (codeElement as HTMLElement).innerText || ''
              // 如果 textContent 没有正确解码，手动处理常见的 HTML 实体
              if (text.includes('&lt;') || text.includes('&gt;') || text.includes('&amp;')) {
                text = text
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
              }
              return text
            }
            // 如果没有找到 code 元素，尝试直接从 pre 元素获取
            let text = element.textContent || element.innerText || ''
            // 同样处理 HTML 实体
            if (text.includes('&lt;') || text.includes('&gt;') || text.includes('&amp;')) {
              text = text
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
            }
            return text
          }
          return ''
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'pre',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          if (!(node instanceof HTMLElement)) return false
          const codeElement = node.querySelector('code.language-mermaid')
          return codeElement ? {} : false
        },
      },
    ]
  },

  // 与 @tiptap/markdown 集成：解析 markdown 中的 ```mermaid 代码块
  markdownTokenName: 'code',
  parseMarkdown(token: { lang?: string; text?: string }) {
    if (token.lang !== 'mermaid') {
      // 返回空数组表示不处理，交给 CodeBlock 等后续 handler 处理
      return []
    }
    return {
      type: 'mermaid',
      attrs: { code: token.text?.trim() ?? '' },
    }
  },
  renderMarkdown(node: { attrs?: { code?: string } }) {
    const code = node.attrs?.code ?? ''
    return `\`\`\`mermaid\n${code}\n\`\`\`\n\n`
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      ['code', { class: 'language-mermaid' }, HTMLAttributes.code || ''],
    ]
  },

  addNodeView() {
    // @ts-ignore
    return VueNodeViewRenderer(MermaidComponent)
  },

  addCommands() {
    return {
      setMermaid:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

export default Mermaid

