import { THEME_KEY } from '@/utils/constants'

export function useTheme() {
  function initTheme(): 'light' | 'dark' {
    let theme: string | null = null
    try {
      theme = localStorage.getItem(THEME_KEY)
    } catch {
      // ignore
    }
    if (theme !== 'dark' && theme !== 'light') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    applyTheme(theme as 'light' | 'dark')
    return theme as 'light' | 'dark'
  }

  function applyTheme(theme: 'light' | 'dark') {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }

  function toggleTheme(current: 'light' | 'dark'): 'light' | 'dark' {
    const next = current === 'light' ? 'dark' : 'light'
    applyTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // ignore
    }
    return next
  }

  return {
    initTheme,
    applyTheme,
    toggleTheme,
  }
}
