import { AlertCircle, CheckCircle2, ChevronDown, FileCode2, Link, Link2Off, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const BASE = '/api'

async function apiFetch(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function uploadFile(file) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/compose`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

function StatusMsg({ msg, isError, onDismiss }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded text-[12px]"
      style={isError
        ? { background: 'rgba(255,68,68,0.07)',   border: '1px solid rgba(255,68,68,0.18)',   color: '#ff4444' }
        : { background: 'rgba(80,227,194,0.07)', border: '1px solid rgba(80,227,194,0.18)', color: '#50e3c2' }
      }>
      {isError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
      <span className="flex-1 font-mono">{msg}</span>
      <button onClick={onDismiss} style={{ color: '#444' }}><X size={11} /></button>
    </div>
  )
}

/**
 * Build display labels for the file dropdown.
 * When two files share the same filename, append the first 8 chars of the
 * file_id (which is a timestamp prefix) so the user can tell them apart.
 * e.g. "docker-compose.yml · 17103842"
 */
function buildFileLabels(composeFiles) {
  const nameCount = {}
  for (const f of composeFiles) {
    nameCount[f.filename] = (nameCount[f.filename] || 0) + 1
  }
  return composeFiles.reduce((acc, f) => {
    acc[f.file_id] = nameCount[f.filename] > 1
      ? `${f.filename} · ${f.file_id.slice(0, 10)}`
      : f.filename
    return acc
  }, {})
}

function ServicePicker({ composeFiles, selectedFileId, selectedService, onChange }) {
  const file     = composeFiles.find(f => f.file_id === selectedFileId)
  const services = file?.services || []
  const labels   = buildFileLabels(composeFiles)

  const selectStyle = {
    background: '#0a0a0a', border: '1px solid #1a1a1a',
    color: '#888', borderRadius: '4px',
    padding: '4px 24px 4px 8px', fontSize: '11px', fontFamily: 'inherit',
    appearance: 'none', width: '100%', cursor: 'pointer',
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <select value={selectedFileId} onChange={e => onChange(e.target.value, '')} style={selectStyle}>
          <option value="">— file —</option>
          {composeFiles.map(f => (
            <option key={f.file_id} value={f.file_id}>{labels[f.file_id]}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#333' }} />
      </div>
      <div className="relative flex-1">
        <select value={selectedService} onChange={e => onChange(selectedFileId, e.target.value)}
          disabled={!selectedFileId} style={{ ...selectStyle, opacity: selectedFileId ? 1 : 0.4 }}>
          <option value="">— service —</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#333' }} />
      </div>
    </div>
  )
}

function ContainerRow({ container, association, composeFiles, onAssociate, onDisassociate }) {
  const [fileId,  setFileId]  = useState(association?.file_id || '')
  const [service, setService] = useState(association?.service_name || '')
  const [saving,  setSaving]  = useState(false)

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
    <div className="grid gap-2 px-3 py-2 rounded"
      style={{
        gridTemplateColumns: '1fr 2fr auto',
        background: hasAssociation ? 'rgba(255,255,255,0.02)' : 'transparent',
        border: `1px solid ${hasAssociation ? '#222' : '#111'}`,
      }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1 h-1 rounded-full shrink-0"
          style={{ background: container.status === 'running' ? '#50e3c2' : '#333' }} />
        <span className="font-mono text-[12px] truncate" style={{ color: '#aaa' }}
          title={container.name}>{container.name}</span>
      </div>

      <ServicePicker composeFiles={composeFiles} selectedFileId={fileId} selectedService={service}
        onChange={(fid, svc) => { setFileId(fid); setService(svc) }} />

      <div className="flex items-center gap-1">
        {canSave && (
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid #222' }}>
            <Link size={9} />{saving ? '…' : 'Link'}
          </button>
        )}
        {hasAssociation && !canSave && (
          <button onClick={() => onDisassociate(container.name)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono opacity-40 hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,68,68,0.05)', color: '#ff4444', border: '1px solid rgba(255,68,68,0.12)' }}>
            <Link2Off size={9} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function ComposeManager({ containers, onClose }) {
  const [composeFiles,  setComposeFiles]  = useState([])
  const [associations,  setAssociations]  = useState({})
  const [dragging,      setDragging]      = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [statusMsg,     setStatusMsg]     = useState(null)
  const [isError,       setIsError]       = useState(false)
  const fileInputRef = useRef()

  function notify(msg, error = false) { setStatusMsg(msg); setIsError(error) }

  async function refresh() {
    try {
      const [files, assocList] = await Promise.all([
        apiFetch('GET', '/compose'),
        apiFetch('GET', '/compose/associations'),
      ])
      setComposeFiles(files)
      const map = {}
      for (const a of assocList) map[a.container_name] = a
      setAssociations(map)
    } catch (e) { notify(`Failed to load: ${e.message}`, true) }
  }

  useEffect(() => { refresh() }, [])

  async function handleFiles(files) {
    const yamlFiles = [...files].filter(f => f.name.endsWith('.yml') || f.name.endsWith('.yaml'))
    if (!yamlFiles.length) { notify('Only .yml / .yaml files accepted.', true); return }
    setUploading(true)
    let uploaded = 0
    for (const f of yamlFiles) {
      try { await uploadFile(f); uploaded++ }
      catch (e) { notify(`Failed to upload ${f.name}: ${e.message}`, true) }
    }
    setUploading(false)
    if (uploaded > 0) notify(`Uploaded ${uploaded} file${uploaded > 1 ? 's' : ''}.`)
    await refresh()
  }

  async function handleDeleteFile(fileId) {
    try { await apiFetch('DELETE', `/compose/${fileId}`); notify('File deleted.'); await refresh() }
    catch (e) { notify(`Delete failed: ${e.message}`, true) }
  }

  async function handleAssociate(containerName, fileId, serviceName) {
    try {
      await apiFetch('POST', '/compose/associate', { container_name: containerName, file_id: fileId, service_name: serviceName })
      notify(`Linked ${containerName} → ${serviceName}`)
      await refresh()
    } catch (e) { notify(`Failed: ${e.message}`, true) }
  }

  async function handleDisassociate(containerName) {
    try { await apiFetch('DELETE', `/compose/associate/${containerName}`); notify('Link removed.'); await refresh() }
    catch (e) { notify(`Failed: ${e.message}`, true) }
  }

  const linkedCount = Object.keys(associations).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="flex flex-col w-full max-w-2xl mx-4 rounded-xl overflow-hidden"
        style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2">
            <FileCode2 size={14} style={{ color: '#666' }} />
            <span className="text-[14px] font-medium" style={{ color: '#ededed' }}>Compose Files</span>
            {composeFiles.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: '#111', color: '#7c7c7c', border: '1px solid #1a1a1a' }}>
                {composeFiles.length}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ color: '#666' }}
            onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
            onMouseLeave={e => e.currentTarget.style.color = '#666'}>
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <StatusMsg msg={statusMsg} isError={isError} onDismiss={() => setStatusMsg(null)} />

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg cursor-pointer transition-all"
            style={{
              border: `1px dashed ${dragging ? '#555' : '#1a1a1a'}`,
              background: dragging ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}>
            <Upload size={18} style={{ color: dragging ? '#888' : '#333' }} />
            <span className="text-[12px] font-mono" style={{ color: dragging ? '#aaa' : '#666' }}>
              {uploading ? 'Uploading…' : 'Drop compose files here, or click to browse'}
            </span>
            <span className="text-[10px]" style={{ color: '#333' }}>.yml / .yaml only</span>
          </div>
          <input ref={fileInputRef} type="file" accept=".yml,.yaml" multiple className="hidden"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

          {/* File list */}
          {composeFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: '#333' }}>
                Stored files
              </span>
              {(() => {
                const labels = buildFileLabels(composeFiles)
                return composeFiles.map(f => (
                  <div key={f.file_id} className="flex items-center justify-between px-3 py-2 rounded"
                    style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode2 size={12} style={{ color: '#5a5a5a', flexShrink: 0 }} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[12px] truncate" style={{ color: '#aaa' }}>
                          {f.filename}
                        </span>
                        {labels[f.file_id] !== f.filename && (
                          <span className="font-mono text-[9px]" style={{ color: '#606060' }}>
                            #{f.file_id.slice(0, 10)}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] shrink-0" style={{ color: '#606060' }}>
                        {f.services.length} service{f.services.length !== 1 ? 's' : ''}: {f.services.slice(0, 4).join(', ')}{f.services.length > 4 ? '…' : ''}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteFile(f.file_id)}
                      className="ml-2 shrink-0 transition-colors" style={{ color: '#5a5a5a' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ff4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#5a5a5a'}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              })()}
            </div>
          )}

          {/* Associations */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: '#333' }}>
              Container associations
            </span>
            {composeFiles.length === 0 ? (
              <p className="text-[12px] font-mono py-2" style={{ color: '#333' }}>
                Upload a compose file above to start linking containers.
              </p>
            ) : containers.length === 0 ? (
              <p className="text-[12px] font-mono py-2" style={{ color: '#333' }}>
                No containers found. Run a scan first.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {containers.map(c => (
                  <ContainerRow key={c.name} container={c} association={associations[c.name]}
                    composeFiles={composeFiles} onAssociate={handleAssociate} onDisassociate={handleDisassociate} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 text-[11px] font-mono"
          style={{ borderTop: '1px solid #1a1a1a', color: '#666' }}>
          <span>{linkedCount} container{linkedCount !== 1 ? 's' : ''} linked</span>
          <button onClick={onClose} className="px-3 py-1 rounded transition-colors"
            style={{ border: '1px solid #1a1a1a', color: '#777' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#555' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
