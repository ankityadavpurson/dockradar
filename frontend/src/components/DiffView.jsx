import React from 'react'

/** Render compose YAML line-by-line, highlighting lines that differ */
const DiffView = ({ current, proposed }) => {
  if (!current || !proposed) return null
  const currentLines = current.split('\n')
  const proposedLines = proposed.split('\n')
  const maxLen = Math.max(currentLines.length, proposedLines.length)

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6, overflowY: 'auto', maxHeight: '260px' }}>
      {Array.from({ length: maxLen }, (_, i) => {
        const cur = currentLines[i] ?? ''
        const prop = proposedLines[i] ?? ''
        const changed = cur !== prop
        return (
          <div key={i}>
            {changed && cur && (
              <div style={{ background: 'rgba(255,68,68,0.12)', color: '#ff6b6b', padding: '0 12px', whiteSpace: 'pre' }}>
                {'- ' + cur}
              </div>
            )}
            {changed && prop && (
              <div style={{ background: 'rgba(80,227,194,0.10)', color: '#50e3c2', padding: '0 12px', whiteSpace: 'pre' }}>
                {'+ ' + prop}
              </div>
            )}
            {!changed && (
              <div style={{ color: '#555', padding: '0 12px', whiteSpace: 'pre' }}>
                {'  ' + cur}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DiffView
