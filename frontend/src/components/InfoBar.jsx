import { useState } from 'react'
import { Clock, History, Info, Mail } from 'lucide-react'
import EmailConfigDialog from './EmailConfigDialog'

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

export default function InfoBar({ health, onTestEmail }) {
  const [showEmail, setShowEmail] = useState(false)
  if (!health) return null

  const lastScan = timeAgo(health.last_scan)
  const emailColor = health.email_configured ? 'var(--accent-teal)' : 'var(--text-3)'

  return (
    <div className="card flex items-center flex-wrap gap-x-4 gap-y-1 px-4 py-2 mb-3 text-[13px]"
      style={{ color: 'var(--text-3)' }}>

      <span className="flex items-center gap-1.5">
        <Clock size={14} style={{ color: 'var(--text-3)' }} />
        Scans every{' '}
        <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{health.scan_interval_hours}h</span>
      </span>

      <div className="w-px h-4" style={{ background: 'var(--border-3)' }} />

      <span className="flex items-center gap-1.5"
        title={health.last_scan ? new Date(health.last_scan).toLocaleString() : undefined}>
        <History size={14} style={{ color: 'var(--text-3)' }} />
        Last scan{' '}
        <span className="font-semibold" style={{ color: health.last_scan ? 'var(--text-1)' : 'var(--text-3)' }}>{lastScan}</span>
      </span>

      <div className="w-px h-4" style={{ background: 'var(--border-3)' }} />

      <span className="flex items-center gap-1.5">
        <Mail size={14} style={{ color: 'var(--text-3)' }} />
        Email
        <button type="button" onClick={() => setShowEmail(true)}
          aria-label="Email configuration details"
          title="View email configuration"
          className="icon-btn-subtle !h-6 !w-6">
          <Info size={14} style={{ color: emailColor }} />
        </button>
      </span>

      {showEmail && (
        <EmailConfigDialog
          health={health}
          onTestEmail={onTestEmail}
          onClose={() => setShowEmail(false)}
        />
      )}
    </div>
  )
}
