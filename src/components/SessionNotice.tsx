import { useState } from 'react'
import { X } from 'lucide-react'
import { inAppBrowser } from '../lib/session'
import './SessionNotice.css'

const KEY = 'comrades-notice-hidden'
const hiddenNow = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }

type Props = { lostSession: boolean; onSignIn: () => void; onDismissLost: () => void }

/** Explains why someone was signed out and offers a one-tap sign back in; warns inside in-app browsers. */
export default function SessionNotice({ lostSession, onSignIn, onDismissLost }: Props) {
  const [hidden, setHidden] = useState(hiddenNow)
  const iab = inAppBrowser()

  const hide = () => { try { sessionStorage.setItem(KEY, '1') } catch { /* ignore */ } setHidden(true) }

  if (lostSession) {
    return (
      <div className="sn-bar" role="status">
        <span>Your browser cleared your login. Tap to sign back in.</span>
        <button className="sn-btn" onClick={onSignIn}>Sign in</button>
        <button className="sn-x" onClick={onDismissLost} aria-label="Dismiss"><X size={16} /></button>
      </div>
    )
  }
  if (iab && !hidden) {
    return (
      <div className="sn-bar" role="status">
        <span>You opened this inside {iab}, which can log you out. For a steady login, open it in Chrome or Safari (menu ⋮ → “Open in browser”).</span>
        <button className="sn-x" onClick={hide} aria-label="Dismiss"><X size={16} /></button>
      </div>
    )
  }
  return null
}
