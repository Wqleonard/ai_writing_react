/**
 * @description: tracking point
 */
import type { MatomoTracker } from '@certible/use-matomo'

let tracker: MatomoTracker | null = null

export function setMatomoTracker(t: MatomoTracker) {
  tracker = t
}

// 设置用户id
export const setMatomoUser = (userId: string) => {
  console.log('setMatomoUser', userId)
  tracker?.setUserId(userId + '')
}

// 登出重置用户id
export const resetMatomoUser = () => {
  tracker?.setUserId(null)
}

export type TrackingEventAction =
  | "Use"
  | "Click"
  | "Generate"
  | "Add"
  | "Create"
  | "Apply"
  | "Step"
  | "Complete"
  | "Success"
  | "Impression"
  | "Save"
  | "Start"
  | "Export"

// 通用埋点
export const trackEvent = (
  category: string,
  action: TrackingEventAction,
  name?: string,
  value?: number
) => {
  if (!tracker) {
    console.warn('[Matomo] tracker is not initialized yet')
    return
  }
  tracker.trackEvent(category, action, name, value)
}
