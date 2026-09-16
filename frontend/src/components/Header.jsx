import favicon from '../../assets/favicon.svg'
import ThemeToggle from './ThemeToggle'

/** "in 5h 12m" style countdown to a future date. */
function relativeTime(date) {
  const diffMs = date.getTime() - Date.now()
  if (diffMs <= 0) return 'soon'
  const mins = Math.round(diffMs / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours < 24) return remMins ? `in ${hours}h ${remMins}m` : `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`
}

export default function Header({ health, containers, scanStatus }) {
  const total = containers.length
  const running = containers.filter(c => c.status === 'running').length
  const outdated = containers.filter(c => c.update_status === 'update_available').length

  // scanStatus only exists once a scan has been polled — fall back to the
  // health endpoint, which also reports the next scheduled run.
  const nextScanRaw = scanStatus?.next_scan ?? health?.next_scan
  const nextScanDate = nextScanRaw ? new Date(nextScanRaw) : null
  const nextScanValid = nextScanDate && !Number.isNaN(nextScanDate.getTime())
  const nextScanLabel = nextScanValid ? relativeTime(nextScanDate) : '—'
  const nextScanTitle = nextScanValid ? nextScanDate.toLocaleString() : undefined

  return (
    <header className="sticky top-0 z-50 acrylic-bar"
      style={{ borderBottom: '1px solid var(--border-1)' }}>
      <div className="max-w-[1400px] mx-auto w-full flex items-center gap-3 md:gap-5 px-4 md:px-6 h-14">

        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <img src={favicon} alt="" className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="font-display text-[15px] sm:text-[16px] font-semibold"
            style={{ color: 'var(--text-strong)' }}>
            DockRadar
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--border-3)' }} />

        {/* Nav-style stat chips — "running" hides on mobile to save space */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <StatChip label="containers" value={total} />
          <StatChip label="running" value={running} active className="hidden sm:flex" />
          {outdated > 0 && <StatChip label="outdated" value={outdated} warn />}
        </div>

        <div className="flex-1" />

        {/* Next scan */}
        {health?.docker_connected && (
          <span className="text-[13px] hidden md:block" style={{ color: 'var(--text-3)' }} title={nextScanTitle}>
            Next scan:{' '}
            <span style={{ color: 'var(--text-2)' }}>{nextScanLabel}</span>
          </span>
        )}

        <div className="w-px h-5 hidden md:block" style={{ background: 'var(--border-3)' }} />

        {/* Docker status — dot only on small screens */}
        <div className="flex items-center gap-2 text-[13px] shrink-0"
          title={health?.docker_connected ? 'Docker connected' : 'Docker offline'}>
          <span className="w-2 h-2 rounded-full" style={{
            background: health?.docker_connected ? 'var(--accent-teal)' : 'var(--accent-red)',
            boxShadow: '0 0 0 2px var(--hover-bg)',
          }} />
          <span className="hidden sm:inline" style={{ color: health?.docker_connected ? 'var(--text-2)' : 'var(--accent-red)' }}>
            {health?.docker_connected ? 'Docker connected' : 'Docker offline'}
          </span>
        </div>

        <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--border-3)' }} />

        <ThemeToggle />
      </div>
    </header>
  )
}

function StatChip({ label, value, active, warn, className = '' }) {
  const color = warn ? 'var(--accent-amber)' : active ? 'var(--text-1)' : 'var(--text-3)'
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="text-[14px] sm:text-[15px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[13px] whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{label}</span>
    </div>
  )
}
