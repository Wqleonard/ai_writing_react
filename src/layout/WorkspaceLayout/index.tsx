import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceHeader } from './WorkspaceHeader'
import { NewbieTour } from "@/layout/components/NewbieTour/NewbieTour.tsx";

/**
 * 主应用布局：左侧固定侧边栏 + 右侧顶部 Header + 路由内容区。
 * 对应 Vue 版本的 MainLayout.vue。
 */
export function WorkspaceLayout() {
  const location = useLocation()
  const [newbieTourOpen, setNewbieTourOpen] = useState(true)

  useEffect(() => {
    // if (location.pathname === '/workspace' && !hasNewbieTourShowed.current) {
    //   const timer = setTimeout(() => {
    //     setNewbieTourOpen(true)
    //     hasNewbieTourShowed.current = true
    //   }, 200)
    //   return () => clearTimeout(timer)
    // }

  }, [location.pathname])

  return (
    <div
      className="flex h-screen"
      style={{
        background: 'var(--bg-primary)',
        minWidth: 'calc(184px + 800px)',
      }}
    >
      {/* 侧边栏 */}
      <WorkspaceSidebar />

      {/* 右侧主体 */}
      <main
        className="flex flex-1 flex-col overflow-hidden"
        style={{ background: 'var(--bg-primary)', minWidth: '800px' }}
      >
        {/* 顶部 Header - sticky */}
        <div
          className="sticky top-0 flex h-14 w-full shrink-0 flex-row-reverse items-center pr-[76px] bg-(--bg-primary)"
        >
          <WorkspaceHeader />
        </div>

        {/* 内容区 */}
        <div className="flex-1" style={{ minHeight: 'calc(100vh - 66px)' }}>
          <Outlet />
        </div>
      </main>

      <NewbieTour open={newbieTourOpen} onOpenChange={setNewbieTourOpen}/>
    </div>
  )
}
