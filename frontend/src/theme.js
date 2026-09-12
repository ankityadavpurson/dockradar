import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'dockradar_theme'
const THEMES = ['system', 'light', 'dark']

const media = () => window.matchMedia('(prefers-color-scheme: light)')

export function getStoredTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(t) ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Resolve 'system' to the concrete 'light' | 'dark' the OS prefers. */
export function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme
  return media().matches ? 'light' : 'dark'
}

/** Stamp the resolved theme onto <html> so the CSS tokens switch. */
export function applyTheme(theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.backgroundColor = resolved === 'light' ? '#f4f4f5' : '#1e1e1e'
}

/** Theme state: 'system' | 'light' | 'dark', persisted and applied to <html>. */
export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme)

  const setTheme = useCallback((t) => {
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* ignore */ }
    setThemeState(t)
    applyTheme(t)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    // While following the system, react to OS light/dark changes live.
    if (theme !== 'system') return
    const m = media()
    const onChange = () => applyTheme('system')
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [theme])

  return [theme, setTheme]
}
