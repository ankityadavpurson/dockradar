import { Divider, ThemeToggle } from 'xedonium'
import favicon from '../../assets/favicon.svg'

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

  const connected = !!health?.docker_connected

  const divider = (cls = '') => <Divider orientation="vertical" className={`!h-5 !self-center ${cls}`} />

  return (
    <header className="sticky top-0 z-40 border-b border-app-border bg-app-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-4 md:gap-5 md:px-6">

        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <img src={favicon} alt="" className="h-6 w-6 sm:h-7 sm:w-7" />
          <span className="text-[15px] font-semibold text-app-strong sm:text-base">DockRadar</span>
        </div>

        {divider('hidden sm:block')}

        {/* Stat chips — "running" hides on mobile to save space */}
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-sm sm:gap-5">
          <StatChip label="containers" value={total} />
          <StatChip label="running" value={running} className="hidden sm:flex" />
          {outdated > 0 && <StatChip label="outdated" value={outdated} warn />}
        </div>

        <div className="flex-1" />

        {connected && (
          <span className="hidden whitespace-nowrap text-[13px] text-app-muted lg:block" title={nextScanTitle}>
            Next scan: <span className="text-app-soft">{nextScanLabel}</span>
          </span>
        )}

        {divider('hidden lg:block')}

        <span className="flex shrink-0 items-center gap-2 text-[13px]"
          title={connected ? 'Docker connected' : 'Docker offline'}>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`hidden sm:inline ${connected ? 'text-app-soft' : 'text-red-500'}`}>
            {connected ? 'Docker connected' : 'Docker offline'}
          </span>
        </span>

        {divider('hidden sm:block')}

        <ThemeToggle variant="toolbar" />
      </div>
    </header>
  )
}

function StatChip({ label, value, warn, className = '' }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className={`font-semibold tabular-nums ${warn ? 'text-amber-500' : 'text-app-text'}`}>{value}</span>
      <span className="text-app-muted whitespace-nowrap">{label}</span>
    </span>
  )
}
