import { defineStore } from 'pinia'
import { ref } from 'vue'
import { THEME_KEY } from '@/utils/constants'

export const useUiStore = defineStore('ui', () => {
  const theme = ref<'light' | 'dark'>('light')
  const settingsVisible = ref(false)   // controls the settings drawer (both desktop & mobile)
  const historyVisible = ref(window.innerWidth >= 768)  // default: shown on desktop, hidden on mobile

  function initTheme() {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(THEME_KEY)
    } catch {}
    if (saved === 'dark' || saved === 'light') {
      theme.value = saved
    } else {
      theme.value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    applyThemeClass(theme.value)
  }

  function applyThemeClass(t: 'light' | 'dark') {
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyThemeClass(theme.value)
    try {
      localStorage.setItem(THEME_KEY, theme.value)
    } catch {}
  }

  function openSettings() {
    settingsVisible.value = true
  }

  function closeSettings() {
    settingsVisible.value = false
  }

  function toggleHistory() {
    historyVisible.value = !historyVisible.value
  }

  function closeHistory() {
    historyVisible.value = false
  }

  return {
    theme,
    settingsVisible,
    historyVisible,
    initTheme,
    toggleTheme,
    openSettings,
    closeSettings,
    toggleHistory,
    closeHistory,
  }
})
