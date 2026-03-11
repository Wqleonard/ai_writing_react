import clsx from "clsx"
import type { IconfontProps } from "./types"

/**
 * 将 unicode 多种写法统一为实际字符，避免在 React 中直接渲染 "&#xe627;" 或 "\\ue627" 时显示成编码文本。
 * 支持：单字符、HTML 实体 "&#xe627;"、JS 转义形式 "\\ue627"（6 字符）、纯 hex "e627"
 */
function normalizeUnicodeToChar(unicode: string): string {
  if (!unicode || typeof unicode !== "string") return unicode
  if (unicode.length === 1) return unicode
  const entityMatch = unicode.trim().match(/^&#x([0-9a-fA-F]+);?$/)
  if (entityMatch) {
    const code = parseInt(entityMatch[1], 16)
    return Number.isNaN(code) ? unicode : String.fromCodePoint(code)
  }
  const slashUMatch = unicode.match(/^\\u([0-9a-fA-F]{4})$/)
  if (slashUMatch) {
    const code = parseInt(slashUMatch[1], 16)
    return Number.isNaN(code) ? unicode : String.fromCodePoint(code)
  }
  const hexOnlyMatch = unicode.match(/^([0-9a-fA-F]{4,6})$/)
  if (hexOnlyMatch) {
    const code = parseInt(hexOnlyMatch[1], 16)
    return Number.isNaN(code) ? unicode : String.fromCodePoint(code)
  }
  return unicode
}

const IconFont = (props: IconfontProps) => {
  const { unicode, className } = props
  const char = normalizeUnicodeToChar(unicode)
  return (
    <span className={clsx("iconfont", className)}>{char}</span>
  )
}

export default IconFont
