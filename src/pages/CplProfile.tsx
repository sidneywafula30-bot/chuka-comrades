import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { Camera, MessageCircle, Pencil, Phone, UserRound } from 'lucide-react'
import { cpl, type Profile } from '../lib/cpl'
import { shrinkImage } from '../lib/files'

export default function CplProfile({ user, role = 'Chairman' }: { user: User; role?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({ fullName: user.displayName || '', whatsapp: '', call: '' })
  const [pending, setPending] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    cpl<Profile | null>('profileGet')
      .then((p) => {
        setProfile(p)
        if (p) setF({ fullName: p.fullName, whatsapp: p.whatsapp, call: p.call })
        else setEditing(true) // first visit: go straight to the form
      })
      .catch((e) => setMsg({ text: e.message, bad: true }))
      .finally(() => setLoaded(true))
  }, [])

  function startEdit() {
    if (profile) setF({ fullName: profile.fullName, whatsapp: profile.whatsapp, call: profile.call })
    setPending(''); setMsg(null); setEditing(true)
  }

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { setPending(await shrinkImage(file, 512)); setMsg(null) }
    catch { setMsg({ text: 'Could not read that image.', bad: true }) }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const p = await cpl<Profile>('profileSave', {
        ...f,
        imageBase64: pending ? pending.split(',')[1] : '',
        imageMime: pending ? 'image/jpeg' : '',
      })
      setProfile(p); setPending(''); setEditing(false)
      setMsg({ text: 'Profile saved.' })
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  const shown = pending || profile?.imageUrl || ''
  const avatar = shown ? <img src={shown} alt="Profile" /> : <span className="ph"><UserRound size={34} /></span>

  if (!loaded) return <div className="cpl-page"><p className="cpl-empty">Loading…</p></div>

  return (
    <div className="cpl-page">
      <h2>My CPL profile</h2>
      <p className="cpl-sub">This is what the public sees on the CPL page.</p>

      {!editing && profile ? (
        <section className="cpl-card cpl-pcard">
          <div className="cpl-pcard-banner" />
          <div className="cpl-pcard-body">
            <div className="cpl-avatar-ring lg">{avatar}</div>
            <small className="cpl-eyebrow">CPL {role}</small>
            <h3>{profile.fullName}</h3>
            <p className="cpl-pcard-email">{user.email}</p>
            <ul className="cpl-pcard-contacts">
              <li><MessageCircle size={16} /><span>WhatsApp</span><b>{profile.whatsapp ? `+${profile.whatsapp}` : 'Not set'}</b></li>
              <li><Phone size={16} /><span>Call</span><b>{profile.call ? `+${profile.call}` : 'Not set'}</b></li>
            </ul>
            <div className="cpl-inline cpl-pcard-actions">
              <button className="lp-btn" onClick={startEdit}><Pencil size={15} /> Edit profile</button>
              {profile.whatsapp && <a className="lp-btn lp-btn-soft" href={`https://wa.me/${profile.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Test WhatsApp</a>}
              {profile.call && <a className="lp-btn lp-btn-soft" href={`tel:+${profile.call}`}><Phone size={15} /> Test call</a>}
            </div>
          </div>
        </section>
      ) : (
        <form className="cpl-card cpl-form cpl-pform" onSubmit={save}>
          <div className="cpl-avatar-pick">
            <div className="cpl-avatar-ring lg">{avatar}</div>
            <label className="cpl-upload"><Camera size={15} /> {shown ? 'Change photo' : 'Upload photo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} hidden />
            </label>
            <small>Square photos look best. PNG, JPG or WebP.</small>
          </div>
          <label>Full name
            <input type="text" required minLength={2} maxLength={60} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </label>
          <label>WhatsApp number
            <input type="tel" inputMode="numeric" placeholder="2547XXXXXXXX" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
            <small>With country code, no + or spaces.</small>
          </label>
          <label>Call number
            <input type="tel" inputMode="numeric" placeholder="2547XXXXXXXX" value={f.call} onChange={(e) => setF({ ...f, call: e.target.value })} />
          </label>
          <div className="cpl-inline">
            <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            {profile && <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => { setEditing(false); setPending(''); setMsg(null) }}>Cancel</button>}
          </div>
        </form>
      )}
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
    </div>
  )
}
