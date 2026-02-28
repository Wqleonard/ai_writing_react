import { useState, useCallback, useEffect } from 'react'
import { Heart, BarChart2 } from 'lucide-react'
import type { PromptItem } from '@/components/Community/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

const STATUS_MAP: Record<string, string> = {
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
}

export interface PromptCardProps {
  data: PromptItem
  showStatus?: boolean
  onUse?: (data: PromptItem) => void
  onFavorite?: (data: PromptItem) => void
}

export const PromptCard = ({
  data,
  showStatus = false,
  onUse,
  onFavorite,
}: PromptCardProps) => {
  const [cardData, setCardData] = useState<PromptItem>({ ...data })

  useEffect(() => {
    setCardData({ ...data })
  }, [data])

  const handleFavoriteClick = useCallback(() => {
    onFavorite?.(cardData)
  }, [cardData, onFavorite])

  const handleUse = useCallback(() => {
    onUse?.(cardData)
  }, [cardData, onUse])

  return (
    <div className="relative flex w-full min-w-0 flex-col rounded-[10px] bg-white px-4 py-3">
      <div className="flex h-13 w-full gap-4">
        <div className="h-13 w-13 shrink-0 overflow-hidden rounded-full bg-gray-100">
          {cardData.iconUrl ? (
            <img
              src={cardData.iconUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex h-13 min-w-0 flex-1 flex-col justify-between">
          <div
            className="truncate pt-0.5 text-base font-bold"
            title={cardData.name}
          >
            {cardData.name}
          </div>
          <div className="flex h-5 items-center gap-3">
            {cardData.categories?.length ? (
              <div className="h-5 rounded-full bg-[#f5e4bb] px-2.5 text-xs leading-5">
                {cardData.categories[0]?.name}
              </div>
            ) : null}
            <span className="flex items-center text-sm text-[#ff5200]">
              <BarChart2 className="mr-0.5 size-4" />
              {cardData.useCount}
            </span>
            <button
              type="button"
              className={cn(
                'flex items-center text-sm',
                cardData.isFavorited ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={handleFavoriteClick}
            >
              <Heart
                className={cn('mr-0.5 size-4', cardData.isFavorited && 'fill-current')}
              />
              {cardData.favoritesCount}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-1.5 line-clamp-5 h-25 wrap-break-word text-xs leading-5 whitespace-break-spaces">
        {cardData.description}
      </div>
      <div className="mt-1.5 flex items-center justify-between border-t border-[#d9d9d9] pt-2.5">
        <div className="text-xs">
          {cardData.authorName ? <span className="mr-0.5">@</span> : null}
          <span>{cardData.authorName}</span>
        </div>
        <Button
          className="bg-[#f0ac00] px-4 h-6.5 leading-6.5 text-xs! text-white! rounded-full"
          onClick={handleUse}
        >
          立即使用
        </Button>
      </div>

      {showStatus && cardData?.status && STATUS_MAP[cardData.status] ? (
        <div
          className={cn(
            'status-flag absolute left-0 top-2.5 whitespace-nowrap rounded px-3 py-1 text-xs font-medium leading-tight',
            cardData.status === 'APPROVED' && 'bg-[#9bffb9] text-black',
            cardData.status === 'REJECTED' && 'bg-[#ff0000] text-white',
            cardData.status === 'UNDER_REVIEW' && 'bg-[#efc04e] text-black'
          )}
        >
          {STATUS_MAP[cardData.status]}
        </div>
      ) : null}
    </div>
  )
}
