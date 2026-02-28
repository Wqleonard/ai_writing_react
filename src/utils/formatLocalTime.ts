/**
 * 格式化时间为本地时间字符串（北京时间 UTC+8）
 */
export const formatLocalTime = (utcTime: string | undefined): string => {
  if (!utcTime) return new Date().toLocaleString('zh-CN')
  try {
    const date = new Date(utcTime)
    return date.toLocaleString('zh-CN')
  } catch {
    return utcTime
  }
}
