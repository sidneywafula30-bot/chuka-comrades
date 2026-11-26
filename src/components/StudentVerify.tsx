import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { BadgeCheck, Camera, Clock, GraduationCap, RefreshCw } from 'lucide-react'
import { BOT_WHATSAPP, compressImage, hostelApi, hostelReady, showPhone, waLink, type StudentMe, type UploadImage } from '../lib/hostel'
import { WhatsAppLogo } from './BrandLogos'
import GoogleSignInButton from './GoogleSignInButton'
import './StudentVerify.css'

type Props = { user: User | null; onSignIn: () => void; authBusy: boolean }

/**
 * Student registration on the website. It creates the SAME account the WhatsApp bot uses
 * (one Students row, matched by email and WhatsApp number), so a student can start on either side.
 */
export default function StudentVerify({ user, onSignIn, authBusy }: Props) {
  const [me, setMe] = useState<StudentMe | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [card, setCard] = useState<(UploadImage & { preview: string }) | null>(null)

  const uid = user?.uid ?? ''
  const load = useCallback(async () => {
    if (!uid || !hostelReady) { setMe(null); return }
    setLoading(true); setError('')
    try { setMe(await hostelApi.studentMe()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [uid])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (user?.displayName) setFullName((cur) => cur || user.displayName || '') }, [user])

  async function pickCard(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setCard(await compressImage(f)); setError('') }
    catch (err) { setError((err as Error).message) }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!card) { setError('Please add a photo of your student card.'); return }
    setBusy(true); setError('')
    try {
      setMe(await hostelApi.studentRegister(fullName, phone, { name: card.name, mime: card.mime, data: card.data }))
      setCard(null)
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  const botLink = waLink(BOT_WHATSAPP, 'REGISTER')

  if (!user) {
    return (
      <aside className="sv sv-plain">
        <span className="sv-icon"><GraduationCap size={20} /></span>
        <div className="sv-body">
          <h3>Register as a Chuka student</h3>
          <p>Sign in with Google to register here, or register on WhatsApp. It is the same account on both, so you can use either.</p>
          <div className="sv-actions">
            <GoogleSignInButton onClick={onSignIn} disabled={authBusy} label="Sign in to register" />
            <a className="sv-wa" href={botLink} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> Register on WhatsApp</a>
          </div>
        </div>
      </aside>
    )
  }

  if (loading && !me) return <aside className="sv sv-plain"><p className="sv-muted">Checking your student account…</p></aside>

  if (me?.status === 'approved') {
    return (
      <p className="sv-ok">
        <BadgeCheck size={15} /> Student verified{me.fullName ? `: ${me.fullName}` : ''}. You can also use this account on WhatsApp:
        {' '}<a href={waLink(BOT_WHATSAPP, 'MENU')} target="_blank" rel="noopener noreferrer">open Chuka Hostel</a>.
      </p>
    )
  }

  if (me?.status === 'pending') {
    return (
      <aside className="sv sv-pending">
        <span className="sv-icon"><Clock size={20} /></span>
        <div className="sv-body">
          <h3>Registration under review</h3>
          <p>
            An admin is checking your student card{me.source === 'whatsapp' ? ' (submitted on WhatsApp)' : ''}.
            {me.phone ? <> We will message you on WhatsApp ({showPhone(me.phone)}) once it is decided.</> : ' We will message you once it is decided.'}
          </p>
          <div className="sv-actions">
            <button type="button" className="hs-btn hs-btn-soft" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'hs-spin' : ''} /> Check status
            </button>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sv">
      <div className="sv-head">
        <span className="sv-icon"><GraduationCap size={20} /></span>
        <div>
          <h3>{me?.status === 'rejected' ? 'Register again' : 'Register as a Chuka student'}</h3>
          <p>
            {me?.status === 'rejected'
              ? 'Your last registration was not approved (the card may have been unclear). Send a clearer photo.'
              : <>Verified students can subscribe and request rooms. Signed in as <strong>{user.email}</strong>.</>}
          </p>
        </div>
      </div>
      <form className="sv-form" onSubmit={submit}>
        <label>Full name
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} maxLength={80} autoComplete="name" placeholder="As on your student card" />
        </label>
        <label>WhatsApp number
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="0712 345 678" />
          <small>We message you here with the decision. It also links this account to the WhatsApp bot.</small>
        </label>
        <div className="sv-card">
          <label className="sv-upload"><Camera size={15} /> {card ? 'Change card photo' : 'Add student card photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickCard} />
          </label>
          {card && <img src={card.preview} alt="Student card preview" />}
        </div>
        {error && <p className="hs-error" role="alert">{error}</p>}
        <div className="sv-actions">
          <button className="hs-btn hs-btn-green" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit registration'}</button>
          <a className="sv-wa" href={botLink} target="_blank" rel="noopener noreferrer"><WhatsAppLogo size={16} /> Or register on WhatsApp</a>
        </div>
      </form>
      {!me && error && <p className="sv-muted">If this keeps failing, tap Refresh above and try again.</p>}
    </aside>
  )
}
