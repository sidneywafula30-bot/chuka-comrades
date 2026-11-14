import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, CalendarDays, Pencil, Shield, Users } from 'lucide-react'
import { cpl, type MyTeam } from '../lib/cpl'
import { shrinkImage } from '../lib/files'
import TeamCard from '../components/TeamCard'
import CplPlayers from './CplPlayers'
import TeamModal from '../components/TeamModal'

type Msg = { text: string; bad?: boolean } | null

/** Coach page: shows the coach's team(s) and lets them edit logo, description, and their own contact details. */
export default function CplMyTeam({ teams: initial }: { teams: MyTeam[] }) {
  const [teams, setTeams] = useState(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [playersFor, setPlayersFor] = useState<MyTeam | null>(null)
  const [fxFor, setFxFor] = useState<MyTeam | null>(null)
  if (playersFor) return <CplPlayers team={playersFor} onBack={() => setPlayersFor(null)} />
  return (
    <div className="cpl-page">
      <h2>My team</h2>
      <p className="cpl-sub">The team{teams.length > 1 ? 's' : ''} you coach. The public sees the name, logo, description and your name.</p>
      <div className="cpl-myteams">
        {teams.map((t) => (
          <section key={t.id} className="cpl-myteam">
            <p className="cpl-myteam-meta"><b>{t.seasonName}</b>{t.divisionName && <> · {t.divisionName}</>}</p>
            {editId === t.id
              ? <TeamEdit t={t} onDone={(list) => { if (list) setTeams(list); setEditId(null) }} />
              : <TeamCard t={t} contacts><button className="lp-btn" onClick={() => setPlayersFor(t)}><Users size={14} /> Players</button><button className="lp-btn lp-btn-soft" onClick={() => setFxFor(t)}><CalendarDays size={14} /> Fixtures</button><button className="lp-btn lp-btn-soft" onClick={() => setEditId(t.id)}><Pencil size={14} /> Edit team</button></TeamCard>}
          </section>
        ))}
      </div>
      {fxFor && <TeamModal team={fxFor} tab="fixtures" onClose={() => setFxFor(null)} />}
    </div>
  )
}

function TeamEdit({ t, onDone }: { t: MyTeam; onDone: (l: MyTeam[] | null) => void }) {
  const [f, setF] = useState({ description: t.description, coachName: t.coachName, coachWhatsapp: t.coachWhatsapp })
  const [logo, setLogo] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const shown = logo || (!removeLogo ? t.logoUrl : '')

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { setLogo(await shrinkImage(file, 400)); setRemoveLogo(false) } catch { setMsg({ text: 'Could not read that image.', bad: true }) }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      onDone(await cpl<MyTeam[]>('myTeamSave', { id: t.id, ...f, logoBase64: logo ? logo.split(',')[1] : '', logoMime: logo ? 'image/jpeg' : '', removeLogo: removeLogo && !logo }))
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }); setBusy(false) }
  }
  return (
    <form className="cpl-card cpl-form" onSubmit={save}>
      <h3>Edit {t.name}</h3>
      <div className="cpl-logo-pick">
        <div className="cpl-team-logo big">{shown ? <img src={shown} alt="Logo preview" /> : <Shield size={30} />}</div>
        <div className="cpl-avatar-pick" style={{ alignItems: 'flex-start' }}>
          <label className="cpl-upload"><Camera size={15} /> {shown ? 'Change logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} /></label>
          {shown && <button type="button" className="cpl-linkbtn" onClick={() => { setLogo(''); setRemoveLogo(true) }}>Remove logo</button>}
        </div>
      </div>
      <label>Description<textarea rows={4} maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <label>Your full name<input type="text" required minLength={2} maxLength={60} value={f.coachName} onChange={(e) => setF({ ...f, coachName: e.target.value })} /></label>
      <label>Your WhatsApp number<input type="tel" required inputMode="numeric" placeholder="2547XXXXXXXX" value={f.coachWhatsapp} onChange={(e) => setF({ ...f, coachWhatsapp: e.target.value })} /></label>
      <small>The team name, division and coach email are set by the chairman.</small>
      <div className="cpl-inline">
        <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : 'Save team'}</button>
        <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
      </div>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
    </form>
  )
}
