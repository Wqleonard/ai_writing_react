import { Plus } from 'lucide-react'
import type { TemplateCardData } from '../types'
import { Button } from '@/components/ui/Button'

export interface TemplateCardProps {
  data: TemplateCardData
  showCreate?: boolean
  onCreate?: (data: TemplateCardData) => void
}

export const TemplateCard = ({
  data,
  showCreate = true,
  onCreate,
}: TemplateCardProps) => {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white p-4 hover:shadow-md">
      <div className="text-lg font-bold text-[#524f47]">{data.title}</div>
      <div className="mt-2 min-h-10 line-clamp-2 text-sm leading-5">
        {data.description}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-hidden">
        {data.tags?.map((tag) => (
          <span
            key={tag.id}
            className="shrink-0 rounded-full bg-[#fcefcc] px-1.5 text-xs leading-5 text-[#7e7866]"
          >
            {tag.name}
          </span>
        ))}
      </div>
      {showCreate && onCreate ? (
        <Button
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onCreate(data)
          }}
        >
          <Plus className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
