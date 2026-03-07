import React, { useState } from 'react'
import { ArrowUpCircle, Trash2, ChevronUp, ChevronDown, Minus } from 'lucide-react'

const STATUS_CFG = {
  up_to_date:       { label: 'Up to date',       dot: 'bg-accent-green',  text: 'text-accent-green',  bg: 'bg-accent-green/10 border-accent-green/20' },
  update_available: { label: 'Update available', dot: 'bg-accent-yellow', text: 'text-accent-yellow', bg: 'bg-accent-yellow/10 border-accent-yellow/20' },
  error:            { label: 'Error',            dot: 'bg-accent-red',    text: 'text-accent-red',    bg: 'bg-accent-red/10 border-accent-red/20' },
  unknown:          { label: 'Unknown',          dot: 'bg-ink-secondary', text: 'text-ink-secondary', bg: 'bg-white/5 border-border' },
}

const DOCKER_DOT = {
  running: 'bg-accent-green shadow-[0_0_6px_#51cf66]',
  exited:  'bg-accent-red',
  paused:  'bg-accent-yellow',
  created: 'bg-blue-300',
  dead:    'bg-accent-red opacity-50',
}

const COLS = [
  { key: 'name',          label: 'Container',      sortable: true  },
  { key: 'repository',    label: 'Image',          sortable: true  },
  { key: 'tag',           label: 'Current Tag',    sortable: false },
  { key: 'latest_tag',    label: 'Latest Tag',     sortable: false },
  { key: 'update_status', label: 'Update Status',  sortable: true  },
  { key: 'status',        label: 'Docker Status',  sortable: true  },
  { key: '_actions',      label: 'Actions',        sortable: false },
]

export default function ContainerTable({
  containers,
  selected,
  isBusy,
  onToggleSelect,
  onUpdateOne,
  onDelete,
  onConfirmUpdate,
  onConfirmDelete,
}) {
  const [sortKey, setSortKey]   = useState('name')
  const [sortDir, setSortDir]   = useState('asc')

  function handleSort(key) {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...containers].sort((a, b) => {
    const av = (a[sortKey] ?? '').toString().toLowerCase()
    const bv = (b[sortKey] ?? '').toString().toLowerCase()
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  // ── Empty states ──────────────────────────────────────────────────────────
  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-ink-secondary">
        <span className="text-5xl mb-5 opacity-30">🐋</span>
        <p className="text-[17px] font-display font-semibold text-ink-primary mb-2">
          No containers found
        </p>
        <p className="text-[13px]">Click <strong>Scan for Updates</strong> to discover Docker containers.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {/* ── thead ── */}
        <thead>
          <tr className="bg-bg-surface/80">
            {/* Select-all checkbox */}
            <th className="w-12 pl-5 py-3 text-left">
              <input
                type="checkbox"
                checked={selected.size === containers.length && containers.length > 0}
                onChange={e => e.target.checked
                  ? containers.forEach(c => !selected.has(c.id) && onToggleSelect(c.id))
                  : containers.forEach(c => selected.has(c.id) && onToggleSelect(c.id))
                }
                className="accent-accent-blue w-3.5 h-3.5 cursor-pointer"
              />
            </th>
            {COLS.map(col => (
              <th
                key={col.key}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`
                  px-4 py-3 text-left text-[10px] font-mono font-bold uppercase
                  tracking-[1.8px] text-ink-secondary border-b border-border whitespace-nowrap
                  ${col.sortable ? 'cursor-pointer hover:text-ink-primary select-none' : ''}
                `}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc'
                      ? <ChevronUp size={11} className="text-accent-blue" />
                      : <ChevronDown size={11} className="text-accent-blue" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* ── tbody ── */}
        <tbody>
          {sorted.map((c, idx) => {
            const s      = STATUS_CFG[c.update_status] ?? STATUS_CFG.unknown
            const ddot   = DOCKER_DOT[c.status] ?? 'bg-ink-secondary'
            const isSel  = selected.has(c.id)

            return (
              <tr
                key={c.id}
                className={`
                  border-b border-border/50 transition-colors duration-100
                  last:border-0
                  ${isSel ? 'bg-accent-blue/5' : 'hover:bg-bg-hover'}
                  animate-fade_in
                `}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {/* checkbox */}
                <td className="w-12 pl-5 py-4">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleSelect(c.id)}
                    className="accent-accent-blue w-3.5 h-3.5 cursor-pointer"
                  />
                </td>

                {/* container name */}
                <td className="px-4 py-4">
                  <div className="font-mono font-semibold text-[13px] text-ink-primary">{c.name}</div>
                  <div className="font-mono text-[10px] text-ink-muted mt-0.5">{c.short_id}</div>
                </td>

                {/* image */}
                <td className="px-4 py-4">
                  <span className="font-mono text-[12px] text-ink-secondary">{c.repository}</span>
                </td>

                {/* current tag */}
                <td className="px-4 py-4">
                  <span className={c.update_status === 'update_available' ? 'tag-old' : 'tag-neutral'}>
                    {c.tag}
                  </span>
                </td>

                {/* latest tag */}
                <td className="px-4 py-4">
                  {c.latest_tag && c.latest_tag !== 'unknown'
                    ? <span className="tag-new">{c.latest_tag}</span>
                    : <span className="text-ink-muted font-mono text-[12px]">—</span>
                  }
                </td>

                {/* update status */}
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1
                                   rounded-full text-[11px] font-mono font-semibold border ${s.bg} ${s.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </td>

                {/* docker status */}
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-secondary">
                    <span className={`w-1.5 h-1.5 rounded-full ${ddot}`} />
                    {c.status}
                  </span>
                </td>

                {/* actions */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {c.update_status === 'update_available' && (
                      <button
                        className="btn btn-yellow btn-xs"
                        disabled={isBusy}
                        onClick={() => onConfirmUpdate(c)}
                        title={`Update ${c.name}`}
                      >
                        <ArrowUpCircle size={11} />
                        Update
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-xs text-accent-red/70 hover:text-accent-red hover:border-accent-red/40"
                      disabled={isBusy}
                      onClick={() => onConfirmDelete(c)}
                      title={`Remove ${c.name}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
