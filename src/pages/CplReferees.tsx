import { useEffect, useState, type FormEvent } from 'react'
import { Mail, Pencil, Trash2, Whistle } from 'lucide-react'
import { cpl, type Referee } from '../lib/cpl'
import ImagePicker from '../components/ImagePicker'

const EMPTY = { id: '', name: '', email: '' }

export default function CplReferees() {
  const [list, setList] = useState<Referee[] | null>(null)
  const [f, setF] = useState(EMPTY)
  const [img, setImg] = useState({ data: '', removed: false })
  const [cur, setCur] = useState('')
  const [fk, setFk] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  useEffect(() => { cpl<Referee[]>('refereesList').then(setList).catch((e) => setMsg({ text: e.message, bad: true })) }, [])

  function reset() { setF(EMPTY); setImg({ data: '', removed: false }); setCur(''); setFk((n) => n + 1) }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      setList(await cpl<Referee[]>('refereeSave', { ...f, imageBase64: img.data ? img.data.split(',')[1] : '', imageMime: img.data ? 'image/jpeg' : '', removeImage: img.removed && !img.data }))
      setMsg({ text: f.id ? 'Referee updated.' : 'Referee added.' }); reset()
    }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }
  async function remove(r: Referee) {
    if (!window.confirm(`Remove ${r.name}?`)) return
    setBusy(true); setMsg(null)
    try { setList(await cpl<Referee[]>('refereeDelete', { id: r.id })); if (f.id === r.id) reset() }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }

  return (
    <div className="cpl-page">
      <h2>Referees</h2>
      <p className="cpl-sub">Referees on the CPL panel. Their emails are visible to chairmen only.</p>
      <form className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <h3>{f.id ? 'Edit referee' : 'Add a referee'}</h3>
        <ImagePicker key={fk} current={cur} label="photo" round fallback={<Whistle size={30} />} onChange={setImg} />
        <div className="cpl-grid2">
          <label>Full name<input type="text" required minLength={2} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        </div>
        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add referee'}</button>
          {f.id && <button type="button" className="lp-btn lp-btn-soft" onClick={reset}>Cancel edit</button>}
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>
      <section className="cpl-card">
        <h3>Panel ({list?.length ?? 0})</h3>
        {list === null && <p className="cpl-empty">Loading…</p>}
        {list?.length === 0 && <p className="cpl-empty">No referees yet.</p>}
        {list?.map((r) => (
          <div className="cpl-row" key={r.id}>
            <div className="cpl-team-logo">{r.imageUrl ? <img src={r.imageUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Whistle size={20} />}</div>
            <div><strong>{r.name}</strong><small><Mail size={12} style={{ verticalAlign: '-1px' }} /> {r.email}</small></div>
            <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => { setF({ id: r.id, name: r.name, email: r.email }); setCur(r.imageUrl); setImg({ data: '', removed: false }); setFk((n) => n + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-label={`Edit ${r.name}`}><Pencil size={14} /></button>
            <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => remove(r)} aria-label={`Remove ${r.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
      </section>
    </div>
  )
}
