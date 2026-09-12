import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

const CONFIGS = {
  success: { icon: CheckCircle2, color: 'var(--accent-teal)',  border: 'rgba(80,227,194,0.2)'  },
  error:   { icon: AlertCircle,  color: 'var(--accent-red)',  border: 'rgba(255,68,68,0.2)'   },
  warning: { icon: AlertTriangle,color: 'var(--accent-amber)',  border: 'rgba(245,166,35,0.2)'  },
  info:    { icon: Info,         color: 'var(--text-3)',  border: 'var(--border-2)'        },
}

export default function Toast({ toasts = [], onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col items-end gap-2"
      aria-live="polite">
      {toasts.map(t => {
        const cfg = CONFIGS[t.type] ?? CONFIGS.info
        const Icon = cfg.icon
        return (
          <div key={t.id}
            role="status"
            className="flex items-center gap-3 px-4 py-3 rounded-lg animate-fade_in cursor-pointer"
            title="Dismiss"
            onClick={() => onDismiss?.(t.id)}
            style={{
              background: 'var(--surface-1)',
              border: `1px solid ${cfg.border}`,
              color: 'var(--text-1)',
              fontSize: '15px',
              maxWidth: '360px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
            <Icon size={14} style={{ color: cfg.color, flexShrink: 0 }} />
            <span>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}
