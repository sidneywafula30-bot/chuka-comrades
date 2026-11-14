import { useEffect, useMemo, useState } from 'react'
import { Gamepad2, Search } from 'lucide-react'
import { PLATFORMS, driveImg, ef, type PublicPlayer } from '../lib/efootball'

const PAGE = 24

export default function EfPlayers() {
  const [all, setAll] = useState<PublicPlayer[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('')
  const [platform, setPlatform] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [zoom, setZoom] = useState('')

  useEffect(() => { ef<PublicPlayer[]>('players').then(setAll).catch((e) => setErr((e as Error).message)) }, [])

  const courses = useMemo(() => [...new Set((all ?? []).map((p) => p.course))].sort(), [all])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (all ?? [])
      .filter((p) => (!s || p.username.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.course.toLowerCase().includes(s)) && (!course || p.course === course) && (!platform || p.platform === platform))
      .sort((a, b) => b.strength - a.strength)
  }, [all, q, course, platform])

  return (
    <div className="cpl-page">
      <h2>Registered players</h2>
      <p className="cpl-sub">{all ? `${all.length} players registered` : 'Loading…'}</p>
      <div className="cpl-search" style={{ width: '100%', marginBottom: 12 }}>
        <Search size={18} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search username, name or course" aria-label="Search players" />
      </div>
      <div className="cpl-inline" style={{ marginBottom: 18 }}>
        <select className="ef-sel" value={course} onChange={(e) => { setCourse(e.target.value); setShown(PAGE) }} aria-label="Filter by course">
          <option value="">All courses</option>{courses.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="ef-sel" value={platform} onChange={(e) => { setPlatform(e.target.value); setShown(PAGE) }} aria-label="Filter by platform">
          <option value="">All platforms</option>{PLATFORMS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {all && !list.length && <p className="cpl-empty">No players match your search.</p>}
      <div className="ef-card-grid">
        {list.slice(0, shown).map((p) => (
          <article key={p.uid} className="ef-pcard">
            {p.squadId
              ? <button type="button" onClick={() => setZoom(driveImg(p.squadId, 1200))} aria-label={`View ${p.username}'s squad`}><img src={driveImg(p.squadId, 400)} alt="" loading="lazy" /></button>
              : <span className="ph"><Gamepad2 size={26} /></span>}
            <div>
              <strong>{p.username}</strong>
              <small>{p.course}{p.year ? `, year ${p.year}` : ''}</small>
              <small>{p.platform} · strength {p.strength}</small>
              {p.canHost && <span className="ef-pill">Can host</span>}
            </div>
          </article>
        ))}
      </div>
      {list.length > shown && <div className="ef-actions"><button className="lp-btn" onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button></div>}
      {zoom && <div className="ef-zoom" onClick={() => setZoom('')} role="dialog" aria-label="Squad image"><img src={zoom} alt="Squad" /></div>}
    </div>
  )
}
