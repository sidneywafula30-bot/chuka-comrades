import { useEffect, useState } from 'react'
import { Download, MoreVertical, Share, X } from 'lucide-react'
import { useInstall } from '../lib/install'
import './InstallPopup.css'

const KEY = 'comrades-install-hidden'

/** Shown on every visit until the app is installed. "Not now" hides it for the current session only. */
export default function InstallPopup() {
  const { canInstall, iosHelp, manualHelp, installed, install } = useInstall()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (installed) return
    let hidden = false
    try { hidden = sessionStorage.getItem(KEY) === '1' } catch { /* ignore */ }
    if (hidden) return
    // Give the browser a moment to offer the real install prompt before falling back to manual steps.
    const t = setTimeout(() => setOpen(true), canInstall ? 800 : 2500)
    return () => clearTimeout(t)
  }, [canInstall, installed])

  const close = () => {
    try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }
  const go = async () => { const ok = await install(); if (ok) setOpen(false); else close() }

  if (!open || installed) return null
  return (
    <div className="ip-backdrop" role="dialog" aria-modal="true" aria-labelledby="ip-title" onClick={close}>
      <div className="ip-card" onClick={(e) => e.stopPropagation()}>
        <button className="ip-x" onClick={close} aria-label="Close"><X size={18} /></button>
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="ip-logo" />
        <h2 id="ip-title">Install Chuka Comrades</h2>
        <p>Get the app on your home screen. It opens fast and works even with a weak connection.</p>
        {canInstall && <button className="ip-btn" onClick={go}><Download size={16} /> Install app</button>}
        {iosHelp && <p className="ip-ios">On iPhone: tap <Share size={14} /> <b>Share</b>, then <b>Add to Home Screen</b>.</p>}
        {manualHelp && <p className="ip-ios">Tap <MoreVertical size={14} /> the browser menu, then choose <b>Install app</b> (or <b>Add to Home screen</b>).</p>}
        <button className="ip-later" onClick={close}>Not now</button>
      </div>
    </div>
  )
}
