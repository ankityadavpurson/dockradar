import { AlertCircle, FileCode2, Link } from 'lucide-react'
import { useEffect, useState } from 'react'
import { composeApi } from '../api/client'
import Modal from './Modal'
import ServicePicker from './ServicePicker'

// Disambiguate files that share a filename (same rule as the Compose Manager).
function buildFileLabels(composeFiles) {
  const nameCount = {}
  for (const f of composeFiles) nameCount[f.filename] = (nameCount[f.filename] || 0) + 1
  return composeFiles.reduce((acc, f) => {
    acc[f.file_id] = nameCount[f.filename] > 1
      ? `${f.filename} · ${f.file_id.slice(0, 10)}`
      : f.filename
    return acc
  }, {})
}

/**
 * Focused per-container linker: pick a stored compose file + service and link
 * this container to it. Uploading new files still lives in the full Compose
 * Manager, reachable via `onOpenManager` when no files are stored yet.
 */
export default function ComposeLinkDialog({ container, onLinked, onClose, onOpenManager }) {
  const [composeFiles, setComposeFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [fileId, setFileId] = useState('')
  const [service, setService] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    composeApi.list()
      .then(files => setComposeFiles(files))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const labels = buildFileLabels(composeFiles)
  const canLink = fileId && service && !saving

  async function handleLink() {
    setSaving(true)
    setError(null)
    try {
      await composeApi.associate(container.name, fileId, service)
      onLinked()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const title = (
    <div className="min-w-0">
      <div className="modal-title truncate">
        Link compose file — <span style={{ color: 'var(--accent)' }}>{container.name}</span>
      </div>
      <div className="text-[12px] truncate" style={{ color: 'var(--text-3)' }}>
        Use <code>docker compose</code> to update this container.
      </div>
    </div>
  )

  const footer = (
    <>
      <span className="flex-1 text-[13px]" style={{ color: 'var(--text-3)' }}>
        {composeFiles.length === 0
          ? 'No compose files stored yet.'
          : 'Select the file and service that defines this container.'}
      </span>
      <button className="btn btn-primary btn-sm" onClick={handleLink} disabled={!canLink}>
        <Link size={13} />{saving ? 'Linking…' : 'Link'}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} size="md" footer={footer} ariaLabel={`Link compose file for ${container.name}`}>
      {error && (
        <div role="alert" className="infobar infobar-critical">
          <AlertCircle size={16} className="infobar-icon" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-[14px] text-center py-6" style={{ color: 'var(--text-3)' }}>
          Loading compose files…
        </div>
      ) : composeFiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <FileCode2 size={28} style={{ color: 'var(--text-3)' }} />
          <p className="text-[14px]" style={{ color: 'var(--text-2)' }}>
            Upload a compose file first, then come back to link it.
          </p>
          {onOpenManager && (
            <button className="btn btn-primary btn-sm" onClick={onOpenManager}>
              Open Compose Manager
            </button>
          )}
        </div>
      ) : (
        <ServicePicker
          composeFiles={composeFiles}
          labels={labels}
          selectedFileId={fileId}
          selectedService={service}
          onChange={(fid, svc) => { setFileId(fid); setService(svc) }}
        />
      )}
    </Modal>
  )
}
