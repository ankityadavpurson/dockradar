import React from 'react'
import { Clock, Mail } from 'lucide-react'

export default function InfoBar({ health }) {
  if (!health) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2 mb-4 text-[11px] font-mono rounded-md"
      style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', color: '#666' }}>

      <span className="flex items-center gap-1.5">
        <Clock size={11} style={{ color: '#606060' }} />
        Scan every{' '}
        <span style={{ color: '#888' }}>{health.scan_interval_hours}h</span>
      </span>

      <div className="w-px h-3" style={{ background: '#1a1a1a' }} />

      <span className="flex items-center gap-1.5">
        <Mail size={11} style={{ color: '#606060' }} />
        Email{' '}
        <span style={{ color: health.email_configured ? '#50e3c2' : '#666' }}>
          {health.email_configured ? 'configured' : 'not configured'}
        </span>
      </span>
    </div>
  )
}
