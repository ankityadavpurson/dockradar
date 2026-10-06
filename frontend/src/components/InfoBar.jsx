import { useState } from 'react'
import { Button, ClockIcon, HistoryIcon, InfoIcon, MailIcon } from 'xedonium'
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

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[13px] text-app-muted">

      <span className="flex items-center gap-1.5">
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        Scans every <span className="font-semibold text-app-text">{health.scan_interval_hours}h</span>
      </span>

      <div className="hidden h-4 w-px bg-app-border sm:block" />

      <span className="flex items-center gap-1.5"
        title={health.last_scan ? new Date(health.last_scan).toLocaleString() : undefined}>
        <HistoryIcon className="h-3.5 w-3.5 shrink-0" />
        Last scan{' '}
        <span className={`font-semibold ${health.last_scan ? 'text-app-text' : 'text-app-muted'}`}>{lastScan}</span>
      </span>

      <div className="hidden h-4 w-px bg-app-border sm:block" />

      <span className="flex items-center gap-1.5">
        <MailIcon className="h-3.5 w-3.5 shrink-0" />
        Email
        <Button variant="flat" onClick={() => setShowEmail(true)}
          aria-label="Email configuration details"
          tooltip="View email configuration"
          className="!p-1">
          <InfoIcon className={`h-3.5 w-3.5 shrink-0 ${health.email_configured ? 'text-emerald-500' : ''}`} />
        </Button>
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
