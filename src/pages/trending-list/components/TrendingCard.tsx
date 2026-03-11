import { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorkReq } from '@/api/works'
import { KeywordsDetailDialog } from './KeywordsDetailDialog'
import { SocialDetailDialog } from './SocialDetailDialog'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip.tsx";
import RichTextRender from '@/components/RichTextRender'
import { Iconfont } from "@/components/Iconfont";

export interface KeywordsDetailData {
  name: string
  workReference: string
  description: string
}

export interface SocialDetailData {
  name: string
  mainSubject: string
  tags?: string
  moreSettings?: string
}

export interface TrendingCardProps {
  title: string
  icon: string
  updateRange: [string, string]
  words: Array<string | { name: string; workReference?: string; description?: string; mainSubject?: string; tags?: string; moreSettings?: string }>
  onLoadingChange?: (loading: boolean) => void
}

const getItemName = (item: TrendingCardProps['words'][number]): string => {
  if (typeof item === 'string') return item
  return item?.name ?? ''
}

const getItemKey = (item: TrendingCardProps['words'][number], index: number): string | number => {
  if (typeof item === 'string') return item
  return item?.name ?? index
}

const isLoggedIn = () => !!localStorage.getItem('token')
const requireLogin = (callback: () => void) => {
  if (isLoggedIn()) callback()
  else window.location.href = '/workspace/my-place'
}

export const TrendingCard = ({ title, icon, updateRange, words, onLoadingChange }: TrendingCardProps) => {
  const navigate = useNavigate()
  const [showKeywordsDialog, setShowKeywordsDialog] = useState(false)
  const [showSocialDialog, setShowSocialDialog] = useState(false)
  const [currentKeywordsDetail, setCurrentKeywordsDetail] = useState<KeywordsDetailData>({
    name: '',
    workReference: '暂无',
    description: '暂无',
  })
  const [currentSocialDetail, setCurrentSocialDetail] = useState<SocialDetailData>({
    name: '',
    mainSubject: '',
  })

  const isKeywordsRank = title === '收稿风向'
  const list = useMemo(() => [...words].slice(0, 10), [words])

  const handleItemClick = useCallback(
    (item: TrendingCardProps['words'][number]) => {
      const itemName = getItemName(item)
      if (isKeywordsRank) {
        setCurrentKeywordsDetail({
          name: itemName,
          workReference: (item as any)?.workReference ?? '暂无',
          description: (item as any)?.description ?? '暂无',
        })
        setShowKeywordsDialog(true)
      } else {
        setCurrentSocialDetail({
          name: itemName,
          mainSubject: (item as any)?.mainSubject ?? '',
          tags: (item as any)?.tags,
          moreSettings: (item as any)?.moreSettings,
        })
        setShowSocialDialog(true)
      }
    },
    [isKeywordsRank]
  )

  const handleCreateNow = useCallback(
    async (word: string) => {
      try {
        onLoadingChange?.(true)
        const req: any = await createWorkReq()
        if (req?.id) {
          const stateData = { message: '请为我生成一篇主题为 #' + word + '的小说', skipRecommendDialog: true }
          sessionStorage.setItem('editorInitialParams', JSON.stringify(stateData))
          navigate(`/editor/${req.id}`, { state: { skipRecommendDialog: true } })
        } else {
          onLoadingChange?.(false)
        }
      } catch (e) {
        console.error(e)
        onLoadingChange?.(false)
      }
    },
    [navigate, onLoadingChange]
  )

  const lastCreateTimeRef = useRef(0)
  const handleCreateClick = useCallback(
    (word: string, event?: React.MouseEvent) => {
      event?.stopPropagation()
      const now = Date.now()
      if (now - lastCreateTimeRef.current < 1000) return
      lastCreateTimeRef.current = now
      requireLogin(() => handleCreateNow(word))
    },
    [handleCreateNow]
  )

  return (
    <div className="trending-card flex w-[382px] flex-col gap-5 rounded-[30px]">
      <div className="trending-card-header flex h-[34px] items-end justify-between">
        <div className="card-title flex items-center text-[26px] font-semibold leading-[26px] text-[#333333]">
          <Iconfont unicode={icon} className="iconfont mr-1 text-[32px]" />
          <span>{title}</span>
        </div>
        <div className="date-range text-xs leading-3 text-(--text-secondary)">
          {updateRange.join(' ~ ')}
        </div>
      </div>

      <div
        className="trending-card-list flex min-h-[calc(54px*10+14px*2)] flex-col rounded-[30px] p-3.5"
        style={{ background: 'var(--bg-card)' }}
      >
        {list.length > 0 ? (
          list.map((item, i) => (
            <div
              key={getItemKey(item, i)}
              className="trending-item flex h-[54px] cursor-pointer items-center rounded-[27px] transition-colors hover:bg-(--el-color-primary-light-8) [&:hover_.create-btn]:visible"
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleItemClick(item)
                }
              }}
            >
              <div
                className="rank-number ml-2.5 mr-3.5 flex h-8 w-8 shrink-0 items-center justify-center font-[YaHei] text-[22px] text-[#808080]"
                style={{
                  color: i === 0 ? '#eaa000' : i === 1 ? '#46a5ff' : i === 2 ? '#e57a00' : undefined,
                }}
              >
                {i + 1}
              </div>
              <div className="keyword-text min-w-0 flex-1 truncate text-xl cursor-pointer" title={getItemName(item)}>
                {getItemName(item)}
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <div
                    className="create-btn iconfont invisible flex size-8 custom-btn flex-shrink-0 cursor-pointer select-none items-center justify-center rounded-full text-2xl text-white"
                    style={{
                      background: 'linear-gradient(42.67deg, #efaf00 14.59%, #d78b00 84.59%)',
                    }}
                    onClick={() => handleItemClick(item)}
                    role="button"
                  >
                    &#xe642;
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  立即创作
                </TooltipContent>
              </Tooltip>
            </div>
          ))
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-[var(--text-secondary)]">
            <span className="text-sm">暂无数据</span>
          </div>
        )}
      </div>

      <KeywordsDetailDialog
        open={showKeywordsDialog}
        onOpenChange={setShowKeywordsDialog}
        detailData={currentKeywordsDetail}
        onDetailDataChange={setCurrentKeywordsDetail}
        title={title}
      />
      <SocialDetailDialog
        open={showSocialDialog}
        onOpenChange={setShowSocialDialog}
        detailData={currentSocialDetail}
        onDetailDataChange={setCurrentSocialDetail}
        title={title}
      />
    </div>
  )
}
