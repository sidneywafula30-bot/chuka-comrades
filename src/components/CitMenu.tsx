import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Menu, X } from 'lucide-react'
import './Cit.css'

export type MenuItem = { key: string; label: string; icon?: ReactNode; on?: boolean; dot?: boolean; onClick: () => void }

/** One "Menu" button that opens a dropdown with every nav item. The panel is drawn on document.body so the page header can never clip it. */
export default function CitMenu({ items, current }: { items: MenuItem[]; current?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 60, right: 12 })
  const btn = useRef<HTMLButtonElement>(null)

  function toggle() {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect()
      setPos({ top: Math.round(r.bottom + 8), right: Math.max(12, Math.round(window.innerWidth - r.right)) })
    }
    setOpen((o) => !o)
  }
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('keydown', esc); window.removeEventListener('resize', close) }
  }, [open])

  return (
    <>
      <button ref={btn} className="cit-menu-btn" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        {open ? <X size={18} /> : <Menu size={18} />}<span>{current ?? 'Menu'}</span>
      </button>
      {open && createPortal(
        <>
          <div className="cit-menu-scrim" onClick={() => setOpen(false)} />
          <div className="cit-menu-panel" role="menu" style={{ top: pos.top, right: pos.right }}>
            {items.map((it) => (
              <button key={it.key} role="menuitem" className={it.on ? 'on' : ''} onClick={() => { setOpen(false); it.onClick() }}>
                {it.icon}<span>{it.label}</span>{it.dot && <i className="cit-dot" />}
              </button>
            ))}
          </div>
        </>, document.body)}
    </>
  )
}
