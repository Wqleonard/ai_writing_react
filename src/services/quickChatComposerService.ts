import type {
  QuickChatInputChannel,
  QuickChatInputChannelValue,
} from "@/types/quickChat"

export const findQuickChannelByTitle = (
  channels: QuickChatInputChannel[],
  title: string | null
): QuickChatInputChannel | null => {
  if (!title) return null
  return channels.find((channel) => channel.title === title) ?? null
}

export const getQuickChannelInputCount = (channel: QuickChatInputChannel): number =>
  channel.value.filter((item) => item.mold === "input").length

export const buildQuickChannelBaseText = (channel: QuickChatInputChannel): string =>
  channel.value
    .filter((item) => item.mold === "tip" || item.mold === "span")
    .map((item) => item.value || "")
    .join("")

export const buildQuickChannelFullText = (
  channel: QuickChatInputChannel,
  inputValues: string[]
): string => {
  let inputIndex = 0
  return channel.value
    .map((item: QuickChatInputChannelValue) => {
      if (item.mold === "tip" || item.mold === "span") return item.value
      if (item.mold === "input") return inputValues[inputIndex++] ?? ""
      return ""
    })
    .join("")
}
