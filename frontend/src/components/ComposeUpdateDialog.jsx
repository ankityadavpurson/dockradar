import { useEffect, useState } from 'react'
import { Alert, Button, Loader, TextArea } from 'xedonium'
import { composeApi } from '../api/client'
import DiffView from './DiffView'
import Modal from './Modal'

// Fetches the compose diff from the server, shows the current vs proposed image,
// highlights changed lines in the compose file, then saves + runs on confirm.
const ComposeUpdateDialog = ({ container, onConfirm, onCancel }) => {
  const [diff, setDiff] = useState(null)   // response from /compose-diff
  const [content, setContent] = useState('')     // editable proposed content
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showFull, setShowFull] = useState(false) // toggle between diff and full editor

  useEffect(() => {
    setLoading(true)
    composeApi.diff(container.name)
      .then(d => { setDiff(d); setContent(d.proposed_content); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [container.name])

  async function handleUpdate() {
    setSaving(true)
    setError(null)
    try {
      // Only stored (uploaded) files are editable/savable, and only when the
      // content actually changed — otherwise skip the write. In label mode the
      // backend runs compose against the real file (and rewrites the tag itself).
      if (diff.editable && diff.file_id && content !== diff.current_content) {
        await composeApi.updateContent(diff.file_id, content)
      }
      onConfirm(container.name)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  // Label mode needs to rewrite the real file to move a pinned tag; if DockRadar
  // can't write it (permissions / read-only mount), block that upgrade.
  const cannotWrite = !!diff && diff.editable === false && diff.has_change
    && container.compose?.writable === false

  const title = (
    <span className="block min-w-0 normal-case tracking-normal">
      <span className="block truncate">Compose update — {container.name}</span>
      {diff && (
        <span className="block truncate font-mono text-xs font-normal text-app-muted">
          {diff.filename} · service: {diff.service_name}
          {diff.mode === 'labels' && ' · via its own compose project'}
        </span>
      )}
    </span>
  )

  const footer = (
    <>
      <span className={`flex-1 text-[13px] ${cannotWrite ? 'text-red-500' : 'text-app-muted'}`}>
        {cannotWrite
          ? 'DockRadar can’t write this compose file — grant its user write access, or mount it read-write.'
          : diff?.has_change
            ? (diff.editable === false
                ? 'The tag in the container’s own compose file will be updated (backup kept), then pull + up -d.'
                : 'File will be saved, then compose pull + up -d will run.')
            : 'compose pull + up -d will run without file changes.'}
      </span>
      <Button onClick={handleUpdate} disabled={loading || saving || !!error || cannotWrite}>
        {saving ? 'Updating…' : 'Confirm & Update'}
      </Button>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
    </>
  )

  return (
    <Modal title={title} onClose={onCancel} size="lg" footer={footer} ariaLabel={`Compose update ${container.name}`}>
      {loading && <Loader variant="inline" label="Checking for updates…" className="justify-center py-6" />}

      {error && <Alert tone="danger"><span className="break-words">{error}</span></Alert>}

      {diff && !loading && (<>
        {/* Image change summary */}
        <div className="overflow-hidden border border-app-border">
          <div className="border-b border-app-border px-3 py-2 text-xs font-semibold uppercase tracking-widest text-app-muted">
            Image change
          </div>
          <div className="flex flex-col gap-1.5 p-3">
            <div className="flex items-baseline gap-2">
              <span className="w-14 shrink-0 text-xs text-app-muted">Current</span>
              <code className="break-all bg-red-500/10 px-2 py-0.5 text-[13px] text-red-700 dark:text-red-300">{diff.current_image}</code>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="w-14 shrink-0 text-xs text-app-muted">Latest</span>
              <code className="break-all bg-emerald-500/10 px-2 py-0.5 text-[13px] text-emerald-800 dark:text-emerald-300">{diff.latest_image}</code>
            </div>
            {!diff.has_change && (
              <div className="mt-1 text-[13px] text-app-muted">
                ✓ Image tag is already up to date — <code>pull + up -d</code> will refresh the image without file changes.
              </div>
            )}
            {diff.has_change && diff.editable === false && (
              <div className="mt-1 text-[13px] text-app-muted">
                DockRadar will update the <code>image:</code> tag to <code>{diff.latest_image}</code> in
                the container’s own compose file (<code>{diff.filename}</code>), keeping a{' '}
                <code>.bak</code> backup, then run <code>pull + up -d</code>.
              </div>
            )}
          </div>
        </div>

        {/* Compose file diff / editor (editable = uploaded copy) or read-only view (label mode) */}
        <div className="overflow-hidden border border-app-border">
          <div className="flex items-center justify-between border-b border-app-border bg-app-bg px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-app-muted">
              {diff.editable === false
                ? (diff.has_change ? 'File change (applied on confirm)' : 'Compose file (read-only)')
                : showFull ? 'Compose file (editable)' : 'File changes'}
            </span>
            {diff.editable !== false && (
              <Button variant="flat" onClick={() => setShowFull(s => !s)}>
                {showFull ? 'Show diff' : 'Edit full file'}
              </Button>
            )}
          </div>

          {diff.editable === false ? (
            diff.has_change ? (
              <DiffView current={diff.current_content} proposed={diff.proposed_content} />
            ) : (
              <pre className="m-0 max-h-[260px] w-full overflow-auto p-3 font-mono text-[13px] leading-relaxed text-app-soft">
                {diff.current_content}
              </pre>
            )
          ) : showFull ? (
            <TextArea
              value={content}
              onChange={setContent}
              spellCheck={false}
              rows={12}
              aria-label="Compose file contents"
              className="!border-0 font-mono !text-[13px] leading-relaxed"
            />
          ) : (
            diff.has_change
              ? <DiffView current={diff.current_content} proposed={content} />
              : <div className="px-3 py-4 text-[13px] text-app-muted">No changes to the compose file.</div>
          )}
        </div>
      </>)}
    </Modal>
  )
}

export default ComposeUpdateDialog
