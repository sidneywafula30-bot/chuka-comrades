import { useEffect, useState } from 'react'
import { labsApi, labsReady, type Countdown } from '../lib/labs'
import './ExamCountdown.css'

// Kenya has no daylight saving, so the exam time is always +03:00.
const startMs = (c: Countdown) => new Date(`${c.date}T${c.time || '08:00'}:00+03:00`).getTime()
const endMs = (c: Countdown) => new Date(`${c.endDate || c.date}T23:59:59+03:00`).getTime()

function Box({ n, label }: { n: number; label: string }) {
  return <div className="ec-box"><b>{String(n).padStart(2, '0')}</b><span>{label}</span></div>
}

/** Strip at the very top of the landing page. Hidden until an admin sets a date, and after the exams end. */
export default function ExamCountdown() {
  const [c, setC] = useState<Countdown | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!labsReady) return
    let live = true
    labsApi.countdown().then((r) => { if (live && r.set) setC(r) }).catch(() => {})
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!c) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [c])

  if (!c || !c.date) return null
  const start = startMs(c)
  const end = endMs(c)
  if (Number.isNaN(start) || now > end) return null

  if (now >= start) {
    return (
      <div className="ec-strip on" role="status">
        <strong>{c.title}</strong>
        <span className="ec-msg">Exams are on. All the best, comrades!</span>
      </div>
    )
  }

  const left = start - now
  const d = Math.floor(left / 86400000)
  const h = Math.floor(left / 3600000) % 24
  const m = Math.floor(left / 60000) % 60
  const s = Math.floor(left / 1000) % 60
  return (
    <div className="ec-strip" role="timer" aria-label={`${c.title} countdown`}>
      <strong>{c.title}</strong>
      <div className="ec-boxes">
        <Box n={d} label="days" /><Box n={h} label="hrs" /><Box n={m} label="min" /><Box n={s} label="sec" />
      </div>
      <span className="ec-date">{new Date(`${c.date}T12:00:00+03:00`).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </div>
  )
}
