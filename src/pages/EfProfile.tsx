import { useEffect, useState, type FormEvent } from 'react'
import { Gamepad2 } from 'lucide-react'
import ImagePicker from '../components/ImagePicker'
import { DAYS, PARTS, PLATFORMS, driveImg, ef, fmtStamp, ksh, type Course, type Me, type PayView, type Profile } from '../lib/efootball'
import { useApi } from '../lib/efHooks'

export default function EfProfile({ me, reload, error }: { me: Me | null; reload: () => Promise<void>; error: string }) {
  const [courses, setCourses] = useState<Course[]>([])
  const p = me?.profile ?? null
  useEffect(() => { ef<Course[]>('courses').then(setCourses).catch(() => {}) }, [])
  if (!me) return <Waiting error={error} retry={reload} />
  return <Form key={p?.uid ?? 'new'} p={p} courses={courses} reload={reload} />
}

function Waiting({ error, retry }: { error: string; retry: () => Promise<void> }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t) }, [])
  if (error) return (
    <div className="cpl-page">
      <p className="cpl-err" role="alert">{error}</p>
      <div className="ef-actions"><button className="lp-btn" onClick={() => void retry()}>Try again</button></div>
    </div>
  )
  return (
    <div className="cpl-page">
      <p className="cpl-empty">Loading your account…</p>
      {slow && <p className="cpl-note">This is taking longer than usual. The server may be waking up.</p>}
      {slow && <div className="ef-actions"><button className="lp-btn" onClick={() => void retry()}>Try again</button></div>}
    </div>
  )
}

function Form({ p, courses, reload }: { p: Profile | null; courses: Course[]; reload: () => Promise<void> }) {
  const [username, setUsername] = useState(p?.username ?? '')
  const [fullName, setFullName] = useState(p?.fullName ?? '')
  const [course, setCourse] = useState(p?.course ?? '')
  const [year, setYear] = useState(String(p?.year ?? 1))
  const [platform, setPlatform] = useState(p?.platform ?? 'Mobile')
  const [strength, setStrength] = useState(p ? String(p.strength) : '')
  const [whatsapp, setWhatsapp] = useState(p?.whatsapp ?? '')
  const [canHost, setCanHost] = useState(p?.canHost ?? false)
  const [showWa, setShowWa] = useState(p?.showWhatsapp ?? true)
  const [free, setFree] = useState<string[]>(p?.freeTimes ?? [])
  const [squad, setSquad] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const toggle = (s: string) => setFree((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]))

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      await ef('saveProfile', { profile: { username, fullName, course, year: Number(year), platform, strength: Number(strength), whatsapp, freeTimes: free, canHost, showWhatsapp: showWa, squad: squad || undefined } })
      await reload()
      setMsg({ ok: true, text: p ? 'Profile saved.' : 'You are registered. Open the League page and tap Join to get daily fixtures.' })
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="cpl-page">
      <h2>{p ? 'My eFootball profile' : 'Register as a player'}</h2>
      <p className="cpl-sub">Your WhatsApp number is shown to opponents you are matched with and to the admin. Other players see it only if you tick the box below.</p>
      <form className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <label>eFootball username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} required /></label>
        <label>Full name<input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={60} required /></label>
        <div className="cpl-grid2">
          <label>Course
            <select value={course} onChange={(e) => setCourse(e.target.value)} required>
              <option value="">Choose your course</option>
              {course && !courses.some((c) => c.name === course) && <option value={course}>{course}</option>}
              {courses.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <small>Course not here? <a href="#/efootball/league/list">List my course</a> (KSh 10, the admin opens it).</small>
          </label>
          <label>Year of study
            <select value={year} onChange={(e) => setYear(e.target.value)}>{[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}</select>
          </label>
        </div>
        <div className="cpl-grid2">
          <label>Platform
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <label>Team strength<input type="number" inputMode="numeric" value={strength} onChange={(e) => setStrength(e.target.value)} min={500} max={6000} placeholder="e.g. 2850" required />
            <small>The number on your squad screen. Your squad image is the proof.</small>
          </label>
        </div>
        <label>WhatsApp number<input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="0712 345 678" required /></label>

        <fieldset className="cpl-fs">
          <legend>Squad image</legend>
          <ImagePicker current={driveImg(p?.squadId ?? '', 600)} fallback={<Gamepad2 size={28} />} label="squad image" max={1280} onChange={(v) => setSquad(v.data)} />
          <small>A clear screenshot of your squad screen showing the team strength.</small>
        </fieldset>

        <fieldset className="cpl-fs">
          <legend>Free times</legend>
          <div className="ef-slots" role="group" aria-label="Free times">
            <span />{PARTS.map((x) => <b key={x}>{x.slice(0, 5)}</b>)}
            {DAYS.map((d) => (
              <FragmentRow key={d} day={d} free={free} toggle={toggle} />
            ))}
          </div>
          <small>Shown on your player card and used to suggest when you and your league opponent can play. League fixtures come on Mon, Wed, Fri and Sun. Leave it empty if you are free any day.</small>
        </fieldset>

        <label className="cpl-file"><input type="checkbox" checked={showWa} onChange={(e) => setShowWa(e.target.checked)} /> Show a WhatsApp “Chat” button on my player card. Other registered players can then message me on WhatsApp for a match, and will be able to see my number</label>
        <label className="cpl-file"><input type="checkbox" checked={canHost} onChange={(e) => setCanHost(e.target.checked)} /> I can host a tournament room (good internet)</label>
        <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : p ? 'Save profile' : 'Register'}</button>
        {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>}
      </form>
      {p && <MyPayments />}
    </div>
  )
}

function FragmentRow({ day, free, toggle }: { day: string; free: string[]; toggle: (s: string) => void }) {
  return (
    <>
      <b>{day}</b>
      {PARTS.map((x) => {
        const k = `${day}-${x}`
        return <button type="button" key={k} className={free.includes(k) ? 'on' : ''} aria-pressed={free.includes(k)} aria-label={`${day} ${x}`} onClick={() => toggle(k)}>{free.includes(k) ? '✓' : ''}</button>
      })}
    </>
  )
}

function MyPayments() {
  const { data } = useApi<PayView[]>('myPayments')
  if (!data || !data.length) return null
  return (
    <section className="cpl-card" style={{ marginTop: 16 }}>
      <h3>My payments</h3>
      {data.map((x) => (
        <div className="cpl-row" key={x.id}>
          <div><strong>{x.label}</strong><small>{ksh(x.amount)} · {x.mpesa} · {fmtStamp(x.createdAt)}{x.note ? ` · ${x.note}` : ''}</small></div>
          <span className={`ef-pill${x.status === 'verified' ? '' : x.status === 'rejected' ? ' red' : ' gold'}`}>{x.status === 'pending' ? 'waiting for admin' : x.status}</span>
        </div>
      ))}
    </section>
  )
}
