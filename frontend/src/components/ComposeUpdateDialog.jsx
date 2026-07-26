import { useEffect, useState } from 'react'
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
      await composeApi.updateContent(diff.file_id, content)
      onConfirm(container.name)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const title = (
    <div className="min-w-0">
      <div className="text-[15px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
        Compose update — <span style={{ color: 'var(--accent-amber)' }}>{container.name}</span>
      </div>
      {diff && (
        <div className="text-[13px] font-mono truncate" style={{ color: 'var(--text-4)' }}>
          {diff.filename} · service: {diff.service_name}
        </div>
      )}
    </div>
  )

  const footer = (
    <>
      <span className="flex-1 text-[13px] font-mono" style={{ color: 'var(--text-4)' }}>
        {diff?.has_change
          ? 'File will be saved, then compose pull + up -d will run.'
          : 'compose pull + up -d will run without file changes.'}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary btn-sm" onClick={handleUpdate} disabled={loading || saving || !!error}>
        {saving ? 'Updating…' : 'Confirm & Update'}
      </button>
    </>
  )

  return (
    <Modal title={title} onClose={onCancel} size="lg" footer={footer} ariaLabel={`Compose update ${container.name}`}>
      {loading && (
        <div className="text-[14px] font-mono text-center py-6" style={{ color: 'var(--text-3)' }}>
          Checking for updates…
        </div>
      )}

      {error && (
        <div className="px-3 py-2.5 rounded text-[14px] font-mono"
          style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', color: 'var(--accent-red)' }}>
          {error}
        </div>
      )}

      {diff && !loading && (<>
        {/* Image change summary */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface-0)', border: '1px solid var(--border-1)' }}>
          <div className="px-3 py-2 text-[12px] font-mono uppercase tracking-wider"
            style={{ borderBottom: '1px solid var(--border-1)', color: 'var(--text-4)' }}>
            Image change
          </div>
          <div className="p-3 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] w-14 shrink-0" style={{ color: 'var(--text-4)' }}>Current</span>
              <code className="text-[14px] px-2 py-0.5 rounded break-all"
                style={{ color: '#ff6b6b', background: 'rgba(255,68,68,0.08)' }}>{diff.current_image}</code>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] w-14 shrink-0" style={{ color: 'var(--text-4)' }}>Latest</span>
              <code className="text-[14px] px-2 py-0.5 rounded break-all"
                style={{ color: 'var(--accent-teal)', background: 'rgba(80,227,194,0.08)' }}>{diff.latest_image}</code>
            </div>
            {!diff.has_change && (
              <div className="text-[13px] font-mono mt-1" style={{ color: 'var(--text-3)' }}>
                ✓ Image tag is already up to date — compose file will not be modified.
              </div>
            )}
          </div>
        </div>

        {/* Compose file diff / editor */}
        <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface-0)', border: '1px solid var(--border-1)' }}>
          <div className="px-3 py-2 flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-1)' }}>
            <span className="text-[12px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
              {showFull ? 'compose file (editable)' : 'file changes'}
            </span>
            <button onClick={() => setShowFull(s => !s)} className="btn btn-ghost btn-xs">
              {showFull ? 'Show diff' : 'Edit full file'}
            </button>
          </div>

          {showFull ? (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              className="w-full font-mono text-[13px] leading-relaxed resize-y outline-none p-3"
              style={{ minHeight: '220px', maxHeight: '320px', background: '#000', color: 'var(--text-2)', border: 'none', tabSize: 2 }}
            />
          ) : (
            diff.has_change
              ? <DiffView current={diff.current_content} proposed={content} />
              : <div className="px-3 py-4 text-[13px] font-mono" style={{ color: 'var(--text-4)' }}>No changes to the compose file.</div>
          )}
        </div>
      </>)}
    </Modal>
  )
}

export default ComposeUpdateDialog
