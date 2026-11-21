import ArrowUpCircleIcon from 'xedonium/icons/ArrowUpCircle'
import Badge from 'xedonium/Badge'
import Button from 'xedonium/Button'
import CloudUploadIcon from 'xedonium/icons/CloudUpload'
import Divider from 'xedonium/Divider'
import FileCode2Icon from 'xedonium/icons/FileCode2'
import Input from 'xedonium/Input'
import RefreshCwIcon from 'xedonium/icons/RefreshCw'
import SearchIcon from 'xedonium/icons/Search'
import Switch from 'xedonium/Switch'
import Flex from 'xedonium/Flex'

export default function Toolbar({
  isBusy, selectedCount, outdatedCount, visibleCount, totalCount,
  search, onSearch, filterOutdated, onFilterOutdated,  showFirstRunHint,
  onScan, onUpdateSelected, onUpdateAll, onSelectAll, onClearSelection, onOpenCompose,
}) {
  const filtering = !!search.trim() || filterOutdated

  const runText = showFirstRunHint ? 'Run first scan' : 'Scan'

  return (
    <Flex align="center" wrap gap={2} className="p-2 mb-3">

      <Button onClick={onScan} disabled={isBusy} className="h-[38px] mr-4">
        <RefreshCwIcon className={`h-3.5 w-3.5 shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
        {isBusy ? 'Working…' : runText}
      </Button>

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Button variant="flat" onClick={onUpdateSelected}
        disabled={isBusy || selectedCount === 0} className="h-[38px]">
        <ArrowUpCircleIcon className="h-3.5 w-3.5 shrink-0" />
        Update selected
        {selectedCount > 0 && <Badge badgeContent={selectedCount} />}
      </Button>

      <Button variant="flat" onClick={onUpdateAll}
        disabled={isBusy || outdatedCount === 0} className="h-[38px]">
        <CloudUploadIcon className="h-3.5 w-3.5 shrink-0" />
        Update all
        {outdatedCount > 0 && <Badge badgeContent={outdatedCount} color="warning" />}
      </Button>

      <Divider orientation="vertical" className="mx-1 hidden !h-5 shrink-0 !self-center sm:block" />

      <Button variant="flat" onClick={onOpenCompose} tooltip="Manage docker-compose files"
        className="h-[38px]">
        <FileCode2Icon className="h-3.5 w-3.5 shrink-0" />
        Compose
      </Button>

      <div className="hidden flex-1 sm:block" />

      <div className="relative w-full transition-[width] sm:w-48 sm:focus-within:w-64">
        <Input
          type="search"
          placeholder="Search containers"
          aria-label="Search containers"
          value={search}
          onChange={onSearch}
          startAdornment={<SearchIcon />}
          clearable
          clearLabel="Clear search"
          className="!h-[38px] [&::-webkit-search-cancel-button]:hidden"
        />
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
    </Flex>
  )
}
