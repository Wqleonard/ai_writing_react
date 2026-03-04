import { useCallback, useMemo, useState } from "react"
import type { QuickChatInputChannel } from "@/types/quickChat"
import {
  buildQuickChannelBaseText,
  findQuickChannelByTitle,
} from "@/services/quickChatComposerService"

interface UseQuickToolComposerOptions {
  channels: QuickChatInputChannel[]
  onChange: (value: string) => void
  onSelectTool?: (toolTitle: string) => void
  onCloseMode?: () => void
}

export const useQuickToolComposer = (options: UseQuickToolComposerOptions) => {
  const { channels, onChange, onSelectTool, onCloseMode } = options
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  const currentChannel = useMemo(
    () => findQuickChannelByTitle(channels, selectedTool),
    [channels, selectedTool]
  )

  const closeToolMode = useCallback(() => {
    setSelectedTool(null)
    onCloseMode?.()
    onChange("")
  }, [onCloseMode, onChange])

  const openToolMode = useCallback(
    (toolTitle: string) => {
      const channel = findQuickChannelByTitle(channels, toolTitle)
      if (!channel) return
      setSelectedTool(toolTitle)
      onChange(buildQuickChannelBaseText(channel))
      onSelectTool?.(toolTitle)
    },
    [channels, onChange, onSelectTool]
  )

  const handleToolTagClick = useCallback(
    (toolTitle: string) => {
      if (selectedTool === toolTitle) {
        closeToolMode()
        return
      }
      openToolMode(toolTitle)
    },
    [selectedTool, closeToolMode, openToolMode]
  )

  return {
    selectedTool,
    currentChannel,
    closeToolMode,
    openToolMode,
    handleToolTagClick,
  }
}
