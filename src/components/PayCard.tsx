import { Lock, RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { BOT_WHATSAPP, kes, livePlans, showPhone, subscribeLink, type Settings } from '../lib/hostel'
import { HostelAdminLogo } from './HostelAdminChat'
import GoogleSignInButton from './GoogleSignInButton'

type Props = {
  kind: 'hostels' | 'roommate'
  user: User | null
  settings: Settings
  headline: string
  detail: string
  onSignIn: () => void
  authBusy: boolean
  onRefresh: () => void
  refreshing: boolean
}

/**
 * Shown when a student has no active subscription. ONE subscription unlocks every hostel and roommate posting.
 * There is no payment form here: every payment happens in WhatsApp with the Chuka Hostel bot, the admin confirms it.
 */
export default function PayCard({ kind, user, settings, headline, detail, onSignIn, authBusy, onRefresh, refreshing }: Props) {
  const plans = livePlans(settings)
  const unlocks = kind === 'hostels' ? 'every hostel' : 'roommate posting'
  return (
    <aside className="hs-pay">
      <div className="hs-pay-top">
        <span className="hs-pay-lock"><Lock size={20} /></span>
        <div>
          <h3>{headline}</h3>
          <p>{detail}</p>
        </div>
        <div className="hs-pay-price">
          {plans.length === 0 ? <small>Plans open soon</small> : plans.map((p) => (
            <div key={p.id}><small>{p.label}</small> <strong>{kes(p.priceKes)}</strong></div>
          ))}
        </div>
      </div>
      <ol className="hs-pay-steps">
        <li><b>1</b><span>{user ? <>Signed in as <strong>{user.email}</strong>. Register as a student first if you have not (it is free).</> : 'Sign in with Google and register as a student (it is free).'}</span></li>
        <li><b>2</b><span>Tap the button below. WhatsApp opens the Chuka Hostel bot with <strong>SUBSCRIBE</strong> typed. Pick a plan and pay by M-Pesa as the bot tells you.</span></li>
        <li><b>3</b><span>Paste the full M-Pesa confirmation message in the chat. An admin confirms it and {unlocks} is unlocked for your email. One subscription unlocks both hostels and roommate posting.</span></li>
      </ol>
      <p className="hs-pay-fine">Important: message the bot from the same WhatsApp number you registered with, or it will not recognise you. The bot is {showPhone(BOT_WHATSAPP)}.</p>
      <div className="hs-pay-actions">
        {user ? (
          <a className="hs-pay-wa" href={subscribeLink()} target="_blank" rel="noopener noreferrer"><HostelAdminLogo className="hs-pay-ph" /> Subscribe on WhatsApp</a>
        ) : (
          <GoogleSignInButton onClick={onSignIn} disabled={authBusy} label="Sign in to unlock" />
        )}
        {user && <button type="button" className="hs-btn hs-btn-soft" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'hs-spin' : ''} /> I have been activated</button>}
      </div>
      <small className="hs-pay-fine">Payments are not refundable. Activation is done by an admin, usually within a few hours.</small>
    </aside>
  )
}
