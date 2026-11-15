import { useCallback, useEffect, useState } from 'react'
import { Copy, Trophy } from 'lucide-react'
import ImagePicker from '../components/ImagePicker'
import { driveImg, ef, fmtStamp, fromParts, toParts, type AdminCourse, type Attention, type FplAdminInfo, type Profile, type Tournament } from '../lib/efootball'

type Tab = 'tournament' | 'attention' | 'courses' | 'players' | 'league' | 'fpl'
type Msg = { ok: boolean; text: string } | null

export default function EfAdmin() {
  const [tab, setTab] = useState<Tab>('tournament')
  return (
    <div className="cpl-page">
      <h2>eFootball admin</h2>
      <p className="cpl-sub">Tournaments, courses, players and the league. League results settle themselves.</p>
      <div className="ef-tabs" role="tablist">
        {([['tournament', 'Tournament'], ['attention', 'Needs attention'], ['courses', 'Courses'], ['players', 'Players'], ['league', 'League'], ['fpl', 'FPL']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'tournament' ? <TournamentAdmin /> : tab === 'attention' ? <AttentionAdmin /> : tab === 'courses' ? <CoursesAdmin /> : tab === 'players' ? <PlayersAdmin /> : tab === 'fpl' ? <FplAdmin /> : <LeagueAdmin />}
    </div>
  )
}

function useMsg() {
  const [msg, setMsg] = useState<Msg>(null)
  const el = msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>
  return { setMsg, el }
}

/* ---------------- tournament form ---------------- */
function TournamentAdmin() {
  const [t, setT] = useState<Tournament | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const { setMsg, el } = useMsg()
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setT(await ef<Tournament | null>('tournament')) } catch (e) { setMsg({ ok: false, text: (e as Error).message }); setT(null) } }, [setMsg])
  useEffect(() => { void load() }, [load])

  if (t === undefined) return <p className="cpl-empty">Loading…</p>
  const live = t && t.status !== 'done'
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); await load(); setMsg({ ok: true, text: ok }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const link = t ? `${window.location.origin}${window.location.pathname}#/efootball/join/${t.token}` : ''

  return (
    <>
      {live && t && (
        <section className="cpl-card">
          <h3>{t.name} <span className="ef-pill">{t.status === 'open' ? 'registration open' : `round ${t.round} of ${t.stages}`}</span></h3>
          <p className="cpl-sub" style={{ margin: '0 0 12px' }}>{t.count} joined of {t.cap}.</p>
          <div className="ef-copy"><span style={{ flex: 1 }}>{link}</span>
            <button className="lp-btn" onClick={() => { void navigator.clipboard?.writeText(link); setMsg({ ok: true, text: 'Invite link copied.' }) }}><Copy size={14} /> Copy</button></div>
          <div className="ef-actions">
            <button className="lp-btn" disabled={busy} onClick={() => setEditing((v) => !v)}>{editing ? 'Close editor' : 'Edit tournament'}</button>
            <button className="lp-btn cpl-danger" disabled={busy} onClick={() => run(() => ef('regenToken', { tid: t.id }), 'New invite link created. The old one no longer works.')}>New invite link</button>
            {t.status === 'open' && <button className="lp-btn" disabled={busy} onClick={() => confirm('Close registration and draw the pools now?') && run(() => ef('drawNow', { tid: t.id }), 'Pools drawn.')}>Draw pools now</button>}
            {t.status === 'running' && <button className="lp-btn" disabled={busy} onClick={() => run(() => ef('advanceNow', { tid: t.id }), 'Advanced.')}>Advance to next round</button>}
          </div>
          {el}
        </section>
      )}
      {(!live || editing) && <TournamentForm t={live ? t : null} onSaved={async () => { setEditing(false); await load() }} />}
      {!live && el}
    </>
  )
}

function TournamentForm({ t, onSaved }: { t: Tournament | null; onSaved: () => Promise<void> }) {
  const first = toParts(t?.windows[0][0] ?? '')
  const reg = toParts(t?.regClose ?? '')
  const w = (i: number, k: 0 | 1, d: string) => toParts(t?.windows[i][k] ?? '').time || d
  const [name, setName] = useState(t?.name ?? 'Chuka Friday Knockout')
  const [date, setDate] = useState(first.date)
  const [regTime, setRegTime] = useState(reg.time || '13:00')
  const [times, setTimes] = useState([w(0, 0, '14:00'), w(0, 1, '15:15'), w(1, 0, '15:25'), w(1, 1, '16:10'), w(2, 0, '16:20'), w(2, 1, '17:00')])
  const [cap, setCap] = useState(String(t?.cap ?? 512))
  const [rules, setRules] = useState(t?.rules ?? '')
  const [logo, setLogo] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const open = !t || t.status === 'open'
  const setTime = (i: number, v: string) => setTimes((a) => a.map((x, j) => (j === i ? v : x)))
  const labels = ['Round 1 starts', 'Round 1 ends', 'Round 2 starts', 'Round 2 ends', 'Final starts', 'Final ends']

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const [s1, e1, s2, e2, s3, e3] = times.map((x) => fromParts(date, x))
      await ef('saveTournament', { t: { id: t?.id, name, rules, regClose: fromParts(date, regTime), s1, e1, s2, e2, s3, e3, cap: Number(cap), logo: logo || undefined, removeLogo } })
      setMsg({ ok: true, text: t ? 'Saved.' : 'Tournament created. Share the invite link.' })
      await onSaved()
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) } finally { setBusy(false) }
  }

  return (
    <section className="cpl-card cpl-form cpl-wide">
      <h3>{t ? 'Edit tournament' : 'New weekly tournament'}</h3>
      <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
      <fieldset className="cpl-fs">
        <legend>Tournament logo</legend>
        <ImagePicker current={driveImg(t?.logoId ?? '', 300)} fallback={<Trophy size={28} />} label="logo" max={600} onChange={(v) => { setLogo(v.data); setRemoveLogo(v.removed) }} />
      </fieldset>
      {open && (
        <div className="cpl-grid2">
          <label>Match day (Friday)<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Registration closes at<input type="time" value={regTime} onChange={(e) => setRegTime(e.target.value)} /><small>Same day, before Round 1. Pools are drawn automatically then.</small></label>
        </div>
      )}
      {!open && <label>Match day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
      <fieldset className="cpl-fs">
        <legend>Round times (Nairobi)</legend>
        <div className="cpl-grid2">{labels.map((l, i) => <label key={l}>{l}<input type="time" value={times[i]} onChange={(e) => setTime(i, e.target.value)} /></label>)}</div>
        <small>With fewer players the Final always uses the Final times.</small>
      </fieldset>
      {open && <label>Maximum players<input type="number" min={8} max={512} value={cap} onChange={(e) => setCap(e.target.value)} /><small>512 players = 64 pools, then 8 pools, then the final.</small></label>}
      <label>Rules<textarea rows={9} value={rules} onChange={(e) => setRules(e.target.value)} placeholder={'1. Be in the room on time.\n2. Match time: ...\n3. Disputes go to the admin with a screenshot.'} /></label>
      <button className="lp-btn" disabled={busy || !name || !date} onClick={save}>{busy ? 'Saving…' : t ? 'Save changes' : 'Create tournament'}</button>
      {el}
    </section>
  )
}

/* ---------------- disputes ---------------- */
function AttentionAdmin() {
  const [list, setList] = useState<Attention[] | null>(null)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<Attention[]>('attention').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function pick(poolId: string, winnerUid: string) {
    try { await ef('setPoolWinner', { poolId, winnerUid }); setMsg({ ok: true, text: 'Winner set.' }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  if (!list) return <>{el || <p className="cpl-empty">Loading…</p>}</>
  return (
    <>
      {el}
      {!list.length && <p className="cpl-empty">Nothing needs attention right now.</p>}
      {list.map((a) => (
        <section className="cpl-card" key={a.id}>
          <h3>Pool {a.idx} <span className="ef-pill red">{a.why}</span></h3>
          {a.disputes.map((d, i) => <p key={i} className="cpl-note" style={{ textAlign: 'left' }}>Dispute by {a.members.find((m) => m.uid === d.uid)?.username ?? '?'}: {d.reason || 'no reason given'}</p>)}
          {a.proofId && <a href={driveImg(a.proofId, 1200)} target="_blank" rel="noopener noreferrer">View the host's screenshot</a>}
          {a.members.map((m) => (
            <div className="cpl-row" key={m.uid}>
              <div><strong>{m.username}{m.uid === a.hostUid ? ' (host)' : ''}{m.uid === a.winnerUid ? ' (reported winner)' : ''}</strong><small>{m.whatsapp}</small></div>
              <button className="lp-btn" onClick={() => pick(a.id, m.uid)}>Winner</button>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

/* ---------------- courses ---------------- */
type CourseFilter = 'all' | 'league' | 'requested' | 'off'
function CoursesAdmin() {
  const [list, setList] = useState<AdminCourse[] | null>(null)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<CourseFilter>('all')
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<AdminCourse[]>('adminCourses').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])

  async function bach() {
    setBusy(true); setMsg(null)
    try {
      const r = await ef<{ found: number; added: number; activated: number; others: number; leagueSeeded: number }>('addBachelors')
      setMsg({ ok: true, text: `Found ${r.found} Bachelor degrees at the Main campus: ${r.added} added, ${r.activated} switched on.${r.leagueSeeded ? ` Electrical Engineering and Nursing were opened for the league (${r.leagueSeeded} course${r.leagueSeeded > 1 ? 's' : ''}).` : ''}${r.others ? ` ${r.others} other active course(s) (diploma, certificate and so on) are still on: switch them off below if you only want Bachelors.` : ''}` })
      await load()
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  async function change(c: AdminCourse, patch: Partial<AdminCourse>, action: string, payload: Record<string, unknown>) {
    setList((l) => l && l.map((x) => (x.name === c.name ? { ...x, ...patch } : x)))
    try { await ef(action, { name: c.name, ...payload }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }); await load() }
  }
  async function del(c: AdminCourse) {
    if (!window.confirm(`Delete the course "${c.name}"?`)) return
    try {
      let r = await ef<{ deleted: boolean; players: number }>('deleteCourse', { name: c.name })
      if (!r.deleted) {
        if (!window.confirm(`${r.players} player(s) are registered under "${c.name}". They keep their profile but will have to pick another course. Delete anyway?`)) return
        r = await ef<{ deleted: boolean; players: number }>('deleteCourse', { name: c.name, force: true })
      }
      setMsg({ ok: true, text: `Deleted "${c.name}".` }); await load()
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function add() {
    try { await ef('addCourse', { name }); setName(''); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((c) => c.name.toLowerCase().includes(s)
    && (filter === 'all' || (filter === 'league' && c.league) || (filter === 'requested' && c.interested > 0) || (filter === 'off' && !c.active)))
    .sort((a, b) => Number(b.league) - Number(a.league) || b.interested - a.interested || a.name.localeCompare(b.name))
  return (
    <>
      <section className="cpl-card">
        <h3>Courses from chuka.ac.ke</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Students pick their course from the <strong>Active</strong> ones. <strong>In league</strong> courses appear in the league course table with a Join button; open more as students ask for them.</p>
        <div className="ef-actions" style={{ marginTop: 0 }}>
          <button className="lp-btn" disabled={busy} onClick={bach}>{busy ? 'Reading the Chuka website…' : 'Add all Bachelor degrees (Main campus)'}</button>
        </div>
        <div className="cpl-inline" style={{ marginTop: 14 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a course by hand" maxLength={120} />
          <button className="lp-btn" disabled={!name.trim()} onClick={add}>Add</button>
        </div>
        {el}
      </section>
      {list && (
        <section className="cpl-card">
          <div className="cpl-inline" style={{ marginBottom: 8 }}>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length} courses`} />
            <select className="ef-sel" value={filter} onChange={(e) => setFilter(e.target.value as CourseFilter)} aria-label="Filter courses">
              <option value="all">All</option><option value="league">In league</option><option value="requested">Requested</option><option value="off">Switched off</option>
            </select>
          </div>
          {shown.slice(0, 120).map((c) => (
            <div className="cpl-row" key={c.name}>
              <div>
                <strong>{c.name} {c.league && <span className="ef-pill gold">In league</span>}</strong>
                <small>{[c.level, c.campuses].filter(Boolean).join(' · ')} · {c.players} registered{c.interested ? ` · ${c.interested} asked for the league` : ''}</small>
              </div>
              <label className="cpl-file"><input type="checkbox" checked={c.active} onChange={() => change(c, { active: !c.active, ...(c.active ? { league: false } : {}) }, 'setCourseActive', { active: !c.active })} /> Active</label>
              <label className="cpl-file"><input type="checkbox" checked={c.league} disabled={!c.active} onChange={() => change(c, { league: !c.league }, 'setCourseLeague', { league: !c.league })} /> In league</label>
              <button className="lp-btn cpl-danger" onClick={() => del(c)}>Delete</button>
            </div>
          ))}
          {!shown.length && <p className="cpl-empty">No courses match.</p>}
          {shown.length > 120 && <p className="cpl-note">Showing 120 of {shown.length}. Search to narrow down.</p>}
        </section>
      )}
    </>
  )
}

/* ---------------- players ---------------- */
function PlayersAdmin() {
  const [list, setList] = useState<Profile[] | null>(null)
  const [q, setQ] = useState('')
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<Profile[]>('adminPlayers').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function ban(p: Profile) {
    try { await ef('setPlayerStatus', { uid: p.uid, banned: p.status === 'active' }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function unlinkFpl(p: Profile) {
    try { await ef('fplUnlinkPlayer', { uid: p.uid }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((p) => !s || p.username.toLowerCase().includes(s) || p.fullName.toLowerCase().includes(s) || p.whatsapp.includes(s) || p.email.toLowerCase().includes(s))
  return (
    <section className="cpl-card">
      {el}
      <div className="cpl-inline" style={{ marginBottom: 8 }}><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list?.length ?? 0} players (name, username, phone, email)`} /></div>
      {shown.slice(0, 100).map((p) => (
        <div className="cpl-row" key={p.uid}>
          <div><strong>{p.username} {p.status !== 'active' && <span className="ef-pill red">{p.status}</span>}</strong><small>{p.fullName} · {p.course} · {p.platform} · {p.strength} · {p.whatsapp}</small></div>
          {p.fplId && <button className="lp-btn" title="Remove this player's FPL link" onClick={() => confirm(`Unlink FPL team ${p.fplId} from ${p.username}?`) && unlinkFpl(p)}>Unlink FPL {p.fplId}</button>}
          {p.squadId && <a href={driveImg(p.squadId, 1200)} target="_blank" rel="noopener noreferrer">Squad</a>}
          <button className={`lp-btn${p.status === 'active' ? ' cpl-danger' : ''}`} onClick={() => ban(p)}>{p.status === 'active' ? 'Ban' : 'Unban'}</button>
        </div>
      ))}
    </section>
  )
}

/* ---------------- league ---------------- */
function LeagueAdmin() {
  const [asks, setAsks] = useState<{ course: string; count: number }[] | null>(null)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<{ course: string; count: number }[]>('courseInterest').then(setAsks).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function fixtures() {
    try {
      const r = await ef<{ made: number; fixtureDay: boolean }>('runFixtures')
      setMsg({ ok: true, text: r.fixtureDay ? `${r.made} new fixture(s) created for today.` : 'Today is not a fixture day (Mon, Wed, Fri, Sun).' })
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function videos() {
    try { await ef('refreshVideos'); setMsg({ ok: true, text: 'Home page videos refreshed.' }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function open(course: string) {
    try { await ef('setCourseLeague', { name: course, league: true }); setMsg({ ok: true, text: `${course} is now open for the league.` }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>Daily fixtures</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Fixtures are made automatically at 00:00 on Monday, Wednesday, Friday and Sunday. Players send scores before 21:00, and every fixture is settled by the rules at 21:00 (same score: confirmed; one screenshot beats none; no report: walkover or void). Nothing needs your decision. Use this button only if the automatic run was missed.</p>
        <button className="lp-btn" onClick={fixtures}>Make today's fixtures now</button>
        {el}
      </section>
      <section className="cpl-card">
        <h3>Home page videos</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>The six video rows on the home page are saved automatically every 12 hours, so visitors never use your YouTube quota. Refresh them by hand after changing the API key.</p>
        <button className="lp-btn" onClick={videos}>Refresh videos now</button>
      </section>
      <section className="cpl-card">
        <h3>Courses asking to join the league</h3>
        {asks && !asks.length && <p className="cpl-empty">No requests yet.</p>}
        {asks?.map((a) => (
          <div className="cpl-row" key={a.course}>
            <div><strong>{a.course}</strong><small>{a.count} student(s) asked</small></div>
            <button className="lp-btn" onClick={() => open(a.course)}>Open for league</button>
          </div>
        ))}
      </section>
    </>
  )
}

/* ---------------- Chuka FPL ---------------- */
function FplAdmin() {
  const [info, setInfo] = useState<FplAdminInfo | null>(null)
  const [leagueId, setLeagueId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const apply = useCallback((i: FplAdminInfo) => { setInfo(i); setLeagueId(i.leagueId); setCode(i.leagueCode) }, [])
  useEffect(() => { ef<FplAdminInfo>('fplInfo').then(apply).catch((e) => setMsg({ ok: false, text: (e as Error).message })) }, [apply, setMsg])
  async function run(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try { apply(await ef<FplAdminInfo>(action, payload)); setMsg({ ok: true, text: ok }) }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>Chuka FPL league</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Create a classic league on the FPL site (Leagues &amp; Cups, Create and join, Create a league). Paste its league ID below: it is the number in the standings address, fantasy.premierleague.com/leagues/<b>123456</b>/standings/c. Only managers inside this league can link and count. Optionally paste the league's join code so players get a join button.</p>
        <div className="cpl-inline" style={{ marginBottom: 10 }}>
          <input type="text" inputMode="numeric" value={leagueId} onChange={(e) => setLeagueId(e.target.value.replace(/\D/g, ''))} placeholder="League ID, e.g. 123456" aria-label="FPL league ID" maxLength={9} />
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Join code (optional)" aria-label="FPL league join code" maxLength={20} />
        </div>
        <div className="ef-actions" style={{ marginTop: 0 }}>
          <button className="lp-btn" disabled={busy} onClick={() => run('fplSettings', { leagueId, leagueCode: code }, leagueId ? 'Saved and loaded from FPL.' : 'FPL league cleared.')}>{busy ? 'Working…' : 'Save league'}</button>
          {info?.leagueId && <button className="lp-btn" disabled={busy} onClick={() => run('fplRefresh', {}, 'Refreshed from FPL.')}>Refresh now</button>}
        </div>
        {el}
      </section>
      {info?.leagueId && (
        <section className="cpl-card">
          <h3>Status</h3>
          <p className="cpl-sub" style={{ margin: 0 }}>
            {info.members} members in the FPL league · {info.linked} Chuka players linked ({info.inLeague} inside the league){info.gw ? ` · gameweek ${info.gw}` : ''}<br />
            Last refreshed: {info.at ? fmtStamp(info.at) : 'not yet'} (automatic every 30 minutes).
          </p>
          {info.error && <p className="cpl-err" role="alert" style={{ marginTop: 10 }}>Last refresh failed: {info.error} The page keeps showing the last good data.</p>}
          <p className="cpl-note" style={{ textAlign: 'left' }}>To remove a wrong link, open the Players tab and use Unlink FPL next to that player.</p>
        </section>
      )}
    </>
  )
}
