import { ArrowUpCircle, FileCode2, Info, MoreVertical, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const GAP = 4       // px between the trigger and the menu
const EDGE = 8      // min px between the menu and the viewport edge

// Module-level so re-renders (e.g. positioning) don't remount items and drop focus.
function MenuItem({ label, icon, onSelect, danger = false }) {
  return (
    <button role="menuitem" type="button" tabIndex={-1}
      className={`menu-item ${danger ? 'menu-item-danger' : ''}`}
      onClick={onSelect}>
      {icon}
      <span className="flex-1">{label}</span>
    </button>
  )
}

/** Per-row ⋮ menu (Windows 11 MenuFlyout). Rendered position:fixed so the
 *  table's overflow-x-auto wrapper cannot clip it. Closes on outside press,
 *  Escape, Tab, scroll, or resize. Opening one menu closes any other: the
 *  trigger click is left to bubble so other menus see it as an outside press. */
const RowMenu = ({ container: c, hasCompose, isBusy, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails }) => {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, above: false })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  // Place the menu from its measured size: below the trigger, flipped above
  // when it would run off the bottom, right-aligned and clamped horizontally.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const { width, height } = menuRef.current.getBoundingClientRect()
    const above = r.bottom + GAP + height > window.innerHeight - EDGE && r.top - GAP - height >= EDGE
    const top = above ? r.top - GAP - height : r.bottom + GAP
    const left = Math.min(Math.max(EDGE, r.right - width), window.innerWidth - width - EDGE)
    setPos({ top, left, above })
    menuRef.current.querySelector('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onPress = e => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    document.addEventListener('mousedown', onPress)
    document.addEventListener('click', onPress)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('mousedown', onPress)
      document.removeEventListener('click', onPress)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [open])

  function closeAndRestoreFocus() {
    setOpen(false)
    btnRef.current?.focus()
  }

  // Roving focus between items, as in native Windows menus.
  function onMenuKeyDown(e) {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    const move = next => { e.preventDefault(); items[(next + items.length) % items.length]?.focus() }
    switch (e.key) {
      case 'ArrowDown': return move(i + 1)
      case 'ArrowUp':   return move(i < 0 ? items.length - 1 : i - 1)
      case 'Home':      return move(0)
      case 'End':       return move(items.length - 1)
      case 'Escape':    e.preventDefault(); return closeAndRestoreFocus()
      case 'Tab':       return setOpen(false)
      default:
    }
  }

  function onTriggerKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
    }
  }

  const outdated = c.update_status === 'update_available'

  const item = (label, icon, onSelect, danger = false) => (
    <MenuItem label={label} icon={icon} danger={danger}
      onSelect={() => { setOpen(false); onSelect() }} />
  )

  return (
    <>
      <button ref={btnRef} type="button" className="btn-icon" disabled={isBusy}
        aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${c.name}`}
        title={`Actions for ${c.name}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onTriggerKeyDown}>
        <MoreVertical size={16} />
      </button>

      {/* Portal to <body>: the animated row keeps a `transform` (fade_in fill
          mode "both"), which would otherwise become the containing block for
          this fixed-position menu and strand it inside the clipped table. */}
      {open && createPortal(
        <div ref={menuRef} role="menu" aria-label={`Actions for ${c.name}`}
          className={`menu ${pos.above ? 'is-above' : ''}`}
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={onMenuKeyDown}>
          {item('View details', <Info />, () => onShowDetails && onShowDetails(c))}
          {hasCompose && item('Update via compose', <FileCode2 />, () => onComposeUpdate && onComposeUpdate(c))}
          {item(
            outdated ? 'Update (pull + recreate)' : 'Re-pull & recreate',
            outdated ? <ArrowUpCircle /> : <RefreshCw />,
            () => onConfirmUpdate(c),
          )}
          <div className="menu-separator" role="separator" />
          {item('Remove container', <Trash2 />, () => onConfirmDelete(c), true)}
        </div>,
        document.body
      )}
    </>
  )
}

export default RowMenu
