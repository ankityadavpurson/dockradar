import React from 'react'
import { Clock, Mail, Activity } from 'lucide-react'

export default function InfoBar({ health, config: cfg }) {
  return (
    <div className="flex items-center gap-4 flex-wrap mb-4
                    text-[11px] font-mono text-ink-secondary">
      <span className="flex items-center gap-1.5">
        <Clock size={11} />
        Scan interval: every {health?.scan_interval_hours ?? '…'}h
      </span>
      <span className="text-border">|</span>
      <span className={`flex items-center gap-1.5 ${health?.email_configured ? 'text-accent-green' : ''}`}>
        <Mail size={11} />
        {health?.email_configured ? '✓ Email notifications active' : 'Email: not configured'}
      </span>
      <span className="text-border">|</span>
      <span className={`flex items-center gap-1.5 ${health?.scheduler_running ? 'text-accent-green' : 'text-accent-red'}`}>
        <Activity size={11} />
        {health?.scheduler_running ? '✓ Scheduler running' : '✗ Scheduler stopped'}
      </span>
    </div>
  )
}
