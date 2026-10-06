import { Select } from 'xedonium'

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
      <div className="min-w-0 flex-[3]">
      <Select
        className="w-full"
        aria-label="Compose file"
        value={selectedFileId}
        placeholder="— file —"
        onChange={v => onChange(v, '')}
        options={composeFiles.map(f => ({ value: f.file_id, label: labels[f.file_id] ?? f.filename }))}
      />
      </div>
      <div className="min-w-0 flex-[2]">
      <Select
        className="w-full"
        aria-label="Compose service"
        value={selectedService}
        placeholder="— service —"
        disabled={!selectedFileId}
        onChange={v => onChange(selectedFileId, v)}
        options={services.map(s => ({ value: s, label: s }))}
      />
      </div>
    </div>
  )
}
