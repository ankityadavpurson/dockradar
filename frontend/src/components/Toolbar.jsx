import { ArrowUpCircle, FileCode2, RefreshCw, Search, UploadCloud, X } from 'lucide-react'

export default function Toolbar({
  isBusy, selectedCount, outdatedCount, visibleCount, totalCount,
  search, onSearch, filterOutdated, onFilterOutdated,  showFirstRunHint,
  onScan, onUpdateSelected, onUpdateAll, onSelectAll, onClearSelection, onOpenCompose,
}) {
  const filtering = !!search.trim() || filterOutdated

  const runText = showFirstRunHint ? 'Run first scan' : 'Scan'

  return (
    <div className="card flex items-center gap-1.5 flex-wrap px-2 py-2 mb-3">

      {/* Scan */}
      <button className="btn btn-primary btn-sm" onClick={onScan} disabled={isBusy}>
        <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
        {isBusy ? 'Working…' : runText}
      </button>

      <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'var(--border-3)' }} />

      {/* Update selected */}
      <button className="btn btn-subtle btn-sm" onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0}>
        <ArrowUpCircle size={14} />
        Update selected
        {selectedCount > 0 && (
          <span className="badge badge-accent tabular-nums">{selectedCount}</span>
        )}
      </button>

      {/* Update all */}
      <button className="btn btn-subtle btn-sm" onClick={onUpdateAll}
        disabled={isBusy || outdatedCount === 0}>
        <UploadCloud size={14} />
        Update all
        {outdatedCount > 0 && (
          <span className="badge badge-caution tabular-nums">{outdatedCount}</span>
        )}
      </button>

      <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'var(--border-3)' }} />

      {/* Compose */}
      <button className="btn btn-subtle btn-sm" onClick={onOpenCompose}
        title="Manage docker-compose files">
        <FileCode2 size={14} />
        Compose
      </button>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-3)' }} />
        <input
          type="search"
          placeholder="Search containers"
          aria-label="Search containers"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="input pl-8 pr-8 w-48 focus:w-64 transition-[width,background-color] [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search"
            className="icon-btn-subtle absolute right-1 top-1/2 -translate-y-1/2 !h-6 !w-6">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Match count while filtering */}
      {filtering && (
        <span className="caption whitespace-nowrap tabular-nums px-1"
          title="Matching / total containers">
          {visibleCount} of {totalCount}
        </span>
      )}

      {/* Outdated filter toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none text-[14px] px-2"
        style={{ color: 'var(--text-1)' }}>
        <span className="toggle">
          <input type="checkbox" checked={filterOutdated}
            onChange={e => onFilterOutdated(e.target.checked)} className="sr-only peer" />
          <span className="toggle-track" aria-hidden="true" />
        </span>
        Outdated only
      </label>

      <div className="w-px h-5 mx-1 shrink-0" style={{ background: 'var(--border-3)' }} />

      <button className="btn btn-subtle btn-sm" onClick={onSelectAll}
        title="Select all visible containers">
        Select all
      </button>
      {selectedCount > 0 && (
        <button className="btn btn-subtle btn-sm" onClick={onClearSelection}
          title={`Clear selection (${selectedCount})`}>
          Clear
        </button>
      )}
    </div>
  )
}
