import { getKeywords } from "@/api/tools-square"

export interface MemeWord {
  name: string
  description?: string
  workReference?: string
}

export interface IndexedMemeWord {
  name: string
  originalIndex: number
}

const toStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

export const normalizeMemeWords = (raw: unknown): MemeWord[] => {
  const container = raw as { keywords?: unknown }
  const list = Array.isArray(container?.keywords) ? container.keywords : []
  const normalized: MemeWord[] = []
  list.forEach((item) => {
    const record = item as Record<string, unknown>
    const name = toStringOrEmpty(record?.name).trim()
    if (!name) return
    normalized.push({
      name,
      description: toStringOrEmpty(record?.description) || undefined,
      workReference: toStringOrEmpty(record?.workReference) || undefined,
    })
  })
  return normalized
}

export const fetchMemeWords = async (): Promise<MemeWord[]> => {
  const result = await getKeywords()
  return normalizeMemeWords(result)
}

export const splitMemeWordsIntoColumns = (
  memeWords: MemeWord[]
): { leftColumnWords: IndexedMemeWord[]; rightColumnWords: IndexedMemeWord[] } => {
  const halfCount = Math.ceil(memeWords.length / 2)
  const leftColumnWords = memeWords.slice(0, halfCount).map((word, index) => ({
    name: word.name,
    originalIndex: index,
  }))
  const rightColumnWords = memeWords.slice(halfCount).map((word, index) => ({
    name: word.name,
    originalIndex: index + halfCount,
  }))
  return { leftColumnWords, rightColumnWords }
}
