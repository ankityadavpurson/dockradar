import { Toast as XToast } from 'xedonium'

export default function Toast({ toasts = [], onDismiss }) {
  return <XToast toasts={toasts} onClose={onDismiss} position="bottom-right" />
}
