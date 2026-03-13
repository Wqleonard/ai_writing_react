import { ThumbsUp, ThumbsDown } from 'lucide-react'
import type { CourseCardProps } from '../types'
import { cn } from '@/lib/utils'

export const CourseCard = ({ data, onClick, onLike, onDislike }: CourseCardProps) => {
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLike?.(data.id)
  }

  const handleDislike = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDislike?.(data.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="course-card flex cursor-pointer flex-col rounded-xl border border-[#dedede] bg-white p-3"
      onClick={() => onClick?.(data.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(data.id)
        }
      }}
    >
      <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded">
        <img
          src={data.imageUrl}
          alt=""
          className="block h-full w-full object-cover"
        />
      </div>
      <div className="mt-3 flex items-center truncate text-lg">
        <div className="truncate">{data.title}</div>
        {data.tags?.map((tag) => (
          <div
            key={tag.id}
            className={cn(
              'ml-2 h-5 shrink-0 rounded-full px-3 text-xs leading-5',
              tag.name === '官方' ? 'bg-[#e2a791]!' : 'bg-gray-100'
            )}
          >
            {tag.name}
          </div>
        ))}
      </div>
      <div className="mt-1.5 line-clamp-2 h-8 text-xs leading-4">
        {data.description}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-500">
          <button
            type="button"
            className="flex cursor-pointer items-center"
            onClick={handleLike}
          >
            <ThumbsUp
              className={cn('mr-0.5 size-4', data.likeValue === 1 && 'text-[#ffc227]')}
            />
            <span>{data.likeCount}</span>
          </button>
          <button
            type="button"
            className="ml-2 cursor-pointer"
            onClick={handleDislike}
          >
            <ThumbsDown
              className={cn('size-4', data.likeValue === 2 && 'text-[#ffc227]')}
            />
          </button>
        </div>
        <div className="flex max-w-40 items-center gap-2 truncate text-xs">
          {data?.authorName ? <span className="mr-0.5">@</span> : null}
          <span>{data?.authorName ?? ''}</span>
        </div>
      </div>
    </div>
  )
}
