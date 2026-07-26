import { CheckCircle2, Mail, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import Modal from './Modal'

function Row({ k, v }) {
  return (
    <div className="flex gap-3 text-[14px] font-mono">
      <span className="w-32 shrink-0" style={{ color: 'var(--text-3)' }}>{k}</span>
      <span className="break-all" style={{ color: 'var(--text-2)' }}>{v}</span>
    </div>
  )
}

export default function EmailConfigDialog({ health, onClose, onTestEmail }) {
  const [testing, setTesting] = useState(false)

  const configured = !!health?.email_configured
  const encryption = health?.smtp_use_ssl ? 'SSL (implicit, port 465)'
    : health?.smtp_starttls ? 'STARTTLS'
    : 'None'
  const auth = health?.smtp_auth ? 'Enabled' : 'None (open relay)'

  async function handleTest() {
    if (!onTestEmail || testing) return
    setTesting(true)
    try { await onTestEmail() } finally { setTesting(false) }
  }

  const title = (
    <div className="flex items-center gap-2">
      <Mail size={15} style={{ color: 'var(--text-3)' }} />
      <span className="modal-title">Email notifications</span>
    </div>
  )

  const footer = (
    <>
      {configured && onTestEmail && (
        <button type="button" onClick={handleTest} disabled={testing}
          className="btn btn-blue btn-sm">
          <Send size={13} />
          {testing ? 'Sending…' : 'Send test email'}
        </button>
      )}
      <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} size="md" footer={footer} ariaLabel="Email notifications">
      {/* Status */}
      <div className="flex items-center gap-2 text-[14px] font-medium">
        {configured
          ? <><CheckCircle2 size={14} style={{ color: 'var(--accent-teal)' }} /><span style={{ color: 'var(--accent-teal)' }}>Configured</span></>
          : <><XCircle size={14} style={{ color: 'var(--text-3)' }} /><span style={{ color: 'var(--text-3)' }}>Not configured</span></>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Row k="SMTP server" v={`${health?.smtp_host || '—'}:${health?.smtp_port ?? ''}`} />
        <Row k="Encryption"  v={encryption} />
        <Row k="Authentication" v={auth} />
        <Row k="From" v={health?.email_from || '—'} />
        <Row k="To"   v={health?.email_to || '(not set)'} />
      </div>

      {!configured && (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Set <code>SMTP_HOST</code> and <code>EMAIL_TO</code> in your <code>.env</code> and restart to
          enable update notifications. Credentials (<code>SMTP_USER</code>/<code>SMTP_PASSWORD</code>) are
          optional for open relays.
        </p>
      )}
    </Modal>
  )
}
