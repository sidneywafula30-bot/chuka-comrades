import { useState, type FormEvent } from 'react'
import { Pencil, UserRound } from 'lucide-react'
import { cpl, POSITIONS, type MyPlayer } from '../lib/cpl'
import ImagePicker from '../components/ImagePicker'

type Msg = { text: string; bad?: boolean } | null

/** A player's own profile page (one card per team he plays for). */
export default function CplPlayerProfile({ players: initial }: { players: MyPlayer[] }) {
  const [players, setPlayers] = useState(initial)
  const [editId, setEditId] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  return (
    <div className="cpl-page">
      <h2>My player profile</h2>
      <p className="cpl-sub">This is what the public sees in your team's squad. Your email and phone are visible to your coach and the chairmen only.</p>
      {msg && <p className="cpl-msg" role="status">{msg.text}</p>}
      <div className="cpl-myteams">
        {players.map((p) => editId === p.id
          ? <Edit key={p.id} p={p} onDone={(l) => { if (l) { setPlayers(l); setMsg({ text: 'Profile saved.' }) } setEditId(null) }} />
          : (
            <section key={p.id} className="cpl-card cpl-pcard cpl-myplayer">
              <div className="cpl-pcard-banner" />
              <div className="cpl-pcard-body">
                <div className="cpl-avatar-ring lg">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <span className="ph"><UserRound size={34} /></span>}</div>
                <small className="cpl-eyebrow">{p.teamName}{p.seasonName && ` · ${p.seasonName}`}</small>
                <h3>{p.name}{p.number && <span className="cpl-shirt"> #{p.number}</span>}</h3>
                <span className={`cpl-pos pos-${p.position}`}>{p.position}</span>
                {p.bio && <p className="cpl-desc" style={{ textAlign: 'center' }}>{p.bio}</p>}
                <ul className="cpl-pcard-contacts" style={{ marginTop: 14 }}>
                  <li><span>Email</span><b>{p.email}</b></li>
                  <li><span>Phone</span><b>{p.phone ? `+${p.phone}` : 'Not set'}</b></li>
                </ul>
                <button className="lp-btn" onClick={() => { setEditId(p.id); setMsg(null) }}><Pencil size={15} /> Edit my profile</button>
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}

function Edit({ p, onDone }: { p: MyPlayer; onDone: (l: MyPlayer[] | null) => void }) {
  const [f, setF] = useState({ name: p.name, position: p.position, number: p.number, phone: p.phone, bio: p.bio })
  const [img, setImg] = useState({ data: '', removed: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { onDone(await cpl<MyPlayer[]>('myPlayerSave', { id: p.id, ...f, imageBase64: img.data ? img.data.split(',')[1] : '', imageMime: img.data ? 'image/jpeg' : '', removeImage: img.removed && !img.data })) }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }); setBusy(false) }
  }
  return (
    <form className="cpl-card cpl-form cpl-pform" onSubmit={save}>
      <h3>Edit my profile</h3>
      <ImagePicker current={p.imageUrl} label="photo" round fallback={<UserRound size={30} />} onChange={setImg} />
      <label>Full name<input type="text" required minLength={2} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="cpl-grid2">
        <label>Position
          <select required value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })}>{POSITIONS.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <label>Shirt number<input type="number" min={0} max={99} value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></label>
      </div>
      <label>Phone / WhatsApp<input type="tel" inputMode="numeric" placeholder="2547XXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label>About me<textarea rows={3} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
      <small>Your team and email are set by your coach.</small>
      <div className="cpl-inline">
        <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
      </div>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
    </form>
  )
}
