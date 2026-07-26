import { X } from 'lucide-react'
import { useEffect } from 'react'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

/**
 * Shared modal shell — one chrome for every centered dialog: overlay, panel,
 * header (title + close), scrollable body, optional footer. Closes on Escape
 * and backdrop click. Pass `title` as a string or a node.
 */
export default function Modal({
  title, onClose, size = 'md', footer, children, ariaLabel,
}) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : ariaLabel}
        className={`modal-panel ${SIZES[size] ?? SIZES.md}`}>

        {title !== undefined && (
          <div className="modal-header">
            <div className="min-w-0 flex-1">
              {typeof title === 'string'
                ? <span className="modal-title truncate block">{title}</span>
                : title}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="btn-icon shrink-0">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
