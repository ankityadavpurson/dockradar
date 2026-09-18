import { AlertCircle, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import ComposeFileEditor from './components/ComposeFileEditor'
import ComposeLinkDialog from './components/ComposeLinkDialog'
import ComposeManager from './components/ComposeManager'
import ComposeUpdateDialog from './components/ComposeUpdateDialog'
import ConfirmDialog from './components/ConfirmDialog'
import ContainerDetailDrawer from './components/ContainerDetailDrawer'
import ContainerTable from './components/ContainerTable'
import ErrorDetailDialog from './components/ErrorDetailDialog'
import Header from './components/Header'
import InfoBar from './components/InfoBar'
import Modal from './components/Modal'
import ProgressLog from './components/ProgressLog'
import Toast from './components/Toast'
import Toolbar from './components/Toolbar'
import { useContainers } from './hooks/useContainers'

const App = () => {
  const {
    containers, scanStatus, health,
    selected, loading, initialLoading, isBusy, error, toasts, dismissToast, updatingNames,
    triggerScan, updateOne, updateSelected, updateAll, deleteContainer, testEmail,
    toggleSelect, selectAll, clearSelection,
    associations, fetchAssociations, composeUpdateOne,
    logVisible, dismissLog,
  } = useContainers()

  const [search, setSearch] = useState('')
  const [filterOutdated, setFilterOutdated] = useState(false)
  const [confirmUpdate, setConfirmUpdate] = useState(null)  // ContainerInfo | null
  const [confirmDelete, setConfirmDelete] = useState(null)  // ContainerInfo | null
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmSel, setConfirmSel] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [confirmCompose, setConfirmCompose] = useState(null) // ContainerInfo | null
  const [detailName, setDetailName] = useState(null)         // container name | null
  const [linkContainer, setLinkContainer] = useState(null)   // ContainerInfo | null
  const [editFile, setEditFile] = useState(null)             // { file_id, filename } | null
  const [errorDetail, setErrorDetail] = useState(null)       // ContainerInfo | null

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

  // Container + association backing the details drawer (drives its action buttons).
  const detailContainer = detailName ? containers.find(c => c.name === detailName) : null
  const detailAssoc     = detailName ? associations[detailName] : undefined

  const outdatedCount = containers.filter(c => c.update_status === 'update_available').length
  // "Update Selected" recreates every selected container (even up-to-date
  // ones), so the badge and dialog must count the full selection.
  const selectedCount = selected.size

  // First-run hint: containers discovered but the server has never scanned.
  const lastScan = scanStatus?.last_scan ?? health?.last_scan
  const showFirstRunHint = !!health && !lastScan && containers.length > 0 && !isBusy

  // Full-page loader until the first health + containers fetch resolves, so the
  // UI is never blank (or a misleading "no containers found") on load.
  if (initialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ color: 'var(--text-3)' }}>
        <Loader2 size={28} className="animate-spin" />
        <div className="text-[14px]">Connecting to DockRadar…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">

      {health && !health.docker_connected && (
        <div role="alert" className="infobar infobar-critical"
          style={{ borderRadius: 0, borderWidth: '0 0 1px 0' }}>
          <AlertCircle size={16} className="infobar-icon" />
          <span><strong className="font-semibold">Docker unavailable.</strong>{' '}Can't reach the Docker daemon. DockRadar can't scan or update containers until it reconnects — check that Docker is running and the socket (or DOCKER_HOST) is accessible.</span>
        </div>
      )}

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
          <div role="alert" className="infobar infobar-critical mb-4 animate-fade_in">
            <AlertCircle size={16} className="infobar-icon" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Toolbar */}
        <Toolbar
          isBusy={isBusy}
          selectedCount={selectedCount}
          outdatedCount={outdatedCount}
          visibleCount={visible.length}
          totalCount={containers.length}
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
          showFirstRunHint={showFirstRunHint}
        />

        {/* Info bar */}
        <InfoBar health={health} onTestEmail={testEmail} />

        {/* Container table */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border-1)' }}>
            <span className="section-label">
              Containers
            </span>
            <span className="caption tabular-nums">
              {visible.length} of {containers.length}
            </span>
          </div>

          <ContainerTable
            containers={visible}
            isFiltered={!!search.trim() || filterOutdated}
            selected={selected}
            isBusy={isBusy}
            scanning={!!scanStatus?.scanning}
            updating={!!scanStatus?.updating}
            updatingNames={updatingNames}
            composeCli={health?.compose_cli}
            onToggleSelect={toggleSelect}
            onConfirmUpdate={c => setConfirmUpdate(c)}
            onConfirmDelete={c => setConfirmDelete(c)}
            associations={associations}
            onComposeUpdate={c => setConfirmCompose(c)}
            onShowDetails={c => setDetailName(c.name)}
            onShowError={c => setErrorDetail(c)}
          />
        </div>

        {/* Progress log — only for user-initiated scans/updates, not on load */}
        <ProgressLog
          messages={scanStatus?.progress ?? []}
          scanning={scanStatus?.scanning}
          updating={scanStatus?.updating}
          visible={logVisible}
          onDismiss={dismissLog}
        />
      </main>

      {/* Footer */}
      <footer className="max-w-[1400px] mx-auto px-6 py-4 text-center text-[12px]"
        style={{ color: 'var(--text-4)' }}>
        DockRadar{health?.version && ` v${health.version}`}
      </footer>

      {/* ── Dialogs ── */}

      {/* Update single */}
      <ConfirmDialog
        open={!!confirmUpdate}
        title={`Update ${confirmUpdate?.name}?`}
        message={`This will stop, remove, and recreate the container using the latest image.
Preserved: ports, bind mounts, env vars, restart policy, network mode, labels.
Not preserved: named volumes attached via --mount, extra networks, and advanced options — use a compose association for those containers.`}
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
        title={`Update ${selectedCount} selected container(s)?`}
        message="This will stop, remove, and recreate every selected container with its latest image — including containers that are already up to date."
        confirmLabel="Update Selected"
        confirmClass="btn-primary"
        onConfirm={() => { updateSelected(); setConfirmSel(false) }}
        onCancel={() => setConfirmSel(false)}
      />

      {/* Compose update — edit file then run */}
      {confirmCompose && (
        <ComposeUpdateDialog
          container={confirmCompose}
          onConfirm={(name) => { composeUpdateOne(name); setConfirmCompose(null) }}
          onCancel={() => setConfirmCompose(null)}
        />
      )}

      {/* Scan error details */}
      {errorDetail && (
        <ErrorDetailDialog
          container={errorDetail}
          onClose={() => setErrorDetail(null)}
        />
      )}

      {/* Container detail drawer */}
      {detailName && (
        <ContainerDetailDrawer
          name={detailName}
          container={detailContainer}
          association={detailAssoc}
          composeCli={health?.compose_cli}
          isBusy={isBusy}
          onClose={() => setDetailName(null)}
          onDirectUpdate={c => { setDetailName(null); setConfirmUpdate(c) }}
          onComposeUpdate={c => { setDetailName(null); setConfirmCompose(c) }}
          onLinkCompose={() => { setLinkContainer(detailContainer); setDetailName(null) }}
          onEditCompose={() => {
            if (detailAssoc) setEditFile({ file_id: detailAssoc.file_id, filename: detailAssoc.filename })
            setDetailName(null)
          }}
        />
      )}

      {/* Link a container to a compose file (focused) */}
      {linkContainer && (
        <ComposeLinkDialog
          container={linkContainer}
          onClose={() => setLinkContainer(null)}
          onLinked={() => { fetchAssociations(); setLinkContainer(null) }}
          onOpenManager={() => { setLinkContainer(null); setShowCompose(true) }}
        />
      )}

      {/* Edit a linked compose file (focused) */}
      {editFile && (
        <Modal
          title={`Edit ${editFile.filename}`}
          size="xl"
          onClose={() => setEditFile(null)}
          ariaLabel={`Edit ${editFile.filename}`}
        >
          <ComposeFileEditor
            file={editFile}
            onSave={() => { fetchAssociations(); setEditFile(null) }}
          />
        </Modal>
      )}

      {/* Compose Manager */}
      {showCompose && (
        <ComposeManager
          containers={containers}
          onClose={() => { setShowCompose(false); fetchAssociations() }}
        />
      )}

      {/* Toasts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default App
