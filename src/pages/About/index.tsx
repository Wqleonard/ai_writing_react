import { Link } from 'react-router-dom'

export function About() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-xl font-semibold">关于</h2>
      <p className="text-gray-600">这是第二个路由的测试页面。</p>
      <Link to="/" className="text-blue-600 underline">
        回首页
      </Link>
    </div>
  )
}
