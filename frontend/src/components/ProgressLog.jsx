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
          className="flyout fixed right-4 bottom-4 z-[190] flex items-center gap-2 px-4 min-h-[36px] text-[14px] transition-colors hover:bg-[var(--control-bg-hover)]"
          style={{ color: 'var(--text-1)' }}
          onClick={() => setOpen(true)}
        >
          <Terminal size={14} />
          <span>{active ? (scanning ? 'Scanning…' : 'Updating…') : 'View log'}</span>
          {active && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse_soft" style={{ background: 'var(--accent-amber)' }} />
          )}
        </button>
      )}

      {/* Non-modal: no backdrop — the page stays fully interactive. */}
      {open && (
        <div
          role="complementary" aria-label="Progress log"
          className="drawer fixed top-0 right-0 z-[190] h-full w-full max-w-[480px]"
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5" style={{ color: 'var(--text-1)' }}>
                <Terminal size={18} style={{ color: active ? (scanning ? 'var(--accent-amber)' : 'var(--accent-teal)') : 'var(--accent)' }} />
                <span className="text-[20px] font-semibold">
                  {scanning ? 'Scanning…' : updating ? 'Updating…' : 'Progress log'}
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
                <X size={16} />
              </button>
            </div>

            <div className="px-5 pb-3 caption">
              {messages.length} line{messages.length === 1 ? '' : 's'}
            </div>

            <div className="code-surface flex-1 overflow-y-auto mx-4 mb-4 p-4 font-mono text-[12px] leading-relaxed"
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
