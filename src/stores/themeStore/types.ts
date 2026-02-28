export type ThemeMode = 'light' | 'dark' | 'eye-care'

export interface ThemeState {
  themes: ThemeMode[]
  currentTheme: ThemeMode
}

export interface ThemeActions {
  initTheme: () => void
  saveTheme: () => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export type ThemeStore = ThemeState & ThemeActions
