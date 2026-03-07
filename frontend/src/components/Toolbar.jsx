import React from 'react'
import { Search, RefreshCw, ArrowUpCircle, UploadCloud, Filter } from 'lucide-react'

export default function Toolbar({
  isBusy,
  selectedCount,
  outdatedCount,
  search,
  onSearch,
  filterOutdated,
  onFilterOutdated,
  onScan,
  onUpdateSelected,
  onUpdateAll,
  onSelectAll,
  onClearSelection,
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap bg-bg-card border border-border
                    rounded-2xl px-5 py-4 mb-5">

      {/* Scan */}
      <button className="btn btn-blue" onClick={onScan} disabled={isBusy}>
        <RefreshCw size={14} className={isBusy ? 'animate-spin' : ''} />
        {isBusy ? 'Working…' : 'Scan for Updates'}
      </button>

      <div className="w-px h-7 bg-border shrink-0" />

      {/* Update selected */}
      <button
        className="btn btn-ghost"
        onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0}
      >
        <ArrowUpCircle size={14} />
        Update Selected
        {selectedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent-blue/20
                           text-accent-blue text-[10px] font-mono font-bold">
            {selectedCount}
          </span>
        )}
      </button>

      {/* Update all outdated */}
      <button
        className="btn btn-green"
        onClick={onUpdateAll}
        disabled={isBusy || outdatedCount === 0}
      >
        <UploadCloud size={14} />
        Update All Outdated
        {outdatedCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/20
                           text-black text-[10px] font-mono font-bold">
            {outdatedCount}
          </span>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary pointer-events-none" />
        <input
          type="text"
          placeholder="Search containers…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-48 pl-8 pr-3 py-2 rounded-lg text-[13px] font-display
                     bg-bg-surface border border-border text-ink-primary placeholder-ink-secondary
                     focus:outline-none focus:border-accent-blue transition-colors"
        />
      </div>

      {/* Filter outdated */}
      <label className="flex items-center gap-2 cursor-pointer select-none text-[12px]
                        font-display text-ink-secondary hover:text-ink-primary transition-colors">
        <div className="relative">
          <input
            type="checkbox"
            checked={filterOutdated}
            onChange={e => onFilterOutdated(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 rounded-full bg-bg-surface border border-border
                          peer-checked:bg-accent-blue peer-checked:border-accent-blue transition-all" />
          <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-ink-secondary
                          peer-checked:translate-x-4 peer-checked:bg-white transition-all" />
        </div>
        Outdated only
      </label>

      <div className="w-px h-7 bg-border shrink-0" />

      {/* Select helpers */}
      <button className="btn btn-ghost btn-xs" onClick={onSelectAll}>All</button>
      <button className="btn btn-ghost btn-xs" onClick={onClearSelection}>None</button>
    </div>
  )
}
