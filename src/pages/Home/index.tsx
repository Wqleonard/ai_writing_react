import { Link } from 'react-router-dom'
import { useCounterStore } from '@/stores/counter.ts'
import { Button } from '@/components/ui/button.tsx'

export function Home() {
  const { count, increment, decrement } = useCounterStore()

  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-xl font-semibold">首页</h2>
      <p className="text-3xl font-bold tabular-nums">{count}</p>
      <div className="flex gap-3">
        <Button onClick={decrement}>-1</Button>
        <Button onClick={increment}>+1</Button>
      </div>
      <Link to="/about" className="text-blue-600 underline">
        去关于页
      </Link>
    </div>
  )
}
