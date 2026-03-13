import dayjs from 'dayjs'
import type { HistoryItem } from '../types'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

export interface HistoryCardProps {
  data: HistoryItem
  onClick?: (data: HistoryItem) => void
}

export const HistoryCard = ({ data, onClick }: HistoryCardProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group relative flex h-34 cursor-pointer flex-col overflow-hidden rounded-lg bg-white p-4 hover:shadow-md"
      onClick={() => onClick?.(data)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(data)
        }
      }}
    >
      <div className="truncate text-lg font-bold text-[#524f47]">{data.name}</div>
      <div className="mt-2 min-h-10 line-clamp-2 text-sm leading-5">
        {data.description || '暂无内容'}
      </div>
      <div className="mt-3 text-xs text-[#dedede]">
        创建时间:{dayjs.utc(data.updatedAt).local().format('YYYY-MM-DD HH:mm:ss')}
      </div>
    </div>
  )
}
