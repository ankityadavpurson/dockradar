import { useMemo, useState } from 'react'
import ComposeManager from './components/ComposeManager'
import ConfirmDialog from './components/ConfirmDialog'
import ContainerTable from './components/ContainerTable'
import Header from './components/Header'
import InfoBar from './components/InfoBar'
import ProgressLog from './components/ProgressLog'
import Toast from './components/Toast'
import Toolbar from './components/Toolbar'
import { useContainers } from './hooks/useContainers'

export default function App() {
  const {
    containers, scanStatus, health,
    selected, loading, isBusy, error, toast,
    triggerScan, updateOne, updateSelected, updateAll, deleteContainer,
    toggleSelect, selectAll, clearSelection,
    associations, fetchAssociations, composeUpdateOne,
  } = useContainers()

  const [search, setSearch]               = useState('')
  const [filterOutdated, setFilterOutdated] = useState(false)
  const [confirmUpdate, setConfirmUpdate]   = useState(null)  // ContainerInfo | null
  const [confirmDelete, setConfirmDelete]   = useState(null)  // ContainerInfo | null
  const [confirmAll, setConfirmAll]         = useState(false)
  const [confirmSel, setConfirmSel]         = useState(false)
  const [showCompose, setShowCompose]       = useState(false)
  const [confirmCompose, setConfirmCompose] = useState(null) // ContainerInfo | null

  // ── Filtered containers ───────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = containers
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.image_name?.toLowerCase().includes(q) ||
        c.repository?.toLowerCase().includes(q)
      )
    }
    if (filterOutdated) {
      list = list.filter(c => c.update_status === 'update_available')
    }
    return list
  }, [containers, search, filterOutdated])

  const outdatedCount = containers.filter(c => c.update_status === 'update_available').length
  const selectedOutdated = containers.filter(
    c => selected.has(c.id) && c.update_status === 'update_available'
  ).length

  return (
    <div className="min-h-screen" style={{ background: '#000' }}>
      {/* Header */}
      <Header
        health={health}
        containers={containers}
        scanStatus={scanStatus}
      />

      {/* Main content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">

        {/* Connection error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded text-[13px] font-mono animate-fade_in"
            style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.18)', color: '#ff4444' }}>
            ✗ {error}
          </div>
        )}

        {/* Toolbar */}
        <Toolbar
          isBusy={isBusy}
          selectedCount={selectedOutdated}
          outdatedCount={outdatedCount}
          search={search}
          onSearch={setSearch}
          filterOutdated={filterOutdated}
          onFilterOutdated={setFilterOutdated}
          onScan={triggerScan}
          onUpdateSelected={() => setConfirmSel(true)}
          onUpdateAll={() => setConfirmAll(true)}
          onSelectAll={() => selectAll(visible)}
          onClearSelection={clearSelection}
          onOpenCompose={() => setShowCompose(true)}
        />

        {/* Info bar */}
        <InfoBar health={health} />

        {/* Container table */}
        <div className="rounded-lg overflow-hidden"
          style={{ border: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid #1a1a1a', background: '#0a0a0a' }}>
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#444' }}>
              Containers
            </span>
            <span className="text-[11px] font-mono" style={{ color: '#333' }}>
              {visible.length} / {containers.length}
            </span>
          </div>

          <ContainerTable
            containers={visible}
            selected={selected}
            isBusy={isBusy}
            onToggleSelect={toggleSelect}
            onConfirmUpdate={c => setConfirmUpdate(c)}
            onConfirmDelete={c => setConfirmDelete(c)}
            associations={associations}
            onComposeUpdate={c => setConfirmCompose(c)}
          />
        </div>

        {/* Progress log */}
        <ProgressLog
          messages={scanStatus?.progress ?? []}
          scanning={scanStatus?.scanning}
          updating={scanStatus?.updating}
        />
      </main>

      {/* ── Dialogs ── */}

      {/* Update single */}
      <ConfirmDialog
        open={!!confirmUpdate}
        title={`Update ${confirmUpdate?.name}?`}
        message={`This will stop, remove, and recreate the container using the latest image.
Original configuration (ports, volumes, env vars, restart policy) will be preserved.`}
        confirmLabel="Update"
        confirmClass="btn-yellow"
        onConfirm={() => { updateOne(confirmUpdate.name); setConfirmUpdate(null) }}
        onCancel={() => setConfirmUpdate(null)}
      />

      {/* Delete single */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Remove ${confirmDelete?.name}?`}
        message="This will stop and permanently remove the container. This action cannot be undone."
        confirmLabel="Remove"
        confirmClass="btn-red"
        onConfirm={() => { deleteContainer(confirmDelete.name); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Update all outdated */}
      <ConfirmDialog
        open={confirmAll}
        title={`Update all ${outdatedCount} outdated container(s)?`}
        message="This will stop, remove, and recreate all outdated containers with their latest images. Original configurations will be preserved."
        confirmLabel="Update All"
        confirmClass="btn-green"
        onConfirm={() => { updateAll(); setConfirmAll(false) }}
        onCancel={() => setConfirmAll(false)}
      />

      {/* Update selected */}
      <ConfirmDialog
        open={confirmSel}
        title={`Update ${selectedOutdated} selected container(s)?`}
        message="This will stop, remove, and recreate the selected outdated containers with their latest images."
        confirmLabel="Update Selected"
        confirmClass="btn-blue"
        onConfirm={() => { updateSelected(); setConfirmSel(false) }}
        onCancel={() => setConfirmSel(false)}
      />

      {/* Compose update confirm */}
      <ConfirmDialog
        open={!!confirmCompose}
        title={`Update ${confirmCompose?.name} via compose?`}
        message={`This will run docker compose pull + up -d for the linked service.\nDocker Compose will manage the container lifecycle.`}
        confirmLabel="Compose Update"
        confirmClass="btn-blue"
        onConfirm={() => { composeUpdateOne(confirmCompose.name); setConfirmCompose(null) }}
        onCancel={() => setConfirmCompose(null)}
      />

      {/* Compose Manager */}
      {showCompose && (
        <ComposeManager
          containers={containers}
          onClose={() => { setShowCompose(false); fetchAssociations() }}
        />
      )}

      {/* Toast */}
      <Toast toast={toast} />
    </div>
  )
}
