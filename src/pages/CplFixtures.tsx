import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { cpl, type Division, type Fixture, type FixtureStatus, type Referee, type Season, type Team, type Venue } from '../lib/cpl'
import FixtureRow from '../components/FixtureRow'

const EMPTY: Fixture = { id: '', seasonId: '', matchday: '', date: '', time: '', home: '', away: '', venue: '', homeScore: '', awayScore: '', status: 'scheduled',
  homeId: '', awayId: '', venueId: '', refereeId: '', venueMapsUrl: '', refereeName: '', summary: '', scorers: '', cards: '', reportAt: '', seasonName: '' }
const STATUSES: FixtureStatus[] = ['scheduled', 'live', 'finished', 'postponed']

export default function CplFixtures({ season, onBack }: { season: Season; onBack: () => void }) {
  const [list, setList] = useState<Fixture[] | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [divs, setDivs] = useState<Division[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [refs, setRefs] = useState<Referee[]>([])
  const [f, setF] = useState<Fixture>(EMPTY)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Fixture, v: string) => setF((p) => ({ ...p, [k]: v }))
  const fail = (e: Error) => setMsg({ text: e.message, bad: true })

  useEffect(() => {
    cpl<Fixture[]>('fixturesList', { seasonId: season.id }).then(setList).catch(fail)
    cpl<Team[]>('teamsList', { seasonId: season.id }).then(setTeams).catch(fail)
    cpl<Division[]>('divisionsList', { seasonId: season.id }).then(setDivs).catch(fail)
    cpl<Venue[]>('venuesList').then(setVenues).catch(fail)
    cpl<Referee[]>('refereesList').then(setRefs).catch(fail)
  }, [season.id])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      setList(await cpl<Fixture[]>('fixtureSave', { ...f, seasonId: season.id }))
      setMsg({ text: f.id ? 'Fixture updated.' : 'Fixture added.' })
      setF(EMPTY)
    } catch (x) { fail(x as Error) }
    finally { setBusy(false) }
  }

  async function remove(x: Fixture) {
    if (!window.confirm(`Delete ${x.home} vs ${x.away}?`)) return
    setBusy(true); setMsg(null)
    try { setList(await cpl<Fixture[]>('fixtureDelete', { id: x.id })); if (f.id === x.id) setF(EMPTY) }
    catch (e) { fail(e as Error) }
    finally { setBusy(false) }
  }

  // Older fixtures only stored team names; match them to teams so they can be re-saved.
  function edit(x: Fixture) {
    const byName = (n: string) => teams.find((t) => t.name === n)?.id ?? ''
    setF({ ...x, homeId: x.homeId || byName(x.home), awayId: x.awayId || byName(x.away) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const teamOptions = (
    <>
      <option value="">Select team…</option>
      {divs.map((d) => (
        <optgroup key={d.id} label={d.name}>
          {teams.filter((t) => t.divisionId === d.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </optgroup>
      ))}
    </>
  )
  const missing = [teams.length < 2 && 'at least two teams', venues.length === 0 && 'a venue', refs.length === 0 && 'a referee'].filter(Boolean)

  return (
    <div className="cpl-page">
      <button className="cpl-back cpl-linkbtn" onClick={onBack}><ArrowLeft size={16} /> All seasons</button>
      <h2>{season.name}: fixtures</h2>
      <p className="cpl-sub">Pick the teams, venue and referee for each match. The referee then files the match report, which records the final score.</p>

      <form className="cpl-card cpl-form cpl-wide" onSubmit={save}>
        <h3>{f.id ? 'Edit fixture' : 'Add a fixture'}</h3>
        {missing.length > 0 && <p className="cpl-note">Before creating fixtures, add {missing.join(', ')}: <a href="#/cpl/manage-seasons">teams</a> (Manage seasons → Teams), <a href="#/cpl/venues">venues</a>, <a href="#/cpl/referees">referees</a>.</p>}
        <div className="cpl-grid2">
          <label>Home team<select required value={f.homeId} onChange={(e) => set('homeId', e.target.value)}>{teamOptions}</select></label>
          <label>Away team<select required value={f.awayId} onChange={(e) => set('awayId', e.target.value)}>{teamOptions}</select></label>
          <label>Date<input type="date" required min={season.startDate} max={season.endDate} value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label>Kick-off time<input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></label>
          <label>Venue
            <select required value={f.venueId} onChange={(e) => set('venueId', e.target.value)}>
              <option value="">Select venue…</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label>Referee
            <select required value={f.refereeId} onChange={(e) => set('refereeId', e.target.value)}>
              <option value="">Select referee…</option>
              {refs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label>Matchday<input type="number" min={1} max={99} value={f.matchday} onChange={(e) => set('matchday', e.target.value)} /></label>
          <label>Status
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </label>
        </div>
        {f.id && (
          <fieldset className="cpl-fs"><legend>Score override (normally set by the referee's report)</legend>
            <div className="cpl-grid2">
              <label>Home score<input type="number" min={0} max={99} value={f.homeScore} onChange={(e) => set('homeScore', e.target.value)} /></label>
              <label>Away score<input type="number" min={0} max={99} value={f.awayScore} onChange={(e) => set('awayScore', e.target.value)} /></label>
            </div>
          </fieldset>
        )}
        <div className="cpl-inline">
          <button className="lp-btn" disabled={busy}>{busy ? 'Saving…' : f.id ? 'Save changes' : 'Add fixture'}</button>
          {f.id && <button type="button" className="lp-btn lp-btn-soft" onClick={() => setF(EMPTY)}>Cancel edit</button>}
        </div>
        {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      </form>

      <section className="cpl-card">
        <h3>Fixtures ({list?.length ?? 0})</h3>
        {list === null && <p className="cpl-empty">Loading…</p>}
        {list?.length === 0 && <p className="cpl-empty">No fixtures yet.</p>}
        <div className="cpl-fixtures">
          {list?.map((x) => (
            <FixtureRow key={x.id} x={x}>
              <div className="cpl-fxc-actions">
                <span className={`cpl-badge ${x.summary ? 'st-Active' : 'st-scheduled'}`}>{x.summary ? 'Report filed' : 'Awaiting report'}</span>
                <button className="lp-btn lp-btn-soft" disabled={busy} onClick={() => edit(x)} aria-label={`Edit ${x.home} vs ${x.away}`}><Pencil size={14} /></button>
                <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => remove(x)} aria-label={`Delete ${x.home} vs ${x.away}`}><Trash2 size={14} /></button>
              </div>
            </FixtureRow>
          ))}
        </div>
      </section>
    </div>
  )
}
