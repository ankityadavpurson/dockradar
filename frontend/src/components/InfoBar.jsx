import React from 'react'
import { Clock, History, Mail } from 'lucide-react'

/** "3m ago" style age for a past ISO timestamp; null → 'never'. */
function timeAgo(iso) {
  if (!iso) return 'never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'never'
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function InfoBar({ health }) {
  if (!health) return null

  const lastScan = timeAgo(health.last_scan)

  return (
    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 px-4 py-2 mb-4 text-[14px] font-mono rounded-md"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid #1a1a1a', color: '#8a8a8a' }}>

      <span className="flex items-center gap-1.5">
        <Clock size={11} style={{ color: '#7a7a7a' }} />
        Scan every{' '}
        <span style={{ color: '#bbb' }}>{health.scan_interval_hours}h</span>
      </span>

      <div className="w-px h-3" style={{ background: '#1a1a1a' }} />

      <span className="flex items-center gap-1.5"
        title={health.last_scan ? new Date(health.last_scan).toLocaleString() : undefined}>
        <History size={11} style={{ color: '#7a7a7a' }} />
        Last scan{' '}
        <span style={{ color: health.last_scan ? '#bbb' : '#8a8a8a' }}>{lastScan}</span>
      </span>

      <div className="w-px h-3" style={{ background: '#1a1a1a' }} />

      <span className="flex items-center gap-1.5">
        <Mail size={11} style={{ color: '#7a7a7a' }} />
        Email{' '}
        <span style={{ color: health.email_configured ? '#50e3c2' : '#8a8a8a' }}>
          {health.email_configured ? 'configured' : 'not configured'}
        </span>
      </span>
    </div>
  )
}
