import { defineStore } from 'pinia'
import { computed, onMounted, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'eye-care'

export const useThemeStore = defineStore('theme', () => {
  const themes = ref<ThemeMode[]>([
    'light', 'dark', 'eye-care'
  ])
  const currentTheme = ref<ThemeMode>(themes.value[0])

  // 从 localStorage 读取主题设置
  const initTheme = () => {
    try {
      document.documentElement.className = 'theme-' + currentTheme.value +' font-YaHei'
      // const savedTheme = localStorage.getItem('theme')
      // if (savedTheme !== null) {
      //   currentTheme.value = savedTheme as ThemeMode
      //   document.documentElement.className = 'theme-' + currentTheme.value
      // } else {
      //   // 如果没有保存的主题，使用默认主题
      //   currentTheme.value = themes.value[0] // 默认 light
      //   document.documentElement.className = 'theme-' + currentTheme.value
      // }
    } catch (error) {
      console.error('读取主题设置失败:', error)
      currentTheme.value = themes.value[0] // 默认 light
      localStorage.setItem('theme', currentTheme.value)
      document.documentElement.className = 'theme-' + currentTheme.value
    }
  }

  initTheme()

  // 保存主题设置到 localStorage
  const saveTheme = () => {
    try {
      localStorage.setItem('theme', currentTheme.value)
    } catch (error) {
      console.error('保存主题设置失败:', error)
    }
  }

  // 切换主题
  const toggleTheme = () => {
    const currentIndex = themes.value.indexOf(currentTheme.value)
    const nextIndex = (currentIndex + 1) % themes.value.length
    currentTheme.value = themes.value[nextIndex]
    document.documentElement.className = 'theme-' + currentTheme.value
    saveTheme()
  }

  const currentThemeIcon = computed(() => {
    switch (currentTheme.value) {
      case 'light':
        return '&#xe635;'
      case 'dark':
        return '&#xe67b;'
      case 'eye-care':
        return '&#xe63d;'
      default:
        return '&#xe635;'
    }
  })

  const currentThemeName = computed(() => {
    switch (currentTheme.value) {
      case 'light':
        return '明亮模式'
      case 'dark':
        return '夜色模式'
      case 'eye-care':
        return '护眼模式'
      default:
        return '明亮模式'
    }
  })

  return {
    currentTheme,
    currentThemeIcon,
    currentThemeName,
    toggleTheme,
    initTheme,
    saveTheme
  }
})
