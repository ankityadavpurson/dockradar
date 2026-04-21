import React, { useEffect, useRef, useState } from 'react'
import { Terminal, X } from 'lucide-react'

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
          className="fixed right-4 bottom-4 z-[190] flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-wider"
          style={{ background: '#111', border: '1px solid #222', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
          onClick={() => setOpen(true)}
        >
          <Terminal size={12} />
          <span>{active ? (scanning ? 'Scanning…' : 'Updating…') : 'View Log'}</span>
          {active && (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse_soft" style={{ background: '#f5a623' }} />
          )}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[200]"
          style={{ background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(3px)' }}
          onClick={e => e.target === e.currentTarget && setOpen(active)}
        >
          <div
            className="absolute top-0 right-0 h-full w-full max-w-[560px]"
            style={{ background: '#0a0a0a', borderLeft: '1px solid #1a1a1a', boxShadow: '-24px 0 60px rgba(0,0,0,0.45)' }}
          >
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2" style={{ color: active ? (scanning ? '#f5a623' : '#50e3c2') : '#fff' }}>
                  <Terminal size={13} />
                  <span className="text-[11px] font-mono uppercase tracking-wider">
                    {scanning ? 'Scanning…' : updating ? 'Updating…' : 'Progress Log'}
                  </span>
                  {active && (
                    <span className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse_soft" style={{ background: '#f5a623' }} />
                  )}
                </div>

                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ color: '#666', border: '1px solid #222', background: 'transparent' }}
                  onClick={() => setOpen(false)}
                  aria-label="Close progress log"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-5 py-3 font-mono text-[11px]" style={{ borderBottom: '1px solid #141414', background: 'rgba(255,255,255,0.015)' }}>
                {messages.length} line{messages.length === 1 ? '' : 's'}
              </div>

              <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed" style={{ background: '#000' }}>
                {messages.map((msg, i) => (
                  <div key={i} className="mb-1 break-words" style={{ color: getLineColor(msg) }}>{msg}</div>
                ))}
                <div ref={endRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getLineColor(msg) {
  if (msg.includes('✓') || msg.includes('complete') || msg.includes('up to date')) return '#50e3c2'
  if (msg.includes('✗') || msg.includes('failed') || msg.includes('error')) return '#ff4444'
  if (msg.includes('⚠') || msg.includes('warn') || msg.includes('Pulling') || msg.includes('Updating')) return '#f5a623'
  if (msg.includes('✅') || msg.includes('Scan complete')) return '#50e3c2'
  return '#fff'
}

export default ProgressLog
