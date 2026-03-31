import { create } from 'zustand'
import { getPromptCategories } from '@/api/community-prompt'
import { getRecommendConfig } from '@/api/editor-header-toolbar'
import type {
  CategoryOption,
  BannerConfig,
  OptionsStore,
} from './types'

export type { CategoryOption, RecommendConfigItem, BannerConfig, OptionsStore } from './types'

const DEFAULT_BANNER: BannerConfig = {
  title: '',
  icon: '',
  btnText: '',
  content: '',
  canOpen: false,
}

const PROMPT_ICON_OPTIONS: CategoryOption[] = [
  {
    label: '图标1',
    value: 'https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark3.png',
  },
  {
    label: '图标2',
    value: 'https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark1.png',
  },
  {
    label: '图标3',
    value: 'https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark2.png',
  },
  {
    label: '图标4',
    value: 'https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark4.png',
  },
  {
    label: '图标5',
    value: 'https://vibe-writing-qa-public.tos-cn-beijing.volces.com/default-book-mark-icon/Bookmark5.png',
  },
]

const SORT_TYPE_OPTIONS: CategoryOption[] = [
  { label: '最新', value: 'updatedTime' },
  { label: '最热', value: 'favoritesCount' },
]

const PAGE_TYPE_OPTIONS: CategoryOption[] = [
  { label: '探索', value: 'public' },
  { label: '我的', value: 'my' },
  { label: '收藏', value: 'favorite' },
]

const ALL_CATEGORY: CategoryOption[] = [{ label: '全部', value: '' }]

export const useOptionsStore = create<OptionsStore>((set, get) => ({
  promptCategories: ALL_CATEGORY,
  promptIconOptions: PROMPT_ICON_OPTIONS,
  sortTypeOptions: SORT_TYPE_OPTIONS,
  pageTypeOptions: PAGE_TYPE_OPTIONS,
  joinUsQrCode: '',
  joinUsDesc: '',
  bannerConfig: DEFAULT_BANNER,
  recommendConfig: {},
  clawGuideUrl: '',
  clawVxQrCode: '',
  clawFeishuQrCode: '',

  updateCategories: async () => {
    try {
      const req = await getPromptCategories()
      if (req && Array.isArray(req)) {
        const categories: CategoryOption[] = [
          ...ALL_CATEGORY,
          ...req.map((item: { id: string | number; name: string }) => ({
            value: item.id + '',
            label: item.name,
          })),
        ]
        set({ promptCategories: categories })
      }
    } catch (e) {
      console.error('获取提示词分类失败:', e)
      set({ promptCategories: ALL_CATEGORY })
    }
  },

  updateConfig: async () => {
    try {
      const req = await getRecommendConfig()
      const updates: Partial<OptionsStore> = {}
      if (req?.vxQrCodeUrl) {
        updates.joinUsQrCode = req.vxQrCodeUrl
      }
      if (req?.vxQrCodeDescription) {
        updates.joinUsDesc = req.vxQrCodeDescription
      }
      if (req?.bannerConfig) {
        updates.bannerConfig = {
          ...get().bannerConfig,
          ...req.bannerConfig,
        }
      }
      if (req?.clawGuideUrl) {
        updates.clawGuideUrl = req.clawGuideUrl
      }
      if (req?.clawVxQrCodeUrl) {
        updates.clawVxQrCode = req.clawVxQrCodeUrl
      }
      if (req?.clawFeishuQrCodeUrl) {
        updates.clawFeishuQrCode = req.clawFeishuQrCodeUrl
      }
      if (Object.keys(updates).length > 0) {
        set(updates)
      }
      if (req?.recommend) {
        try {
          const recommend = JSON.parse(req.recommend)
          if (recommend && typeof recommend === 'object') {
            const recommendConfig = Object.entries(recommend).reduce<Record<string, string[]>>(
              (acc, [key, value]) => {
                acc[key] =
                  value && typeof value === 'object' && 'value' in value
                    ? Array.isArray((value as any).value)
                      ? (value as any).value
                      : []
                    : Array.isArray(value)
                      ? value
                      : []
                return acc
              },
              {}
            )
            set({ recommendConfig })
          }
        } catch {
          // ignore parse error
        }
      }
    } catch (e) {
      console.error('获取推荐配置失败:', e)
    }
  },

  updateRecommendConfig: async () => get().updateConfig(),
}))

// 初始化后拉取推荐配置（joinUsQrCode、joinUsDesc、bannerConfig、recommendConfig）
useOptionsStore.getState().updateConfig()
