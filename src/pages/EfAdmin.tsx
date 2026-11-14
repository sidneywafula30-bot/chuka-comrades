import { useCallback, useEffect, useState } from 'react'
import { Copy, Trophy } from 'lucide-react'
import ImagePicker from '../components/ImagePicker'
import { driveImg, ef, fromParts, toParts, type AdminCourse, type Attention, type DisputedMatch, type Profile, type Tournament } from '../lib/efootball'

type Tab = 'tournament' | 'attention' | 'courses' | 'players' | 'league'
type Msg = { ok: boolean; text: string } | null

export default function EfAdmin() {
  const [tab, setTab] = useState<Tab>('tournament')
  return (
    <div className="cpl-page">
      <h2>eFootball admin</h2>
      <p className="cpl-sub">Tournaments, disputes, courses and players.</p>
      <div className="ef-tabs" role="tablist">
        {([['tournament', 'Tournament'], ['attention', 'Needs attention'], ['courses', 'Courses'], ['players', 'Players'], ['league', 'League']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'tournament' ? <TournamentAdmin /> : tab === 'attention' ? <AttentionAdmin /> : tab === 'courses' ? <CoursesAdmin /> : tab === 'players' ? <PlayersAdmin /> : <LeagueAdmin />}
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
function CoursesAdmin() {
  const [list, setList] = useState<AdminCourse[] | null>(null)
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<AdminCourse[]>('adminCourses').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])

  async function imp() {
    setBusy(true); setMsg(null)
    try { const r = await ef<{ pages: number; found: number; added: number }>('importCourses'); setMsg({ ok: true, text: `Read ${r.pages} pages, found ${r.found} courses, added ${r.added} new.` }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  async function bach() {
    setBusy(true); setMsg(null)
    try { const r = await ef<{ added: number; activated: number }>('addBachelors'); setMsg({ ok: true, text: `Added ${r.added} bachelor degree courses and switched on ${r.activated} more.` }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  async function toggle(c: AdminCourse) {
    setList((l) => l && l.map((x) => (x.name === c.name ? { ...x, active: !x.active } : x)))
    try { await ef('setCourseActive', { name: c.name, active: !c.active }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }); await load() }
  }
  async function add() {
    try { await ef('addCourse', { name }); setName(''); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  const shown = (list ?? []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <section className="cpl-card">
        <h3>Courses from chuka.ac.ke</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Students pick their course from the active ones. Bachelor degree courses are switched on by default; diploma, certificate and postgraduate ones are off.</p>
        <div className="ef-actions" style={{ marginTop: 0 }}>
          <button className="lp-btn" disabled={busy} onClick={bach}>Add bachelor degree courses</button>
          <button className="lp-btn" disabled={busy} onClick={imp}>{busy ? 'Working…' : 'Import full list from Chuka website'}</button>
        </div>
        <div className="cpl-inline" style={{ marginTop: 14 }}>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a course by hand" maxLength={120} />
          <button className="lp-btn" disabled={!name.trim()} onClick={add}>Add</button>
        </div>
        {el}
      </section>
      {list && (
        <section className="cpl-card">
          <div className="cpl-inline" style={{ marginBottom: 8 }}><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length} courses`} /></div>
          {shown.slice(0, 120).map((c) => (
            <div className="cpl-row" key={c.name}>
              <div><strong>{c.name}</strong><small>{[c.level, c.campuses].filter(Boolean).join(' · ')}</small></div>
              <label className="cpl-file"><input type="checkbox" checked={c.active} onChange={() => toggle(c)} /> Active</label>
            </div>
          ))}
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
  const s = q.toLowerCase()
  const shown = (list ?? []).filter((p) => !s || p.username.toLowerCase().includes(s) || p.fullName.toLowerCase().includes(s) || p.whatsapp.includes(s) || p.email.toLowerCase().includes(s))
  return (
    <section className="cpl-card">
      {el}
      <div className="cpl-inline" style={{ marginBottom: 8 }}><input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list?.length ?? 0} players (name, username, phone, email)`} /></div>
      {shown.slice(0, 100).map((p) => (
        <div className="cpl-row" key={p.uid}>
          <div><strong>{p.username} {p.status !== 'active' && <span className="ef-pill red">{p.status}</span>}</strong><small>{p.fullName} · {p.course} · {p.platform} · {p.strength} · {p.whatsapp}</small></div>
          {p.squadId && <a href={driveImg(p.squadId, 1200)} target="_blank" rel="noopener noreferrer">Squad</a>}
          <button className={`lp-btn${p.status === 'active' ? ' cpl-danger' : ''}`} onClick={() => ban(p)}>{p.status === 'active' ? 'Ban' : 'Unban'}</button>
        </div>
      ))}
    </section>
  )
}

/* ---------------- league ---------------- */
function LeagueAdmin() {
  const [list, setList] = useState<DisputedMatch[] | null>(null)
  const { setMsg, el } = useMsg()
  const load = useCallback(() => ef<DisputedMatch[]>('disputedMatches').then(setList).catch((e) => setMsg({ ok: false, text: (e as Error).message })), [setMsg])
  useEffect(() => { void load() }, [load])
  async function resolve(id: string, s1: number, s2: number) {
    try { await ef('resolveMatch', { matchId: id, s1, s2 }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  async function pair() {
    try { const r = await ef<{ made: number }>('runPairing'); setMsg({ ok: true, text: `${r.made} new matches created for this week.` }) } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
  }
  return (
    <>
      <section className="cpl-card">
        <h3>Weekly pairing</h3>
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Runs by itself every Monday at 6 am. Use this to top up the week after many new players joined.</p>
        <button className="lp-btn" onClick={pair}>Pair this week now</button>
        {el}
      </section>
      <section className="cpl-card">
        <h3>Disputed league matches</h3>
        {list && !list.length && <p className="cpl-empty">No disputed matches.</p>}
        {list?.map((m) => (
          <div className="cpl-row" key={m.id}>
            <div>
              <strong>{m.p1} vs {m.p2}</strong>
              <small>{m.p1} says {m.r1 ? `${m.r1.a}–${m.r1.b}` : '?'} · {m.p2} says {m.r2 ? `${m.r2.a}–${m.r2.b}` : '?'}{m.proofIds.length ? ` · ${m.proofIds.length} screenshot(s)` : ''}</small>
              {m.proofIds.map((id) => <a key={id} href={driveImg(id, 1200)} target="_blank" rel="noopener noreferrer">Screenshot</a>)}
            </div>
            {m.r1 && <button className="lp-btn" onClick={() => resolve(m.id, m.r1!.a, m.r1!.b)}>Use {m.p1}'s</button>}
            {m.r2 && <button className="lp-btn" onClick={() => resolve(m.id, m.r2!.a, m.r2!.b)}>Use {m.p2}'s</button>}
          </div>
        ))}
      </section>
    </>
  )
}
