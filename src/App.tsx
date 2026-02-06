import { Outlet, Link } from 'react-router-dom'

function App() {
  return (
    <div className="flex h-screen flex-col bg-white">
      <nav className="flex gap-4 border-b px-6 py-3">
        <Link to="/" className="text-blue-600 hover:underline">
          首页
        </Link>
        <Link to="/about" className="text-blue-600 hover:underline">
          关于
        </Link>
      </nav>
      <main className="flex flex-1 items-center justify-center">
        <Outlet />
      </main>
    </div>
  )
}

export default App
