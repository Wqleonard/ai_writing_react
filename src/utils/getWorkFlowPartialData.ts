/**
 * 从流式数据中提取文本内容
 */
export const getContentFromPartial = (partialData: any): string => {
  if (!partialData || !Array.isArray(partialData) || partialData.length === 0) {
    return ''
  }
  const textContents: string[] = []
  for (const message of partialData) {
    if (!message || typeof message !== 'object') continue
    if (message.content && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (
          contentItem &&
          typeof contentItem === 'object' &&
          contentItem.type === 'text' &&
          typeof contentItem.text === 'string'
        ) {
          textContents.push(contentItem.text)
        }
      }
    } else if (typeof message.content === 'string') {
      textContents.push(message.content)
    }
  }
  return textContents.join('')
}
