import { useEffect, useRef } from 'react'
import Modal from './Modal'

export default function ConfirmDialog({
  open, title, message, onConfirm, onCancel,
  confirmLabel = 'Confirm', confirmClass = 'btn-primary',
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={<>
        <button ref={confirmRef} className={`btn ${confirmClass} btn-sm`} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <p className="text-[14px] whitespace-pre-line" style={{ color: 'var(--text-3)' }}>{message}</p>
    </Modal>
  )
}
