import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  return (
    <button className="theme-toggle" onClick={() => setDark(v => !v)}>
      {dark ? '🌙 Dark' : '☀️ Light'}
    </button>
  )
}
