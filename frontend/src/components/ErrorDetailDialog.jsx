import { Alert, Button } from 'xedonium'
import Modal from './Modal'

/**
 * Shows why a scan couldn't determine a container's update status. Opened by
 * clicking the red "Error" status pill in the container list.
 */
export default function ErrorDetailDialog({ container, onClose }) {
  const title = (
    <span className="block min-w-0 normal-case tracking-normal">
      <span className="block truncate">Scan error — {container.name}</span>
      <span className="block truncate font-mono text-xs font-normal text-app-muted">
        {container.repository}:{container.tag}
      </span>
    </span>
  )

  return (
    <Modal title={title} onClose={onClose} size="md"
      footer={<Button onClick={onClose}>Close</Button>}
      ariaLabel={`Scan error for ${container.name}`}>
      <Alert tone="danger">
        <span className="break-words">
          {container.error_message
            || 'The last scan could not determine this container’s update status.'}
        </span>
      </Alert>

      <p className="text-[13px] leading-relaxed text-app-muted">
        DockRadar couldn’t check this image against its registry, so its update
        status is unknown. Common causes: the image is private (needs
        authentication), the repository was renamed or removed, or the registry
        was unreachable. Fix access and run a scan again.
      </p>
    </Modal>
  )
}
