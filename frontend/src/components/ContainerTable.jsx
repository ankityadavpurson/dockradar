import React, { useState } from 'react'
import { ArrowUpCircle, Trash2, ChevronUp, ChevronDown, ShieldCheck, Tag, FileCode2 } from 'lucide-react'

const STATUS_CFG = {
  up_to_date:       { label: 'Up to date',       dot: 'bg-accent-green',  text: 'text-accent-green',  bg: 'rgba(81,207,102,0.10)',  border: 'rgba(81,207,102,0.20)'  },
  update_available: { label: 'Update available', dot: 'bg-accent-yellow', text: 'text-accent-yellow', bg: 'rgba(255,212,59,0.10)',  border: 'rgba(255,212,59,0.20)'  },
  error:            { label: 'Error',            dot: 'bg-accent-red',    text: 'text-accent-red',    bg: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.20)' },
  unknown:          { label: 'Unknown',          dot: 'bg-ink-secondary', text: 'text-ink-secondary', bg: 'rgba(255,255,255,0.05)', border: '#1c2a3a'                 },
}

const DOCKER_DOT = {
  running: 'bg-accent-green shadow-[0_0_6px_#51cf66]',
  exited:  'bg-accent-red',
  paused:  'bg-accent-yellow',
  created: 'bg-blue-300',
  dead:    'bg-accent-red opacity-50',
}

const COLS = [
  { key: 'name',          label: 'Container',     sortable: true  },
  { key: 'repository',    label: 'Image',         sortable: true  },
  { key: 'tag',           label: 'Tag / Digest',  sortable: false },
  { key: '_version',      label: 'Version Check', sortable: false },
  { key: 'update_status', label: 'Update Status', sortable: true  },
  { key: 'status',        label: 'Docker Status', sortable: true  },
  { key: '_actions',      label: 'Actions',       sortable: false },
]

/** Shorten a sha256 digest to a readable format: sha256:a1b2c3d4 */
function shortDigest(digest) {
  if (!digest) return null
  const hash = digest.startsWith('sha256:') ? digest.slice(7) : digest
  return 'sha256:' + hash.slice(0, 8)
}

/** Version check cell — shows what checks were performed and their results */
function VersionCheckCell({ container }) {
  const { tag, latest_tag, update_status, local_digest } = container
  const tagsMatch = !latest_tag || latest_tag === tag || latest_tag === 'unknown'
  const hasDigest = !!local_digest

  if (update_status === 'unknown' || update_status === 'error') {
    return <span className="text-ink-muted font-mono text-[12px]">—</span>
  }

  // Tag change detected — digest check was skipped
  if (!tagsMatch) {
    return (
      <div className="flex flex-col gap-1">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ color: '#ffd43b', background: 'rgba(255,212,59,0.08)', border: '1px solid rgba(255,212,59,0.2)' }}
          title="A newer tag was found — digest check skipped"
        >
          <Tag size={9} />
          tag changed
        </span>
        <span className="font-mono text-[10px]" style={{ color: '#06ffa5' }}>
          → {latest_tag}
        </span>
      </div>
    )
  }

  // Tags matched — digest was (or wasn't) checked as the second step
  return (
    <div className="flex flex-col gap-1">
      <span
        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={{ color: '#7a8799', background: 'rgba(255,255,255,0.05)', border: '1px solid #1c2a3a' }}
        title="Tag names matched"
      >
        <Tag size={9} />
        tag match
      </span>
      {hasDigest ? (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={
            update_status === 'update_available'
              ? { color: '#ffd43b', background: 'rgba(255,212,59,0.08)', border: '1px solid rgba(255,212,59,0.2)' }
              : { color: '#00d4ff', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)' }
          }
          title={
            update_status === 'update_available'
              ? `Digest mismatch — image was silently rebuilt\nLocal: ${local_digest}`
              : `Digest confirmed — image content is identical\nLocal: ${local_digest}`
          }
        >
          <ShieldCheck size={9} />
          {update_status === 'update_available' ? 'digest changed' : 'digest match'}
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ color: '#3d5166', background: 'rgba(255,255,255,0.02)', border: '1px solid #1c2a3a' }}
          title="No local digest available — only tag name was compared"
        >
          <ShieldCheck size={9} />
          no digest
        </span>
      )}
    </div>
  )
}

export default function ContainerTable({
  containers,
  selected,
  isBusy,
  onToggleSelect,
  onConfirmUpdate,
  onConfirmDelete,
  associations = {},
  onComposeUpdate,
}) {
  const [sortKey, setSortKey] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

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
            <th className="w-12 pl-5 py-3 text-left">
              <input
                type="checkbox"
                checked={selected.size === containers.length && containers.length > 0}
                onChange={e =>
                  containers.forEach(c =>
                    e.target.checked
                      ? !selected.has(c.id) && onToggleSelect(c.id)
                      : selected.has(c.id) && onToggleSelect(c.id)
                  )
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
            const s           = STATUS_CFG[c.update_status] ?? STATUS_CFG.unknown
            const ddot        = DOCKER_DOT[c.status] ?? 'bg-ink-secondary'
            const isSel       = selected.has(c.id)
            const assoc       = associations[c.name]
            const hasCompose  = !!assoc

            return (
              <tr
                key={c.id}
                className={`border-b border-border/50 transition-colors duration-100 last:border-0 animate-fade_in
                  ${isSel ? 'bg-accent-blue/5' : 'hover:bg-bg-hover'}`}
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-[13px] text-ink-primary">{c.name}</span>
                    {hasCompose && (
                      <span
                        title={`Compose: ${assoc.filename} / ${assoc.service_name}`}
                        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono"
                        style={{ background: 'rgba(0,212,255,0.08)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}
                      >
                        <FileCode2 size={8} />
                        compose
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-ink-muted mt-0.5">{c.short_id}</div>
                </td>

                {/* image */}
                <td className="px-4 py-4">
                  <span className="font-mono text-[12px] text-ink-secondary">{c.repository}</span>
                </td>

                {/* tag + digest hint */}
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span
                      className="inline-block font-mono text-[11px] px-2 py-0.5 rounded"
                      style={
                        c.update_status === 'update_available'
                          ? { color: '#ff6b6b', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', textDecoration: 'line-through', opacity: 0.7 }
                          : { color: '#7a8799', background: 'rgba(255,255,255,0.05)', border: '1px solid #1c2a3a' }
                      }
                    >
                      {c.tag}
                    </span>
                    {c.local_digest && (
                      <span
                        className="font-mono text-[9px] text-ink-muted"
                        title={c.local_digest}
                      >
                        {shortDigest(c.local_digest)}
                      </span>
                    )}
                  </div>
                </td>

                {/* version check method */}
                <td className="px-4 py-4">
                  <VersionCheckCell container={c} />
                </td>

                {/* update status */}
                <td className="px-4 py-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border"
                    style={{ color: s.text.replace('text-', ''), background: s.bg, borderColor: s.border }}
                  >
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
                      hasCompose ? (
                        <button
                          className="btn btn-xs"
                          disabled={isBusy}
                          onClick={() => onComposeUpdate && onComposeUpdate(c)}
                          title={`Update via compose: ${assoc.filename} / ${assoc.service_name}`}
                          style={{ background: 'rgba(0,212,255,0.10)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.25)' }}
                        >
                          <FileCode2 size={11} />
                          Compose
                        </button>
                      ) : (
                        <button
                          className="btn btn-yellow btn-xs"
                          disabled={isBusy}
                          onClick={() => onConfirmUpdate(c)}
                          title={`Update ${c.name}`}
                        >
                          <ArrowUpCircle size={11} />
                          Update
                        </button>
                      )
                    )}
                    <button
                      className="btn btn-ghost btn-xs"
                      disabled={isBusy}
                      onClick={() => onConfirmDelete(c)}
                      title={`Remove ${c.name}`}
                      style={{ color: 'rgba(255,107,107,0.7)' }}
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
