export interface CategoryOption {
  label: string
  value: string | number
}

export interface RecommendConfigItem {
  key: string
  label: string
  value: string
}

export interface BannerConfig {
  title: string
  icon: string
  btnText: string
  content: string
  canOpen: boolean
}

export interface OptionsState {
  promptCategories: CategoryOption[]
  promptIconOptions: CategoryOption[]
  sortTypeOptions: CategoryOption[]
  pageTypeOptions: CategoryOption[]
  joinUsQrCode: string
  joinUsDesc: string
  bannerConfig: BannerConfig
  recommendConfig: Record<string, string[]>
}

export interface OptionsActions {
  updateCategories: () => Promise<void>
  updateConfig: () => Promise<void>
  /** 与 updateConfig 相同，兼容 Vue 命名 */
  updateRecommendConfig: () => Promise<void>
}

export type OptionsStore = OptionsState & OptionsActions
