import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, ImagePlus, Loader2, Minus, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import {
  MAX_PHOTOS, PROVIDED_ITEMS, ROOM_TYPE_SUGGESTIONS, compressImage, hostelApi, isGoogleMapsUrl, kes, showPhone, timeAgo,
  type Hostel, type HostelInput, type HostelImage, type Period, type ProvidedState, type RoomType, type UploadImage,
} from '../lib/hostel'

type Props = { onChanged: () => void }

export default function HostelAdmin({ onChanged }: Props) {
  const [list, setList] = useState<Hostel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState('')
  const [editing, setEditing] = useState<Hostel | 'new' | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setList(await hostelApi.adminList()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  function replace(h: Hostel) { setList((cur) => cur.map((x) => (x.id === h.id ? h : x))); onChanged() }

  async function saveRooms(h: Hostel, rooms: { type: string; available: number }[]) {
    setBusyId(h.id); setError(''); setNotice('')
    try { replace(await hostelApi.updateRooms(h.id, rooms)); setNotice(`Rooms updated for ${h.name}.`) }
    catch (e) { setError((e as Error).message) }
    finally { setBusyId('') }
  }

  async function toggleStatus(h: Hostel) {
    setBusyId(h.id); setError(''); setNotice('')
    const status = h.status === 'published' ? 'hidden' : 'published'
    try { replace(await hostelApi.update(h.id, { status })); setNotice(`${h.name} is now ${status === 'published' ? 'visible to students' : 'hidden from students'}.`) }
    catch (e) { setError((e as Error).message) }
    finally { setBusyId('') }
  }

  async function remove(h: Hostel) {
    if (!window.confirm(`Delete "${h.name}" and its photos? This cannot be undone.`)) return
    setBusyId(h.id); setError(''); setNotice('')
    try { await hostelApi.remove(h.id); setList((cur) => cur.filter((x) => x.id !== h.id)); onChanged(); setNotice(`${h.name} deleted.`) }
    catch (e) { setError((e as Error).message) }
    finally { setBusyId('') }
  }

  if (editing) {
    return (
      <HostelForm
        initial={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(h, isNew) => {
          setList((cur) => (isNew ? [h, ...cur] : cur.map((x) => (x.id === h.id ? h : x))))
          onChanged(); setEditing(null); setNotice(isNew ? `${h.name} published.` : `${h.name} saved.`)
        }}
      />
    )
  }

  return (
    <section className="hs-panel">
      <div className="hs-admin-head">
        <div>
          <span className="hs-kicker dark">ADMIN DESK</span>
          <h2>Manage hostels</h2>
          <p>When a landlord texts you, change the free-room counts below and press Save. Students see the new numbers straight away.</p>
        </div>
        <button className="hs-btn hs-btn-green" onClick={() => { setNotice(''); setEditing('new') }}><Plus size={16} /> Add hostel</button>
      </div>

      {notice && <p className="hs-ok" role="status"><CheckCircle2 size={16} /> {notice}</p>}
      {error && <p className="hs-error" role="alert">{error}</p>}

      {loading ? <p className="hs-empty">Loading…</p>
        : list.length === 0 ? <p className="hs-empty">No hostels yet. Press “Add hostel” to publish the first one.</p>
        : (
          <div className="hs-admin-list">
            {list.map((h) => (
              <article className="hs-admin-item" key={h.id}>
                <header>
                  <div>
                    <h3>{h.name}</h3>
                    <p>{h.area}{h.landmark ? ` · ${h.landmark}` : ''} · {h.landlordName || 'landlord'} {h.landlordContact ? `(${showPhone(h.landlordContact)})` : ''}</p>
                  </div>
                  <span className={`hs-status ${h.status}`}>{h.status === 'published' ? 'Published' : 'Hidden'}</span>
                </header>

                <RoomsPanel key={`${h.id}-${h.roomsUpdatedAt}`} h={h} busy={busyId === h.id} onSave={(rooms) => saveRooms(h, rooms)} />

                <div className="hs-admin-actions">
                  <button className="hs-btn hs-btn-soft" onClick={() => { setNotice(''); setEditing(h) }} disabled={busyId === h.id}><Pencil size={14} /> Edit details</button>
                  <button className="hs-btn hs-btn-soft" onClick={() => void toggleStatus(h)} disabled={busyId === h.id}>
                    {h.status === 'published' ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                  </button>
                  <button className="hs-btn hs-btn-danger" onClick={() => void remove(h)} disabled={busyId === h.id}><Trash2 size={14} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
    </section>
  )
}

/* ---------- quick room counts ---------- */

function RoomsPanel({ h, busy, onSave }: { h: Hostel; busy: boolean; onSave: (rooms: { type: string; available: number }[]) => void }) {
  const [draft, setDraft] = useState<Record<string, number>>(() => Object.fromEntries(h.roomTypes.map((r) => [r.type, r.available])))
  const changed = h.roomTypes.filter((r) => draft[r.type] !== r.available)
  const set = (r: RoomType, v: number) => setDraft((d) => ({ ...d, [r.type]: Math.max(0, Math.min(r.total, Number.isFinite(v) ? Math.floor(v) : 0)) }))

  return (
    <div className="hs-roomsedit">
      {h.roomTypes.map((r) => (
        <div className="hs-roomrow" key={r.type}>
          <span className="hs-roomrow-name">{r.type}<small>{kes(r.rent)} / {r.period}</small></span>
          <div className="hs-stepper">
            <button type="button" onClick={() => set(r, draft[r.type] - 1)} aria-label={`One less ${r.type}`}><Minus size={14} /></button>
            <input type="number" inputMode="numeric" min={0} max={r.total} value={draft[r.type]} onChange={(e) => set(r, Number(e.target.value))} aria-label={`Free ${r.type} rooms`} />
            <button type="button" onClick={() => set(r, draft[r.type] + 1)} aria-label={`One more ${r.type}`}><Plus size={14} /></button>
          </div>
          <span className="hs-roomrow-of">free of {r.total}</span>
          <button type="button" className="hs-linkbtn" onClick={() => set(r, 0)}>Mark full</button>
        </div>
      ))}
      <div className="hs-roomsedit-foot">
        <small>Last updated {timeAgo(h.roomsUpdatedAt) || 'never'}</small>
        <button className="hs-btn hs-btn-green" disabled={busy || changed.length === 0} onClick={() => onSave(changed.map((r) => ({ type: r.type, available: draft[r.type] })))}>
          {busy ? <Loader2 size={15} className="hs-spin" /> : <Save size={15} />} Save rooms
        </button>
      </div>
    </div>
  )
}

/* ---------- add / edit form ---------- */

type RoomDraft = { type: string; rent: string; period: Period; total: string; available: string }
type NewPhoto = UploadImage & { preview: string }
const blankRoom = (): RoomDraft => ({ type: '', rent: '', period: 'month', total: '', available: '' })

function HostelForm({ initial, onClose, onSaved }: { initial: Hostel | null; onClose: () => void; onSaved: (h: Hostel, isNew: boolean) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [area, setArea] = useState(initial?.area ?? '')
  const [landmark, setLandmark] = useState(initial?.landmark ?? '')
  const [walkingTime, setWalkingTime] = useState(initial?.walkingTime ?? '')
  const [locationUrl, setLocationUrl] = useState(initial?.locationUrl ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [landlordName, setLandlordName] = useState(initial?.landlordName ?? '')
  const [landlordContact, setLandlordContact] = useState(initial?.landlordContact ? showPhone(initial.landlordContact) : '')
  const [showContact, setShowContact] = useState(initial?.showContact ?? false)
  const [deposit, setDeposit] = useState(initial?.deposit ?? '')
  const [rules, setRules] = useState(initial?.rules ?? '')
  const [verified, setVerified] = useState(initial?.verified ?? false)
  const [status, setStatus] = useState<'published' | 'hidden'>(initial?.status ?? 'published')
  const [rooms, setRooms] = useState<RoomDraft[]>(
    initial?.roomTypes.map((r) => ({ type: r.type, rent: String(r.rent), period: r.period, total: String(r.total), available: String(r.available) })) ?? [blankRoom()],
  )
  const [provided, setProvided] = useState<Record<string, ProvidedState>>(initial?.provided ?? {})
  const [keptImages, setKeptImages] = useState<HostelImage[]>(initial?.images ?? [])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([])
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const slotsLeft = MAX_PHOTOS - keptImages.length - newPhotos.length

  const setRoom = (i: number, patch: Partial<RoomDraft>) => setRooms((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  async function pickPhotos(files: FileList | null) {
    if (!files) return
    setError('')
    try {
      const picked = await Promise.all(Array.from(files).slice(0, slotsLeft).map(compressImage))
      setNewPhotos((cur) => [...cur, ...picked])
    } catch (e) { setError((e as Error).message) }
  }

  function removeKept(img: HostelImage) {
    setKeptImages((cur) => cur.filter((x) => x.id !== img.id))
    setRemovedIds((cur) => [...cur, img.id])
  }

  function buildRooms(): RoomType[] {
    return rooms.map((r) => {
      const type = r.type.trim()
      const rent = Number(r.rent), total = Number(r.total), available = Number(r.available)
      if (!type) throw new Error('Every room type needs a name.')
      if (![rent, total, available].every((n) => Number.isInteger(n) && n >= 0)) throw new Error(`Check the rent and room numbers for ${type}.`)
      if (available > total) throw new Error(`Free rooms for ${type} cannot be more than the total.`)
      return { type, rent, period: r.period, total, available }
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (!name.trim() || !area.trim()) throw new Error('Hostel name and area are required.')
      if (!isGoogleMapsUrl(locationUrl)) throw new Error('Paste a Google Maps link (in Google Maps: Share → Copy link).')
      if (!landlordName.trim() || !landlordContact.trim()) throw new Error('Landlord name and phone number are required.')
      const roomTypes = buildRooms()
      if (!initial && !consent) throw new Error('Please confirm the landlord agreed to the listing.')
      if (!initial && newPhotos.length === 0) throw new Error('Add at least one photo.')

      const input: HostelInput = {
        status, name, area, landmark, walkingTime, locationUrl, description, landlordName, landlordContact, showContact,
        roomTypes, provided, deposit, rules, verified,
      }
      const added: UploadImage[] = newPhotos.map(({ name: n, mime, data }) => ({ name: n, mime, data }))
      setBusy(true)
      if (initial) {
        const payload: Partial<HostelInput> = { ...input }
        if (JSON.stringify(roomTypes) === JSON.stringify(initial.roomTypes)) delete payload.roomTypes // keep "rooms updated" time honest
        onSaved(await hostelApi.update(initial.id, payload, { removeImageIds: removedIds, newImages: added }), false)
      } else {
        onSaved(await hostelApi.create(input, added), true)
      }
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <form className="hs-panel hs-form" onSubmit={submit}>
      <div className="hs-admin-head">
        <div>
          <span className="hs-kicker dark">{initial ? 'EDIT HOSTEL' : 'ADD HOSTEL'}</span>
          <h2>{initial ? initial.name : 'New hostel'}</h2>
        </div>
        <button type="button" className="hs-btn hs-btn-soft" onClick={onClose}><X size={15} /> Cancel</button>
      </div>

      <fieldset>
        <legend>Basics</legend>
        <div className="hs-fgrid">
          <label>Hostel name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required /></label>
          <label>Area<input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="e.g. Kamwenja" required /></label>
          <label>Landmark<input value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={120} placeholder="e.g. near the main gate" /></label>
          <label>Walking time to campus<input value={walkingTime} onChange={(e) => setWalkingTime(e.target.value)} maxLength={60} placeholder="e.g. 10 min to main gate" /></label>
          <label className="wide">Google Maps link
            <input value={locationUrl} onChange={(e) => setLocationUrl(e.target.value)} placeholder="https://maps.app.goo.gl/…" required />
            <small>In Google Maps: open the hostel, tap Share, then Copy link.</small>
          </label>
          <label className="wide">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Room types &amp; rent</legend>
        <datalist id="hs-room-suggestions">{ROOM_TYPE_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
        <div className="hs-rtable">
          {rooms.map((r, i) => (
            <div className="hs-rrow" key={i}>
              <label>Type<input list="hs-room-suggestions" value={r.type} onChange={(e) => setRoom(i, { type: e.target.value })} maxLength={40} placeholder="Bedsitter" /></label>
              <label>Rent (KSh)<input type="number" inputMode="numeric" min={0} value={r.rent} onChange={(e) => setRoom(i, { rent: e.target.value })} /></label>
              <label>Per<select value={r.period} onChange={(e) => setRoom(i, { period: e.target.value as Period })}><option value="month">month</option><option value="semester">semester</option></select></label>
              <label>Total rooms<input type="number" inputMode="numeric" min={0} value={r.total} onChange={(e) => setRoom(i, { total: e.target.value })} /></label>
              <label>Free now<input type="number" inputMode="numeric" min={0} value={r.available} onChange={(e) => setRoom(i, { available: e.target.value })} /></label>
              <button type="button" className="hs-iconbtn" onClick={() => setRooms((cur) => cur.filter((_, idx) => idx !== i))} disabled={rooms.length === 1} aria-label="Remove this room type"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" className="hs-btn hs-btn-soft" onClick={() => setRooms((cur) => [...cur, blankRoom()])} disabled={rooms.length >= 8}><Plus size={14} /> Add room type</button>
      </fieldset>

      <fieldset>
        <legend>What is provided</legend>
        <div className="hs-pgrid">
          {PROVIDED_ITEMS.map((p) => (
            <label key={p.key}>{p.label}
              <select
                value={provided[p.key] ?? ''}
                onChange={(e) => setProvided((cur) => {
                  const next = { ...cur }
                  if (e.target.value) next[p.key] = e.target.value as ProvidedState
                  else delete next[p.key]
                  return next
                })}
              >
                <option value="">Not provided</option>
                <option value="included">Included in rent</option>
                <option value="extra">Extra cost</option>
              </select>
            </label>
          ))}
        </div>
        <div className="hs-fgrid">
          <label>Deposit<input value={deposit} onChange={(e) => setDeposit(e.target.value)} maxLength={60} placeholder="e.g. KSh 3,000 refundable" /></label>
          <label className="wide">House rules<textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} maxLength={800} placeholder="Visitors, curfew, notice period, payment terms…" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Landlord</legend>
        <div className="hs-fgrid">
          <label>Landlord name<input value={landlordName} onChange={(e) => setLandlordName(e.target.value)} maxLength={80} required /></label>
          <label>Phone number<input value={landlordContact} onChange={(e) => setLandlordContact(e.target.value)} inputMode="tel" placeholder="0712 345 678" required /></label>
        </div>
        <label className="hs-check"><input type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} /> The landlord agreed that students can see this phone number (otherwise students only get the “Ask admin” button)</label>
      </fieldset>

      <fieldset>
        <legend>Photos ({keptImages.length + newPhotos.length}/{MAX_PHOTOS})</legend>
        <div className="hs-photos">
          {keptImages.map((img) => (
            <div className="hs-photo" key={img.id}><img src={img.url} alt="" /><button type="button" onClick={() => removeKept(img)} aria-label="Remove photo"><X size={14} /></button></div>
          ))}
          {newPhotos.map((p, i) => (
            <div className="hs-photo" key={i}><img src={p.preview} alt="" /><button type="button" onClick={() => setNewPhotos((cur) => cur.filter((_, idx) => idx !== i))} aria-label="Remove photo"><X size={14} /></button></div>
          ))}
          {slotsLeft > 0 && (
            <label className="hs-photo add"><ImagePlus size={22} /><span>Add photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { void pickPhotos(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
        <small>Photos are shrunk automatically before upload.</small>
      </fieldset>

      <fieldset>
        <legend>Visibility</legend>
        <label className="hs-check"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified (the admin has checked this hostel)</label>
        <label className="hs-check"><input type="checkbox" checked={status === 'published'} onChange={(e) => setStatus(e.target.checked ? 'published' : 'hidden')} /> Visible to students</label>
        {!initial && <label className="hs-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> The landlord agreed to this listing and to the use of these photos.</label>}
      </fieldset>

      {error && <p className="hs-error" role="alert">{error}</p>}
      <div className="hs-admin-actions">
        <button className="hs-btn hs-btn-green" disabled={busy}>{busy ? <Loader2 size={15} className="hs-spin" /> : <Save size={15} />} {initial ? 'Save changes' : 'Publish hostel'}</button>
        <button type="button" className="hs-btn hs-btn-soft" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}
