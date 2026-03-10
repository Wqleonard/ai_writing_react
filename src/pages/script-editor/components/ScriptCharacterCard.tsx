import { useMemo, useState } from 'react'
import { addNote, type NoteSourceType } from '@/api/notes'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import FEMALE from '@/assets/images/quick_creation/character_woman_sex.svg'
import MALE from '@/assets/images/quick_creation/character_man_sex.svg'
import CUSTOMSEX from '@/assets/images/quick_creation/character_custom_sex.svg'

export interface ScriptCharacterCardData {
  name?: string
  definition?: string
  age?: string
  personality?: string
  biography?: string
}

export interface ScriptCharacterCardProps {
  data?: ScriptCharacterCardData
  showEdit?: boolean
  showDelete?: boolean
  isCustom?: boolean
  loading?: boolean
  isSelected?: boolean
  compactTags?: boolean
  onClick?: (event?: React.MouseEvent<HTMLDivElement>) => void
  onEdit?: (event: React.MouseEvent) => void
  onDelete?: (event: React.MouseEvent) => void
}

export const ScriptCharacterCard = ({
  data,
  showEdit = false,
  showDelete = false,
  isCustom = false,
  loading = false,
  isSelected = false,
  compactTags = false,
  onClick,
  onEdit,
  onDelete,
}: ScriptCharacterCardProps) => {
  const [isCardHovered, setIsCardHovered] = useState(false)

  // 与 Vue 保持一致：definition 包含“女”时使用女性底图，否则男性底图
  const genderImage = useMemo(
    () => (data?.definition?.includes('女') ? FEMALE : MALE),
    [data?.definition]
  )

  const personalityTags = useMemo(() => {
    const raw = data?.personality?.trim()
    if (!raw) return []
    return raw
      .split(/[、,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  }, [data?.personality])

  const handleAddNote = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!data?.name) {
      toast.warning('角色信息不完整，无法添加笔记')
      return
    }

    const parts: string[] = []
    if (data.definition) parts.push(`身份：${data.definition}`)
    if (data.age) parts.push(data.age)
    if (data.personality) parts.push(data.personality)
    if (data.biography) parts.push(data.biography)

    const content = parts.join('\n\n')
    if (!content) {
      toast.warning('角色内容为空，无法添加笔记')
      return
    }

    try {
      await addNote(data.name, content, 'PC_ADD' as NoteSourceType)
      toast.success('笔记添加成功')
    } catch (error) {
      console.error('添加笔记失败:', error)
      toast.error('添加笔记失败，请重试')
    }
  }

  if (isCustom) {
    return (
      <div
        role="button"
        className="relative flex size-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-[12px] border-2 border-dashed border-[#d9d9d9] bg-transparent p-[8%] shadow-[0_0_25px_0_rgba(58,37,0,0.15)] outline-none transition-colors hover:border-(--theme-color)"
        onClick={onClick}
      >
        <div className="pointer-events-none absolute right-[-15%] bottom-[-15%] h-[min(190px,65%)] w-[min(180px,65%)] opacity-60">
          <img src={CUSTOMSEX} alt="" className="size-full object-contain" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
          <div className="mb-3 max-w-full shrink-0 px-1 text-center text-[clamp(14px,2.8vmin,28px)] font-bold leading-[1.32] tracking-[0.04em] text-[#d9d9d9]">
            自定义角色
          </div>

          <div className="flex h-[min(72px,28%)] w-[min(72px,28%)] max-h-[72px] max-w-[72px] shrink-0 items-center justify-center">
            <div className="relative size-full rounded-full border-2 border-[#c8c8c8] h-[33px]">
              <span className="absolute top-1/2 left-1/2 h-[2px] w-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#c8c8c8]" />
              <span className="absolute top-1/2 left-1/2 h-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#c8c8c8]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const showSkeleton = loading || !data?.name

  return (
    <div
      role="button"
      className={cn(
        'relative flex size-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-[10px] bg-[#fff8e5] p-5 shadow-[5px_5px_5px_0_rgba(58,37,0,0.15)]',
        isSelected && 'ring-2 ring-(--theme-color)'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      {showSkeleton ? (
        <div className="relative z-10 flex size-full flex-col justify-around">
          <Skeleton className="h-[42px] w-full rounded-[4px]" />
          <Skeleton className="h-[28px] w-full rounded-[4px]" />
          <Skeleton className="h-[90px] w-full rounded-[4px]" />
          <Skeleton className="h-[40px] w-full rounded-[4px]" />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute right-[-20px] bottom-[-20px] z-0 h-[175px] w-[167px]">
            <img src={genderImage} alt="" className="size-full object-contain" />
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-[15px]">
            <div className="relative min-w-0 shrink-0">
              <div
                className="truncate text-[20px] leading-[1.32] font-bold tracking-[0.04em] text-[#464646]"
                title={data?.name}
              >
                {data?.name}
              </div>

              {isCardHovered ? (
                <div className="absolute top-[-15px] right-[-15px] flex items-center gap-1 text-xs text-[#999999]">
                  <span
                    className="inline-flex cursor-pointer items-center whitespace-nowrap text-xs text-[#999999] hover:text-(--theme-color)"
                    onClick={handleAddNote}
                  >
                    添加笔记
                  </span>
                  {showEdit ? (
                    <span
                      className="inline-flex cursor-pointer items-center whitespace-nowrap text-xs text-[#999999] hover:text-(--theme-color)"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit?.(e)
                      }}
                    >
                      编辑
                    </span>
                  ) : null}
                  {showDelete ? (
                    <span
                      className="inline-flex cursor-pointer items-center text-xs text-[#999999] transition-colors hover:text-[#f56c6c]"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete?.(e)
                      }}
                    >
                      删除
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 shrink-0 items-center justify-between gap-3">
              <div
                className="flex-1 truncate text-sm leading-[1.32] text-[#464646]"
                title={data?.definition}
              >
                {data?.definition}
              </div>
              <div
                className="max-w-[80px] shrink-0 truncate text-right text-sm leading-[1.32] text-[#464646]"
                title={data?.age}
              >
                {data?.age}
              </div>
            </div>

            <div className={cn('relative w-full min-w-0 shrink-0 overflow-hidden', compactTags && 'pr-0')}>
              {compactTags ? (
                <div className="flex items-center gap-[5px]">
                  {personalityTags[0] ? (
                    <span className="shrink-0 rounded-[21px] bg-[rgba(239,175,0,0.2)] px-3 py-1.5 text-[13px] leading-[1.32] text-[#4d4d4d]">
                      {personalityTags[0]}
                    </span>
                  ) : null}
                  <span className="ml-1 shrink-0 text-[13px] leading-[1.32] text-[#8a8a8a]">...</span>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 flex-nowrap gap-[5px] overflow-hidden">
                    {personalityTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="shrink-0 whitespace-nowrap rounded-[21px] bg-[rgba(239,175,0,0.2)] px-3 py-1.5 text-[13px] leading-[1.32] text-[#4d4d4d]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute top-0 right-0 h-full w-[8%] bg-[linear-gradient(to_right,transparent_0%,rgba(255,248,229,0.4)_20%,rgba(255,248,229,0.95)_100%)]" />
                </>
              )}
            </div>

            <div className="relative flex min-h-[80px] flex-1 flex-col overflow-hidden">
              <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-12 bg-[linear-gradient(180deg,rgba(255,248,229,0)_0%,rgba(255,248,229,1)_100%)]" />
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                <div
                  className="w-full pr-1.5 pb-5 text-justify text-sm leading-[1.32] tracking-[0.04em] text-[#464646]"
                  style={{
                    WebkitMaskImage:
                      'linear-gradient(180deg, #000 0%, #000 70%, transparent 100%)',
                    maskImage:
                      'linear-gradient(180deg, #000 0%, #000 70%, transparent 100%)',
                  }}
                >
                  {data?.biography}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
