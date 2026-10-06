import { useEffect, useRef, useState } from 'react'
import { Button, CloseIcon, MaximizeIcon, MinimizeIcon, TerminalIcon } from 'xedonium'

const ProgressLog = ({ messages, scanning, updating, visible = false, onDismiss }) => {
  const endRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const active = scanning || updating

  function close() {
    setOpen(false)
    setFullscreen(false)
  }

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, active])

  useEffect(() => {
    if (active || messages.length > 0) {
      setOpen(true)
    }
  }, [active, messages.length])

  // Escape leaves full-screen mode (the log itself stays open).
  useEffect(() => {
    if (!fullscreen) return
    const onKey = e => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Only shown when the user started a scan/update (visible) — never on a
  // scan merely detected on page load.
  if (!visible || (!active && messages.length === 0)) return null

  return (
    <>
      {!open && (
        <Button variant="secondary" onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-[40] inline-flex items-center gap-2 shadow-lg">
          <TerminalIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{active ? (scanning ? 'Scanning…' : 'Updating…') : 'View log'}</span>
          {active && <span className="h-1.5 w-1.5 animate-pulse_soft rounded-full bg-amber-500" />}
        </Button>
      )}

      {/* Non-modal: no backdrop — the page stays fully interactive. */}
      {open && (
        <div
          role="complementary" aria-label="Progress log"
          className={`fixed right-0 top-0 h-full w-full border-l border-app-border bg-app-card shadow-2xl ${fullscreen
            ? 'z-[60] max-w-none border-l-0'
            : 'z-[40] max-w-[480px]'}`}
        >
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
              <div className="flex items-center gap-2.5 text-app-text">
                <TerminalIcon className={`h-[18px] w-[18px] shrink-0 ${active ? (scanning ? 'text-amber-500' : 'text-emerald-500') : ''}`} />
                <span className="text-sm font-semibold uppercase tracking-widest">
                  {scanning ? 'Scanning…' : updating ? 'Updating…' : 'Progress log'}
                </span>
                {active && <span className="ml-1 h-1.5 w-1.5 animate-pulse_soft rounded-full bg-amber-500" />}
              </div>

              <Button variant="secondary" onClick={close} aria-label="Close progress log">
                <CloseIcon className="h-4 w-4 shrink-0" />
              </Button>
            </div>

            <div className="px-5 py-3 text-xs text-app-muted">
              {messages.length} line{messages.length === 1 ? '' : 's'}
            </div>

            <div className="mx-4 mb-4 flex-1 overflow-y-auto border border-app-border bg-app-bg p-4 font-mono text-xs leading-relaxed"
              role="log" aria-live="polite">
              {messages.map((msg, i) => (
                <div key={i} className={`mb-1 break-words ${getLineColor(msg)}`}>{msg}</div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-app-border px-5 py-4">
              <Button variant="secondary" onClick={() => setFullscreen(f => !f)}
                aria-pressed={fullscreen} className="inline-flex items-center gap-2">
                {fullscreen ? <MinimizeIcon className="h-3.5 w-3.5 shrink-0" /> : <MaximizeIcon className="h-3.5 w-3.5 shrink-0" />}
                {fullscreen ? 'Exit full screen' : 'Full screen'}
              </Button>
              <Button onClick={() => { close(); onDismiss && onDismiss() }} disabled={active}
                tooltip={active ? 'Available when the current operation finishes' : undefined}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function getLineColor(msg) {
  if (msg.includes('✓') || msg.includes('complete') || msg.includes('up to date')) return 'text-emerald-600 dark:text-emerald-400'
  if (msg.includes('✗') || msg.includes('failed') || msg.includes('error')) return 'text-red-600 dark:text-red-400'
  if (msg.includes('⚠') || msg.includes('warn') || msg.includes('Pulling') || msg.includes('Updating')) return 'text-amber-600 dark:text-amber-400'
  if (msg.includes('✅') || msg.includes('Scan complete')) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-app-text'
}

export default ProgressLog
