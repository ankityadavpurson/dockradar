import { useEffect, useState } from 'react'
import { composeApi } from '../api/client'
import DiffView from './DiffView'

// ── Compose Update Dialog ─────────────────────────────────────────────────────
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
    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(6px)',
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
            <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
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
            <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #1a1a1a', borderRadius: '8px', overflow: 'hidden' }}>
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

export default ComposeUpdateDialog
