import { useCallback } from 'react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover'
import { MoreHorizontal } from 'lucide-react'
import { Checkbox } from '@/components/ui/Checkbox'
import type { MyWorkData } from '../types'

dayjs.extend(utc)
dayjs.extend(timezone)

export interface MyWorksProps {
  data: MyWorkData
  batchDelete?: boolean
  onJump: (data: MyWorkData) => void
  onDelete: (id: string) => void
  onRename: (data: MyWorkData) => void
  onExportWord: (id: string) => void
  onExportTxt: (id: string) => void
  onBatchDelete: (data: MyWorkData) => void
  onDeleteCheckbox: (data: MyWorkData, checked: boolean) => void
}

const getDisplayTitle = (data: MyWorkData) => {
  return data.title || '未命名作品'
}

export const MyWorks = ({
  data,
  batchDelete,
  onJump,
  onDelete,
  onRename,
  onExportWord,
  onExportTxt,
  onBatchDelete,
  onDeleteCheckbox,
}: MyWorksProps) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (batchDelete) {
        onDeleteCheckbox(data, !data.deleteChecked)
      } else {
        onJump(data)
      }
    },
    [batchDelete, data, onJump, onDeleteCheckbox]
  )

  const handleMenuAction = useCallback(
    (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation()
      fn()
    },
    []
  )

  const workTypeLabel =
    data.workType === 'doc' ? '快捷创作' : data.workType === 'script' ? '剧本创作' : null

  return (
    <div
      className="my-works-item relative flex h-32 cursor-pointer flex-col rounded-lg p-5 shadow-sm transition-shadow hover:shadow-md"
      style={{ background: 'var(--bg-card)' }}
      onClick={handleClick}
    >
      {!batchDelete ? (
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded p-1 text-[#efaf00] hover:bg-(--bg-hover)"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-32 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col">
              <div
                className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
                onClick={handleMenuAction(() => onRename(data))}
              >
                重命名
              </div>
              <div
                className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
                onClick={handleMenuAction(() => onExportWord(data.id))}
              >
                导出为word
              </div>
              <div
                className="cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-(--bg-hover)"
                style={{ color: 'var(--text-primary)' }}
                onClick={handleMenuAction(() => onExportTxt(data.id))}
              >
                导出为txt
              </div>
              <div
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-[#ef4444] hover:bg-[#fef2f2]"
                onClick={handleMenuAction(() => onDelete(data.id))}
              >
                删除
              </div>
              <div
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-[#ef4444] hover:bg-[#fef2f2]"
                onClick={handleMenuAction(() => onBatchDelete(data))}
              >
                批量删除
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div
          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={!!data.deleteChecked}
            onCheckedChange={(checked) => {
              onDeleteCheckbox(data, checked === true)
            }}
            className="h-[18px] w-[18px] cursor-pointer rounded border-gray-300"
          />
        </div>
      )}

      <div className="mt-2 truncate font-bold text-[#524f47]" title={getDisplayTitle(data)}>
        {getDisplayTitle(data)}
      </div>
      <div className="line-clamp-2 mt-1 text-sm leading-tight text-(--text-secondary)">
        {data.description || '文章暂无简介'}
      </div>
      <div className="mt-auto flex justify-end">
        <div className="text-right text-xs text-(--text-tertiary)">
          {data?.updatedTime
            ? dayjs.utc(data.updatedTime).local().format('MM-DD HH:mm')
            : ''}
        </div>
      </div>
      {workTypeLabel ? (
        <div
          className="absolute left-0 top-0 rounded-tl-lg rounded-br-lg px-3 py-1 text-xs"
          style={{
            background: 'var(--bg-editor-save)',
            color: 'var(--bg-primary-overlay)',
          }}
        >
          {workTypeLabel}
        </div>
      ) : null}
    </div>
  )
}
