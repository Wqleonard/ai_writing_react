import { create } from 'zustand'
import type { ThemeStore, ThemeMode } from './types'

export type { ThemeMode, ThemeStore } from './types'

const THEMES: ThemeMode[] = ['light', 'dark', 'eye-care']
const STORAGE_KEY = 'theme'

function applyThemeToDocument(theme: ThemeMode) {
  try {
    document.documentElement.className = 'theme-' + theme + ' font-YaHei'
  } catch (e) {
    console.error('应用主题失败:', e)
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  themes: THEMES,
  currentTheme: THEMES[0],

  initTheme: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
      const theme =
        saved && THEMES.includes(saved) ? saved : THEMES[0]
      set({ currentTheme: theme })
      applyThemeToDocument(theme)
      if (!saved) localStorage.setItem(STORAGE_KEY, theme)
    } catch (e) {
      console.error('读取主题设置失败:', e)
      const theme = THEMES[0]
      set({ currentTheme: theme })
      localStorage.setItem(STORAGE_KEY, theme)
      applyThemeToDocument(theme)
    }
  },

  saveTheme: () => {
    try {
      localStorage.setItem(STORAGE_KEY, get().currentTheme)
    } catch (e) {
      console.error('保存主题设置失败:', e)
    }
  },

  setTheme: (theme: ThemeMode) => {
    if (!THEMES.includes(theme)) return
    set({ currentTheme: theme })
    applyThemeToDocument(theme)
    get().saveTheme()
  },

  toggleTheme: () => {
    const { themes, currentTheme } = get()
    const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length
    const next = themes[nextIndex]
    set({ currentTheme: next })
    applyThemeToDocument(next)
    get().saveTheme()
  },
}))

export const selectCurrentTheme = (s: ThemeStore) => s.currentTheme
export const selectThemes = (s: ThemeStore) => s.themes

export const selectCurrentThemeIcon = (s: ThemeStore): string => {
  switch (s.currentTheme) {
    case 'light':
      return '&#xe635;'
    case 'dark':
      return '&#xe67b;'
    case 'eye-care':
      return '&#xe63d;'
    default:
      return '&#xe635;'
  }
}

export const selectCurrentThemeName = (s: ThemeStore): string => {
  switch (s.currentTheme) {
    case 'light':
      return '明亮模式'
    case 'dark':
      return '夜色模式'
    case 'eye-care':
      return '护眼模式'
    default:
      return '明亮模式'
  }
}

// 模块加载时初始化主题（与 Vue 版 onMounted 时 initTheme 行为一致）
if (typeof document !== 'undefined') {
  useThemeStore.getState().initTheme()
}
