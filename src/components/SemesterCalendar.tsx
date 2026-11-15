import { useMemo, useState } from 'react'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { googleCalendarLink, niceDate, semesterInfo, ymd, type Settings } from '../lib/hostel'

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Semester start/end shown as a small month calendar. The dates come from the hostel Apps Script (set in Admin desk > Semester). */
export default function SemesterCalendar({ settings }: { settings: Settings }) {
  const info = useMemo(() => semesterInfo(settings), [settings])
  const today = new Date()
  const [cursor, setCursor] = useState(() => {
    const base = info.phase === 'upcoming' && info.start ? info.start : today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const title = settings.semesterName || 'This semester'

  if (!info.set) {
    return (
      <section className="hs-sem hs-sem-empty" aria-label="Semester dates">
        <CalendarDays size={20} />
        <span><strong>Semester dates coming soon.</strong> The admin will publish the start and end dates here.</span>
      </section>
    )
  }

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))]
  const startKey = settings.semesterStart, endKey = settings.semesterEnd, todayKey = ymd(today)
  const move = (d: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + d, 1))

  const status =
    info.phase === 'upcoming' ? `Starts in ${Math.max(0, Math.round(((info.start as Date).getTime() - new Date(todayKey + 'T00:00:00').getTime()) / 86400000))} days`
    : info.phase === 'ended' ? 'Semester ended'
    : info.daysLeft === 0 ? 'Last day of the semester' : `${info.daysLeft} day${info.daysLeft === 1 ? '' : 's'} left`

  return (
    <section className="hs-sem" aria-label="Semester dates">
      <div className="hs-sem-info">
        <span className="hs-kicker dark">GOOGLE CALENDAR · SEMESTER</span>
        <h2>{title}</h2>
        <div className="hs-sem-dates">
          <div><small>Starts</small><strong>{niceDate(startKey)}</strong></div>
          <div><small>Ends</small><strong>{niceDate(endKey)}</strong></div>
          <div><small>Status</small><strong>{status}</strong></div>
        </div>
        <div className="hs-sem-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(info.progress * 100)} aria-label="Semester progress">
          <span style={{ width: `${info.phase === 'ended' ? 100 : Math.round(info.progress * 100)}%` }} />
        </div>
        <small className="hs-sem-note">{info.phase === 'running' ? `Day ${info.dayNumber} of ${info.totalDays}` : `${info.totalDays} days in total`}</small>
        <div className="hs-sem-actions">
          <a href={googleCalendarLink(`${title} starts`, startKey)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={14} /> Add start</a>
          <a href={googleCalendarLink(`${title} ends`, endKey)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={14} /> Add end</a>
          <a href={googleCalendarLink(title, startKey, endKey)} target="_blank" rel="noopener noreferrer"><CalendarPlus size={14} /> Add whole semester</a>
        </div>
      </div>

      <div className="hs-cal" role="group" aria-label="Calendar">
        <div className="hs-cal-head">
          <button type="button" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <strong>{cursor.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })}</strong>
          <button type="button" onClick={() => move(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="hs-cal-grid">
          {WEEK.map((w, i) => <span className="hs-cal-wd" key={i}>{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const k = ymd(d)
            const cls = ['hs-cal-day', k >= startKey && k <= endKey ? 'in' : '', k === startKey ? 'start' : '', k === endKey ? 'end' : '', k === todayKey ? 'today' : ''].filter(Boolean).join(' ')
            return <span key={i} className={cls} title={k === startKey ? 'Semester starts' : k === endKey ? 'Semester ends' : undefined}>{d.getDate()}</span>
          })}
        </div>
        <div className="hs-cal-key"><i className="s" /> Start <i className="e" /> End <i className="t" /> Today</div>
      </div>
    </section>
  )
}
