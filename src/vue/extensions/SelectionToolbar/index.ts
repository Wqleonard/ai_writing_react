import { Extension, posToDOMRect } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

export interface SelectionToolbarOptions {
  getElement: () => HTMLElement | null
  setVisible: (visible: boolean) => void
  getVisible: () => boolean
  setPosition: (left: number, top: number) => void
  setSelection: (from: number, to: number, selectedText: string) => void
  /** 返回「在此时间戳之前不显示划词工具」的时间戳，用于接受内容后短暂抑制显示 */
  getSuppressUntil?: () => number
  /** 延迟多少 ms 后再显示工具栏，避免划词过程中闪烁（参考 BubbleMenu updateDelay） */
  updateDelay?: number
  /** 窗口/容器 resize 后延迟多少 ms 再更新位置（参考 BubbleMenu resizeDelay） */
  resizeDelay?: number
  /** 是否显示工具栏，返回 false 则不显示（参考 BubbleMenu shouldShow） */
  shouldShow?: (props: {
    editor: Editor
    view: EditorView
    state: EditorState
    from: number
    to: number
    element: HTMLElement | null
  }) => boolean
  /** 用于 shouldShow 的编辑器实例（若使用 shouldShow 则需提供） */
  getEditor?: () => Editor | null
  /**
   * 返回划词框的定位容器（如 .tiptap-editor）的 getBoundingClientRect。
   * 若提供则 left/top 相对该容器计算，避免上方有工具栏时下方显示遮挡文字。
   */
  getContainerRect?: () => DOMRect
}

const SelectionToolbarPluginKey = new PluginKey('selectionToolbar')

const SelectionToolbar = Extension.create<SelectionToolbarOptions>({
  name: 'selectionToolbar',

  addOptions() {
    return {
      getElement: () => null,
      setVisible: () => {},
      getVisible: () => false,
      setPosition: () => {},
      setSelection: () => {},
      getSuppressUntil: () => 0,
      updateDelay: 100,
      resizeDelay: 60,
      shouldShow: undefined,
      getEditor: () => null,
      getContainerRect: undefined,
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: SelectionToolbarPluginKey,
        view(editorView) {
          let isVisible = false
          let showTimeout: ReturnType<typeof setTimeout> | null = null
          let isSelecting = false
          let lastSelection: { from: number; to: number } | null = null
          const createdAt = Date.now()
          const COOLING_MS = 500 // 插件创建后一段时间内不显示工具栏，避免刷新/挂载时的误触发
          /** 是否在本次会话中发生过编辑器内的 mousedown，用于区分「用户划词」与「刷新/挂载后的初始选区」 */
          let hasSeenMouseDownInEditor = false

          const getElement = () => {
            return extension.options.getElement()
          }

          const hideToolbar = () => {
            if (isVisible) {
              extension.options.setVisible(false)
              isVisible = false
            }
            // 清除待显示的定时器
            if (showTimeout) {
              clearTimeout(showTimeout)
              showTimeout = null
            }
          }

          const showToolbar = (from: number, to: number) => {
            // 仅当用户在编辑器内有过点击（划词）后才允许显示，避免刷新后无操作时误显示
            if (!hasSeenMouseDownInEditor) return
            // 冷却期内不显示，避免刷新/挂载时因初始选区或状态变化误触发
            if (Date.now() - createdAt < COOLING_MS) return
            // 接受内容后短暂抑制显示，避免划词工具再次弹出
            const suppressUntil = extension.options.getSuppressUntil?.()
            if (suppressUntil && Date.now() < suppressUntil) return
            // 仅在有实际选区时显示（光标不算）
            if (from >= to) return

            const { state } = editorView
            const selectedText = state.doc.textBetween(from, to, '\n')
            if (!selectedText.trim()) return

            const element = getElement()
            // 可选：外部 shouldShow 控制是否显示（参考 BubbleMenu）
            const shouldShow = extension.options.shouldShow
            const getEditor = extension.options.getEditor
            if (shouldShow && getEditor) {
              const editor = getEditor()
              if (!editor || !shouldShow({ editor, view: editorView, state, from, to, element })) return
            }

            // 先设置选中文本的范围和内容
            extension.options.setSelection(from, to, selectedText)

            // 使用 posToDOMRect 获取选区矩形；坐标相对定位容器（与划词框 style.left/top 的参考一致）
            const selectionRect = posToDOMRect(editorView, from, to)
            const containerRect = extension.options.getContainerRect?.() ?? editorView.dom.getBoundingClientRect()

            const selectionTop = selectionRect.top - containerRect.top
            const selectionBottom = selectionRect.bottom - containerRect.top
            const selectionLeft = selectionRect.left - containerRect.left
            const selectionHeight = selectionRect.height

            // toolbar 使用 visibility:hidden 隐藏，DOM 常驻，可同步取到尺寸
            const toolbarWidth = element ? element.offsetWidth : 130
            const toolbarHeight = element ? element.offsetHeight : 140

            const GAP = 6 // 划词框与选区之间的间距（上方或下方）
            const PADDING = 16 // 与编辑器容器边缘的最小间距
            const containerWidth = containerRect.width
            const containerHeight = containerRect.height

            // 默认：放在所选文字上方；上方空间不足时放在下方
            let top: number
            const topIfAbove = selectionTop - toolbarHeight - GAP
            const enoughSpaceAbove = topIfAbove >= PADDING

            if (enoughSpaceAbove) {
              top = topIfAbove
            } else {
              // 显示在下方时：选区下缘 + 间距，避免遮挡下方文字
              top = selectionBottom + GAP
            }

            // 限制在编辑器容器内
            top = Math.max(PADDING, Math.min(top, containerHeight - toolbarHeight - PADDING))

            // 水平位置：与选区左对齐，再限制不超出容器
            let left = selectionLeft
            if (left + toolbarWidth > containerWidth - PADDING) {
              left = Math.max(PADDING, containerWidth - toolbarWidth - PADDING)
            }
            if (left < PADDING) {
              left = PADDING
            }

            extension.options.setPosition(left, top)
            extension.options.setVisible(true)
            isVisible = true
          }

          const updatePosition = () => {
            const element = getElement()
            if (!element) {
              return
            }

            // 检查外部可见状态，如果被外部关闭，重置内部状态
            const externalVisible = extension.options.getVisible()
            if (!externalVisible && isVisible) {
              isVisible = false
              lastSelection = null
              if (showTimeout) {
                clearTimeout(showTimeout)
                showTimeout = null
              }
            }

            const { state } = editorView
            const { selection } = state
            const { empty, from, to } = selection

            // 如果没有选中内容（空或光标），隐藏工具栏
            if (empty || from >= to) {
              hideToolbar()
              lastSelection = null
              return
            }

            // 检查选择是否发生了变化
            const selectionChanged = !lastSelection ||
              lastSelection.from !== from ||
              lastSelection.to !== to

            if (selectionChanged) {
              // 选择发生了变化，先隐藏工具栏
              hideToolbar()
              lastSelection = { from, to }

              // 延迟显示工具栏（等待用户完成选择，参考 BubbleMenu updateDelay）
              const delay = extension.options.updateDelay ?? 100
              showTimeout = setTimeout(() => {
                const currentState = editorView.state
                const currentSelection = currentState.selection
                if (!currentSelection.empty &&
                    currentSelection.from < currentSelection.to &&
                    currentSelection.from === from &&
                    currentSelection.to === to) {
                  showToolbar(from, to)
                }
                showTimeout = null
              }, delay)
            }
          }

          // 监听鼠标事件，检测选择开始和结束
          const handleMouseDown = () => {
            hasSeenMouseDownInEditor = true // 标记用户已在编辑器内有过点击，后续才允许显示划词工具栏
            isSelecting = true
            hideToolbar()
          }

          const handleMouseUp = () => {
            // 用户完成选择
            isSelecting = false
            // 延迟触发更新，确保选择已完成
            setTimeout(() => {
              if (!isSelecting) {
                updatePosition()
              }
            }, 10)
          }

          // 监听窗口/容器 resize，防抖更新位置（参考 BubbleMenu resizeDelay）
          let resizeTimeout: ReturnType<typeof setTimeout> | null = null
          const handleResize = () => {
            if (!isVisible) return
            if (resizeTimeout) clearTimeout(resizeTimeout)
            const delay = extension.options.resizeDelay ?? 60
            resizeTimeout = setTimeout(() => {
              resizeTimeout = null
              const el = getElement()
              if (el) {
                const { state } = editorView
                const { selection } = state
                const { from, to } = selection
                if (!selection.empty && from < to) showToolbar(from, to)
              }
            }, delay)
          }

          // 拖拽开始时隐藏工具栏（参考 BubbleMenu dragstartHandler）
          const handleDragStart = () => {
            hideToolbar()
          }

          // 设置事件监听器
          editorView.dom.addEventListener('mousedown', handleMouseDown)
          editorView.dom.addEventListener('mouseup', handleMouseUp)
          editorView.dom.addEventListener('dragstart', handleDragStart)
          window.addEventListener('resize', handleResize)

          return {
            update(view, prevState) {
              if (!prevState) return
              if (!isSelecting && view.state.selection !== prevState.selection) {
                updatePosition()
              }
            },
            destroy() {
              if (showTimeout) {
                clearTimeout(showTimeout)
                showTimeout = null
              }
              if (resizeTimeout) {
                clearTimeout(resizeTimeout)
                resizeTimeout = null
              }
              extension.options.setVisible(false)
              editorView.dom.removeEventListener('mousedown', handleMouseDown)
              editorView.dom.removeEventListener('mouseup', handleMouseUp)
              editorView.dom.removeEventListener('dragstart', handleDragStart)
              window.removeEventListener('resize', handleResize)
            },
          }
        },
      }),
    ]
  },
})

export default SelectionToolbar

