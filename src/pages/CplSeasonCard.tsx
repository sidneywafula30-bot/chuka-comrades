import { useState } from 'react'
import { CalendarDays, FileText, Shield, Users } from 'lucide-react'
import TeamCard from '../components/TeamCard'
import TeamModal from '../components/TeamModal'
import FixtureRow from '../components/FixtureRow'
import { cpl, docViewUrl, fmtDate, fmtRange, seasonState, type Division, type Fixture, type Season, type Team } from '../lib/cpl'

export default function SeasonCard({ s }: { s: Season }) {
  const [open, setOpen] = useState(false)
  const [fx, setFx] = useState<Fixture[] | null>(null)
  const [err, setErr] = useState('')
  const [tOpen, setTOpen] = useState(false)
  const [squads, setSquads] = useState<{ divs: Division[]; teams: Team[] } | null>(null)
  const [tErr, setTErr] = useState('')
  const [squad, setSquad] = useState<{ t: Team; tab: 'players' | 'fixtures' } | null>(null)

  function toggleTeams() {
    const next = !tOpen
    setTOpen(next)
    if (next && !squads) {
      Promise.all([cpl<Division[]>('divisionsList', { seasonId: s.id }), cpl<Team[]>('teamsList', { seasonId: s.id })])
        .then(([divs, teams]) => setSquads({ divs, teams })).catch((e) => setTErr(e.message))
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !fx) cpl<Fixture[]>('fixturesList', { seasonId: s.id }).then(setFx).catch((e) => setErr(e.message))
  }

  return (
    <article className="cpl-sc">
      <div className="cpl-sc-cover">
        {s.coverUrl && <img src={s.coverUrl} alt="" loading="lazy" />}
        <span className={`cpl-badge st-${seasonState(s)}`}>{seasonState(s)}</span>
        <div className="cpl-sc-title"><h3>{s.name}</h3><small><CalendarDays size={13} /> {fmtDate(s.startDate)} – {fmtDate(s.endDate)}</small></div>
      </div>
      <div className="cpl-sc-body">
        {s.description && <p className="cpl-desc">{s.description}</p>}
        <div className="cpl-sc-windows">
          <div><span>Pre-season transfers</span><b>{fmtRange(s.preStart, s.preEnd)}</b></div>
          <div><span>Mid-season transfers</span><b>{fmtRange(s.midStart, s.midEnd)}</b></div>
        </div>
        <div className="cpl-inline">
          {s.rulesDocId && <a className="lp-btn lp-btn-soft" href={docViewUrl(s.rulesDocId)} target="_blank" rel="noopener noreferrer"><FileText size={14} /> Rules (Google Doc)</a>}
          {s.rulesUrl && <a className="lp-btn lp-btn-soft" href={s.rulesUrl} target="_blank" rel="noopener noreferrer"><FileText size={14} /> {s.rulesName || 'Rules document'}</a>}
          <button className="lp-btn lp-btn-soft" onClick={toggleTeams} aria-expanded={tOpen}><Shield size={14} /> {tOpen ? 'Hide teams' : 'Teams'}</button>
          <button className="lp-btn" onClick={toggle} aria-expanded={open}>{open ? 'Hide fixtures' : 'Fixtures'}</button>
        </div>
        {tOpen && (
          <div className="cpl-teams">
            {tErr && <p className="cpl-err">{tErr}</p>}
            {!squads && !tErr && <p className="cpl-empty">Loading…</p>}
            {squads && squads.teams.length === 0 && <p className="cpl-empty">No teams published yet.</p>}
            {squads?.divs.map((d) => {
              const list = squads.teams.filter((t) => t.divisionId === d.id)
              return list.length === 0 ? null : (
                <div key={d.id}>
                  <h4 className="cpl-div-title">{d.name}</h4>
                  <div className="cpl-tc-grid">
                    {list.map((t) => <TeamCard key={t.id} t={t}><button className="lp-btn lp-btn-soft" onClick={() => setSquad({ t, tab: 'players' })}><Users size={14} /> Players</button><button className="lp-btn lp-btn-soft" onClick={() => setSquad({ t, tab: 'fixtures' })}><CalendarDays size={14} /> Fixtures</button></TeamCard>)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {open && (
          <div className="cpl-fixtures">
            {err && <p className="cpl-err">{err}</p>}
            {!fx && !err && <p className="cpl-empty">Loading…</p>}
            {fx?.length === 0 && <p className="cpl-empty">No fixtures published yet.</p>}
            {fx?.map((x) => <FixtureRow key={x.id} x={x} />)}
          </div>
        )}
      </div>
      {squad && <TeamModal team={squad.t} tab={squad.tab} onClose={() => setSquad(null)} />}
    </article>
  )
}
