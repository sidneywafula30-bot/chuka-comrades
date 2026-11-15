import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { useInstall } from '../lib/install'
import './InstallPopup.css'

const KEY = 'comrades-install-dismissed'
const SNOOZE_DAYS = 3

function snoozed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0)
    return Date.now() - t < SNOOZE_DAYS * 864e5
  } catch { return false }
}

/** Popup shown shortly after the first visit; comes back after a few days if dismissed. */
export default function InstallPopup() {
  const { canInstall, iosHelp, installed, install } = useInstall()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (installed || snoozed() || !(canInstall || iosHelp)) return
    const t = setTimeout(() => setOpen(true), 2500)
    return () => clearTimeout(t)
  }, [canInstall, iosHelp, installed])

  const close = () => {
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
    setOpen(false)
  }
  const go = async () => { await install(); close() }

  if (!open || installed) return null
  return (
    <div className="ip-backdrop" role="dialog" aria-modal="true" aria-labelledby="ip-title" onClick={close}>
      <div className="ip-card" onClick={(e) => e.stopPropagation()}>
        <button className="ip-x" onClick={close} aria-label="Close"><X size={18} /></button>
        <img src={`${import.meta.env.BASE_URL}chukalogo-192.png`} alt="" className="ip-logo" />
        <h2 id="ip-title">Install Chuka Comrades</h2>
        <p>Get the app on your home screen. It opens fast and works even with a weak connection.</p>
        {canInstall ? (
          <button className="ip-btn" onClick={go}><Download size={16} /> Install app</button>
        ) : (
          <p className="ip-ios">On iPhone: tap <Share size={14} /> <b>Share</b>, then <b>Add to Home Screen</b>.</p>
        )}
        <button className="ip-later" onClick={close}>Not now</button>
      </div>
    </div>
  )
}
