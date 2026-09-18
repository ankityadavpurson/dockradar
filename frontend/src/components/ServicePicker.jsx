import { ChevronDown } from 'lucide-react'

const LABEL = { color: 'var(--text-3)' }

/**
 * Two linked selects: pick a stored compose file, then a service inside it.
 * `onChange(fileId, serviceName)` fires on either change (service resets to ''
 * when the file changes). Shared by the Compose Manager and the focused
 * per-container link dialog.
 */
export default function ServicePicker({ composeFiles, labels = {}, selectedFileId, selectedService, onChange }) {
  const file = composeFiles.find(f => f.file_id === selectedFileId)
  const services = file?.services || []

  return (
    <div className="flex gap-2">
      <div className="relative flex-1 min-w-0">
        <select value={selectedFileId} onChange={e => onChange(e.target.value, '')} className="select"
          aria-label="Compose file">
          <option value="">— file —</option>
          {composeFiles.map(f => (
            <option key={f.file_id} value={f.file_id}>
              {labels[f.file_id] ?? f.filename}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={LABEL} />
      </div>
      <div className="relative flex-1 min-w-0">
        <select value={selectedService} onChange={e => onChange(selectedFileId, e.target.value)}
          disabled={!selectedFileId} className="select"
          aria-label="Compose service">
          <option value="">— service —</option>
          {services.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={LABEL} />
      </div>
    </div>
  )
}
