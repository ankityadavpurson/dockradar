import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

const CONFIGS = {
  success: { icon: CheckCircle2,  color: 'var(--accent-teal)'  },
  error:   { icon: AlertCircle,   color: 'var(--accent-red)'   },
  warning: { icon: AlertTriangle, color: 'var(--accent-amber)' },
  info:    { icon: Info,          color: 'var(--accent)'       },
}

export default function Toast({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 left-6 sm:left-auto z-[300] flex flex-col items-end gap-2 pointer-events-none"
      aria-live="polite">
      {toasts.map(t => {
        const cfg = CONFIGS[t.type] ?? CONFIGS.info
        const Icon = cfg.icon
        return (
          <div key={t.id}
            role="status"
            className="flyout pointer-events-auto relative flex items-start gap-3 pl-5 pr-4 py-3 animate-scale_in cursor-pointer overflow-hidden text-[14px]"
            title="Dismiss"
            onClick={() => onDismiss?.(t.id)}
            style={{ color: 'var(--text-1)', maxWidth: '380px' }}>
            {/* Accent strip — notification style */}
            <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: cfg.color }} />
            <Icon size={16} className="mt-[2px]" style={{ color: cfg.color, flexShrink: 0 }} />
            <span className="break-words">{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}
