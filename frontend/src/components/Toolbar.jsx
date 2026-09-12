import { ArrowUpCircle, FileCode2, RefreshCw, Search, UploadCloud, X } from 'lucide-react'

export default function Toolbar({
  isBusy, selectedCount, outdatedCount, visibleCount, totalCount,
  search, onSearch, filterOutdated, onFilterOutdated,  showFirstRunHint,
  onScan, onUpdateSelected, onUpdateAll, onSelectAll, onClearSelection, onOpenCompose,
}) {
  const filtering = !!search.trim() || filterOutdated

  const runText = showFirstRunHint ? 'Run first scan' : 'Scan'

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-3 mb-4 rounded-lg"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-1)' }}>

      {/* Scan */}
      <button className="btn btn-primary btn-sm" onClick={onScan} disabled={isBusy}>
        <RefreshCw size={13} className={isBusy ? 'animate-spin' : ''} />
        {isBusy ? 'Working…' : runText}
      </button>

      <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-1)' }} />

      {/* Update selected */}
      <button className="btn btn-ghost btn-sm" onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0}>
        <ArrowUpCircle size={13} />
        Update Selected
        {selectedCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded text-[12px] font-mono"
            style={{ background: 'var(--surface-2)', color: 'var(--text-3)', border: '1px solid var(--border-2)' }}>
            {selectedCount}
          </span>
        )}
      </button>

      {/* Update all */}
      <button className="btn btn-ghost btn-sm" onClick={onUpdateAll}
        disabled={isBusy || outdatedCount === 0}>
        <UploadCloud size={13} />
        Update All
        {outdatedCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded text-[12px] font-mono"
            style={{ background: 'rgba(245,166,35,0.08)', color: 'var(--accent-amber)', border: '1px solid rgba(245,166,35,0.2)' }}>
            {outdatedCount}
          </span>
        )}
      </button>

      <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-1)' }} />

      {/* Compose */}
      <button className="btn btn-ghost btn-sm" onClick={onOpenCompose}
        title="Manage docker-compose files">
        <FileCode2 size={13} />
        Compose
      </button>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-4)' }} />
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-8 pr-7 py-1.5 rounded text-[14px] w-44 focus:w-64 transition-all outline-none"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
          onFocus={e => e.target.style.borderColor = 'var(--border-3)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border-2)'}
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-4)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Match count while filtering */}
      {filtering && (
        <span className="text-[13px] font-mono whitespace-nowrap" style={{ color: 'var(--text-3)' }}
          title="Matching / total containers">
          {visibleCount} / {totalCount}
        </span>
      )}

      {/* Outdated filter toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none text-[14px]"
        style={{ color: 'var(--text-3)' }}>
        <div className="relative">
          <input type="checkbox" checked={filterOutdated}
            onChange={e => onFilterOutdated(e.target.checked)} className="sr-only peer" />
          <div className="w-7 h-3.5 rounded-full transition-colors"
            style={{ background: filterOutdated ? 'var(--accent-amber)' : 'var(--border-3)' }} />
          <div className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
            style={{ left: filterOutdated ? '17px' : '2px' }} />
        </div>
        Outdated only
      </label>

      <div className="w-px h-5 shrink-0" style={{ background: 'var(--border-1)' }} />

      <button className="btn btn-ghost btn-xs" onClick={onSelectAll}
        title="Select all visible containers">
        Select all
      </button>
      {selectedCount > 0 && (
        <button className="btn btn-ghost btn-xs" onClick={onClearSelection}
          title={`Clear selection (${selectedCount})`}>
          Clear
        </button>
      )}
    </div>
  )
}
