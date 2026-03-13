/** 去除 markdown 格式并截取前 N 个字符 */
export const stripMarkdownAndTruncate = (
  content: string,
  maxLength: number = 100
): string => {
  if (!content) return ''
  let text = content
  text = text.replace(/```[\s\S]*?```/g, '')
  text = text.replace(/`[^`]*`/g, '')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/__([^_]+)__/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/_([^_]+)_/g, '$1')
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
  text = text.replace(/^>\s+/gm, '')
  text = text.replace(/^[-*+]\s+/gm, '')
  text = text.replace(/^\d+\.\s+/gm, '')
  text = text.replace(/^[-*_]{3,}$/gm, '')
  text = text.replace(/\n{2,}/g, ' ')
  text = text.replace(/\s+/g, ' ')
  text = text.trim()
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '...'
  }
  return text
}
