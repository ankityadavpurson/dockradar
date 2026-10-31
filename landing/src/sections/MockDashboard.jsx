import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpCircleIcon, Badge, Button, Divider, Loader, RefreshCwIcon, ShieldCheckIcon, TagIcon,
} from 'xedonium'
import logo from '../../assets/logo.svg'

// Sample data only  - mirrors the shape of the real dashboard's container table.
const INITIAL = [
  { id: 'npm',   name: 'proxy',      repo: 'jc21/nginx-proxy-manager', tag: '2.11.3', latest: '2.12.0', state: 'outdated', kind: 'tag' },
  { id: 'pg',    name: 'postgres',   repo: 'library/postgres',          tag: '16.3',   latest: '16.4',   state: 'outdated', kind: 'tag' },
  { id: 'graf',  name: 'grafana',    repo: 'grafana/grafana',           tag: 'latest', latest: null,     state: 'outdated', kind: 'digest' },
  { id: 'redis', name: 'cache',      repo: 'library/redis',             tag: '7.2',    latest: null,     state: 'current',  kind: 'verified' },
  { id: 'trf',   name: 'traefik',    repo: 'library/traefik',           tag: 'v3.1',   latest: null,     state: 'current',  kind: 'verified' },
  { id: 'prt',   name: 'portainer',  repo: 'portainer/portainer-ce',    tag: '2.21.0', latest: null,     state: 'current',  kind: 'verified' },
]

/** Inline pill built on xedonium's standalone Badge (same as the dashboard). */
function Pill({ color, children, className = '' }) {
  return (
    <Badge color={color} className={className}
      badgeContent={<span className="inline-flex items-center gap-1 px-1">{children}</span>} />
  )
}

function VersionCell({ row }) {
  if (row.state === 'updating') return <span className="text-app-muted">—</span>
  if (row.state === 'outdated' && row.kind === 'tag') {
    return <Pill color="warning"><TagIcon className="h-3 w-3 shrink-0" />→ {row.latest}</Pill>
  }
  if (row.state === 'outdated') {
    return <Pill color="warning"><ShieldCheckIcon className="h-3 w-3 shrink-0" />Digest changed</Pill>
  }
  return <Pill color="success"><ShieldCheckIcon className="h-3 w-3 shrink-0" />Verified</Pill>
}

function StatusCell({ row }) {
  if (row.state === 'updating') {
    return <Pill color="warning"><Loader variant="spinner" size="sm" />Updating…</Pill>
  }
  if (row.state === 'outdated') {
    return <Pill color="warning"><span className="h-1.5 w-1.5 rounded-full bg-current" />Update available</Pill>
  }
  return <Pill color="success"><span className="h-1.5 w-1.5 rounded-full bg-current" />Up to date</Pill>
}

function TagCell({ row }) {
  const { tag } = row
  if (row.state === 'outdated') {
    return <span className="font-mono text-[13px] text-app-muted line-through">{tag}</span>
  }
  if (tag === 'latest') return <span className="font-mono text-[13px] text-app-muted">latest</span>
  return <span className="inline-block w-fit border border-app-border px-1.5 py-0.5 font-mono text-[13px] text-app-text">{tag}</span>
}

export default function MockDashboard() {
  const [rows, setRows] = useState(INITIAL)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const total = rows.length
  const outdated = rows.filter(r => r.state === 'outdated').length
  const busy = rows.some(r => r.state === 'updating')

  // Simulated update: outdated → updating → up to date (on the new tag).
  function update(ids) {
    setRows(rs => rs.map(r => ids.includes(r.id) ? { ...r, state: 'updating' } : r))
    ids.forEach((id, i) => {
      const t = setTimeout(() => {
        setRows(rs => rs.map(r => r.id === id
          ? { ...r, state: 'current', tag: r.latest ?? r.tag, latest: null, kind: 'verified' }
          : r))
      }, 1400 + i * 450)
      timers.current.push(t)
    })
  }

  function reset() {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setRows(INITIAL)
  }

  const outdatedIds = rows.filter(r => r.state === 'outdated').map(r => r.id)

  return (
    <div className="border border-app-border bg-app-bg text-left shadow-[0_30px_80px_-30px_rgb(0_0_0/0.55)]"
      role="group" aria-label="Interactive demo of the DockRadar dashboard, using sample data">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-app-border bg-app-card px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-app-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-app-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-app-border" />
        <span className="ml-3 truncate font-mono text-[11px] text-app-muted">localhost:8086</span>
      </div>

      <div>
        {/* App header */}
        <div className="flex h-12 items-center gap-3 border-b border-app-border px-4 md:gap-5">
          <div className="flex shrink-0 items-center gap-2">
            <img src={logo} alt="" className="h-6 w-6" />
            <span className="text-[15px] font-semibold text-app-strong">DockRadar</span>
          </div>
          <Divider orientation="vertical" className="!hidden !h-5 !self-center sm:!block" />
          <div className="flex items-center gap-3 whitespace-nowrap text-sm sm:gap-5">
            <Chip label="containers" value={total} />
            <Chip label="running" value={total} className="hidden sm:flex" />
            {outdated > 0 && <Chip label="outdated" value={outdated} warn />}
          </div>
          <div className="flex-1" />
          <span className="flex shrink-0 items-center gap-2 text-[13px]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="hidden text-app-soft sm:inline">Docker connected</span>
          </span>
        </div>

        <div className="p-3 md:p-4">
          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={reset} disabled={busy}
              className="inline-flex items-center gap-1.5 !px-2.5 !py-1.5"
              tooltip="Reset the demo">
              <RefreshCwIcon className="h-3.5 w-3.5 shrink-0" />Scan
            </Button>
            <Button variant="warning" disabled={busy || outdated === 0} onClick={() => update(outdatedIds)}
              className="inline-flex items-center gap-1.5 !px-2.5 !py-1.5">
              <ArrowUpCircleIcon className="h-3.5 w-3.5 shrink-0" />
              Update All{outdated > 0 && ` (${outdated})`}
            </Button>
            <span className="ml-auto hidden text-[12px] text-app-muted sm:inline">
              Click an Update button  - it’s a live demo with sample data.
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-app-border bg-app-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-app-border text-left text-[11px] font-semibold uppercase tracking-widest text-app-muted">
                  <th className="px-4 py-2.5 font-semibold">Container</th>
                  <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Tag</th>
                  <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Version</th>
                  <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-app-border last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-app-strong">{r.name}</span>
                      </div>
                      <div className="break-all font-mono text-xs text-app-muted">{r.repo}</div>
                      {/* Status column is hidden on phones; show it here instead. */}
                      <div className="mt-1.5 sm:hidden"><StatusCell row={r} /></div>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell"><TagCell row={r} /></td>
                    <td className="hidden px-3 py-2.5 md:table-cell"><VersionCell row={r} /></td>
                    <td className="hidden px-3 py-2.5 sm:table-cell"><StatusCell row={r} /></td>
                    <td className="px-4 py-2.5 text-right">
                      {r.state === 'outdated' && (
                        <Button variant="warning" disabled={busy} onClick={() => update([r.id])}
                          className="inline-flex items-center gap-1.5 !px-2 !py-1"
                          aria-label={`Update ${r.name} (demo)`}>
                          <ArrowUpCircleIcon className="h-3 w-3 shrink-0" />Update
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ label, value, warn, className = '' }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className={`font-semibold tabular-nums ${warn ? 'text-amber-500' : 'text-app-text'}`}>{value}</span>
      <span className="whitespace-nowrap text-app-muted">{label}</span>
    </span>
  )
}
