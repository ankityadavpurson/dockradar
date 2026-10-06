import { useCallback, useEffect, useState } from 'react'
import { Alert, Badge, Button, CheckCircleIcon, ChevronDownIcon, CopyIcon, DownloadIcon, EditIcon, FileCode2Icon, FileUpload, LinkIcon, Trash2Icon, UnlinkIcon } from 'xedonium'
import { composeApi } from '../api/client'
import ComposeFileEditor from './ComposeFileEditor'
import Modal from './Modal'
import ServicePicker from './ServicePicker'

// ── Helper components ─────────────────────────────────────────────────────────

function StatusMsg({ msg, isError, onDismiss }) {
  if (!msg) return null
  return (
    <Alert tone={isError ? 'danger' : 'success'} onClose={onDismiss}>
      <span className="break-words">{msg}</span>
    </Alert>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <span className={`text-xs font-semibold uppercase tracking-widest text-app-muted ${className}`}>
      {children}
    </span>
  )
}

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

// ── Post-update download panel ────────────────────────────────────────────────

function DownloadPanel({ file, onClose }) {
  const [copied, setCopied] = useState(false)
  const [content, setContent] = useState(null)

  useEffect(() => {
    composeApi.getContent(file.file_id)
      .then(d => setContent(d.content))
      .catch(() => { })
  }, [file.file_id])

  function handleDownload() {
    window.open(`/api/compose/${file.file_id}/download`, '_blank')
  }

  async function handleCopy() {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for non-https
      const el = document.createElement('textarea')
      el.value = content
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Alert tone="success" title="Update complete" onClose={onClose} icon={<CheckCircleIcon className="h-4 w-4 shrink-0" />}>
      <p className="mb-3">
        Download or copy the updated <span className="font-mono font-semibold">{file.filename}</span> compose file.
      </p>
      <div className="flex gap-2">
        <Button onClick={handleDownload} className="inline-flex flex-1 items-center justify-center gap-2">
          <DownloadIcon className="h-[13px] w-[13px] shrink-0" />
          Download .yml
        </Button>
        <Button variant="secondary" onClick={handleCopy} disabled={!content}
          className="inline-flex flex-1 items-center justify-center gap-2">
          <CopyIcon className="h-[13px] w-[13px] shrink-0" />
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
      </div>
    </Alert>
  )
}

// Square icon button sized to match the selects (38px tall) beside it.
const ICON_BTN = 'inline-flex !h-[38px] !w-[38px] items-center justify-center !p-0'

// ── Container row ─────────────────────────────────────────────────────────────

function ContainerRow({ container, association, composeFiles, labels, onAssociate, onDisassociate }) {
  const [fileId, setFileId] = useState(association?.file_id || '')
  const [service, setService] = useState(association?.service_name || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFileId(association?.file_id || '')
    setService(association?.service_name || '')
  }, [association])

  const hasAssociation = !!association
  const canSave = fileId && service &&
    (fileId !== association?.file_id || service !== association?.service_name)

  async function handleSave() {
    setSaving(true)
    try { await onAssociate(container.name, fileId, service) }
    finally { setSaving(false) }
  }

  return (
    <div className="-mx-3 grid items-center gap-3 px-3 py-2 hover:bg-app-bg"
      style={{ gridTemplateColumns: 'minmax(0, 7rem) minmax(0, 1fr) 38px' }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${container.status === 'running' ? 'bg-emerald-500' : 'bg-app-border'}`} />
        <span className="truncate text-sm font-semibold text-app-text" title={container.name}>{container.name}</span>
      </div>

      <ServicePicker composeFiles={composeFiles} labels={labels} selectedFileId={fileId} selectedService={service}
        onChange={(fid, svc) => { setFileId(fid); setService(svc) }} />

      <div className="flex items-center justify-end gap-1">
        {canSave && (
          <Button onClick={handleSave} disabled={saving} tooltip={`Link ${container.name}`}
            aria-label={`Link ${container.name}`} className={ICON_BTN}>
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
          </Button>
        )}
        {hasAssociation && !canSave && (
          <Button variant="danger" onClick={() => onDisassociate(container.name)}
            tooltip={`Unlink ${container.name}`} aria-label={`Unlink ${container.name}`}
            className={ICON_BTN}>
            <UnlinkIcon className="h-3.5 w-3.5 shrink-0" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComposeManager({ containers, onClose, lastUpdatedFile }) {
  const [composeFiles, setComposeFiles] = useState([])
  const [associations, setAssociations] = useState({})
  const [uploadKey, setUploadKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null)
  const [isError, setIsError] = useState(false)
  const [editingFile, setEditingFile] = useState(null)   // ComposeFile being edited
  const [downloadFile, setDownloadFile] = useState(null)   // ComposeFile for download panel
  const [showStoredFiles, setShowStoredFiles] = useState(false)

  function notify(msg, error = false) { setStatusMsg(msg); setIsError(error) }

  const refresh = useCallback(async () => {
    try {
      const [files, assocList] = await Promise.all([
        composeApi.list(),
        composeApi.associations(),
      ])
      setComposeFiles(files)
      const map = {}
      for (const a of assocList) map[a.container_name] = a
      setAssociations(map)
    } catch (e) { notify(`Failed to load: ${e.message}`, true) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // If a compose update just finished, auto-open the download panel for the relevant file
  useEffect(() => {
    if (lastUpdatedFile) {
      setDownloadFile(lastUpdatedFile)
    }
  }, [lastUpdatedFile])

  async function handleFiles(files) {
    const yamlFiles = [...files].filter(f => f.name.endsWith('.yml') || f.name.endsWith('.yaml'))
    if (!yamlFiles.length) { notify('Only .yml / .yaml files accepted.', true); return }
    setUploading(true)
    let uploaded = 0
    for (const f of yamlFiles) {
      try { await composeApi.upload(f); uploaded++ }
      catch (e) { notify(`Failed to upload ${f.name}: ${e.message}`, true) }
    }
    setUploading(false)
    if (uploaded > 0) notify(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''}.`)
    await refresh()
    setUploadKey(k => k + 1)
  }

  async function handleDeleteFile(fileId) {
    try { await composeApi.deleteFile(fileId); notify('File deleted.'); await refresh() }
    catch (e) { notify(`Delete failed: ${e.message}`, true) }
  }

  async function handleAssociate(containerName, fileId, serviceName) {
    try {
      await composeApi.associate(containerName, fileId, serviceName)
      notify(`Linked ${containerName} → ${serviceName}`)
      await refresh()
    } catch (e) { notify(`Failed: ${e.message}`, true) }
  }

  async function handleDisassociate(containerName) {
    try { await composeApi.disassociate(containerName); notify('Link removed.'); await refresh() }
    catch (e) { notify(`Failed: ${e.message}`, true) }
  }

  function handleEditorSave() {
    setEditingFile(null)
    notify('Compose file saved.')
    refresh()
  }

  const linkedCount = Object.keys(associations).length
  const labels = buildFileLabels(composeFiles)

  const title = (
    <span className="flex items-center gap-2.5">
      <FileCode2Icon className="h-5 w-5 shrink-0" />
      <span>Compose files</span>
      {composeFiles.length > 0 && <Badge badgeContent={composeFiles.length} color="secondary" />}
    </span>
  )

  const footer = (
    <>
      <span className="flex-1 text-[13px] text-app-muted">
        {linkedCount} container{linkedCount !== 1 ? 's' : ''} linked
      </span>
      {editingFile && (
        <Button variant="secondary" onClick={() => setEditingFile(null)}>← Back</Button>
      )}
      <Button variant="secondary" onClick={onClose}>Close</Button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} size="lg" footer={footer} ariaLabel="Compose files">
      <StatusMsg msg={statusMsg} isError={isError} onDismiss={() => setStatusMsg(null)} />

      {/* Post-update download panel */}
      {downloadFile && (
        <DownloadPanel
          file={downloadFile}
          onClose={() => setDownloadFile(null)}
        />
      )}

      {/* Inline editor — shown when editing a file */}
      {editingFile ? (
        <ComposeFileEditor
          file={editingFile}
          onSave={handleEditorSave}
          onCancel={() => setEditingFile(null)}
        />
      ) : (
        <>
          {/* Drop zone — keyed so the picked-file list resets after each upload */}
          <FileUpload
            key={uploadKey}
            label={uploading ? 'Uploading…' : 'Drop compose files here, or select to browse (.yml / .yaml)'}
            accept=".yml,.yaml"
            multiple
            disabled={uploading}
            onChange={handleFiles}
          />

          {/* File list */}
          {composeFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setShowStoredFiles(!showStoredFiles)}
                aria-expanded={showStoredFiles}
                className="-mx-3 flex min-h-[32px] items-center justify-between gap-2 px-3 transition-colors hover:bg-app-bg">
                <SectionLabel>Stored files</SectionLabel>
                <ChevronDownIcon className={`h-4 w-4 shrink-0 text-app-muted transition-transform ${showStoredFiles ? 'rotate-180' : ''}`} />
              </button>
              {showStoredFiles && composeFiles.map(f => (
                <div key={f.file_id} className="-mx-3 flex items-center justify-between px-3 py-2 hover:bg-app-bg">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <FileCode2Icon className="h-4 w-4 shrink-0 text-app-soft" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-[13px] text-app-text">{f.filename}</span>
                      {labels[f.file_id] !== f.filename && (
                        <span className="font-mono text-[11px] text-app-muted">#{f.file_id.slice(0, 10)}</span>
                      )}
                    </div>
                    <span className="w-48 shrink-0 truncate text-xs text-app-muted"
                      title={f.services.join(', ')}>
                      {f.services.length} service{f.services.length !== 1 ? 's' : ''}: {f.services.slice(0, 4).join(', ')}{f.services.length > 4 ? '…' : ''}
                    </span>
                  </div>

                  {/* File actions: Edit · Download · Delete */}
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <Button variant="flat" onClick={() => setEditingFile(f)}
                      tooltip="Edit file content" aria-label={`Edit ${f.filename}`} className="!p-1.5">
                      <EditIcon className="h-3.5 w-3.5 shrink-0" />
                    </Button>
                    <Button variant="flat" onClick={() => setDownloadFile(f)}
                      tooltip="Download file" aria-label={`Download ${f.filename}`} className="!p-1.5">
                      <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
                    </Button>
                    <Button variant="danger" onClick={() => handleDeleteFile(f.file_id)}
                      tooltip="Delete file" aria-label={`Delete ${f.filename}`} className="!p-1.5">
                      <Trash2Icon className="h-3.5 w-3.5 shrink-0" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Container associations */}
          <div className="flex flex-col gap-1">
            <SectionLabel className="mb-1">Container associations</SectionLabel>
            {composeFiles.length === 0 ? (
              <p className="py-2 text-sm text-app-muted">Upload a compose file above to start linking containers.</p>
            ) : containers.length === 0 ? (
              <p className="py-2 text-sm text-app-muted">No containers found. Run a scan first.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {containers.map(c => (
                  <ContainerRow key={c.name} container={c} association={associations[c.name]}
                    composeFiles={composeFiles} labels={labels} onAssociate={handleAssociate}
                    onDisassociate={handleDisassociate} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
