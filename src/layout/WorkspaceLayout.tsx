import { Outlet, Link, useLocation } from 'react-router-dom'

const workspaceNavItems = [
  { to: '/workspace', label: '工作台首页' },
  { to: '/workspace/projects', label: '项目' },
  { to: '/workspace/tiptap', label: 'Tiptap' },
]

/**
 * Workspace 布局：左侧导航栏 + 右侧路由内容。
 * 用于 /workspace 下的所有子路由。
 */
export function WorkspaceLayout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="flex w-52 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <Link to="/workspace" className="text-lg font-semibold text-gray-900">
            Workspace
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {workspaceNavItems.map(({ to, label }) => {
            const isActive =
              to === '/workspace'
                ? location.pathname === '/workspace'
                : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-gray-100 font-medium text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-gray-200 p-2">
          <Link
            to="/"
            className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            返回首页
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
