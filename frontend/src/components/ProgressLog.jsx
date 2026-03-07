import React, { useEffect, useRef } from 'react'
import { Terminal } from 'lucide-react'

export default function ProgressLog({ messages = [], scanning, updating }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const busy = scanning || updating

  return (
    <div className="mt-5 bg-bg-surface border border-border rounded-2xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-bg-card/50">
        <Terminal size={13} className="text-ink-secondary" />
        <span className="text-[11px] font-mono font-bold uppercase tracking-[2px] text-ink-secondary">
          Progress Log
        </span>
        {busy && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-accent-blue animate-pulse_soft">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
            {scanning ? 'Scanning…' : 'Updating…'}
          </span>
        )}
      </div>

      {/* log body */}
      <div className="px-5 py-4 font-mono text-[12px] text-ink-secondary leading-[1.9]
                      max-h-48 overflow-y-auto">
        {messages.length === 0 ? (
          <span className="text-ink-muted">Ready. Click Scan to start.</span>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`
              ${msg.startsWith('✅') ? 'text-accent-green' : ''}
              ${msg.startsWith('🏁') ? 'text-accent-cyan' : ''}
              ${msg.includes('Error') || msg.includes('✗') ? 'text-accent-red' : ''}
            `}>
              {msg}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
