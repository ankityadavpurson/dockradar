import { ArrowUpCircle, ChevronDown, ChevronUp, FileCode2, Info, MoreVertical, RefreshCw, ShieldCheck, Tag, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

// One entry per body cell (after the checkbox) — keep in sync with the <td>s.
const COLS = [
  { key: 'name',          label: 'Container',     sortable: true  },
  { key: 'tag',           label: 'Tag / Digest',  sortable: false },
  { key: '_version',      label: 'Version',       sortable: false },
  { key: 'update_status', label: 'Status',        sortable: true  },
  { key: '_actions',      label: 'Actions',       sortable: false },
]

function shortDigest(digest) {
  if (!digest) return null
  const hash = digest.startsWith('sha256:') ? digest.slice(7) : digest
  return hash.slice(0, 8)
}

/**
 * Tag rendering: `latest` is the common case and carries no signal, so it is
 * plain muted text. Pinned versions get the boxed emphasis; outdated tags are
 * struck through; digest-pins are truncated with the full digest in a tooltip.
 */
function TagLabel({ container: c }) {
  const isDigestTag = c.tag.startsWith('sha256:')
  const label = isDigestTag ? `${c.tag.slice(0, 15)}…` : c.tag

  if (c.update_status === 'update_available') {
    return (
      <span className="inline-block font-mono text-[14px]"
        style={{ color: '#7a7a7a', textDecoration: 'line-through' }}>
        {label}
      </span>
    )
  }
  if (c.tag === 'latest') {
    return (
      <span className="inline-block font-mono text-[14px]" style={{ color: '#8a8a8a' }}>
        latest
      </span>
    )
  }
  return (
    <span className="inline-block font-mono text-[14px] px-1.5 py-0.5 rounded w-fit"
      style={{ color: '#aaa', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a' }}
      title={isDigestTag ? c.tag : undefined}>
      {label}
    </span>
  )
}

const CHECK_STYLES = {
  ok:   { color: '#50e3c2', background: 'rgba(80,227,194,0.05)',  border: '1px solid rgba(80,227,194,0.15)' },
  warn: { color: '#f5a623', background: 'rgba(245,166,35,0.07)',  border: '1px solid rgba(245,166,35,0.18)' },
  dim:  { color: '#7a7a7a', background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a1a' },
}

function CheckChip({ style, icon, label, title }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-mono px-1.5 py-0.5 rounded capitalize"
      style={style} title={title}
    >
      {icon}
      {label}
    </span>
  )
}

function VersionCheckCell({ container }) {
  const { tag, latest_tag, update_status, local_digest } = container
  const tagsMatch = !latest_tag || latest_tag === tag || latest_tag === 'unknown'

  if (update_status === 'unknown' || update_status === 'error') {
    return <span style={{ color: '#333' }}>—</span>
  }

  // A newer tag exists — the genuinely interesting tag-level state.
  if (!tagsMatch) {
    return <CheckChip style={CHECK_STYLES.warn} icon={<Tag size={12} />}
      label={`→ ${latest_tag}`} title={`Newer tag available: ${latest_tag}`} />
  }

  // Same tag, but the image was rebuilt upstream.
  if (update_status === 'update_available') {
    return <CheckChip style={CHECK_STYLES.warn} icon={<ShieldCheck size={12} />}
      label="digest changed"
      title={`Same tag, but the image was rebuilt upstream\nLocal digest: ${local_digest ?? 'unknown'}`} />
  }

  // Fully verified: tag and digest both match upstream.
  if (local_digest) {
    return <CheckChip style={CHECK_STYLES.ok} icon={<ShieldCheck size={12} />}
      label="verified" title={`Tag and digest match upstream\n${local_digest}`} />
  }

  // Tag matches but there was no digest to verify image content with.
  return <CheckChip style={CHECK_STYLES.dim} icon={<Tag size={12} />}
    label="tag match" title="Tag matches upstream; no digest available to verify image content" />
}

// Priority for the default sort: actionable states first.
const STATUS_ORDER = { update_available: 0, error: 1, unknown: 2, up_to_date: 3 }

/** Compact card used below the md breakpoint instead of the table row. */
function ContainerCard({
  c, isSel, refreshing, hasCompose, assoc, isBusy,
  onToggleSelect, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails,
}) {
  const dot = DOCKER_DOT[c.status] ?? { bg: '#333', shadow: 'none' }
  const isRunning = c.status === 'running'

  return (
    <div className="px-4 py-3 flex flex-col gap-2.5"
      style={{
        borderBottom: '1px solid #111',
        background: isSel ? 'rgba(255,255,255,0.03)' : 'transparent',
        filter: isRunning ? undefined : 'brightness(0.65)',
      }}>
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckBox id={`card-check-${c.id}`} ariaLabel={`Select ${c.name}`}
          checked={isSel} onChange={() => onToggleSelect(c.id)} />
        <span className="w-2 h-2 rounded-full shrink-0"
          style={{ background: dot.bg, boxShadow: dot.shadow }}
          role="img" aria-label={`Container ${c.status}`} />
        <button type="button" className="text-[15px] font-medium truncate text-left"
          style={{ color: '#ededed', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          title={`View details for ${c.name}`}
          onClick={() => onShowDetails && onShowDetails(c)}>
          {c.name}
        </button>
        <StoppedBadge status={c.status} />
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
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
          <RowMenu container={c} hasCompose={hasCompose} isBusy={isBusy}
            onConfirmUpdate={onConfirmUpdate} onComposeUpdate={onComposeUpdate}
            onConfirmDelete={onConfirmDelete} onShowDetails={onShowDetails} />
        </div>
      </div>

      <div className="text-[14px] font-mono truncate" style={{ color: '#8a8a8a' }}>
        {c.repository}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <TagLabel container={c} />
        {refreshing
          ? <div className="skeleton h-4 w-20" aria-label="Checking…" />
          : <VersionCheckCell container={c} />}
        {refreshing
          ? <div className="skeleton h-5 w-24" aria-label="Checking…" />
          : <StatusPill status={c.update_status} />}
      </div>
    </div>
  )
}

const MENU_WIDTH = 200

function StoppedBadge({ status }) {
  if (status === 'running') return null
  return (
    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
      style={{
        color: status === 'exited' ? '#ff6b6b'
             : status === 'paused' ? '#f5a623'
             : '#888',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid #222',
      }}>
      {status}
    </span>
  )
}

function StatusPill({ status }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.unknown
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-mono px-1.5 py-0.5 rounded"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      <span className="w-1 h-1 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

/** Per-row ⋮ menu. Rendered position:fixed so the table's overflow-x-auto
 *  wrapper cannot clip it; closes on outside click, Escape, or scroll. */
function RowMenu({ container: c, hasCompose, isBusy, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function toggle(e) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuH = 165
      const top = r.bottom + menuH > window.innerHeight ? r.top - menuH - 4 : r.bottom + 4
      setPos({ top, left: Math.max(8, r.right - MENU_WIDTH) })
    }
    setOpen(o => !o)
  }

  const outdated = c.update_status === 'update_available'

  function MenuItem({ label, icon, onSelect, danger = false }) {
    return (
      <button role="menuitem" type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-[14px] transition-colors"
        style={{ color: danger ? '#ff6b6b' : '#ccc', background: 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={() => { setOpen(false); onSelect() }}>
        {icon}
        {label}
      </button>
    )
  }

  return (
    <>
      <button ref={btnRef} type="button" className="btn btn-ghost btn-xs" disabled={isBusy}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${c.name}`}
        title={`Actions for ${c.name}`}
        onClick={toggle}>
        <MoreVertical size={12} />
      </button>

      {/* Portal to <body>: the animated row keeps a `transform` (fade_in fill
          mode "both"), which would otherwise become the containing block for
          this fixed-position menu and strand it inside the clipped table. */}
      {open && createPortal(
        <div role="menu" aria-label={`Actions for ${c.name}`}
          className="fixed z-[250] rounded-lg py-1 overflow-hidden"
          style={{
            top: pos.top, left: pos.left, width: MENU_WIDTH,
            background: '#111', border: '1px solid #2a2a2a',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          }}
          onClick={e => e.stopPropagation()}>
          <MenuItem label="View details" icon={<Info size={12} />}
            onSelect={() => onShowDetails && onShowDetails(c)} />
          {hasCompose && (
            <MenuItem label="Update via compose" icon={<FileCode2 size={12} />}
              onSelect={() => onComposeUpdate && onComposeUpdate(c)} />
          )}
          <MenuItem
            label={outdated ? 'Update (pull + recreate)' : 'Re-pull & recreate'}
            icon={outdated ? <ArrowUpCircle size={12} /> : <RefreshCw size={12} />}
            onSelect={() => onConfirmUpdate(c)} />
          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />
          <MenuItem label="Remove container" icon={<Trash2 size={12} />} danger
            onSelect={() => onConfirmDelete(c)} />
        </div>,
        document.body
      )}
    </>
  )
}

export default function ContainerTable({
  containers, isFiltered = false, selected, isBusy,
  scanning = false, updating = false,
  onToggleSelect, onConfirmUpdate, onConfirmDelete,
  associations = {}, onComposeUpdate, onShowDetails,
}) {
  const [sortKey, setSortKey] = useState('update_status')
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(key) {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...containers].sort((a, b) => {
    let cmp
    if (sortKey === 'update_status') {
      cmp = (STATUS_ORDER[a.update_status] ?? 9) - (STATUS_ORDER[b.update_status] ?? 9)
    } else {
      const av = (a[sortKey] ?? '').toString().toLowerCase()
      const bv = (b[sortKey] ?? '').toString().toLowerCase()
      cmp = av.localeCompare(bv)
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name)
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: '#8a8a8a' }}>
        <span className="text-4xl mb-4 opacity-20">▲</span>
        {isFiltered ? (
          <>
            <p className="text-[16px] font-medium mb-1" style={{ color: '#bbb' }}>No matching containers</p>
            <p className="text-[15px]">Nothing matches the current search or filter — clear them to see all containers.</p>
          </>
        ) : (
          <>
            <p className="text-[16px] font-medium mb-1" style={{ color: '#bbb' }}>No containers found</p>
            <p className="text-[15px]">Click <span style={{ color: '#ddd' }}>Scan</span> to discover Docker containers.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
    {/* Mobile: card list */}
    <div className="md:hidden">
      {sorted.map(c => (
        <ContainerCard key={c.id}
          c={c}
          isSel={selected.has(c.id)}
          refreshing={scanning || (updating && c.update_status === 'update_available')}
          hasCompose={!!associations[c.name]}
          assoc={associations[c.name]}
          isBusy={isBusy}
          onToggleSelect={onToggleSelect}
          onConfirmUpdate={onConfirmUpdate}
          onComposeUpdate={onComposeUpdate}
          onConfirmDelete={onConfirmDelete}
          onShowDetails={onShowDetails}
        />
      ))}
    </div>

    {/* Desktop: table */}
    <div className="overflow-x-auto hidden md:block">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
            <th className="w-10 pl-4 py-3 text-left">
              <CheckBox
                id="check-all"
                ariaLabel="Select all containers"
                checked={selected.size === containers.length && containers.length > 0}
                onChange={e => containers.forEach(c =>
                  e.target.checked
                    ? !selected.has(c.id) && onToggleSelect(c.id)
                    : selected.has(c.id) && onToggleSelect(c.id)
                )} />
            </th>
            {COLS.map(col => (
              <th key={col.key}
                aria-sort={col.sortable && sortKey === col.key
                  ? (sortDir === 'asc' ? 'ascending' : 'descending')
                  : undefined}
                className="px-4 py-3 text-left text-[13px] font-medium uppercase tracking-wider whitespace-nowrap"
                style={{ color: col.sortable && sortKey === col.key ? '#ccc' : '#8a8a8a' }}>
                {col.sortable ? (
                  <button type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer select-none"
                    style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', padding: 0 }}>
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp size={10} />
                        : <ChevronDown size={10} />
                    )}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">{col.label}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((c, idx) => {
            const dot        = DOCKER_DOT[c.status] ?? { bg: '#333', shadow: 'none' }
            const isSel      = selected.has(c.id)
            const assoc      = associations[c.name]
            const hasCompose = !!assoc
            const isRunning  = c.status === 'running'
            // Scans refresh every row's version data; updates touch outdated rows.
            const refreshing = scanning || (updating && c.update_status === 'update_available')

            return (
              <tr key={c.id}
                className="animate-fade_in"
                style={{
                  borderBottom: '1px solid #111',
                  background: isSel ? 'rgba(255,255,255,0.03)' : 'transparent',
                  animationDelay: `${idx * 20}ms`,
                  // fade_in's fill-mode owns `opacity`, so dim via filter
                  filter: isRunning ? undefined : 'brightness(0.65)',
                }}>

                {/* Checkbox */}
                <td className="w-10 pl-4 py-3">
                  <CheckBox id={`check-${c.id}`} ariaLabel={`Select ${c.name}`} checked={isSel} onChange={() => onToggleSelect(c.id)} />
                </td>

                {/* Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: dot.bg, boxShadow: dot.shadow }}
                      title={c.status}
                      role="img"
                      aria-label={`Container ${c.status}`}
                    />
                    <button type="button" className="text-[15px] font-medium text-left"
                      style={{ color: '#ededed', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      title={`View details for ${c.name}`}
                      onClick={() => onShowDetails && onShowDetails(c)}>
                      {c.name}
                    </button>
                    <StoppedBadge status={c.status} />
                  </div>
                  <span className="text-[14px] font-mono" style={{ color: '#8a8a8a' }}>{c.repository}</span>
                  <div className="text-[12px] font-mono mt-0.5" style={{ color: '#6a6a6a' }}>{c.short_id}</div>
                </td>

                {/* Tag + Digest */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <TagLabel container={c} />
                    {c.local_digest && (
                      <span className="font-mono text-[13px] px-1.5 py-0.5" style={{ color: '#6a6a6a' }}
                        title={c.local_digest}>
                        {shortDigest(c.local_digest)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Version check */}
                <td className="px-4 py-3">
                  {refreshing
                    ? <div className="skeleton h-4 w-20" aria-label="Checking…" />
                    : <VersionCheckCell container={c} />}
                </td>

                {/* Update status */}
                <td className="px-4 py-3">
                  {refreshing ? (
                    <div className="skeleton h-5 w-24" aria-label="Checking…" />
                  ) : (
                    <StatusPill status={c.update_status} />
                  )}
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
                    <RowMenu
                      container={c}
                      hasCompose={hasCompose}
                      isBusy={isBusy}
                      onConfirmUpdate={onConfirmUpdate}
                      onComposeUpdate={onComposeUpdate}
                      onConfirmDelete={onConfirmDelete}
                      onShowDetails={onShowDetails}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

const CheckBox = ({ checked, onChange, id, ariaLabel }) => (
  <div className="inline-flex items-center">
    <label className="flex items-center cursor-pointer relative">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel}
        className="peer h-3 w-3 cursor-pointer transition-all appearance-none rounded shadow hover:shadow-md border border-slate-300 checked:bg-blue-600 checked:border-blue-600" id={id} />
      <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
        </svg>
      </span>
    </label>
  </div>
)
