import { useEffect, useMemo, useState } from "react"
import {
  fetchMemeWords,
  splitMemeWordsIntoColumns,
  type MemeWord,
} from "@/services/chatInputService"

interface UseMemeWordsOptions {
  disabled?: boolean
  collapsedPreviewCount?: number
}

export const useMemeWords = (options?: UseMemeWordsOptions) => {
  const disabled = options?.disabled ?? false
  const collapsedPreviewCount = options?.collapsedPreviewCount ?? 5

  const [memeWords, setMemeWords] = useState<MemeWord[]>([])
  const [isLoadingMemeWords, setIsLoadingMemeWords] = useState(false)

  useEffect(() => {
    if (disabled) return
    let cancelled = false
    setIsLoadingMemeWords(true)
    fetchMemeWords()
      .then((words) => {
        if (!cancelled) setMemeWords(words)
      })
      .catch(() => {
        if (!cancelled) setMemeWords([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMemeWords(false)
      })

    return () => {
      cancelled = true
    }
  }, [disabled])

  const { leftColumnWords, rightColumnWords } = useMemo(
    () => splitMemeWordsIntoColumns(memeWords),
    [memeWords]
  )

  const collapsedPreviewWords = useMemo(
    () => memeWords.slice(0, collapsedPreviewCount),
    [memeWords, collapsedPreviewCount]
  )

  return {
    memeWords,
    isLoadingMemeWords,
    leftColumnWords,
    rightColumnWords,
    collapsedPreviewWords,
  }
}
