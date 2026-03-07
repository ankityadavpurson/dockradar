import React from 'react'
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const CONFIG = {
  success: { icon: CheckCircle,   bg: 'bg-accent-green/10 border-accent-green/30',  text: 'text-accent-green' },
  error:   { icon: AlertCircle,   bg: 'bg-accent-red/10 border-accent-red/30',       text: 'text-accent-red' },
  warning: { icon: AlertTriangle, bg: 'bg-accent-yellow/10 border-accent-yellow/30', text: 'text-accent-yellow' },
  info:    { icon: Info,          bg: 'bg-accent-blue/10 border-accent-blue/30',      text: 'text-accent-blue' },
}

export default function Toast({ toast }) {
  if (!toast) return null
  const { icon: Icon, bg, text } = CONFIG[toast.type] || CONFIG.info

  return (
    <div className={`
      fixed bottom-6 right-6 z-[100] flex items-center gap-3
      px-4 py-3 rounded-xl border backdrop-blur-xl
      font-display text-[13px] font-semibold text-ink-primary
      shadow-[0_8px_32px_rgba(0,0,0,0.5)]
      animate-fade_in
      ${bg}
    `}>
      <Icon size={16} className={text} />
      {toast.msg}
    </div>
  )
}
