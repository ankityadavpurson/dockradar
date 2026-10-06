import { useEffect, useState } from 'react'
import { Alert, Button, FileCode2Icon, LinkIcon } from 'xedonium'
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
    <span className="block min-w-0 normal-case tracking-normal">
      <span className="block truncate">Link compose file — {container.name}</span>
      <span className="block truncate text-xs font-normal text-app-muted">
        Use <code>docker compose</code> to update this container.
      </span>
    </span>
  )

  const footer = (
    <>
      <span className="flex-1 text-[13px] text-app-muted">
        {composeFiles.length === 0
          ? 'No compose files stored yet.'
          : 'Select the file and service that defines this container.'}
      </span>
      <Button onClick={handleLink} disabled={!canLink} className="inline-flex items-center gap-1.5">
        <LinkIcon className="h-[13px] w-[13px] shrink-0" />{saving ? 'Linking…' : 'Link'}
      </Button>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} size="md" footer={footer} ariaLabel={`Link compose file for ${container.name}`}>
      {error && <Alert tone="danger"><span className="break-words">{error}</span></Alert>}

      {loading ? (
        <div className="py-6 text-center text-sm text-app-muted">Loading compose files…</div>
      ) : composeFiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <FileCode2Icon className="h-7 w-7 shrink-0 text-app-muted" />
          <p className="text-sm text-app-soft">Upload a compose file first, then come back to link it.</p>
          {onOpenManager && <Button onClick={onOpenManager}>Open Compose Manager</Button>}
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
