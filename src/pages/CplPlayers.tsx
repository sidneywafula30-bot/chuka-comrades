import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Pencil, Trash2, UserRound } from 'lucide-react'
import { cpl, POSITIONS, type Player, type Team } from '../lib/cpl'
import ImagePicker from '../components/ImagePicker'
import PlayerCard from '../components/PlayerCard'

const EMPTY = { id: '', name: '', email: '', position: '', number: '', phone: '', bio: '' }
type Msg = { text: string; bad?: boolean } | null

/** Coach/chairman page: add, edit and remove the players of one team. */
export default function CplPlayers({ team, onBack }: { team: Team; onBack: () => void }) {
  const [list, setList] = useState<Player[] | null>(null)
  const [f, setF] = useState(EMPTY)
  const [img, setImg] = useState({ data: '', removed: false })
  const [cur, setCur] = useState('')
  const [fk, setFk] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const set = (k: keyof typeof EMPTY, v: string) => setF((p) => ({ ...p, [k]: v }))

  useEffect(() => { cpl<Player[]>('playersList', { teamId: team.id }).then(setList).catch((e) => setMsg({ text: e.message, bad: true })) }, [team.id])

  function reset() { setF(EMPTY); setImg({ data: '', removed: false }); setCur(''); setFk((n) => n + 1) }
  function edit(p: Player) {
    setF({ id: p.id, name: p.name, email: p.email, position: p.position, number: p.number, phone: p.phone, bio: p.bio })
    setImg({ data: '', removed: false }); setCur(p.imageUrl); setFk((n) => n + 1); setMsg(null)
    document.getElementById('player-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      setList(await cpl<Player[]>('playerSave', { ...f, teamId: team.id, imageBase64: img.data ? img.data.split(',')[1] : '', imageMime: img.data ? 'image/jpeg' : '', removeImage: img.removed && !img.data }))
      setMsg({ text: f.id ? 'Player updated.' : 'Player added. They can now sign in with that email to edit their own profile.' }); reset()
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }
  async function remove(p: Player) {
    if (!window.confirm(`Remove ${p.name} from ${team.name}?`)) return
    setBusy(true); setMsg(null)
    try { setList(await cpl<Player[]>('playerDelete', { id: p.id })); if (f.id === p.id) reset() }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }

  return (
    <div className="cpl-page">
      <button className="cpl-back cpl-linkbtn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
      <h2>{team.name}: players</h2>
      <p className="cpl-sub">Add each player with the email he signs in with. He can then update his own photo and details.</p>

      <form id="player-form" className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <h3>{f.id ? 'Edit player' : 'Add a player'}</h3>
        <ImagePicker key={fk} current={cur} label="photo" round fallback={<UserRound size={30} />} onChange={setImg} />
        <div className="cpl-grid2">
          <label>Full name<input type="text" required minLength={2} maxLength={60} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Email<input type="email" required value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
          <label>Position
            <select required value={f.position} onChange={(e) => set('position', e.target.value)}>
              <option value="">Select position…</option>
              {POSITIONS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Shirt number<input type="number" min={0} max={99} value={f.number} onChange={(e) => set('number', e.target.value)} /></label>
          <label>Phone / WhatsApp<input type="tel" inputMode="numeric" placeholder="2547XXXXXXXX" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
        </div>
        <label>About<textarea rows={3} maxLength={300} value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Course, year, strengths…" /></label>
        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add player'}</button>
          {f.id && <button type="button" className="lp-btn lp-btn-soft" onClick={reset}>Cancel edit</button>}
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>

      <h3 className="cpl-h3">Squad ({list?.length ?? 0})</h3>
      {list === null && <p className="cpl-empty">Loading…</p>}
      {list?.length === 0 && <p className="cpl-empty">No players yet.</p>}
      <div className="cpl-pl-grid">
        {list?.map((p) => (
          <PlayerCard key={p.id} p={p}>
            <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => edit(p)}><Pencil size={14} /> Edit</button>
            <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => remove(p)} aria-label={`Remove ${p.name}`}><Trash2 size={14} /></button>
          </PlayerCard>
        ))}
      </div>
    </div>
  )
}
