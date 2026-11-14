import { useEffect, useState, type FormEvent } from 'react'
import { MapPin, Pencil, Trash2 } from 'lucide-react'
import { cpl, type Venue } from '../lib/cpl'
import ImagePicker from '../components/ImagePicker'
import VenueCard from '../components/VenueCard'

const EMPTY = { id: '', name: '', mapsUrl: '', description: '' }

export default function CplVenues() {
  const [list, setList] = useState<Venue[] | null>(null)
  const [f, setF] = useState(EMPTY)
  const [img, setImg] = useState({ data: '', removed: false })
  const [cur, setCur] = useState('')
  const [fk, setFk] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  useEffect(() => { cpl<Venue[]>('venuesList').then(setList).catch((e) => setMsg({ text: e.message, bad: true })) }, [])

  function reset() { setF(EMPTY); setImg({ data: '', removed: false }); setCur(''); setFk((n) => n + 1) }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      setList(await cpl<Venue[]>('venueSave', { ...f, imageBase64: img.data ? img.data.split(',')[1] : '', imageMime: img.data ? 'image/jpeg' : '', removeImage: img.removed && !img.data }))
      setMsg({ text: f.id ? 'Venue updated.' : 'Venue added.' }); reset()
    } catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }
  async function remove(v: Venue) {
    if (!window.confirm(`Delete ${v.name}?`)) return
    setBusy(true); setMsg(null)
    try { setList(await cpl<Venue[]>('venueDelete', { id: v.id })); if (f.id === v.id) reset() }
    catch (x) { setMsg({ text: (x as Error).message, bad: true }) } finally { setBusy(false) }
  }

  return (
    <div className="cpl-page">
      <h2>Venues</h2>
      <p className="cpl-sub">Pitches where CPL matches are played.</p>
      <form className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <h3>{f.id ? 'Edit venue' : 'Add a venue'}</h3>
        <ImagePicker key={fk} current={cur} label="image" max={1280} fallback={<MapPin size={30} />} onChange={setImg} />
        <label>Venue name<input type="text" required minLength={2} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>Google Maps link<input type="url" placeholder="https://maps.app.goo.gl/…" value={f.mapsUrl} onChange={(e) => setF({ ...f, mapsUrl: e.target.value })} />
          <small>In Google Maps tap Share, then Copy link.</small></label>
        <label>Description<textarea rows={3} maxLength={600} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Surface, capacity, how to get there…" /></label>
        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add venue'}</button>
          {f.id && <button type="button" className="lp-btn lp-btn-soft" onClick={reset}>Cancel edit</button>}
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>
      <h3 className="cpl-h3">All venues ({list?.length ?? 0})</h3>
      {list === null && <p className="cpl-empty">Loading…</p>}
      {list?.length === 0 && <p className="cpl-empty">No venues yet.</p>}
      <div className="cpl-vn-grid">
        {list?.map((v) => (
          <VenueCard key={v.id} v={v}>
            <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => { setF({ id: v.id, name: v.name, mapsUrl: v.mapsUrl, description: v.description }); setCur(v.imageUrl); setImg({ data: '', removed: false }); setFk((n) => n + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={14} /> Edit</button>
            <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => remove(v)} aria-label={`Delete ${v.name}`}><Trash2 size={14} /></button>
          </VenueCard>
        ))}
      </div>
    </div>
  )
}
