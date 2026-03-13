export interface CategoryOption {
  label: string
  value: string | number
}

export const PAGE_TYPE_OPTIONS: CategoryOption[] = [
  { label: '探索', value: 'public' },
  { label: '我的', value: 'my' },
  { label: '收藏', value: 'favorite' },
]

export const SORT_TYPE_OPTIONS: CategoryOption[] = [
  { label: '最新', value: 'updatedTime' },
  { label: '最热', value: 'favoritesCount' },
]
