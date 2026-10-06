import { ConfirmDialog as XConfirmDialog } from 'xedonium'

export default function ConfirmDialog({
  open, title, message, onConfirm, onCancel,
  confirmLabel = 'Confirm', danger = false,
}) {
  return (
    <XConfirmDialog
      open={!!open}
      title={title}
      tone={danger ? 'danger' : 'default'}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onClose={onCancel}
    >
      <p className="whitespace-pre-line">{message}</p>
    </XConfirmDialog>
  )
}
