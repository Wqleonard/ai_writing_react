import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isMobileDevice } from '@/utils/isMobileDevice'

/**
 * 移动端重定向守卫组件（用于路由内部）
 * - 移动设备访问非移动端页面 → 重定向到 /m
 * - PC 端访问移动端页面 → 重定向到 /workspace/my-place
 */
export const MobileRedirectGuard = () => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const currentPath = location.pathname
    const isMobilePath = currentPath === '/m' || currentPath.startsWith('/m/')
    const isMobile = isMobileDevice()

    // PC 端访问移动端路径，重定向到 PC 端工作空间
    if (isMobilePath && !isMobile) {
      navigate('/workspace/my-place', { replace: true })
      return
    }

    // 移动设备访问非移动端页面，重定向到移动端
    if (!isMobilePath && isMobile) {
      navigate('/m', { replace: true })
    }
  }, [location.pathname, navigate])

  return <Outlet />
}
