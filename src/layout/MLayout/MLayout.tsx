import { Outlet } from 'react-router-dom'

export default function MLayout() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden">
      <Outlet />
    </div>
  )
}
