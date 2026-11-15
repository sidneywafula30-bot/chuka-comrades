import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, LoaderCircle, MapPin, Pencil, Trash2, X } from 'lucide-react'
import { labsApi, eventKindOf, type CalEvent, type EventInput, type EventKind } from '../lib/labs'

type Note = { type: 'ok' | 'err'; text: string } | null

const KIND_LABEL: Record<EventKind, string> = { exam: 'Exam', cat: 'CAT', important: 'Important date', event: 'Event' }
const TZ = 'Africa/Nairobi'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

/** Date part (YYYY-MM-DD) of an all-day date or a dateTime. Google sends dateTimes in the calendar's own timezone. */
const dayOf = (s: string) => s.slice(0, 10)

function timeOf(s: string) {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })
}

function whenText(e: CalEvent) {
  const sd = dayOf(e.start)
  const ed = dayOf(e.end)
  const fmt = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  if (e.allDay) return sd === ed ? `${fmt(sd)} · all day` : `${fmt(sd)} – ${fmt(ed)}`
  const t1 = timeOf(e.start)
  const t2 = timeOf(e.end)
  if (sd === ed) return `${fmt(sd)} · ${t1}${t2 && t2 !== t1 ? ` – ${t2}` : ''}`
  return `${fmt(sd)} ${t1} – ${fmt(ed)} ${t2}`
}

/** Every day an event touches (capped) so multi-day events show on each day. */
function daysOf(e: CalEvent) {
  const out: string[] = []
  let cur = new Date(`${dayOf(e.start)}T00:00:00`)
  const last = dayOf(e.end)
  for (let i = 0; i < 31; i++) {
    const k = ymd(cur)
    out.push(k)
    if (k >= last) break
    cur = addDays(cur, 1)
  }
  return out
}

function EventLine({ e }: { e: CalEvent }) {
  return (
    <li className={`sl-ev k-${e.kind}`}>
      <span className="sl-ev-bar" />
      <div>
        <strong>{e.title}</strong>
        <small><Clock size={11} /> {whenText(e)}</small>
        {e.location && <small><MapPin size={11} /> {e.location}</small>}
        {e.description && <p>{e.description}</p>}
      </div>
      <span className="sl-ev-kind">{KIND_LABEL[e.kind]}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* Student view: month grid + coming up                                */
/* ------------------------------------------------------------------ */
export function CalendarCard({ isAdmin }: { isAdmin: boolean }) {
  const today = useMemo(() => new Date(), [])
  const todayKey = ymd(today)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [monthEvents, setMonthEvents] = useState<CalEvent[] | null>(null)
  const [upcoming, setUpcoming] = useState<CalEvent[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState(todayKey)

  // The grid always shows 6 whole weeks (Monday first), so ask for exactly those 42 days.
  const gridStart = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    return addDays(first, -offset)
  }, [month])

  useEffect(() => {
    let live = true
    setMonthEvents(null)
    labsApi.events(ymd(gridStart), ymd(addDays(gridStart, 41)))
      .then((r) => { if (!live) return; setConfigured(r.configured); setMonthEvents(r.events); setErr('') })
      .catch((e) => { if (!live) return; setErr(errMsg(e)); setMonthEvents([]) })
    return () => { live = false }
  }, [gridStart])

  useEffect(() => {
    let live = true
    labsApi.events(todayKey, ymd(addDays(today, 60)))
      .then((r) => { if (live) setUpcoming(r.events.filter((e) => dayOf(e.end) >= todayKey).slice(0, 8)) })
      .catch(() => { if (live) setUpcoming([]) })
    return () => { live = false }
  }, [todayKey, today])

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of monthEvents ?? []) for (const k of daysOf(e)) m.set(k, [...(m.get(k) ?? []), e])
    return m
  }, [monthEvents])

  if (!configured) {
    return isAdmin ? (
      <section className="sl-card sl-cal"><h2><CalendarDays size={17} /> Exams &amp; important dates</h2>
        <p className="sl-sub">The calendar is not connected yet. Set CALENDAR_ID in Config.gs (SETUP.md step 9), then deploy a new version.</p></section>
    ) : null
  }

  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const dayEvents = byDay.get(picked) ?? []
  const monthName = month.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })

  return (
    <section className="sl-card sl-cal">
      <div className="sl-cal-head">
        <h2><CalendarDays size={17} /> Exams, CATs &amp; important dates</h2>
        <div className="sl-cal-nav">
          <button className="sl-icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
          <strong>{monthName}</strong>
          <button className="sl-icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
          <button className="sl-mini ghost" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setPicked(todayKey) }}>Today</button>
        </div>
      </div>
      {err && <p className="sl-alert err">{err}</p>}

      <div className="sl-cal-layout">
        <div>
          <div className="sl-cal-grid" role="grid" aria-label={monthName}>
            {WEEKDAYS.map((w) => <span key={w} className="sl-cal-dow">{w}</span>)}
            {cells.map((d) => {
              const k = ymd(d)
              const evs = byDay.get(k) ?? []
              const kinds = Array.from(new Set(evs.map((e) => e.kind))).slice(0, 3)
              const cls = ['sl-cal-day', d.getMonth() !== month.getMonth() ? 'other' : '', k === todayKey ? 'today' : '', k === picked ? 'picked' : ''].join(' ')
              return (
                <button key={k} className={cls} onClick={() => setPicked(k)} aria-label={`${d.toDateString()}${evs.length ? `, ${evs.length} events` : ''}`}>
                  <span>{d.getDate()}</span>
                  <i>{kinds.map((kd) => <b key={kd} className={`k-${kd}`} />)}</i>
                </button>
              )
            })}
          </div>
          <div className="sl-cal-legend">
            <span><b className="k-exam" /> Exam</span><span><b className="k-cat" /> CAT</span><span><b className="k-important" /> Important date</span><span><b className="k-event" /> Other</span>
          </div>
          <div className="sl-cal-day-list">
            <h3>{new Date(`${picked}T00:00:00`).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {monthEvents === null ? <p className="sl-sub"><LoaderCircle size={14} className="sl-spin" /> Loading…</p>
              : dayEvents.length === 0 ? <p className="sl-sub">Nothing scheduled this day.</p>
                : <ul className="sl-ev-list">{dayEvents.map((e) => <EventLine key={`${e.id}${picked}`} e={e} />)}</ul>}
          </div>
        </div>

        <aside className="sl-cal-up">
          <h3>Coming up</h3>
          {upcoming === null ? <p className="sl-sub"><LoaderCircle size={14} className="sl-spin" /> Loading…</p>
            : upcoming.length === 0 ? <p className="sl-sub">No dates in the next 60 days.</p>
              : <ul className="sl-ev-list">{upcoming.map((e) => <EventLine key={e.id} e={e} />)}</ul>}
        </aside>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Admin: add / edit / delete events                                   */
/* ------------------------------------------------------------------ */
type Draft = EventInput & { kind: EventKind }
const emptyDraft = (): Draft => ({ title: '', kind: 'exam', date: ymd(new Date()), endDate: '', allDay: false, startTime: '09:00', endTime: '12:00', location: '', description: '' })

/** The server colours an event by words in its title, so make sure the chosen type is in there. */
function titleForKind(title: string, kind: EventKind) {
  const t = title.trim()
  if (kind === 'event' || eventKindOf(t) === kind) return t
  return `${t} ${kind === 'exam' ? 'Exam' : kind === 'cat' ? 'CAT' : '(Important date)'}`
}

function toDraft(e: CalEvent): Draft {
  return {
    title: e.title, kind: e.kind, date: dayOf(e.start), endDate: dayOf(e.end) !== dayOf(e.start) ? dayOf(e.end) : '',
    allDay: e.allDay, startTime: e.allDay ? '09:00' : timeOf(e.start) || '09:00', endTime: e.allDay ? '12:00' : timeOf(e.end) || '12:00',
    location: e.location ?? '', description: e.description ?? '',
  }
}

export function AdminCalendarTab({ setMsg }: { setMsg: (n: Note) => void }) {
  const [events, setEvents] = useState<CalEvent[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => labsApi.admin.events()
    .then((r) => { setConfigured(r.configured); setEvents(r.events) })
    .catch((e) => { setMsg({ type: 'err', text: errMsg(e) }); setEvents([]) }), [setMsg])
  useEffect(() => { void load() }, [load])

  async function save(ev: FormEvent) {
    ev.preventDefault()
    if (draft.title.trim().length < 3) return setMsg({ type: 'err', text: 'Give the event a clear title.' })
    if (!draft.date) return setMsg({ type: 'err', text: 'Pick a date.' })
    const input: EventInput = {
      title: titleForKind(draft.title, draft.kind), date: draft.date, endDate: draft.endDate || draft.date, allDay: draft.allDay,
      location: draft.location?.trim(), description: draft.description?.trim(),
      ...(draft.allDay ? {} : { startTime: draft.startTime, endTime: draft.endTime }),
    }
    setBusy(true); setMsg(null)
    try {
      if (editing) await labsApi.admin.updateEvent(editing, input); else await labsApi.admin.addEvent(input)
      setMsg({ type: 'ok', text: editing ? 'Event updated. Students see it now.' : 'Added to the calendar. Students see it now.' })
      setDraft(emptyDraft()); setEditing(null); await load()
    } catch (e) { setMsg({ type: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }

  async function remove(e: CalEvent) {
    if (!window.confirm(`Delete “${e.title}”?`)) return
    setMsg(null)
    try {
      await labsApi.admin.deleteEvent(e.id)
      if (editing === e.id) { setEditing(null); setDraft(emptyDraft()) }
      setMsg({ type: 'ok', text: 'Event deleted.' }); await load()
    } catch (x) { setMsg({ type: 'err', text: errMsg(x) }) }
  }

  if (events === null) return <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>Loading…</span></div>
  if (!configured) return <p className="sl-alert err">The calendar is not connected. Set CALENDAR_ID in Config.gs (SETUP.md step 9) and deploy a new version.</p>

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <>
      <section className="sl-card">
        <h2>{editing ? 'Edit event' : 'Add an exam, CAT or important date'}</h2>
        <form className="sl-form" onSubmit={save}>
          <div className="sl-two">
            <label>Type
              <select value={draft.kind} onChange={(e) => set('kind', e.target.value as EventKind)}>
                {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
            <label>Title<input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. COSC 101 Main Exam" maxLength={120} /></label>
          </div>
          <div className="sl-two">
            <label>Date<input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
            <label>Ends on (optional)<input type="date" value={draft.endDate} min={draft.date} onChange={(e) => set('endDate', e.target.value)} /></label>
          </div>
          <label className="sl-check"><input type="checkbox" checked={draft.allDay} onChange={(e) => set('allDay', e.target.checked)} /> All-day (no specific time)</label>
          {!draft.allDay && (
            <div className="sl-two">
              <label>Starts<input type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} /></label>
              <label>Ends<input type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} /></label>
            </div>
          )}
          <label>Venue (optional)<input value={draft.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Hall 3" maxLength={120} /></label>
          <label>Details (optional)<textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={500} /></label>
          <div className="sl-decide">
            <button className="sl-primary small" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to calendar'}</button>
            {editing && <button type="button" className="sl-mini ghost big" onClick={() => { setEditing(null); setDraft(emptyDraft()) }}><X size={13} /> Cancel edit</button>}
          </div>
        </form>
      </section>

      <section className="sl-card">
        <h2>Upcoming &amp; recent events</h2>
        {events.length === 0 ? <p className="sl-sub">No events yet.</p> : (
          <div className="sl-unit-list">
            {events.map((e) => (
              <div key={e.id} className={`sl-unit static${editing === e.id ? ' sel' : ''}`}>
                <span className={`sl-ev-dot k-${e.kind}`} />
                <span className="sl-unit-name"><strong>{e.title}</strong><small>{whenText(e)}{e.location ? ` · ${e.location}` : ''}</small></span>
                <span className="sl-foot-actions">
                  <button className="sl-mini" onClick={() => { setEditing(e.id); setDraft(toDraft(e)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={12} /> Edit</button>
                  <button className="sl-mini danger" onClick={() => remove(e)}><Trash2 size={12} /> Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="sl-sub">Changes show for students straight away. Repeating events appear as separate dates; editing one only changes that date.</p>
      </section>
    </>
  )
}
