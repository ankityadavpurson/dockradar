import { useMemo } from 'react'
import { ArrowUpCircleIcon, Badge, BoxIcon, Button, DataGrid, FileCode2Icon, Loader, ShieldCheckIcon, Skeleton, TagIcon } from 'xedonium'
import CheckBox from './CheckBox'
import RowMenu from './RowMenu'

const STATUS_CFG = {
  up_to_date:       { label: 'Up to date',       color: 'success'   },
  update_available: { label: 'Update available', color: 'warning'   },
  error:            { label: 'Error',            color: 'danger'    },
  unknown:          { label: 'Unknown',          color: 'secondary' },
}

const DOCKER_DOT = {
  running: 'bg-emerald-500',
  exited:  'bg-red-500',
  paused:  'bg-amber-500',
  created: 'bg-app-muted',
  dead:    'bg-app-border',
}
const DEFAULT_DOT = 'bg-app-border'

function shortDigest(digest) {
  if (!digest) return null
  const hash = digest.startsWith('sha256:') ? digest.slice(7) : digest
  return hash.slice(0, 8)
}

/** Inline pill built on xedonium's standalone Badge. */
function Pill({ color, children, className = '', ...rest }) {
  return (
    <Badge color={color} className={className} {...rest}
      badgeContent={<span className="inline-flex items-center gap-1 px-1">{children}</span>} />
  )
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
    return <span className="inline-block font-mono text-[13px] text-app-muted line-through">{label}</span>
  }
  if (c.tag === 'latest') {
    return <span className="inline-block font-mono text-[13px] text-app-muted">latest</span>
  }
  return (
    <span className="inline-block w-fit border border-app-border px-1.5 py-0.5 font-mono text-[13px] text-app-text"
      title={isDigestTag ? c.tag : undefined}>
      {label}
    </span>
  )
}

function VersionCheckCell({ container }) {
  const { tag, latest_tag, update_status, local_digest } = container
  const tagsMatch = !latest_tag || latest_tag === tag || latest_tag === 'unknown'

  if (update_status === 'unknown' || update_status === 'error') {
    return <span className="text-app-muted">—</span>
  }

  // A newer tag exists — the genuinely interesting tag-level state.
  if (!tagsMatch) {
    return <Pill color="warning" title={`Newer tag available: ${latest_tag}`}>
      <TagIcon className="h-3 w-3 shrink-0" />→ {latest_tag}
    </Pill>
  }

  // Same tag, but the image was rebuilt upstream.
  if (update_status === 'update_available') {
    return <Pill color="warning"
      title={`Same tag, but the image was rebuilt upstream\nLocal digest: ${local_digest ?? 'unknown'}`}>
      <ShieldCheckIcon className="h-3 w-3 shrink-0" />Digest changed
    </Pill>
  }

  // Fully verified: tag and digest both match upstream.
  if (local_digest) {
    return <Pill color="success" title={`Tag and digest match upstream\n${local_digest}`}>
      <ShieldCheckIcon className="h-3 w-3 shrink-0" />Verified
    </Pill>
  }

  // Tag matches but there was no digest to verify image content with.
  return <Pill color="secondary"
    title="Tag matches upstream; no digest available to verify image content">
    <TagIcon className="h-3 w-3 shrink-0" />Tag match
  </Pill>
}

// Priority for the default sort: actionable states first.
const STATUS_ORDER = { update_available: 0, error: 1, unknown: 2, up_to_date: 3 }

/** Update / compose-update button shown for outdated containers. */
function UpdateButton({ c, hasCompose, assoc, composeUnavailable, isBusy, onConfirmUpdate, onComposeUpdate }) {
  if (c.update_status !== 'update_available') return null
  const composeSvc = assoc?.service_name || c.compose?.service
  return hasCompose ? (
    <Button variant="secondary" disabled={isBusy || composeUnavailable}
      onClick={() => onComposeUpdate && onComposeUpdate(c)}
      className="inline-flex items-center gap-1.5 !px-2 !py-1"
      tooltip={composeUnavailable
        ? 'Compose CLI not available in this deployment'
        : `Update via compose: ${composeSvc}`}>
      <FileCode2Icon className="h-3 w-3 shrink-0" />
      Compose
    </Button>
  ) : (
    <Button variant="warning" disabled={isBusy}
      onClick={() => onConfirmUpdate(c)}
      className="inline-flex items-center gap-1.5 !px-2 !py-1"
      tooltip={`Update ${c.name}`}>
      <ArrowUpCircleIcon className="h-3 w-3 shrink-0" />
      Update
    </Button>
  )
}

/** Compact card used below the md breakpoint instead of the table row. */
function ContainerCard({
  c, isSel, refreshing, isUpdating, hasCompose, assoc, composeUnavailable, isBusy,
  onToggleSelect, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails, onShowError,
}) {
  const dot = DOCKER_DOT[c.status] ?? DEFAULT_DOT
  const isRunning = c.status === 'running'

  return (
    <div className={`flex flex-col gap-2.5 border-b border-app-border px-4 py-3 ${isSel ? 'bg-app-bg' : ''} ${isRunning ? '' : 'opacity-70 saturate-[0.4]'}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <CheckBox id={`card-check-${c.id}`} ariaLabel={`Select ${c.name}`}
          checked={isSel} onChange={() => onToggleSelect(c.id)} />
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`}
          role="img" aria-label={`Container ${c.status}`} />
        <button type="button" className="truncate text-sm font-semibold text-app-strong hover:underline"
          title={`View details for ${c.name}`}
          onClick={() => onShowDetails && onShowDetails(c)}>
          {c.name}
        </button>
        <StoppedBadge status={c.status} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <UpdateButton c={c} hasCompose={hasCompose} assoc={assoc} composeUnavailable={composeUnavailable}
            isBusy={isBusy} onConfirmUpdate={onConfirmUpdate} onComposeUpdate={onComposeUpdate} />
          <RowMenu container={c} hasCompose={hasCompose} isBusy={isBusy}
            onConfirmUpdate={onConfirmUpdate} onComposeUpdate={onComposeUpdate}
            onConfirmDelete={onConfirmDelete} onShowDetails={onShowDetails} />
        </div>
      </div>

      <div className="truncate font-mono text-xs text-app-muted">{c.repository}</div>

      <div className="flex flex-wrap items-center gap-2">
        <TagLabel container={c} />
        {isUpdating
          ? <UpdatingPill />
          : refreshing
            ? (<>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
              </>)
            : (<>
                <VersionCheckCell container={c} />
                <StatusPill status={c.update_status} errorMessage={c.error_message}
                  onShowError={() => onShowError && onShowError(c)} />
              </>)}
      </div>
    </div>
  )
}

function StoppedBadge({ status }) {
  if (status === 'running') return null
  const color = status === 'exited' ? 'danger' : status === 'paused' ? 'warning' : 'secondary'
  return <Pill color={color} className="shrink-0 capitalize">{status}</Pill>
}

function StatusPill({ status, errorMessage, onShowError }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.unknown
  // On error, the pill becomes a button that opens a dialog with the scan
  // reason (adds click + keyboard activation).
  const clickable = status === 'error' && !!errorMessage && !!onShowError
  return (
    <Pill
      color={s.color}
      className={clickable ? 'cursor-pointer hover:opacity-80' : ''}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? 'View error details' : undefined}
      onClick={clickable ? onShowError : undefined}
      onKeyDown={clickable
        ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onShowError() } })
        : undefined}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </Pill>
  )
}

/** Shown in a row whose image is currently being pulled + recreated. */
function UpdatingPill() {
  return (
    <Pill color="warning">
      <Loader variant="spinner" size='sm' />
      Updating…
    </Pill>
  )
}

export default function ContainerTable({
  containers, isFiltered = false, selected, isBusy,
  scanning = false, updating = false, updatingNames = new Set(),
  composeCli = true,
  onToggleSelect, onConfirmUpdate, onConfirmDelete,
  associations = {}, onComposeUpdate, onShowDetails, onShowError,
}) {
  // compose_cli is false when the deployment has no `docker compose` CLI
  // (e.g. an older container image). Treat undefined as available.
  const composeUnavailable = composeCli === false

  // Default order: actionable states first, then by name. Clicking a sortable
  // column header in the grid overrides this.
  const sorted = useMemo(() => [...containers].sort((a, b) =>
    ((STATUS_ORDER[a.update_status] ?? 9) - (STATUS_ORDER[b.update_status] ?? 9))
    || a.name.localeCompare(b.name)), [containers])

  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-app-muted">
        <BoxIcon className="h-10 w-10 shrink-0 mb-4" />
        {isFiltered ? (
          <>
            <p className="mb-1 text-base font-semibold text-app-text">No matching containers</p>
            <p className="text-sm">Nothing matches the current search or filter — clear them to see all containers.</p>
          </>
        ) : (
          <>
            <p className="mb-1 text-base font-semibold text-app-text">No containers found</p>
            <p className="text-sm">Select <span className="font-semibold text-app-text">Scan</span> to discover Docker containers.</p>
          </>
        )}
      </div>
    )
  }

  // Stopped containers are dimmed (the grid has no per-row class, so each cell does it).
  const dim = (c, node) => (
    <div style={{ filter: c.status === 'running' ? undefined : 'saturate(0.4) opacity(0.7)' }}>{node}</div>
  )

  const columns = [
    {
      key: 'name', header: 'Container', sortable: true,
      render: c => dim(c, (
        <>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${DOCKER_DOT[c.status] ?? DEFAULT_DOT}`}
              title={c.status} role="img" aria-label={`Container ${c.status}`} />
            <button type="button" className="text-sm font-semibold text-app-strong hover:underline"
              title={`View details for ${c.name}`}
              onClick={() => onShowDetails && onShowDetails(c)}>
              {c.name}
            </button>
            <StoppedBadge status={c.status} />
          </div>
          <span className="font-mono text-xs text-app-muted">{c.repository}</span>
          <div className="font-mono text-[11px] text-app-muted opacity-70">{c.short_id}</div>
        </>
      )),
    },
    {
      key: 'tag', header: 'Tag / Digest',
      render: c => dim(c, (
        <div className="flex flex-col gap-1">
          <TagLabel container={c} />
          {c.local_digest && (
            <span className="font-mono text-xs text-app-muted opacity-70" title={c.local_digest}>
              {shortDigest(c.local_digest)}
            </span>
          )}
        </div>
      )),
    },
    {
      key: '_version', header: 'Version',
      render: c => dim(c, updatingNames.has(c.name)
        ? <span className="text-[13px] text-app-muted">—</span>
        : scanning
          ? <Skeleton className="h-4 w-20" />
          : <VersionCheckCell container={c} />),
    },
    {
      key: 'update_status', header: 'Status', sortable: true,
      accessor: c => STATUS_ORDER[c.update_status] ?? 9,
      render: c => dim(c, updatingNames.has(c.name)
        ? <UpdatingPill />
        : scanning
          ? <Skeleton className="h-5 w-24" />
          : <StatusPill status={c.update_status} errorMessage={c.error_message}
              onShowError={() => onShowError && onShowError(c)} />),
    },
    {
      key: '_actions', header: 'Actions',
      render: c => {
        const assoc = associations[c.name]
        const hasCompose = !!assoc || !!c.compose
        return (
          <div className="flex items-center gap-1.5">
            <RowMenu container={c} hasCompose={hasCompose} isBusy={isBusy}
              onConfirmUpdate={onConfirmUpdate} onComposeUpdate={onComposeUpdate}
              onConfirmDelete={onConfirmDelete} onShowDetails={onShowDetails} />
            <UpdateButton c={c} hasCompose={hasCompose} assoc={assoc} composeUnavailable={composeUnavailable}
              isBusy={isBusy} onConfirmUpdate={onConfirmUpdate} onComposeUpdate={onComposeUpdate} />
          </div>
        )
      },
    },
  ]

  // The grid reports the full next selection; the app toggles per id, so apply the difference.
  function handleSelectionChange(next) {
    const nextSet = new Set(next)
    for (const id of nextSet) if (!selected.has(id)) onToggleSelect(id)
    for (const id of selected) if (!nextSet.has(id)) onToggleSelect(id)
  }

  return (
    <>
    {/* Mobile: card list */}
    <div className="lg:hidden">
      {sorted.map(c => (
        <ContainerCard key={c.id}
          c={c}
          isSel={selected.has(c.id)}
          refreshing={scanning}
          isUpdating={updatingNames.has(c.name)}
          hasCompose={!!associations[c.name] || !!c.compose}
          assoc={associations[c.name]}
          composeUnavailable={composeUnavailable}
          isBusy={isBusy}
          onToggleSelect={onToggleSelect}
          onConfirmUpdate={onConfirmUpdate}
          onComposeUpdate={onComposeUpdate}
          onConfirmDelete={onConfirmDelete}
          onShowDetails={onShowDetails}
          onShowError={onShowError}
        />
      ))}
    </div>

    {/* Desktop: data grid */}
    <div className="hidden lg:block">
      <DataGrid
        caption="Containers"
        columns={columns}
        rows={sorted}
        rowKey="id"
        selectable
        selected={[...selected]}
        onSelectionChange={handleSelectionChange}
        pageSize={50}
        empty="No containers"
        className="!gap-0 [&>div:first-child]:border-0 [&>div:last-child]:items-end [&>div:last-child]:border-t [&>div:last-child]:border-app-border [&>div:last-child]:px-4 [&>div:last-child]:py-3"
      />
    </div>
    </>
  )
}
