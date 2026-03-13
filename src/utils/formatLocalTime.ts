/**
 * 格式化时间为本地时间字符串（北京时间 UTC+8）
 */
export const formatLocalTime = (utcTime: string | undefined): string => {
  if (!utcTime) return new Date().toLocaleString('zh-CN')
  try {
    const normalized = utcTime.trim()
    // 后端若返回无时区信息的 UTC 字符串（如 "2026-01-01 12:00:00"），按 UTC 解析后再转本地
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    const needsUtcSuffix =
      !hasTimezone &&
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized)
    const dateInput = needsUtcSuffix ? `${normalized.replace(' ', 'T')}Z` : normalized
    const date = new Date(dateInput)
    if (Number.isNaN(date.getTime())) return utcTime
    return date.toLocaleString('zh-CN')
  } catch {
    return utcTime
  }
}
