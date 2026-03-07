import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Proceed', confirmClass = 'btn-green' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         onClick={onCancel}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* dialog */}
      <div
        className="relative w-full max-w-md bg-bg-card border border-border rounded-2xl p-8
                   shadow-[0_25px_60px_rgba(0,0,0,0.6)] animate-fade_in"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-ink-secondary hover:text-ink-primary transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20
                          flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-accent-yellow" />
          </div>
          <div>
            <h2 className="text-[18px] font-display font-bold text-ink-primary mb-1">{title}</h2>
            <p className="text-[13px] text-ink-secondary leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={onConfirm} className={`btn ${confirmClass} btn-sm`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
