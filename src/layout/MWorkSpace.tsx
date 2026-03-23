import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface TabBar {
  label: string
  name: string
  icon: string
  route: string
}

const tabBar: TabBar[] = [
  {
    label: '对话',
    name: 'm-workspace-chat',
    icon: '\ue940',
    route:'/m/workspace/chat'
  },
  {
    label: '灵感',
    name: 'm-workspace-inspiration',
    icon: '\ue637',
    route:'/m/workspace/inspiration'
  },
  {
    label: '笔记',
    name: 'm-workspace-notes',
    icon: '\ue644',
    route:'/m/workspace/notes'
  },
  {
    label: '我的',
    name: 'm-workspace-mine',
    icon: '\ue60b',
    route:'/m/workspace/mine'
  },
]

export default function MWorkSpace() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (tab: TabBar) => {
    return location.pathname.includes(tab.route)
  }

  const handleTabClick = (tab: TabBar) => {
    if (location.pathname.includes(tab.route)) {
      return
    }
    navigate(tab.route)
  }

  return (
    <div className="h-dvh overflow-hidden flex flex-col bg-[#f3f3f3]">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
      <div className="flex justify-between shrink-0 w-full h-35 px-8 pt-5 bg-white">
        {tabBar.map((tab) => (
          <div
            key={tab.name}
            className={cn(
              'flex flex-col text-xl items-center cursor-pointer transition-opacity active:opacity-70 min-w-0 flex-1',
              isActive(tab) && tab.name !== 'm-workspace-inspiration' ? 'text-[#fa9e00]' : 'text-gray-600'
            )}
            onClick={() => handleTabClick(tab)}
          >
            <div
              className={cn(
                'iconfont text-[44px]!',
                isActive(tab) && tab.name === 'm-workspace-inspiration'
                  ? 'text-transparent bg-clip-text bg-linear-to-r from-[#efaf00] to-[#ff9500]'
                  : isActive(tab)
                    ? 'text-[#fa9e00]'
                    : 'text-gray-600'
              )}
            >
              {tab.icon}
            </div>
            <div
              className={cn(
                isActive(tab) && tab.name === 'm-workspace-inspiration'
                  ? 'text-transparent bg-clip-text bg-linear-to-r from-[#efaf00] to-[#ff9500]'
                  : isActive(tab)
                    ? 'text-[#fa9e00]'
                    : 'text-gray-600'
              )}
            >
              {tab.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
