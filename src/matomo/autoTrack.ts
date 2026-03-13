import apiClient from '@/api'
import { router } from '@/router'
import { useLoginStore } from '@/stores/loginStore'
import { trackEvent } from '@/matomo/trackingMatomoEvent'
import {getMatomoTracker} from './trackingMatomoEvent'

type Cleanup = () => void

type GlobalWithMatomoCleanup = typeof globalThis & {
  __MATOMO_AUTO_TRACK_CLEANUP__?: Cleanup
}

const FIRST_EDITOR_VISIT_KEY = '___first_in_editor___'

function safeTrack(fn: () => void) {
  try {
    fn()
  } catch (error) {
    console.warn('[Matomo] auto track failed:', error)
  }
}

type MatomoQueue = Array<unknown[]>

function getPaq(): MatomoQueue | undefined {
  return (window as Window & { _paq?: MatomoQueue })._paq
}

function getRouteTitleFromState(state: {
  matches: Array<{ route?: { meta?: { title?: string }; handle?: { title?: string } } }>
}): string {
  const lastMatch = state.matches[state.matches.length - 1]
  const route = lastMatch?.route ?? {}

  return route.meta?.title || route.handle?.title || document.title
}

function trackPageView(fullPath: string, previousUrl: string, title: string) {
  const tracker = getMatomoTracker()
  if (!tracker) {
    console.warn('[Matomo] tracker is not initialized yet')
    return
  }

  const currentUrl = `${location.origin}${fullPath}`
  tracker.push(['setReferrerUrl', previousUrl])
  tracker.push(['setCustomUrl', currentUrl])
  tracker.push(['setDocumentTitle', title])
  tracker.push(['trackPageView'])
  // tracker.push(['enableLinkTracking'])
}

function trackByPathname(pathname: string) {
  if (pathname.startsWith('/editor/')) {
    const firstVisited = localStorage.getItem(FIRST_EDITOR_VISIT_KEY) === '1'
    if (!firstVisited) {
      safeTrack(() => trackEvent('User Lifecycle', 'Success', 'Use Editor'))
      localStorage.setItem(FIRST_EDITOR_VISIT_KEY, '1')
    }
    return
  }
}

function registerRouteAutoTrack(): Cleanup {
  trackByPathname(window.location.pathname)

  const initialFullPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  let previousUrl = document.referrer || `${location.origin}${initialFullPath}`
  const initialTitle = document.title
  trackPageView(initialFullPath, previousUrl, initialTitle)

  let lastFullPath = initialFullPath
  const unsubscribe = router.subscribe((state) => {
    const pathname = state.location.pathname
    if (!pathname) return

    const fullPath = `${state.location.pathname}${state.location.search}${state.location.hash}`
    if (fullPath === lastFullPath) return
    lastFullPath = fullPath

    trackByPathname(pathname)

    const title = getRouteTitleFromState(state)
    trackPageView(fullPath, previousUrl, title)
    previousUrl = `${location.origin}${fullPath}`
  })

  return () => unsubscribe()
}

function registerLoginAutoTrack(): Cleanup {
  const unsubscribe = useLoginStore.subscribe((state, prevState) => {
    if (!prevState.isLoggedIn && state.isLoggedIn) {
      safeTrack(() => trackEvent('User Lifecycle', 'Success', 'Login'))
    }
  })

  return () => unsubscribe()
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function registerPaymentApiAutoTrack(): Cleanup {
  const responseInterceptorId = apiClient.api.interceptors.response.use((response) => {
    const url = response?.config?.url ?? ''
    const lowered = url.toLowerCase()
    const maybePayment =
      lowered.includes('pay') || lowered.includes('payment') || lowered.includes('recharge')

    if (!maybePayment) return response

    const data = response?.data as { data?: { amount?: unknown; totalCost?: unknown } } | undefined
    const amount = toNumber(data?.data?.amount) ?? toNumber(data?.data?.totalCost) ?? 1
    safeTrack(() => trackEvent('Payment', 'Success', 'Plan', amount))
    return response
  })

  return () => {
    apiClient.api.interceptors.response.eject(responseInterceptorId)
  }
}

export function registerAutoTrack() {
  const cleanupRoute = registerRouteAutoTrack()
  const cleanupLogin = registerLoginAutoTrack()
  const cleanupPaymentApi = registerPaymentApiAutoTrack()

  const cleanup = () => {
    cleanupRoute()
    cleanupLogin()
    cleanupPaymentApi()
  }

  const globalScope = globalThis as GlobalWithMatomoCleanup
  globalScope.__MATOMO_AUTO_TRACK_CLEANUP__?.()
  globalScope.__MATOMO_AUTO_TRACK_CLEANUP__ = cleanup
}
