import React from 'react'

export default function ConfirmDialog({
  open, title, message, onConfirm, onCancel,
  confirmLabel = 'Confirm', confirmClass = 'btn-primary',
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>

      <div className="w-full max-w-sm mx-4 rounded-xl p-6 flex flex-col gap-5"
        style={{ background: '#111', border: '1px solid #222' }}>

        <div>
          <h2 className="text-[15px] font-semibold mb-2" style={{ color: '#ededed' }}>{title}</h2>
          <p className="text-[13px] whitespace-pre-line" style={{ color: '#666' }}>{message}</p>
        </div>

        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn ${confirmClass} btn-sm`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
