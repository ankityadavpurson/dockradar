import { AlertCircle } from 'lucide-react'
import Modal from './Modal'

/**
 * Shows why a scan couldn't determine a container's update status. Opened by
 * clicking the red "Error" status pill in the container list.
 */
export default function ErrorDetailDialog({ container, onClose }) {
  const title = (
    <div className="min-w-0">
      <div className="modal-title truncate">
        Scan error — <span style={{ color: 'var(--accent)' }}>{container.name}</span>
      </div>
      <div className="text-[12px] font-mono truncate" style={{ color: 'var(--text-3)' }}>
        {container.repository}:{container.tag}
      </div>
    </div>
  )

  const footer = (
    <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
  )

  return (
    <Modal title={title} onClose={onClose} size="md" footer={footer}
      ariaLabel={`Scan error for ${container.name}`}>
      <div role="alert" className="infobar infobar-critical items-start">
        <AlertCircle size={16} className="infobar-icon" />
        <span className="break-words">
          {container.error_message
            || 'The last scan could not determine this container’s update status.'}
        </span>
      </div>

      <p className="text-[13px] mt-3 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        DockRadar couldn’t check this image against its registry, so its update
        status is unknown. Common causes: the image is private (needs
        authentication), the repository was renamed or removed, or the registry
        was unreachable. Fix access and run a scan again.
      </p>
    </Modal>
  )
}
