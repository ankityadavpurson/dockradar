/** Render compose YAML line-by-line, highlighting lines that differ */
const DiffView = ({ current, proposed }) => {
  if (!current || !proposed) return null
  const currentLines = current.split('\n')
  const proposedLines = proposed.split('\n')
  const maxLen = Math.max(currentLines.length, proposedLines.length)

  return (
    <div className="max-h-[260px] overflow-y-auto font-mono text-xs leading-relaxed">
      {Array.from({ length: maxLen }, (_, i) => {
        const cur = currentLines[i] ?? ''
        const prop = proposedLines[i] ?? ''
        const changed = cur !== prop
        return (
          <div key={i}>
            {changed && cur && (
              <div className="whitespace-pre bg-red-500/10 px-3 text-red-700 dark:text-red-300">{'- ' + cur}</div>
            )}
            {changed && prop && (
              <div className="whitespace-pre bg-emerald-500/10 px-3 text-emerald-800 dark:text-emerald-300">{'+ ' + prop}</div>
            )}
            {!changed && (
              <div className="whitespace-pre px-3 text-app-muted">{'  ' + cur}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DiffView
