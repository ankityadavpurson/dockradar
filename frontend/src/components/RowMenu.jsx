import { ArrowUpCircle, FileCode2, Info, MoreVertical, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Per-row ⋮ menu. Rendered position:fixed so the table's overflow-x-auto
 *  wrapper cannot clip it; closes on outside click, Escape, or scroll. */
const RowMenu = ({ container: c, hasCompose, isBusy, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  function toggle(e) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const menuH = 165
      const top = r.bottom + menuH > window.innerHeight ? r.top - menuH - 4 : r.bottom + 4
      setPos({ top, left: Math.max(8, r.right - MENU_WIDTH) })
    }
    setOpen(o => !o)
  }

  const outdated = c.update_status === 'update_available'

  function MenuItem({ label, icon, onSelect, danger = false }) {
    return (
      <button role="menuitem" type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-[14px] transition-colors"
        style={{ color: danger ? '#ff6b6b' : '#ccc', background: 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={() => { setOpen(false); onSelect() }}>
        {icon}
        {label}
      </button>
    )
  }

  return (
    <>
      <button ref={btnRef} type="button" className="btn btn-ghost btn-xs p-0 py-1" disabled={isBusy}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${c.name}`}
        title={`Actions for ${c.name}`}
        onClick={toggle}>
        <MoreVertical size={20} />
      </button>

      {/* Portal to <body>: the animated row keeps a `transform` (fade_in fill
          mode "both"), which would otherwise become the containing block for
          this fixed-position menu and strand it inside the clipped table. */}
      {open && createPortal(
        <div role="menu" aria-label={`Actions for ${c.name}`}
          className="fixed z-[250] rounded-lg py-1 overflow-hidden"
          style={{
            top: pos.top, left: pos.left, width: MENU_WIDTH,
            background: '#111', border: '1px solid #2a2a2a',
            boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          }}
          onClick={e => e.stopPropagation()}>
          <MenuItem label="View details" icon={<Info size={12} />}
            onSelect={() => onShowDetails && onShowDetails(c)} />
          {hasCompose && (
            <MenuItem label="Update via compose" icon={<FileCode2 size={12} />}
              onSelect={() => onComposeUpdate && onComposeUpdate(c)} />
          )}
          <MenuItem
            label={outdated ? 'Update (pull + recreate)' : 'Re-pull & recreate'}
            icon={outdated ? <ArrowUpCircle size={12} /> : <RefreshCw size={12} />}
            onSelect={() => onConfirmUpdate(c)} />
          <div style={{ borderTop: '1px solid #222', margin: '4px 0' }} />
          <MenuItem label="Remove container" icon={<Trash2 size={12} />} danger
            onSelect={() => onConfirmDelete(c)} />
        </div>,
        document.body
      )}
    </>
  )
}

export default RowMenu
