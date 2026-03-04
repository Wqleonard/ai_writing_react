/**
 * @description: tracking point
 */
import type { MatomoTracker } from '@certible/use-matomo'
import type {
  MatomoEventSpec,
  TrackEventArgs,
} from '@/matomo/types'

let tracker: MatomoTracker | null = null

export function setMatomoTracker(t: MatomoTracker) {
  tracker = t
}

export const getMatomoTracker = () => {
  return tracker
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

// 通用埋点
export const trackEvent = <
  E extends MatomoEventSpec
>(
  ...args: TrackEventArgs<E>
) => {
  const [category, action, name, value] = args
  if (!tracker) {
    console.warn('[Matomo] tracker is not initialized yet')
    return
  }
  tracker.trackEvent(category, action, name, value)
}
