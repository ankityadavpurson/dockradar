import React from 'react'

export default function Header({ health, containers, scanStatus }) {
  const total    = containers.length
  const running  = containers.filter(c => c.status === 'running').length
  const outdated = containers.filter(c => c.update_status === 'update_available').length

  return (
    <header className="sticky top-0 z-50 flex items-center gap-6 px-6 h-14"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <img src="/favicon.svg" alt="Logo" className="w-8 h-8" />
        <span className="text-[15px] font-semibold tracking-tight text-white">
          DockRadar
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-5" style={{ background: '#222' }} />

      {/* Nav-style stat chips */}
      <div className="flex items-center gap-5">
        <StatChip label="containers" value={total} />
        <StatChip label="running"    value={running}  active />
        {outdated > 0 && <StatChip label="outdated" value={outdated} warn />}
      </div>

      <div className="flex-1" />

      {/* Next scan */}
      <span className="text-[12px] hidden md:block" style={{ color: '#777' }}>
        Next scan:{' '}
        <span style={{ color: '#aaa' }}>{scanStatus?.next_scan ?? '—'}</span>
      </span>

      <div className="w-px h-5" style={{ background: '#222' }} />

      {/* Docker status */}
      <div className="flex items-center gap-2 text-[12px]">
        <span className="w-1.5 h-1.5 rounded-full" style={{
          background: health?.docker_connected ? '#50e3c2' : '#ff4444',
          boxShadow:  health?.docker_connected ? '0 0 5px rgba(80,227,194,0.5)' : 'none',
        }} />
        <span style={{ color: health?.docker_connected ? '#aaa' : '#ff4444' }}>
          {health?.docker_connected ? 'Docker connected' : 'Docker offline'}
        </span>
      </div>
    </header>
  )
}

function StatChip({ label, value, active, warn }) {
  const color = warn ? '#f5a623' : active ? '#ededed' : '#555'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] font-medium tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[12px]" style={{ color: '#666' }}>{label}</span>
    </div>
  )
}
