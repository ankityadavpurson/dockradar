import React, { useState } from 'react'
import { ArrowUpCircle, Trash2, ChevronUp, ChevronDown, ShieldCheck, Tag, FileCode2 } from 'lucide-react'

const STATUS_CFG = {
  up_to_date:       { label: 'Up to date',       color: '#50e3c2', bg: 'rgba(80,227,194,0.07)',  border: 'rgba(80,227,194,0.18)'  },
  update_available: { label: 'Update available', color: '#f5a623', bg: 'rgba(245,166,35,0.07)', border: 'rgba(245,166,35,0.18)'  },
  error:            { label: 'Error',            color: '#ff4444', bg: 'rgba(255,68,68,0.07)',   border: 'rgba(255,68,68,0.18)'   },
  unknown:          { label: 'Unknown',          color: '#444',    bg: 'rgba(255,255,255,0.03)', border: '#1a1a1a'                },
}

const DOCKER_DOT = {
  running:  { bg: '#50e3c2', shadow: '0 0 5px rgba(80,227,194,0.5)' },
  exited:   { bg: '#ff4444', shadow: 'none' },
  paused:   { bg: '#f5a623', shadow: 'none' },
  created:  { bg: '#888',    shadow: 'none' },
  dead:     { bg: '#333',    shadow: 'none' },
}

const COLS = [
  { key: 'name',          label: 'Container',     sortable: true  },
  { key: 'repository',    label: 'Image',         sortable: true  },
  { key: 'tag',           label: 'Tag / Digest',  sortable: false },
  { key: '_version',      label: 'Version Check', sortable: false },
  { key: 'update_status', label: 'Status',        sortable: true  },
  { key: 'status',        label: 'Docker',        sortable: true  },
  { key: '_actions',      label: '',              sortable: false },
]

function shortDigest(digest) {
  if (!digest) return null
  const hash = digest.startsWith('sha256:') ? digest.slice(7) : digest
  return hash.slice(0, 8)
}

function VersionCheckCell({ container }) {
  const { tag, latest_tag, update_status, local_digest } = container
  const tagsMatch = !latest_tag || latest_tag === tag || latest_tag === 'unknown'
  const hasDigest = !!local_digest

  if (update_status === 'unknown' || update_status === 'error') {
    return <span style={{ color: '#333' }}>—</span>
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Tag check */}
      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
        style={tagsMatch
          ? { color: '#444', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a' }
          : { color: '#f5a623', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }
        }>
        <Tag size={8} />
        {tagsMatch ? 'tag match' : `→ ${latest_tag}`}
      </span>

      {/* Digest check (only shown when tags match) */}
      {tagsMatch && (
        hasDigest ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={update_status === 'update_available'
              ? { color: '#f5a623', background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.18)' }
              : { color: '#50e3c2', background: 'rgba(80,227,194,0.05)', border: '1px solid rgba(80,227,194,0.15)' }
            }
            title={update_status === 'update_available'
              ? `Digest mismatch — image rebuilt\n${local_digest}`
              : `Digest confirmed\n${local_digest}`}>
            <ShieldCheck size={8} />
            {update_status === 'update_available' ? 'digest changed' : 'digest match'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ color: '#5a5a5a', background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a' }}>
            <ShieldCheck size={8} />
            no digest
          </span>
        )
      )}
    </div>
  )
}

export default function ContainerTable({
  containers, selected, isBusy,
  onToggleSelect, onConfirmUpdate, onConfirmDelete,
  associations = {}, onComposeUpdate,
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
      <div className="flex flex-col items-center justify-center py-20" style={{ color: '#333' }}>
        <span className="text-4xl mb-4 opacity-20">▲</span>
        <p className="text-[15px] font-medium mb-1" style={{ color: '#555' }}>No containers found</p>
        <p className="text-[13px]">Click <span style={{ color: '#888' }}>Scan</span> to discover Docker containers.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
            <th className="w-10 pl-4 py-3 text-left">
              <input type="checkbox"
                checked={selected.size === containers.length && containers.length > 0}
                onChange={e => containers.forEach(c =>
                  e.target.checked
                    ? !selected.has(c.id) && onToggleSelect(c.id)
                    : selected.has(c.id)  && onToggleSelect(c.id)
                )}
                className="w-3 h-3 cursor-pointer accent-white"
              />
            </th>
            {COLS.map(col => (
              <th key={col.key}
                onClick={() => col.sortable && handleSort(col.key)}
                className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider whitespace-nowrap
                  ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                style={{ color: col.sortable && sortKey === col.key ? '#aaa' : '#666' }}>
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc'
                      ? <ChevronUp size={10} />
                      : <ChevronDown size={10} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((c, idx) => {
            const s          = STATUS_CFG[c.update_status] ?? STATUS_CFG.unknown
            const dot        = DOCKER_DOT[c.status] ?? { bg: '#333', shadow: 'none' }
            const isSel      = selected.has(c.id)
            const assoc      = associations[c.name]
            const hasCompose = !!assoc

            return (
              <tr key={c.id}
                className="animate-fade_in"
                style={{
                  borderBottom: '1px solid #111',
                  background: isSel ? 'rgba(255,255,255,0.03)' : 'transparent',
                  animationDelay: `${idx * 20}ms`,
                }}>

                {/* Checkbox */}
                <td className="w-10 pl-4 py-3">
                  <input type="checkbox" checked={isSel} onChange={() => onToggleSelect(c.id)}
                    className="w-3 h-3 cursor-pointer accent-white" />
                </td>

                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium" style={{ color: '#ededed' }}>{c.name}</span>
                    {hasCompose && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#777', border: '1px solid #222' }}
                        title={`Compose: ${assoc.filename} / ${assoc.service_name}`}>
                        <FileCode2 size={8} />
                        compose
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono mt-0.5" style={{ color: '#5a5a5a' }}>{c.short_id}</div>
                </td>

                {/* Image */}
                <td className="px-4 py-3">
                  <span className="text-[12px] font-mono" style={{ color: '#777' }}>{c.repository}</span>
                </td>

                {/* Tag + Digest */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-block font-mono text-[11px] px-1.5 py-0.5 rounded"
                      style={c.update_status === 'update_available'
                        ? { color: '#666', background: 'transparent', textDecoration: 'line-through' }
                        : { color: '#888', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a' }
                      }>
                      {c.tag}
                    </span>
                    {c.local_digest && (
                      <span className="font-mono text-[9px]" style={{ color: '#5a5a5a' }}
                        title={c.local_digest}>
                        {shortDigest(c.local_digest)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Version check */}
                <td className="px-4 py-3">
                  <VersionCheckCell container={c} />
                </td>

                {/* Update status */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium"
                    style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                    <span className="w-1 h-1 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                </td>

                {/* Docker status */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-mono" style={{ color: '#777' }}>
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: dot.bg, boxShadow: dot.shadow }} />
                    {c.status}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.update_status === 'update_available' && (
                      hasCompose ? (
                        <button className="btn btn-ghost btn-xs" disabled={isBusy}
                          onClick={() => onComposeUpdate && onComposeUpdate(c)}
                          title={`Update via compose: ${assoc.service_name}`}>
                          <FileCode2 size={10} />
                          Compose
                        </button>
                      ) : (
                        <button className="btn btn-yellow btn-xs" disabled={isBusy}
                          onClick={() => onConfirmUpdate(c)}
                          title={`Update ${c.name}`}>
                          <ArrowUpCircle size={10} />
                          Update
                        </button>
                      )
                    )}
                    <button className="btn btn-ghost btn-xs" disabled={isBusy}
                      onClick={() => onConfirmDelete(c)}
                      title={`Remove ${c.name}`}
                      style={{ color: '#5a5a5a' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#5a5a5a'}>
                      <Trash2 size={10} />
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
