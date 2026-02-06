import { Outlet } from 'react-router-dom'

/**
 * 根布局：仅渲染子路由内容，无侧边栏。
 * 用于 /、/about 等非 workspace 路由。
 */
export function RootLayout() {
  return <Outlet />
}
