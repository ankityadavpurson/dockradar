import { Terminal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const ProgressLog = ({ messages, scanning, updating }) => {
  const endRef = useRef(null)
  const [open, setOpen] = useState(false)
  const active = scanning || updating

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, active])

  useEffect(() => {
    if (active || messages.length > 0) {
      setOpen(true)
    }
  }, [active, messages.length])

  if (!active && messages.length === 0) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className="fixed right-4 bottom-4 z-[190] flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[13px] uppercase tracking-wider"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-2)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
          onClick={() => setOpen(true)}
        >
          <Terminal size={12} />
          <span>{active ? (scanning ? 'Scanning…' : 'Updating…') : 'View Log'}</span>
          {active && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse_soft" style={{ background: 'var(--accent-amber)' }} />
          )}
        </button>
      )}

      {/* Non-modal: no backdrop — the page stays fully interactive. */}
      {open && (
        <div
          className="fixed top-0 right-0 z-[190] h-full w-full max-w-[480px]"
          style={{ background: 'var(--surface-0)', borderLeft: '1px solid var(--border-1)', boxShadow: '-24px 0 60px rgba(0,0,0,0.45)' }}
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--surface-raised)' }}>
              <div className="flex items-center gap-2" style={{ color: active ? (scanning ? 'var(--accent-amber)' : 'var(--accent-teal)') : 'var(--text-1)' }}>
                <Terminal size={13} />
                <span className="text-[13px] font-mono uppercase tracking-wider">
                  {scanning ? 'Scanning…' : updating ? 'Updating…' : 'Progress Log'}
                </span>
                {active && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse_soft" style={{ background: 'var(--accent-amber)' }} />
                )}
              </div>

              <button
                type="button"
                className="btn-icon"
                onClick={() => setOpen(false)}
                aria-label="Close progress log"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-3 font-mono text-[13px]" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--surface-raised)' }}>
              {messages.length} line{messages.length === 1 ? '' : 's'}
            </div>

            <div className="flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed" style={{ background: 'var(--surface-0)' }}
              role="log" aria-live="polite">
              {messages.map((msg, i) => (
                <div key={i} className="mb-1 break-words" style={{ color: getLineColor(msg) }}>{msg}</div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getLineColor(msg) {
  if (msg.includes('✓') || msg.includes('complete') || msg.includes('up to date')) return 'var(--accent-teal)'
  if (msg.includes('✗') || msg.includes('failed') || msg.includes('error')) return 'var(--accent-red)'
  if (msg.includes('⚠') || msg.includes('warn') || msg.includes('Pulling') || msg.includes('Updating')) return 'var(--accent-amber)'
  if (msg.includes('✅') || msg.includes('Scan complete')) return 'var(--accent-teal)'
  return 'var(--text-1)'
}

export default ProgressLog
