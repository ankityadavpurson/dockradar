import {
  AlertCircle, CheckCircle2, ChevronDown, ClipboardCopy,
  Download, Edit2, FileCode2, Link, Link2Off,
  Trash2, Upload, X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { composeApi } from '../api/client'
import ComposeFileEditor from './ComposeFileEditor'
import ServicePicker from './ServicePicker'

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  section: { color: 'var(--text-4)' },
  label: { color: 'var(--text-3)' },
  primary: { color: 'var(--text-1)' },
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatusMsg({ msg, isError, onDismiss }) {
  if (!msg) return null
  return (
    <div role={isError ? 'alert' : 'status'}
      className={`infobar ${isError ? 'infobar-critical' : 'infobar-success'} items-center py-2`}>
      {isError ? <AlertCircle size={16} className="infobar-icon !mt-0" /> : <CheckCircle2 size={16} className="infobar-icon !mt-0" />}
      <span className="flex-1 break-words">{msg}</span>
      <button onClick={onDismiss} className="icon-btn-subtle shrink-0" aria-label="Dismiss message"><X size={16} /></button>
    </div>
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
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: 'var(--accent-teal)' }} />
          <span className="section-label">Update complete</span>
        </div>
        <button onClick={onClose} className="btn-icon" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>

      <p className="text-[14px]" style={S.label}>
        Download or copy the updated <span className="font-mono" style={S.primary}>{file.filename}</span> compose file.
      </p>

      <div className="flex gap-2">
        <button onClick={handleDownload} className="btn btn-primary btn-sm flex-1 justify-center">
          <Download size={13} />
          Download .yml
        </button>

        <button onClick={handleCopy} disabled={!content} className="btn btn-blue btn-sm flex-1 justify-center">
          <ClipboardCopy size={13} />
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>
    </div>
  )
}

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
    <div className="grid gap-2 px-3 py-2 items-center hover:bg-[var(--hover-bg)]"
      style={{ gridTemplateColumns: '1fr 2fr auto' }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full shrink-0"
          style={{ background: container.status === 'running' ? 'var(--accent-teal)' : 'var(--text-4)' }} />
        <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-1)' }}
          title={container.name}>{container.name}</span>
      </div>

      <ServicePicker composeFiles={composeFiles} labels={labels} selectedFileId={fileId} selectedService={service}
        onChange={(fid, svc) => { setFileId(fid); setService(svc) }} />

      <div className="flex items-center gap-1">
        {canSave && (
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-xs">
            <Link size={12} />{saving ? '…' : 'Link'}
          </button>
        )}
        {hasAssociation && !canSave && (
          <button onClick={() => onDisassociate(container.name)}
            className="icon-btn-subtle is-danger"
            title={`Unlink ${container.name}`} aria-label={`Unlink ${container.name}`}>
            <Link2Off size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ComposeManager({ containers, onClose, lastUpdatedFile }) {
  const [composeFiles, setComposeFiles] = useState([])
  const [associations, setAssociations] = useState({})
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [statusMsg, setStatusMsg] = useState(null)
  const [isError, setIsError] = useState(false)
  const [editingFile, setEditingFile] = useState(null)   // ComposeFile being edited
  const [downloadFile, setDownloadFile] = useState(null)   // ComposeFile for download panel
  const [showStoredFiles, setShowStoredFiles] = useState(false)
  const fileInputRef = useRef()

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

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  return (
    <div className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="modal-panel max-w-2xl"
        role="dialog" aria-modal="true" aria-label="Compose files">

        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <FileCode2 size={20} style={{ color: 'var(--accent)' }} />
            <span className="modal-title">Compose files</span>
            {composeFiles.length > 0 && (
              <span className="badge badge-neutral tabular-nums">
                {composeFiles.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close compose manager">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body flex-1">
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
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                className="flex flex-col items-center justify-center gap-2 py-7 cursor-pointer transition-colors hover:bg-[var(--hover-bg)]"
                style={{
                  borderRadius: 'var(--radius-overlay)',
                  border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border-3)'}`,
                  background: dragging ? 'var(--accent-subtle)' : 'var(--surface-raised)',
                }}>
                <Upload size={24} style={{ color: dragging ? 'var(--accent)' : 'var(--text-3)' }} />
                <span className="text-[14px]"
                  style={{ color: 'var(--text-1)' }}>
                  {uploading ? 'Uploading…' : 'Drop compose files here, or select to browse'}
                </span>
                <span className="caption">.yml / .yaml only</span>
              </div>
              <input ref={fileInputRef} type="file" accept=".yml,.yaml" multiple className="hidden"
                onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

              {/* File list */}
              {composeFiles.length > 0 && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setShowStoredFiles(!showStoredFiles)}
                    aria-expanded={showStoredFiles}
                    className="flex items-center justify-between gap-2 px-2 -mx-2 min-h-[32px] rounded hover:bg-[var(--hover-bg)] transition-colors">
                    <span className="section-label">Stored files</span>
                    <ChevronDown size={16} className={`transition-transform ${showStoredFiles ? 'rotate-180' : ''}`} style={S.label} />
                  </button>
                  {showStoredFiles && composeFiles.map(f => (
                    <div key={f.file_id} className="flex items-center justify-between px-3 py-2 hover:bg-[var(--hover-bg)]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCode2 size={16} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[13px] truncate" style={{ color: 'var(--text-1)' }}>
                            {f.filename}
                          </span>
                          {labels[f.file_id] !== f.filename && (
                            <span className="font-mono text-[11px]" style={S.section}>
                              #{f.file_id.slice(0, 10)}
                            </span>
                          )}
                        </div>
                        <span className="caption shrink-0">
                          {f.services.length} service{f.services.length !== 1 ? 's' : ''}: {f.services.slice(0, 4).join(', ')}{f.services.length > 4 ? '…' : ''}
                        </span>
                      </div>

                      {/* File actions: Edit · Download · Delete */}
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button onClick={() => setEditingFile(f)}
                          title="Edit file content" aria-label={`Edit ${f.filename}`}
                          className="icon-btn-subtle">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDownloadFile(f)}
                          title="Download file" aria-label={`Download ${f.filename}`}
                          className="icon-btn-subtle">
                          <Download size={14} />
                        </button>
                        <button onClick={() => handleDeleteFile(f.file_id)}
                          title="Delete file" aria-label={`Delete ${f.filename}`}
                          className="icon-btn-subtle is-danger">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Container associations */}
              <div className="flex flex-col gap-1">
                <span className="section-label mb-1">Container associations</span>
                {composeFiles.length === 0 ? (
                  <p className="text-[14px] py-2" style={S.label}>
                    Upload a compose file above to start linking containers.
                  </p>
                ) : containers.length === 0 ? (
                  <p className="text-[14px] py-2" style={S.label}>
                    No containers found. Run a scan first.
                  </p>
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
        </div>

        {/* Footer */}
        <div className="modal-footer justify-between">
          <span className="text-[13px]" style={S.label}>
            {linkedCount} container{linkedCount !== 1 ? 's' : ''} linked
          </span>
          <div className="flex items-center gap-2">
            {editingFile && (
              <button onClick={() => setEditingFile(null)} className="btn btn-ghost btn-sm">
                ← Back
              </button>
            )}
            <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
