import { HIGHLIGHT_END, HIGHLIGHT_START } from '@/vue/utils/constant'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export interface HighlightMarkerOptions {
  /**
   * 开始标记
   */
  startMarker: string
  /**
   * 结束标记
   */
  endMarker: string
}

/**
 * HighlightMarker 扩展
 * 给指定范围内的文本添加高亮标记
 * 标记本身不会被显示
 */
export const HighlightMarker = Extension.create<HighlightMarkerOptions>({
  name: 'highlightMarker',

  addOptions() {
    return {
      startMarker: HIGHLIGHT_START,
      endMarker: HIGHLIGHT_END,
    }
  },

  addProseMirrorPlugins() {
    const { startMarker, endMarker } = this.options

    // ✅ 去掉标记末尾的换行符来查找，因为文本节点中换行符可能被解析为 DOM 结构
    const startMarkerTrimmed = startMarker.replace(/\n$/, '')
    const endMarkerTrimmed = endMarker.replace(/\n$/, '')

    return [
      new Plugin({
        key: new PluginKey('highlightMarker'),
        appendTransaction: (transactions, oldState, newState) => {
          // 只在内容真正改变时处理
          if (!transactions.some(tr => tr.docChanged)) {
            return null
          }

          const { doc, schema } = newState
          const streamedContentMark = schema.marks.streamedContent

          if (!streamedContentMark) {
            return null
          }

          let tr = null
          const markerRanges: Array<{ from: number; to: number; type: 'start' | 'end'; highlightId?: string }> = []

          // 第一步：收集所有标记的位置（支持提取 data-highlight-id）
          doc.descendants((node, pos) => {
            if (node.isText) {
              const text = node.text || ''

              // 查找开始标记（支持带 ID 的标记）
              // 匹配格式：<<<--highlight-start data-highlight-id="xxx"-->>> 或 <<<--highlight-start-->>>
              const startMarkerRegex = /<<<--highlight-start(?:\s+data-highlight-id="([^"]+)")?\s*-->>>/g
              let match: RegExpExecArray | null

              while ((match = startMarkerRegex.exec(text)) !== null) {
                const highlightId = match[1] || undefined // 提取 ID（如果有）

                console.log('[HighlightMarker] 找到开始标记:', {
                  matchText: match[0],
                  highlightId: highlightId,
                  position: pos + match.index
                })

                markerRanges.push({
                  from: pos + match.index,
                  to: pos + match.index + match[0].length,
                  type: 'start',
                  highlightId: highlightId
                })
              }

              // 查找结束标记
              let searchPos = 0
              while (true) {
                const endIndex = text.indexOf(endMarkerTrimmed, searchPos)
                if (endIndex === -1) break

                markerRanges.push({
                  from: pos + endIndex,
                  to: pos + endIndex + endMarkerTrimmed.length,
                  type: 'end'
                })
                searchPos = endIndex + 1
              }
            }
            return true
          })

          // 如果没有找到标记，直接返回
          if (markerRanges.length === 0) {
            return null
          }

          // 按位置排序
          markerRanges.sort((a, b) => a.from - b.from)

          // 第二步：匹配开始和结束标记对（保留 highlightId）
          const pairs: Array<{ start: number; end: number; highlightId?: string }> = []
          const startStack: Array<{ pos: number; length: number; highlightId?: string }> = []

          for (const range of markerRanges) {
            if (range.type === 'start') {
              startStack.push({
                pos: range.from,
                length: range.to - range.from,
                highlightId: range.highlightId
              })
            } else if (range.type === 'end') {
              if (startStack.length > 0) {
                const startInfo = startStack.pop()!
                pairs.push({
                  start: startInfo.pos + startInfo.length, // 标记后的位置
                  end: range.from, // 标记前的位置
                  highlightId: startInfo.highlightId // 保留 ID
                })
              }
            }
          }

          // 如果没有匹配的标记对，直接返回
          if (pairs.length === 0) {
            return null
          }

          // 第三步：创建事务，删除标记并应用 streamedContent mark
          tr = newState.tr

          // 按位置排序所有标记范围（用于计算位置偏移）
          const sortedMarkerRanges = [...markerRanges].sort((a, b) => a.from - b.from)

          // 计算删除标记后的位置调整函数
          const getAdjustedPosition = (pos: number): number => {
            let offset = 0
            for (const range of sortedMarkerRanges) {
              // 如果标记完全在目标位置之前，减去标记长度
              if (range.to <= pos) {
                offset += (range.to - range.from)
              } else {
                break
              }
            }
            return pos - offset
          }

          // 从后往前删除标记，避免位置偏移
          const reversedMarkerRanges = [...markerRanges].sort((a, b) => b.from - a.from)
          for (const range of reversedMarkerRanges) {
            tr = tr.delete(range.from, range.to)
          }

          // 删除标记后，应用 streamedContent mark
          // 使用调整后的位置（已删除标记），并传递 highlightId
          for (const pair of pairs) {
            const adjustedStart = getAdjustedPosition(pair.start)
            const adjustedEnd = getAdjustedPosition(pair.end)

            if (adjustedStart < adjustedEnd && adjustedStart >= 0 && adjustedEnd <= tr.doc.content.size) {
              // ✅ 传递 highlightId 属性给 mark
              const markAttrs = pair.highlightId ? { highlightId: pair.highlightId } : {}

              console.log('[HighlightMarker] 应用 streamedContent mark:', {
                highlightId: pair.highlightId,
                adjustedStart,
                adjustedEnd,
                markAttrs,
                textPreview: tr.doc.textBetween(adjustedStart, adjustedEnd, ' ').substring(0, 50)
              })

              tr = tr.addMark(
                adjustedStart,
                adjustedEnd,
                streamedContentMark.create(markAttrs)
              )
            }
          }

          return tr
        },
      }),
    ]
  },
})

export default HighlightMarker

