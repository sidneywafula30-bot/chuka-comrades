import { Lock, RefreshCw } from 'lucide-react'
import type { User } from 'firebase/auth'
import { paymentLink, type Settings } from '../lib/hostel'
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

/** Shown when a student has not paid yet. Payment is manual: pay, WhatsApp the admin, the admin activates the email. */
export default function PayCard({ kind, user, settings, headline, detail, onSignIn, authBusy, onRefresh, refreshing }: Props) {
  const price = kind === 'hostels' ? settings.hostelPrice : settings.roommatePrice
  const until = settings.semesterEnd ? ` until the end of ${settings.semesterName || 'the semester'}` : ' for the whole semester'
  return (
    <aside className="hs-pay">
      <div className="hs-pay-top">
        <span className="hs-pay-lock"><Lock size={20} /></span>
        <div>
          <h3>{headline}</h3>
          <p>{detail}</p>
        </div>
        <div className="hs-pay-price"><small>One payment</small><strong>KSh {price}</strong><small>per semester</small></div>
      </div>
      <ol className="hs-pay-steps">
        <li><b>1</b><span>{user ? <>Signed in as <strong>{user.email}</strong>.</> : 'Sign in with Google (your access is tied to your email).'}</span></li>
        <li><b>2</b><span>{settings.payNote || `Pay KSh ${price} by M-Pesa. Tap the button below on WhatsApp and the admin will give you the payment number.`}</span></li>
        <li><b>3</b><span>Tap the button below and send the admin your M-Pesa code on WhatsApp. Access{until} is activated for your email.</span></li>
      </ol>
      <div className="hs-pay-actions">
        {user ? (
          <a className="hs-pay-wa" href={paymentLink(kind, user.email ?? '', price)} target="_blank" rel="noopener noreferrer"><HostelAdminLogo className="hs-pay-ph" /> Activate on WhatsApp</a>
        ) : (
          <GoogleSignInButton onClick={onSignIn} disabled={authBusy} label="Sign in to unlock" />
        )}
        {user && <button type="button" className="hs-btn hs-btn-soft" onClick={onRefresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? 'hs-spin' : ''} /> I have been activated</button>}
      </div>
      <small className="hs-pay-fine">Payments are not refundable. Activation is done by the admin, usually within a few hours.</small>
    </aside>
  )
}
