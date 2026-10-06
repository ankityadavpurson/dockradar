import { ArrowUpCircleIcon, Badge, Button, CloseIcon, CloudUploadIcon, Divider, FileCode2Icon, Input, RefreshCwIcon, SearchIcon, Switch } from 'xedonium'

export default function Toolbar({
  isBusy, selectedCount, outdatedCount, visibleCount, totalCount,
  search, onSearch, filterOutdated, onFilterOutdated,  showFirstRunHint,
  onScan, onUpdateSelected, onUpdateAll, onSelectAll, onClearSelection, onOpenCompose,
}) {
  const filtering = !!search.trim() || filterOutdated

  const runText = showFirstRunHint ? 'Run first scan' : 'Scan'

  return (
    <div className="flex items-center gap-2 flex-wrap p-2 mb-3">

      <Button onClick={onScan} disabled={isBusy} className="inline-flex h-[38px] items-center gap-2 mr-4">
        <RefreshCwIcon className={`h-3.5 w-3.5 shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
        {isBusy ? 'Working…' : runText}
      </Button>

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Button variant="flat" onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0} className="inline-flex h-[38px] items-center gap-2">
        <ArrowUpCircleIcon className="h-3.5 w-3.5 shrink-0" />
        Update selected
        {selectedCount > 0 && <Badge badgeContent={selectedCount} />}
      </Button>

      <Button variant="flat" onClick={onUpdateAll}
        disabled={isBusy || outdatedCount === 0} className="inline-flex h-[38px] items-center gap-2">
        <CloudUploadIcon className="h-3.5 w-3.5 shrink-0" />
        Update all
        {outdatedCount > 0 && <Badge badgeContent={outdatedCount} color="warning" />}
      </Button>

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Button variant="flat" onClick={onOpenCompose} tooltip="Manage docker-compose files"
        className="inline-flex h-[38px] items-center gap-2">
        <FileCode2Icon className="h-3.5 w-3.5 shrink-0" />
        Compose
      </Button>

      <div className="hidden flex-1 sm:block" />

      <div className="relative w-full transition-[width] sm:w-48 sm:focus-within:w-64">
        <SearchIcon className="h-3.5 w-3.5 shrink-0 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
        <Input
          type="search"
          placeholder="Search containers"
          aria-label="Search containers"
          value={search}
          onChange={onSearch}
          className="!h-[38px] !pl-9 !pr-8 [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search"
            className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center text-app-muted hover:text-app-text">
            <CloseIcon className="h-3 w-3 shrink-0" />
          </button>
        )}
      </div>

      {filtering && (
        <span className="text-xs text-app-muted whitespace-nowrap tabular-nums px-1"
          title="Matching / total containers">
          {visibleCount} of {totalCount}
        </span>
      )}

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Switch label="Outdated only" checked={filterOutdated} onChange={onFilterOutdated} />

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Button variant="flat" className="h-[38px]" onClick={onSelectAll} tooltip="Select all visible containers">
        Select all
      </Button>
      {selectedCount > 0 && (
        <Button variant="flat" className="h-[38px]" onClick={onClearSelection} tooltip={`Clear selection (${selectedCount})`}>
          Clear
        </Button>
      )}
    </div>
  )
}
