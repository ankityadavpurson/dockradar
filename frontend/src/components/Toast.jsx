import React from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const CONFIGS = {
  success: { icon: CheckCircle2, color: '#50e3c2',  border: 'rgba(80,227,194,0.2)'  },
  error:   { icon: AlertCircle,  color: '#ff4444',  border: 'rgba(255,68,68,0.2)'   },
  warning: { icon: AlertTriangle,color: '#f5a623',  border: 'rgba(245,166,35,0.2)'  },
  info:    { icon: Info,         color: '#888',     border: '#222'                  },
}

export default function Toast({ toast }) {
  if (!toast) return null
  const cfg = CONFIGS[toast.type] ?? CONFIGS.info
  const Icon = cfg.icon

  return (
    <div key={toast.id}
      className="fixed bottom-6 right-6 z-[300] flex items-center gap-3 px-4 py-3 rounded-lg animate-fade_in"
      style={{
        background: '#111',
        border: `1px solid ${cfg.border}`,
        color: '#ededed',
        fontSize: '13px',
        maxWidth: '360px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
      <Icon size={14} style={{ color: cfg.color, shrink: 0 }} />
      <span>{toast.msg}</span>
    </div>
  )
}
