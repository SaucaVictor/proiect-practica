import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme, AccentColor } from '@/types'
import { useSettingsStore } from './settings.store'

export const useThemeStore = defineStore('theme', () => {
  const settingsStore = useSettingsStore()

  const theme = ref<Theme>('dark')
  const accentColor = ref<AccentColor>('indigo')

  const isDark = computed(() => {
    if (theme.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return theme.value === 'dark'
  })

  function applyTheme(): void {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    document.documentElement.setAttribute('data-accent', accentColor.value)
  }

  function setTheme(t: Theme): void {
    theme.value = t
    applyTheme()
    void settingsStore.save({ theme: t })
  }

  function setAccentColor(color: AccentColor): void {
    accentColor.value = color
    applyTheme()
    void settingsStore.save({ accentColor: color })
  }

  function initialize(): void {
    const settings = settingsStore.current
    theme.value = settings.theme
    accentColor.value = settings.accentColor
    applyTheme()

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', () => {
      if (theme.value === 'system') applyTheme()
    })
  }

  // Sync with settings store
  watch(() => settingsStore.current.theme, (t) => {
    theme.value = t
    applyTheme()
  })

  watch(() => settingsStore.current.accentColor, (c) => {
    accentColor.value = c
    applyTheme()
  })

  return {
    theme,
    accentColor,
    isDark,
    setTheme,
    setAccentColor,
    initialize,
    applyTheme,
  }
})
