import React from 'react'

export default function Header({ health, containers, scanStatus }) {
  const total    = containers.length
  const running  = containers.filter(c => c.status === 'running').length
  const outdated = containers.filter(c => c.update_status === 'update_available').length

  return (
    <header className="sticky top-0 z-50 flex items-center gap-5 px-8 h-16
                        bg-bg-base/90 backdrop-blur-xl border-b border-border">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0
                        bg-gradient-to-br from-accent-blue to-accent-cyan
                        shadow-[0_0_18px_rgba(0,212,255,0.4)]">
          🐳
        </div>
        <div>
          <div className="text-[19px] font-display font-extrabold tracking-tight leading-none">
            Dock<span className="text-accent-blue">Radar</span>
          </div>
          <div className="text-[9px] font-mono text-ink-secondary tracking-[1.8px] uppercase mt-0.5">
            Image monitoring &amp; update dashboard
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stat chips */}
      <StatChip label="Total"   value={total}    color="text-accent-blue" />
      <StatChip label="Running" value={running}  color="text-accent-green" />
      <StatChip label="Outdated" value={outdated} color="text-accent-yellow" />

      <div className="w-px h-8 bg-border" />

      {/* Next scan */}
      <div className="text-[11px] font-mono text-ink-secondary hidden md:block">
        Next scan:{' '}
        <span className="text-ink-primary">
          {scanStatus?.next_scan ?? '—'}
        </span>
      </div>

      <div className="w-px h-8 bg-border" />

      {/* Docker status */}
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className={`w-2 h-2 rounded-full ${
          health?.docker_connected ? 'bg-accent-green shadow-[0_0_6px_#51cf66]' : 'bg-accent-red'
        }`} />
        <span className={health?.docker_connected ? 'text-accent-green' : 'text-accent-red'}>
          {health?.docker_connected ? 'Docker connected' : 'Docker offline'}
        </span>
      </div>
    </header>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div className="flex flex-col items-center pl-5 border-l border-border first:border-0 hidden sm:flex">
      <span className={`text-[18px] font-mono font-bold leading-none ${color}`}>
        {value}
      </span>
      <span className="text-[9px] font-mono text-ink-secondary tracking-[1.5px] uppercase mt-1">
        {label}
      </span>
    </div>
  )
}
