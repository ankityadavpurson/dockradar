import { ArrowUpCircle, FileCode2, Info, MoreVertical, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MENU_WIDTH = 200

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
        className={`menu-item ${danger ? 'menu-item-danger' : ''}`}
        onClick={() => { setOpen(false); onSelect() }}>
        {icon}
        {label}
      </button>
    )
  }

  return (
    <>
      <button ref={btnRef} type="button" className="btn-icon" disabled={isBusy}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${c.name}`}
        title={`Actions for ${c.name}`}
        onClick={toggle}>
        <MoreVertical size={16} />
      </button>

      {/* Portal to <body>: the animated row keeps a `transform` (fade_in fill
          mode "both"), which would otherwise become the containing block for
          this fixed-position menu and strand it inside the clipped table. */}
      {open && createPortal(
        <div role="menu" aria-label={`Actions for ${c.name}`}
          className="flyout fixed z-[250] py-1 overflow-hidden animate-fade_in"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          onClick={e => e.stopPropagation()}>
          <MenuItem label="View details" icon={<Info size={14} />}
            onSelect={() => onShowDetails && onShowDetails(c)} />
          {hasCompose && (
            <MenuItem label="Update via compose" icon={<FileCode2 size={14} />}
              onSelect={() => onComposeUpdate && onComposeUpdate(c)} />
          )}
          <MenuItem
            label={outdated ? 'Update (pull + recreate)' : 'Re-pull & recreate'}
            icon={outdated ? <ArrowUpCircle size={14} /> : <RefreshCw size={14} />}
            onSelect={() => onConfirmUpdate(c)} />
          <div className="menu-separator" role="separator" />
          <MenuItem label="Remove container" icon={<Trash2 size={14} />} danger
            onSelect={() => onConfirmDelete(c)} />
        </div>,
        document.body
      )}
    </>
  )
}

export default RowMenu
