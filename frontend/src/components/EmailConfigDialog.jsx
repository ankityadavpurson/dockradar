import { CheckCircle2, Mail, Send, XCircle } from 'lucide-react'
import { useState } from 'react'
import Modal from './Modal'

function Row({ k, v }) {
  return (
    <div className="flex gap-3 text-[14px] py-1.5" style={{ borderBottom: '1px solid var(--border-1)' }}>
      <span className="w-32 shrink-0" style={{ color: 'var(--text-3)' }}>{k}</span>
      <span className="break-all font-mono text-[13px]" style={{ color: 'var(--text-1)' }}>{v}</span>
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
      <Mail size={20} style={{ color: 'var(--accent)' }} />
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
      <div className={`infobar ${configured ? 'infobar-success' : ''} items-center py-2`}>
        {configured
          ? <><CheckCircle2 size={16} className="infobar-icon !mt-0" /><span>Configured</span></>
          : <><XCircle size={16} className="infobar-icon !mt-0" style={{ color: 'var(--text-3)' }} /><span>Not configured</span></>}
      </div>

      <div className="flex flex-col">
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
