import { useEffect, useMemo, useState } from 'react'
import { composeApi } from './api/client'
import ComposeManager from './components/ComposeManager'
import ConfirmDialog from './components/ConfirmDialog'
import ContainerTable from './components/ContainerTable'
import Header from './components/Header'
import InfoBar from './components/InfoBar'
import ProgressLog from './components/ProgressLog'
import Toast from './components/Toast'
import Toolbar from './components/Toolbar'
import { useContainers } from './hooks/useContainers'

// ── Compose Update Dialog ─────────────────────────────────────────────────────
// Fetches the compose diff from the server, shows the current vs proposed image,
// highlights changed lines in the compose file, then saves + runs on confirm.

/** Render compose YAML line-by-line, highlighting lines that differ */
function DiffView({ current, proposed }) {
  if (!current || !proposed) return null
  const currentLines  = current.split('\n')
  const proposedLines = proposed.split('\n')
  const maxLen = Math.max(currentLines.length, proposedLines.length)

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6, overflowY: 'auto', maxHeight: '260px' }}>
      {Array.from({ length: maxLen }, (_, i) => {
        const cur  = currentLines[i]  ?? ''
        const prop = proposedLines[i] ?? ''
        const changed = cur !== prop
        return (
          <div key={i}>
            {changed && cur  && (
              <div style={{ background: 'rgba(255,68,68,0.12)', color: '#ff6b6b', padding: '0 12px', whiteSpace: 'pre' }}>
                {'- ' + cur}
              </div>
            )}
            {changed && prop && (
              <div style={{ background: 'rgba(80,227,194,0.10)', color: '#50e3c2', padding: '0 12px', whiteSpace: 'pre' }}>
                {'+ ' + prop}
              </div>
            )}
            {!changed && (
              <div style={{ color: '#555', padding: '0 12px', whiteSpace: 'pre' }}>
                {'  ' + cur}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ComposeUpdateDialog({ container, onConfirm, onCancel }) {
  const [diff,    setDiff]    = useState(null)   // response from /compose-diff
  const [content, setContent] = useState('')     // editable proposed content
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [showFull, setShowFull] = useState(false) // toggle between diff and full editor

  useEffect(() => {
    setLoading(true)
    composeApi.diff(container.name)
      .then(d => {
        setDiff(d)
        setContent(d.proposed_content)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [container.name])

  async function handleUpdate() {
    setSaving(true)
    setError(null)
    try {
      await composeApi.updateContent(diff.file_id, content)
      onConfirm(container.name)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
  }
  const panel = {
    width: '100%', maxWidth: '660px', margin: '0 16px',
    background: '#111', border: '1px solid #222', borderRadius: '12px',
    display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden',
  }
  const mono = { fontFamily: 'monospace' }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={panel}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ededed', marginBottom: '4px' }}>
            Compose update — <span style={{ color: '#f5a623' }}>{container.name}</span>
          </div>
          {diff && (
            <div style={{ fontSize: '11px', color: '#606060', ...mono }}>
              {diff.filename} · service: {diff.service_name}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {loading && (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: '24px', ...mono }}>
              Checking for updates…
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '6px', color: '#ff4444', fontSize: '12px', ...mono }}>
              {error}
            </div>
          )}

          {diff && !loading && (<>

            {/* Image change summary */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a', fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>
                Image change
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#444', width: '52px', flexShrink: 0 }}>Current</span>
                  <code style={{ fontSize: '12px', color: '#ff6b6b', background: 'rgba(255,68,68,0.08)', padding: '2px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                    {diff.current_image}
                  </code>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#444', width: '52px', flexShrink: 0 }}>Latest</span>
                  <code style={{ fontSize: '12px', color: '#50e3c2', background: 'rgba(80,227,194,0.08)', padding: '2px 8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                    {diff.latest_image}
                  </code>
                </div>
                {!diff.has_change && (
                  <div style={{ fontSize: '11px', color: '#606060', marginTop: '4px', ...mono }}>
                    ✓ Image tag is already up to date — compose file will not be modified.
                  </div>
                )}
              </div>
            </div>

            {/* Compose file diff / editor */}
            <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', ...mono }}>
                  {showFull ? 'compose file (editable)' : 'file changes'}
                </span>
                <button onClick={() => setShowFull(s => !s)}
                  style={{ fontSize: '10px', color: '#606060', background: 'none', border: '1px solid #222', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', ...mono }}>
                  {showFull ? 'Show diff' : 'Edit full file'}
                </button>
              </div>

              {showFull ? (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  spellCheck={false}
                  style={{ width: '100%', minHeight: '220px', maxHeight: '320px', background: '#000', color: '#aaa', border: 'none', outline: 'none', ...mono, fontSize: '11px', lineHeight: 1.6, padding: '12px', resize: 'vertical', tabSize: 2 }}
                />
              ) : (
                diff.has_change
                  ? <DiffView current={diff.current_content} proposed={content} />
                  : <div style={{ padding: '16px 12px', fontSize: '11px', color: '#555', ...mono }}>No changes to the compose file.</div>
              )}
            </div>

          </>)}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#555', ...mono }}>
            {diff?.has_change ? 'File will be saved, then compose pull + up -d will run.' : 'compose pull + up -d will run without file changes.'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onCancel}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #333', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleUpdate} disabled={loading || saving || !!error}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: loading || saving || error ? '#333' : '#fff', color: '#000', fontSize: '13px', fontWeight: 600, cursor: loading || saving || error ? 'not-allowed' : 'pointer', opacity: loading || saving || error ? 0.5 : 1 }}>
              {saving ? 'Updating…' : 'Confirm & Update'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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

      {/* Compose update — edit file then run */}
      {confirmCompose && (
        <ComposeUpdateDialog
          container={confirmCompose}
          onConfirm={(name) => { composeUpdateOne(name); setConfirmCompose(null) }}
          onCancel={() => setConfirmCompose(null)}
        />
      )}

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
