import React, { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'

export default function ProgressLog({ messages, scanning, updating }) {
  const endRef = useRef(null)
  const active = scanning || updating

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, active])

  if (!active && messages.length === 0) return null

  return (
    <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
      {/* Bar */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <Terminal size={12} style={{ color: '#666' }} />
        <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#666' }}>
          {scanning ? 'Scanning…' : updating ? 'Updating…' : 'Log'}
        </span>
        {active && (
          <span className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse_soft"
            style={{ background: '#f5a623' }} />
        )}
      </div>

      {/* Output */}
      <div className="p-4 max-h-52 overflow-y-auto font-mono text-[11px] leading-relaxed"
        style={{ background: '#000' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ color: getLineColor(msg) }}>{msg}</div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function getLineColor(msg) {
  if (msg.includes('✓') || msg.includes('complete') || msg.includes('up to date')) return '#50e3c2'
  if (msg.includes('✗') || msg.includes('failed') || msg.includes('error')) return '#ff4444'
  if (msg.includes('⚠') || msg.includes('warn') || msg.includes('Pulling') || msg.includes('Updating')) return '#f5a623'
  if (msg.includes('✅') || msg.includes('Scan complete')) return '#50e3c2'
  return '#777'
}
