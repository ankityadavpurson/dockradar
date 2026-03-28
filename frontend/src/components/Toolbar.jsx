import React from 'react'
import { Search, RefreshCw, ArrowUpCircle, UploadCloud, FileCode2 } from 'lucide-react'

export default function Toolbar({
  isBusy, selectedCount, outdatedCount,
  search, onSearch, filterOutdated, onFilterOutdated,
  onScan, onUpdateSelected, onUpdateAll, onSelectAll, onClearSelection, onOpenCompose,
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap px-4 py-3 mb-4 rounded-lg"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #1a1a1a' }}>

      {/* Scan */}
      <button className="btn btn-primary btn-sm" onClick={onScan} disabled={isBusy}>
        <RefreshCw size={13} className={isBusy ? 'animate-spin' : ''} />
        {isBusy ? 'Working…' : 'Scan'}
      </button>

      <div className="w-px h-5 shrink-0" style={{ background: '#1a1a1a' }} />

      {/* Update selected */}
      <button className="btn btn-ghost btn-sm" onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0}>
        <ArrowUpCircle size={13} />
        Update Selected
        {selectedCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: '#1a1a1a', color: '#888', border: '1px solid #222' }}>
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
          <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: 'rgba(245,166,35,0.08)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.2)' }}>
            {outdatedCount}
          </span>
        )}
      </button>

      <div className="w-px h-5 shrink-0" style={{ background: '#1a1a1a' }} />

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
          style={{ color: '#606060' }} />
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-8 pr-3 py-1.5 rounded text-[12px] w-44 outline-none"
          style={{ background: '#111', border: '1px solid #222', color: '#ededed' }}
          onFocus={e => e.target.style.borderColor = '#444'}
          onBlur={e  => e.target.style.borderColor = '#222'}
        />
      </div>

      {/* Outdated filter toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none text-[12px]"
        style={{ color: '#7a7a7a' }}>
        <div className="relative">
          <input type="checkbox" checked={filterOutdated}
            onChange={e => onFilterOutdated(e.target.checked)} className="sr-only peer" />
          <div className="w-7 h-3.5 rounded-full transition-colors"
            style={{ background: filterOutdated ? '#f5a623' : '#222' }} />
          <div className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all"
            style={{ left: filterOutdated ? '17px' : '2px' }} />
        </div>
        Outdated only
      </label>

      <div className="w-px h-5 shrink-0" style={{ background: '#1a1a1a' }} />

      <button className="btn btn-ghost btn-xs" onClick={onSelectAll}>All</button>
      <button className="btn btn-ghost btn-xs" onClick={onClearSelection}>None</button>
    </div>
  )
}
