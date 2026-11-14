import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, MapPin } from 'lucide-react'
import { labsApi, type CalEvent, type EventKind, type EventsResult } from '../lib/labs'

/* ---------- date helpers (all on plain 'YYYY-MM-DD' strings so time zones can never shift a day) ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
const addDays = (k: string, n: number) => { const d = new Date(`${k}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
const fmtDay = (k: string, long = false) =>
  new Date(`${k}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: long ? 'long' : undefined, day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthTitle = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const KIND_LABEL: Record<EventKind, string> = { exam: 'Exam', cat: 'CAT', important: 'Important', event: 'Event' }
const FILTERS: { key: 'all' | EventKind; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'exam', label: 'Exams' }, { key: 'cat', label: 'CATs' }, { key: 'important', label: 'Important dates' },
]

function whenLabel(e: CalEvent) {
  const s = e.start.slice(0, 10), en = e.end.slice(0, 10)
  if (e.allDay) return s === en ? `${fmtDay(s, true)} · all day` : `${fmtDay(s)} – ${fmtDay(en)}`
  const t1 = e.start.slice(11, 16), t2 = e.end.slice(11, 16)
  if (s === en) return `${fmtDay(s, true)} · ${t1}${t2 && t2 !== t1 ? ` – ${t2}` : ''}`
  return `${fmtDay(s)} ${t1} – ${fmtDay(en)} ${t2}`
}

/** A "add to my Google Calendar" link built from the event itself (the calendar's own link would open the owner's calendar). */
function addLink(e: CalEvent) {
  const compact = (v: string) => v.replace(/[-:]/g, '').slice(0, e.allDay ? 8 : 15)
  const dates = e.allDay ? `${compact(e.start)}/${compact(addDays(e.end.slice(0, 10), 1))}` : `${compact(e.start)}/${compact(e.end)}`
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates, ctz: 'Africa/Nairobi' })
  if (e.location) q.set('location', e.location)
  if (e.description) q.set('details', e.description)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export default function LabsCalendar() {
  const now = todayKey()
  const [ym, setYm] = useState({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) - 1 })
  const [res, setRes] = useState<EventsResult | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | EventKind>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const cache = useRef(new Map<string, EventsResult>())

  // The grid always shows 6 weeks starting on Monday, so fetch exactly that window.
  const { cells, from, to, monthStart, monthEnd } = useMemo(() => {
    const first = `${ym.y}-${pad(ym.m + 1)}-01`
    const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
    const gridStart = addDays(first, -dow)
    const last = new Date(Date.UTC(ym.y, ym.m + 1, 0)).toISOString().slice(0, 10)
    return { cells: Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), from: gridStart, to: addDays(gridStart, 41), monthStart: first, monthEnd: last }
  }, [ym])

  useEffect(() => {
    let live = true
    const ck = `${from}_${to}`
    const hit = cache.current.get(ck)
    if (hit) { setRes(hit); setErr(''); return }
    setRes(null); setErr('')
    labsApi.events(from, to)
      .then((r) => { cache.current.set(ck, r); if (live) setRes(r) })
      .catch((e) => { if (live) setErr(e instanceof Error ? e.message : 'Could not load the calendar.') })
    return () => { live = false }
  }, [from, to])

  const events = useMemo(() => (res?.events ?? []).filter((e) => filter === 'all' || e.kind === filter), [res, filter])

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) {
      let k = e.start.slice(0, 10) < from ? from : e.start.slice(0, 10)
      const stop = e.end.slice(0, 10) > to ? to : e.end.slice(0, 10)
      for (let i = 0; i < 45 && k <= stop; i++, k = addDays(k, 1)) m.set(k, [...(m.get(k) ?? []), e])
    }
    return m
  }, [events, from, to])

  const isThisMonth = ym.y === Number(now.slice(0, 4)) && ym.m === Number(now.slice(5, 7)) - 1
  const listed = useMemo(() => {
    if (selected) return byDay.get(selected) ?? []
    return events.filter((e) => e.end.slice(0, 10) >= (isThisMonth ? now : monthStart) && e.start.slice(0, 10) <= monthEnd)
  }, [selected, byDay, events, isThisMonth, now, monthStart, monthEnd])

  function go(delta: number) {
    setSelected(null)
    setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  }

  if (res && !res.configured) {
    return (
      <section className="sl-cal sl-card">
        <div className="sl-cal-head"><h2><CalendarDays size={18} /> Important dates &amp; exams</h2></div>
        <p className="sl-sub">The calendar is not connected yet. An admin needs to add the calendar ID in the Apps Script settings.</p>
      </section>
    )
  }

  return (
    <section className="sl-cal sl-card" aria-label="Important dates and exams calendar">
      <div className="sl-cal-head">
        <h2><CalendarDays size={18} /> Important dates &amp; exams</h2>
        <div className="sl-cal-nav">
          <button className="sl-icon-btn" onClick={() => go(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <strong>{monthTitle(ym.y, ym.m)}</strong>
          <button className="sl-icon-btn" onClick={() => go(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          {!isThisMonth && <button className="sl-mini ghost" onClick={() => { setSelected(null); setYm({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) - 1 }) }}>Today</button>}
        </div>
      </div>

      <div className="sl-cal-filters">
        {FILTERS.map((f) => <button key={f.key} className={`sl-chipbtn ${filter === f.key ? 'on' : ''} k-${f.key}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>

      <div className="sl-cal-body">
        <div className="sl-cal-grid-wrap">
          <div className="sl-cal-grid" role="grid">
            {WEEK.map((w) => <span key={w} className="sl-cal-dow" role="columnheader">{w}</span>)}
            {cells.map((k) => {
              const list = byDay.get(k) ?? []
              const kinds = Array.from(new Set(list.map((e) => e.kind)))
              return (
                <button key={k} role="gridcell" aria-label={`${fmtDay(k, true)}${list.length ? `, ${list.length} event${list.length > 1 ? 's' : ''}` : ''}`}
                  className={`sl-cal-day${k.slice(0, 7) !== monthStart.slice(0, 7) ? ' out' : ''}${k === now ? ' today' : ''}${k === selected ? ' sel' : ''}${list.length ? ' has' : ''}`}
                  onClick={() => setSelected(k === selected ? null : k)}>
                  <span>{Number(k.slice(8))}</span>
                  {kinds.length > 0 && <i className="sl-cal-dots">{kinds.map((kd) => <b key={kd} className={`d-${kd}`} />)}</i>}
                </button>
              )
            })}
          </div>
          {!res && !err && <div className="sl-cal-loading"><LoaderCircle className="sl-spin" size={20} /></div>}
        </div>

        <div className="sl-cal-list">
          <h3>{selected ? fmtDay(selected, true) : isThisMonth ? 'Coming up this month' : `Events in ${monthTitle(ym.y, ym.m)}`}
            {selected && <button className="sl-mini ghost" onClick={() => setSelected(null)}>Show month</button>}</h3>
          {err && <p className="sl-reject">{err}</p>}
          {!err && res && listed.length === 0 && <p className="sl-sub">{selected ? 'Nothing on this day.' : 'No events to show.'}</p>}
          <ul>
            {listed.map((e) => (
              <li key={`${e.id}${e.start}`} className={`ev k-${e.kind}`}>
                <span className="ev-kind">{KIND_LABEL[e.kind]}</span>
                <strong>{e.title}</strong>
                <small>{whenLabel(e)}</small>
                {e.location && <small className="ev-loc"><MapPin size={11} /> {e.location}</small>}
                {e.description && <p>{e.description}</p>}
                <a href={addLink(e)} target="_blank" rel="noreferrer noopener"><ExternalLink size={11} /> Add to my calendar</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
