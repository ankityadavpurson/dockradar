import React from 'react'
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

  return (
    <header className="sticky top-0 z-50 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm border-b border-[#1a1a1a]">
      <div className="max-w-[1400px] mx-auto w-full flex items-center gap-3 md:gap-6 px-4 md:px-6 h-14">

        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <img src={favicon} alt="Logo" className="w-8 h-8" />
          <span className="text-[18px] font-semibold tracking-tight text-white">
            DockRadar
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 hidden sm:block" style={{ background: '#222' }} />

        {/* Nav-style stat chips */}
        <div className="flex items-center gap-5">
          <StatChip label="containers" value={total} />
          <StatChip label="running" value={running} active />
          {outdated > 0 && <StatChip label="outdated" value={outdated} warn />}
        </div>

        <div className="flex-1" />

        {/* Next scan */}
        <span className="text-[14px] hidden md:block" style={{ color: '#9a9a9a' }} title={nextScanTitle}>
          Next scan:{' '}
          <span style={{ color: '#ccc' }}>{nextScanLabel}</span>
        </span>

        <div className="w-px h-5 hidden md:block" style={{ background: '#222' }} />

        {/* Docker status — dot only on small screens */}
        <div className="flex items-center gap-2 text-[14px] shrink-0"
          title={health?.docker_connected ? 'Docker connected' : 'Docker offline'}>
          <span className="w-1.5 h-1.5 rounded-full" style={{
            background: health?.docker_connected ? '#50e3c2' : '#ff4444',
            boxShadow: health?.docker_connected ? '0 0 5px rgba(80,227,194,0.5)' : 'none',
          }} />
          <span className="hidden sm:inline" style={{ color: health?.docker_connected ? '#aaa' : '#ff4444' }}>
            {health?.docker_connected ? 'Docker connected' : 'Docker offline'}
          </span>
        </div>
      </div>
    </header>
  )
}

function StatChip({ label, value, active, warn }) {
  const color = warn ? '#f5a623' : active ? '#ededed' : '#9a9a9a'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[15px] font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[14px] uppercase" style={{ color: '#8a8a8a' }}>{label}</span>
    </div>
  )
}
