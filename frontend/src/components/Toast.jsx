import XToast from 'xedonium/Toast'

export default function Toast({ toasts = [], onDismiss }) {
  return <XToast toasts={toasts} onClose={onDismiss} position="bottom-right" />
}
