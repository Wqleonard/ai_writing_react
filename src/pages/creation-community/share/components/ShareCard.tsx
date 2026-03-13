import type { ShareCardProps } from '../types'
import { useMemo } from 'react'

/** 过滤 HTML 标签，取纯文本前 100 字 */
const getDescriptionPreview = (html: string): string => {
  const text = (html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

export const ShareCard = ({ data, onClick }: ShareCardProps) => {
  const descriptionPreview = useMemo(
    () => getDescriptionPreview(data?.description ?? ''),
    [data?.description]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      className="course-card relative flex cursor-pointer flex-col rounded-xl border border-[#dedede] bg-white p-3"
      onClick={() => onClick?.(data)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.(data)
        }
      }}
    >
      <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded">
        <img
          src={data.coverImageUrl}
          alt=""
          className="block h-full w-full object-cover"
        />
      </div>
      <div className="card-title mt-3 truncate text-lg leading-normal text-[#333]">
        {data.title}
      </div>
      <div className="card-description mt-1.5 line-clamp-2 text-xs leading-[1.33] text-[#666]">
        {descriptionPreview}
      </div>
      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-500" />
        <div className="mt-1 flex max-w-40 items-center gap-2 truncate text-xs">
          {data?.authorName ? <span className="mr-0.5">@</span> : null}
          <span>{data?.authorName ?? ''}</span>
        </div>
      </div>
    </div>
  )
}
