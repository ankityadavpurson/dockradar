import { useState } from 'react'
import { Alert, Button, SendIcon } from 'xedonium'
import Modal from './Modal'

function Row({ k, v }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-32 shrink-0 text-app-muted">{k}</span>
      <span className="break-all font-mono text-[13px] text-app-text">{v}</span>
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

  const footer = (
    <>
      {configured && onTestEmail && (
        <Button variant="secondary" onClick={handleTest} disabled={testing}
          className="inline-flex items-center gap-2">
          <SendIcon className="h-[13px] w-[13px] shrink-0" />
          {testing ? 'Sending…' : 'Send test email'}
        </Button>
      )}
      <Button onClick={onClose}>Close</Button>
    </>
  )

  return (
    <Modal title="Email notifications" onClose={onClose} size="md" footer={footer}>
      <Alert tone={configured ? 'success' : 'info'}>
        {configured ? 'Configured' : 'Not configured'}
      </Alert>

      <div className="flex flex-col">
        <Row k="SMTP server" v={`${health?.smtp_host || '—'}:${health?.smtp_port ?? ''}`} />
        <Row k="Encryption"  v={encryption} />
        <Row k="Authentication" v={auth} />
        <Row k="From" v={health?.email_from || '—'} />
        <Row k="To"   v={health?.email_to || '(not set)'} />
      </div>

      {!configured && (
        <p className="text-[13px] leading-relaxed text-app-muted">
          Set <code>SMTP_HOST</code> and <code>EMAIL_TO</code> in your <code>.env</code> and restart to
          enable update notifications. Credentials (<code>SMTP_USER</code>/<code>SMTP_PASSWORD</code>) are
          optional for open relays.
        </p>
      )}
    </Modal>
  )
}
