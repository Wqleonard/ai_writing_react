import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import StreamedContentActionBarComponent from './StreamedContentActionBarComponent.vue'

export interface StreamedContentActionBarOptions {
  HTMLAttributes: Record<string, any>
  onEdit?: () => void
  onRegenerate?: () => void
  onReject?: () => void
  onAccept?: (selectedOption?: 'chapter' | 'para' | 'once') => void
  onEditingCancel?: () => void
  onEditingConfirm?: () => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    streamedContentActionBar: {
      /**
       * Insert a streamed content action bar
       */
      setStreamedContentActionBar: (options?: { 
        streamedContentRange?: { from: number; to: number }
        selectedOption?: 'chapter' | 'para' | 'once'
      }) => ReturnType
    }
  }
}

const StreamedContentActionBar = Node.create<StreamedContentActionBarOptions>({
  name: 'streamedContentActionBar',
  group: 'block',
  atom: true,
  selectable: false,

  addStorage() {
    return {
      onEdit: this.options.onEdit,
      onRegenerate: this.options.onRegenerate,
      onReject: this.options.onReject,
      onAccept: this.options.onAccept,
      onEditingCancel: this.options.onEditingCancel,
      onEditingConfirm: this.options.onEditingConfirm,
    }
  },

  addAttributes() {
    return {
      streamedContentRange: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      selectedOption: {
        default: 'chapter',
        parseHTML: (element) => element.getAttribute('data-selected-option') || 'chapter',
        renderHTML: (attributes) => {
          if (!attributes.selectedOption) {
            return {}
          }
          return {
            'data-selected-option': attributes.selectedOption,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="streamed-content-action-bar"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'streamed-content-action-bar' }),
    ]
  },

  addNodeView() {
    // @ts-ignore
    return VueNodeViewRenderer(StreamedContentActionBarComponent)
  },

  addCommands() {
    return {
      setStreamedContentActionBar:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

export default StreamedContentActionBar

