import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Alert from 'xedonium/Alert'
import Button from 'xedonium/Button'
import Card from 'xedonium/Card'
import KeyIcon from 'xedonium/icons/Key'
import Container from 'xedonium/Container'
import Flex from 'xedonium/Flex'
import Stack from 'xedonium/Stack'
import radarLoader from '../assets/radar-loader.svg'
import { AUTH_REQUIRED_EVENT } from './api/client'
import ApiKeyPrompt from './components/ApiKeyPrompt'
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
import SettingsPage from './components/SettingsPage'
import Toast from './components/Toast'
import Toolbar from './components/Toolbar'
import { useContainers } from './hooks/useContainers'

const SETTINGS_HASH = '#/settings'
const pageFromHash = () => (window.location.hash === SETTINGS_HASH ? 'settings' : 'home')

const App = () => {
  const {
    containers, scanStatus, health,
    selected, loading, initialLoading, isBusy, error, toasts, dismissToast, updatingNames,
    triggerScan, updateOne, updateSelected, updateAll, deleteContainer, testEmail,
    toggleSelect, selectAll, clearSelection,
    associations, fetchAssociations, composeUpdateOne,
    logVisible, dismissLog, fetchHealth, fetchContainers, notify,
  } = useContainers()

  // ── Page (hash route: #/settings) ─────────────────────────────────────────
  const [page, setPage] = useState(pageFromHash)
  const settingsDirtyRef = useRef(false)
  const [pendingNav, setPendingNav] = useState(null)   // hash waiting on "discard changes?"

  useEffect(() => {
    const onHashChange = () => {
      const next = pageFromHash()
      if (page === 'settings' && next !== 'settings' && settingsDirtyRef.current) {
        // Stay on Settings and ask first; replaceState doesn't fire hashchange.
        setPendingNav(window.location.hash || '#/')
        window.history.replaceState(null, '', SETTINGS_HASH)
        return
      }
      setPage(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [page])

  useEffect(() => { window.scrollTo(0, 0) }, [page])

  // ── API key prompt - opened by the first 401 from the API ─────────────────
  const [authNeeded, setAuthNeeded] = useState(null)     // null | { hadKey }
  const [showKeyPrompt, setShowKeyPrompt] = useState(false)
  const keyPromptDismissedRef = useRef(false)

  useEffect(() => {
    const onAuthRequired = (e) => {
      setAuthNeeded(prev => prev ?? { hadKey: !!e.detail?.hadKey })
      // After "Not now", later 401s don't reopen it; the banner offers it again.
      if (!keyPromptDismissedRef.current) setShowKeyPrompt(true)
    }
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
  }, [])

  const openSettings = useCallback(() => { window.location.hash = SETTINGS_HASH }, [])
  const openHome = useCallback(() => { window.location.hash = '#/' }, [])
  const setSettingsDirty = useCallback((dirty) => { settingsDirtyRef.current = dirty }, [])
  const onSettingsSaved = useCallback((changed) => {
    fetchHealth()
    if (changed.includes('HIDDEN_REPOSITORY')) fetchContainers()
  }, [fetchHealth, fetchContainers])

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
      <Stack align="center" justify="center" gap={4} className="min-h-screen text-sm text-app-muted">
        <img src={radarLoader} alt="" className="h-28 w-28" />
        <div>Connecting to DockRadar…</div>
      </Stack>
    )
  }

  return (
    <div className="min-h-screen">

      {health && !health.docker_connected && (
        <Alert tone="danger" title="Docker unavailable.">
          Can't reach the Docker daemon. DockRadar can't scan or update containers until it reconnects - check that Docker is running and the socket (or DOCKER_HOST) is accessible.
        </Alert>
      )}

      {/* Header */}
      <Header
        health={health}
        containers={containers}
        page={page}
        onOpenSettings={openSettings}
        onOpenHome={openHome}
      />

      {page === 'settings' ? (
        <Container as="main" maxWidth="max-w-[1400px]" className="pt-4 md:pt-6">
          <SettingsPage
            onBack={openHome}
            onSaved={onSettingsSaved}
            onTestEmail={testEmail}
            notify={notify}
            onDirtyChange={setSettingsDirty}
          />
        </Container>
      ) : (
      <Container as="main" maxWidth="max-w-[1400px]" className="py-4 md:py-6">

        {/* API key missing or rejected */}
        {authNeeded && !showKeyPrompt && (
          <Alert tone="warning" className="mb-4" title="API key required.">
            <Flex align="center" wrap gap={3}>
              <span>This DockRadar is protected with an API key, so containers can't be loaded without it.</span>
              <Button variant="secondary" onClick={() => setShowKeyPrompt(true)}>
                <KeyIcon className="h-4 w-4 shrink-0" /> Enter API key
              </Button>
            </Flex>
          </Alert>
        )}

        {/* Connection error (the API key banner above already explains a 401) */}
        {error && !authNeeded && (
          <Alert tone="danger" className="mb-4">
            <span className="break-words">{error}</span>
          </Alert>
        )}

        {/* Info bar */}
        <InfoBar health={health} scanStatus={scanStatus} />

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

        {/* Container table */}
        <Card
          title="Containers"
          headingLevel={2}
          padded={false}
          className="overflow-hidden"
          actions={
            <span className="text-xs tabular-nums text-app-muted">
              {visible.length} of {containers.length}
            </span>
          }
        >

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
        </Card>

        {/* Progress log - only for user-initiated scans/updates, not on load */}
        <ProgressLog
          messages={scanStatus?.progress ?? []}
          scanning={scanStatus?.scanning}
          updating={scanStatus?.updating}
          visible={logVisible}
          onDismiss={dismissLog}
        />
      </Container>
      )}

      {/* Footer */}
      <Container as="footer" maxWidth="max-w-[1400px]" className="py-4 text-center text-xs text-app-muted">
        DockRadar{health?.version && ` v${health.version}`}
      </Container>

      {/* ── Dialogs ── */}

      {showKeyPrompt && (
        <ApiKeyPrompt
          hadKey={authNeeded?.hadKey}
          onClose={() => { keyPromptDismissedRef.current = true; setShowKeyPrompt(false) }}
        />
      )}

      {/* Leaving Settings with unsaved changes */}
      <ConfirmDialog
        open={!!pendingNav}
        title="Discard unsaved changes?"
        message="Your changes to the settings haven't been saved."
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          const target = pendingNav
          settingsDirtyRef.current = false
          setPendingNav(null)
          window.location.hash = target
        }}
        onCancel={() => setPendingNav(null)}
      />

      {/* Update single */}
      <ConfirmDialog
        open={!!confirmUpdate}
        title={`Update ${confirmUpdate?.name}?`}
        message={`This will stop, remove, and recreate the container using the latest image.
Preserved: ports, bind mounts, env vars, restart policy, network mode, labels.
Not preserved: named volumes attached via --mount, extra networks, and advanced options - use a compose association for those containers.`}
        confirmLabel="Update"
        onConfirm={() => { updateOne(confirmUpdate.name); setConfirmUpdate(null) }}
        onCancel={() => setConfirmUpdate(null)}
      />

      {/* Delete single */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Remove ${confirmDelete?.name}?`}
        message="This will stop and permanently remove the container. This action cannot be undone."
        confirmLabel="Remove"
        danger
        onConfirm={() => { deleteContainer(confirmDelete.name); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Update all outdated */}
      <ConfirmDialog
        open={confirmAll}
        title={`Update all ${outdatedCount} outdated container(s)?`}
        message="This will stop, remove, and recreate all outdated containers with their latest images. Original configurations will be preserved."
        confirmLabel="Update All"
        onConfirm={() => { updateAll(); setConfirmAll(false) }}
        onCancel={() => setConfirmAll(false)}
      />

      {/* Update selected */}
      <ConfirmDialog
        open={confirmSel}
        title={`Update ${selectedCount} selected container(s)?`}
        message="This will stop, remove, and recreate every selected container with its latest image - including containers that are already up to date."
        confirmLabel="Update Selected"
        onConfirm={() => { updateSelected(); setConfirmSel(false) }}
        onCancel={() => setConfirmSel(false)}
      />

      {/* Compose update - edit file then run */}
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
