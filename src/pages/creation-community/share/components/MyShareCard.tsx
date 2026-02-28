import { Trash2 } from 'lucide-react'
import type { MyShareCardProps, ShareStatus } from '../types'
import { cn } from '@/lib/utils'

const getStatusText = (status: ShareStatus | string | undefined): string => {
  switch (status) {
    case 'DRAFT':
      return '草稿'
    case 'UNDER_REVIEW':
      return '审核中'
    case 'APPROVED':
      return '已发布'
    case 'REJECTED':
      return '已拒绝'
    default:
      return '审核中'
  }
}

export const MyShareCard = ({ data, onClick, onDelete }: MyShareCardProps) => {
  const isCreateCard = data.isCreateCard === true

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(data.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'my-share-card group relative flex h-[280px] w-full cursor-pointer flex-col rounded-xl bg-white p-3',
        isCreateCard
          ? 'border border-dashed border-gray-300 hover:bg-gray-50'
          : 'border border-[#dedede]'
      )}
      onClick={() => onClick?.(data)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(data)
        }
      }}
    >
      {!isCreateCard && (
        <>
          <button
            type="button"
            className="delete-icon absolute bottom-2 left-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-xl bg-[rgba(144,147,153,0.4)] p-1 text-[#333] opacity-0 transition-opacity duration-300 hover:bg-[rgba(144,147,153,0.35)] hover:text-[#f56c6c] focus:opacity-100 focus:outline-none group-hover:opacity-100"
            onClick={handleDelete}
            aria-label="删除"
          >
            <Trash2 className="size-4" />
          </button>
          {data.status ? (
            <div className="status-badge absolute right-2 top-2 z-5 rounded-xl bg-[#f0ad4e] px-3 py-1 text-xs font-medium text-white">
              {getStatusText(data.status)}
            </div>
          ) : null}
        </>
      )}

      {isCreateCard ? (
        <div className="card-content flex flex-1 flex-col items-center justify-center">
          <div className="mb-2 text-6xl text-gray-400">+</div>
          <div className="text-lg text-gray-600">{data.title}</div>
        </div>
      ) : (
        <div className="card-content flex flex-1 flex-col">
          <div className="card-title line-clamp-2 min-h-[54px] pr-[70px] text-lg leading-normal text-[#333]">
            {data.title}
          </div>
          <div className="card-description mt-1.5 line-clamp-10 max-h-[calc(1.33em*10)] text-xs leading-[1.33] text-[#666]">
            {data.description}
          </div>
          <div className="mt-auto flex items-center justify-between">
            <div className="text-xs text-gray-500" />
            <div className="mt-1 max-w-32 truncate text-xs">
              {data.authorName}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
