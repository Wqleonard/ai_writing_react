export type ChatSubmitSource = "creation-input"

export interface ChatSubmitPayload {
  id: string
  text: string
  source: ChatSubmitSource
  createdAt: number
}

type ChatSubmitListener = (payload: ChatSubmitPayload) => void

const listeners = new Set<ChatSubmitListener>()
let pendingPayload: ChatSubmitPayload | null = null

const DEFAULT_MAX_AGE_MS = 15_000

const isPayloadFresh = (payload: ChatSubmitPayload, maxAgeMs: number) => {
  return Date.now() - payload.createdAt <= maxAgeMs
}

export const emitCreationInputSubmit = (text: string) => {
  const payload: ChatSubmitPayload = {
    id: `creation_submit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    source: "creation-input",
    createdAt: Date.now(),
  }
  pendingPayload = payload
  listeners.forEach((listener) => listener(payload))
}

export const subscribeChatSubmitBridge = (
  listener: ChatSubmitListener,
  options?: { consumePending?: boolean; maxAgeMs?: number }
) => {
  const consumePending = options?.consumePending ?? true
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS

  listeners.add(listener)
  if (consumePending && pendingPayload && isPayloadFresh(pendingPayload, maxAgeMs)) {
    const payload = pendingPayload
    pendingPayload = null
    listener(payload)
  }

  return () => {
    listeners.delete(listener)
  }
}
