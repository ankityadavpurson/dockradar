import { CheckCircle2, Mail, Send, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

const MUTED = { color: '#8a8a8a' }
const VALUE = { color: '#ccc' }

function Row({ k, v }) {
  return (
    <div className="flex gap-3 text-[14px] font-mono">
      <span className="w-32 shrink-0" style={MUTED}>{k}</span>
      <span className="break-all" style={VALUE}>{v}</span>
    </div>
  )
}

export default function EmailConfigDialog({ health, onClose, onTestEmail }) {
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div role="dialog" aria-modal="true" aria-labelledby="email-config-title"
        className="w-full max-w-md mx-4 rounded-xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #222' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2">
            <Mail size={15} style={MUTED} />
            <span id="email-config-title" className="text-[15px] font-medium" style={{ color: '#ededed' }}>
              Email notifications
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ color: '#8a8a8a', border: '1px solid #222' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Status */}
          <div className="flex items-center gap-2 text-[14px] font-medium">
            {configured
              ? <><CheckCircle2 size={14} style={{ color: '#50e3c2' }} /><span style={{ color: '#50e3c2' }}>Configured</span></>
              : <><XCircle size={14} style={{ color: '#8a8a8a' }} /><span style={MUTED}>Not configured</span></>}
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <Row k="SMTP server" v={`${health?.smtp_host || '—'}:${health?.smtp_port ?? ''}`} />
            <Row k="Encryption"  v={encryption} />
            <Row k="Authentication" v={auth} />
            <Row k="From" v={health?.email_from || '—'} />
            <Row k="To"   v={health?.email_to || '(not set)'} />
          </div>

          {!configured && (
            <p className="text-[13px] leading-relaxed mt-1" style={{ color: '#9a9a9a' }}>
              Set <code>SMTP_HOST</code> and <code>EMAIL_TO</code> in your <code>.env</code> and restart to
              enable update notifications. Credentials (<code>SMTP_USER</code>/<code>SMTP_PASSWORD</code>) are
              optional for open relays.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid #1a1a1a' }}>
          {configured && onTestEmail && (
            <button type="button" onClick={handleTest} disabled={testing}
              className="btn btn-blue btn-sm disabled:opacity-50">
              <Send size={13} />
              {testing ? 'Sending…' : 'Send test email'}
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>
      </div>
    </div>
  )
}
