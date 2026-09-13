import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme'

const ORDER = ['system', 'light', 'dark']
const ICON = { system: Monitor, light: Sun, dark: Moon }
const LABEL = { system: 'System', light: 'Light', dark: 'Dark' }

/** Cycles system → light → dark, showing the current mode's icon. */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  const Icon = ICON[theme] ?? Monitor
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]

  return (
    <button type="button" onClick={() => setTheme(next)} className="btn-icon shrink-0"
      title={`Theme: ${LABEL[theme]} — click for ${LABEL[next].toLowerCase()}`}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next].toLowerCase()}.`}>
      <Icon size={15} />
    </button>
  )
}
