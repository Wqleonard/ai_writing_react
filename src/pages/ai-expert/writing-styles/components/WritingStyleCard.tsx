import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { WritingStyleCardProps } from '../types'

dayjs.extend(utc)

export const WritingStyleCard = ({ data, onClick }: WritingStyleCardProps) => {
  return (
    <div
      className="relative h-34 cursor-pointer overflow-hidden rounded-lg bg-white p-4 hover:shadow-md"
      onClick={() => onClick?.(data)}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(data)}
      role="button"
      tabIndex={0}
    >
      <div className="truncate text-lg font-bold text-[#524f47]">{data.name}</div>
      <div className="mt-2 min-h-10 line-clamp-2 text-sm leading-5">
        {data.description || '暂无内容'}
      </div>
      <div className="mt-3 text-xs text-[#dedede]">
        创建时间:{dayjs.utc(data.updatedAt).local().format('YYYY-MM-DD HH:mm:ss')}
      </div>
      {data.isAdd ? (
        <div className="absolute top-0 right-0 rounded-es-lg bg-theme-500 px-2 py-1.5 text-xs">
          已添加
        </div>
      ) : null}
    </div>
  )
}
