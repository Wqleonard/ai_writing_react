import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getKeywordsRankReq, getSocialRankReq } from '@/api/trending-list'
import { TrendingCard } from './components/TrendingCard'
import titleBg from '@/assets/images/title_bg.png'

const defaultTimeRange: [string, string] = [
  dayjs().subtract(7, 'day').format('YYYY.MM.DD'),
  dayjs().subtract(1, 'day').format('YYYY.MM.DD'),
]

export interface KeywordsRankItem {
  name: string
  workReference?: string
  description?: string
}

export interface SocialRankItem {
  name: string
  mainSubject?: string
  tags?: string
  moreSettings?: string
}

const TrendingListPage = () => {
  const [keywordsRankList, setKeywordsRankList] = useState<KeywordsRankItem[]>([])
  const [keywordsRankTime, setKeywordsRankTime] = useState<[string, string]>(defaultTimeRange)
  const [socialRankList, setSocialRankList] = useState<SocialRankItem[]>([])
  const [socialRankTime, setSocialRankTime] = useState<[string, string]>(defaultTimeRange)
  const [loading, setLoading] = useState(false)

  const updateKeywordsRank = async () => {
    try {
      const req: any = await getKeywordsRankReq()
      if (req && Array.isArray(req?.keywords)) {
        setKeywordsRankList(
          req.keywords.slice(0, 10).map((item: any) => ({
            name: item.name || item,
            workReference: item.workReference || '暂无',
            description: item.description || '暂无',
          }))
        )
      }
      if (req?.startTime && req?.endTime) {
        setKeywordsRankTime([
          dayjs(req.startTime).format('YYYY.MM.DD'),
          dayjs(req.endTime).format('YYYY.MM.DD'),
        ])
      }
    } catch {
      // ignore
    }
  }

  const updateSocialRank = async () => {
    try {
      const req: any = await getSocialRankReq()
      if (req && Array.isArray(req?.keywords)) {
        setSocialRankList(
          req.keywords.slice(0, 10).map((item: any) => ({
            name: item.name || item,
            mainSubject: item.mainSubject || '',
            tags: item.tags,
            moreSettings: item.moreSettings,
          }))
        )
      }
      if (req?.startTime && req?.endTime) {
        setSocialRankTime([
          dayjs(req.startTime).format('YYYY.MM.DD'),
          dayjs(req.endTime).format('YYYY.MM.DD'),
        ])
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all([updateKeywordsRank(), updateSocialRank()])
      } catch (e) {
        console.error(e)
      }
    }
    run()
  }, [])

  return (
    <div className="trending-list-container-scrollbar h-full overflow-y-auto">
      <div className="trending-list-container flex h-full flex-col items-center">
        {/* 标题区域 */}
        <div
          className="header relative flex w-[380px] shrink-0 flex-col items-center justify-center gap-2 py-10 text-center"
          style={{
            height: 160,
          }}
        >
          <div
            className="absolute inset-0 left-0 right-0 z-0 opacity-10"
            style={{
              background: `url(${titleBg}) no-repeat center center`,
              backgroundSize: 'auto 160px',
            }}
          />
          <div className="title relative z-10 flex items-center text-[38px] font-semibold leading-[38px] tracking-[2px] text-(--text-primary)">
            <span className="iconfont mr-1 text-[40px] text-[#333333]">&#xe608;</span>
            <span>创作榜单</span>
          </div>
          <div className="subtitle relative z-10 text-lg text-(--text-secondary)">
            写作风向标，即点即创作
          </div>
        </div>

        {/* 热榜卡片区域 */}
        <div className="cards-container mt-6 flex w-full max-w-[900px] justify-center gap-10 pb-10">
          <TrendingCard
            key="收稿风向"
            title="收稿风向"
            icon="&#xe63a;"
            updateRange={keywordsRankTime}
            words={keywordsRankList}
            onLoadingChange={setLoading}
          />
          <div className="divider w-[2px] shrink-0 bg-(--bg-secondary) mt-[3.375rem] mx-10 h-[calc(100%-3.375rem)]" />
          <TrendingCard
            key="灵感素材"
            title="灵感素材"
            icon="&#xe639;"
            updateRange={socialRankTime}
            words={socialRankList}
            onLoadingChange={setLoading}
          />
        </div>

        {loading && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-(--theme-color,#efaf00) border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  )
}

export default TrendingListPage
