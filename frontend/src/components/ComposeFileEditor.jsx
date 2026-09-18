import { AlertCircle, FileCode2, Save, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { composeApi } from '../api/client'

const LABEL = { color: 'var(--text-3)' }
const PRIMARY = { color: 'var(--text-1)' }
const BORDER = '1px solid var(--border-1)'

/**
 * Inline YAML editor for a stored compose file. Fetches the raw content on
 * mount, saves via `composeApi.updateContent`, and calls `onSave()` on success.
 * Shared by the Compose Manager and the details-drawer edit action.
 */
export default function ComposeFileEditor({ file, onSave, onCancel }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    composeApi.getContent(file.file_id)
      .then(d => setContent(d.content))
      .catch(e => setError(e.message))
  }, [file.file_id])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await composeApi.updateContent(file.file_id, content)
      onSave()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="code-surface flex flex-col gap-2 overflow-hidden">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: BORDER, background: 'var(--surface-raised)' }}>
        <div className="flex items-center gap-2">
          <FileCode2 size={16} style={LABEL} />
          <span className="font-mono text-[13px]" style={PRIMARY}>{file.filename}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-xs">
            <Save size={12} />{saving ? 'Saving…' : 'Save'}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="btn-icon" aria-label="Cancel edit">
              <XCircle size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="infobar infobar-critical mx-3 py-2">
          <AlertCircle size={16} className="infobar-icon" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        spellCheck={false}
        rows={16}
        className="w-full font-mono text-[13px] leading-relaxed resize-none outline-none px-3 py-2"
        style={{ background: 'var(--surface-0)', color: 'var(--text-2)', border: 'none', tabSize: 2 }}
      />
    </div>
  )
}
