import { useEffect, useMemo, useState } from "react"
import {
  fetchMemeWords,
  splitMemeWordsIntoColumns,
  type MemeWord,
} from "@/services/chatInputService"

// 模块级缓存：同一页面生命周期内复用，避免多组件重复请求 keywords-rank
let memeWordsCache: MemeWord[] | null = null
let memeWordsPendingPromise: Promise<MemeWord[]> | null = null

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
    // 命中缓存：直接使用，不再重复请求
    if (memeWordsCache) {
      setMemeWords(memeWordsCache)
      setIsLoadingMemeWords(false)
      return
    }

    setIsLoadingMemeWords(true)
    if (!memeWordsPendingPromise) {
      memeWordsPendingPromise = fetchMemeWords()
    }

    memeWordsPendingPromise
      .then((words) => {
        memeWordsCache = words
        if (!cancelled) setMemeWords(words)
      })
      .catch(() => {
        memeWordsCache = []
        if (!cancelled) setMemeWords([])
      })
      .finally(() => {
        memeWordsPendingPromise = null
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
