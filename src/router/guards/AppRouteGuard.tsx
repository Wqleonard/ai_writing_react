import { useEffect, useRef } from 'react'
import { useLocation, type Location } from 'react-router-dom'
import { MobileRedirectGuard } from '@/router/guards/MobileRedirect'
import { getMatomoTracker } from '@/matomo/trackingMatomoEvent'

/**
 * 路由标题映射表
 */
const ROUTE_TITLES: Record<string, string> = {
  '/': '落地页',
  '/workspace/my-place': '我的空间',
  '/workspace/trending-list': '创作榜单',
  '/workspace/ai-expert/book-analysis': '拆书仿写',
  '/workspace/ai-expert/writing-styles': '文风提炼',
  '/workspace/creation-community/course': '课程',
  '/workspace/creation-community/course/details': '课程详情',
  '/workspace/creation-community/share': '分享',
  '/workspace/creation-community/share/details': '分享详情',
  '/workspace/creation-community/prompt': '提示词',
  '/editor': '编辑器 / 通用创作短篇',
}

/**
 * 根据路径获取页面标题
 */
const getPageTitle = (pathname: string): string => {
  // 精确匹配
  if (ROUTE_TITLES[pathname]) {
    return ROUTE_TITLES[pathname]
  }

  // 动态路由前缀匹配（如 /editor/:workId、/quick-editor/:workId）
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(`${route}/`)) {
      return title
    }
  }

  // 默认使用 document.title
  return document.title
}

/**
 * 根据路径获取页面路由配置
 */

const getPageRoute = (pathname: string): string => {
  // 精确匹配
  if (ROUTE_TITLES[pathname]) {
    return pathname
  }

  // 动态路由前缀匹配（如 /editor/:workId、/quick-editor/:workId）
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(`${route}/`)) {
      return route
    }
  }
  return '/'
}

/**
 * 全局路由守卫：提供 before / after 路由快照。
 */
export const AppRouteGuard = () => {
  const location = useLocation()
  const prevLocationRef = useRef<Location | null>(null)

  useEffect(() => {
    const before = prevLocationRef.current
    const after = location

    const beforeRoute = getPageRoute(before?.pathname || '')
    const afterRoute = getPageRoute(after.pathname || '')
    const pageTitle = getPageTitle(after.pathname)

    // 同步设置 document.title
    if (pageTitle == '落地页'){
      document.title = '爆文猫写作'
    } else {
      document.title = '爆文猫写作' + pageTitle
    }

    const tracker = getMatomoTracker()
    if (!tracker) {
      console.warn('[Matomo] tracker is not initialized yet')
      prevLocationRef.current = location
      return
    }

    tracker.push(['setReferrerUrl', beforeRoute])
    tracker.push(['setCustomUrl', afterRoute])
    tracker.push(['setDocumentTitle', pageTitle])
    tracker.push(['trackPageView'])

    prevLocationRef.current = location
  }, [location])

  return <MobileRedirectGuard/>
}
