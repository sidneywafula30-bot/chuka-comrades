import { useEffect, useState } from 'react'
import { Clock, Link2, MessageCircle, Share2 } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ImagePicker from '../components/ImagePicker'
import { ef, fmtTime, leagueInviteLink, sharedSlots, waLink, type League, type MatchView, type Me } from '../lib/efootball'

type Tab = 'table' | 'courses' | 'mine' | 'recent'
type Props = { me: Me | null; reload: () => Promise<void>; signedIn: boolean; onSignIn: () => void; joinCourse: string; joining: boolean }

function useCountdown(iso: string) {
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i) }, [])
  const ms = Date.parse(iso) - Date.now()
  if (!(ms > 0)) return ''
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export default function EfLeague({ me, reload, signedIn, onSignIn, joinCourse, joining }: Props) {
  const [lg, setLg] = useState<League | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>(joining ? 'courses' : 'table')
  const load = () => ef<League>('league').then(setLg).catch((e) => setErr((e as Error).message))
  useEffect(() => { void load() }, [])
  const both = async () => { await Promise.all([reload(), load()]) }

  const open = me?.matches.filter((m) => m.status === 'pending' || m.status === 'disputed').length ?? 0
  return (
    <div className="cpl-page">
      <h2>Chuka League</h2>
      <p className="cpl-sub">
        {lg ? `Fixtures are made at 00:00 on ${lg.fixtureDays.join(', ')}. Send your score before ${lg.closeHour}:00 the same day. ` : ''}
        A win is 3 points, a draw 1. Results are settled automatically at {lg?.closeHour ?? 21}:00.
      </p>
      {lg && <JoinCard lg={lg} me={me} signedIn={signedIn} onSignIn={onSignIn} reload={both} inviteCourse={joinCourse} />}
      <div className="ef-tabs" role="tablist">
        {([['table', 'Player table'], ['courses', 'Course table'], ['mine', `My fixtures${open ? ` (${open})` : ''}`], ['recent', 'Recent results']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {tab === 'mine' ? <Mine me={me} signedIn={signedIn} reload={both} /> : !lg ? <p className="cpl-empty">Loading…</p>
        : tab === 'table' ? (
          <div className="cpl-card ef-scroll">
            {!lg.table.length ? <p className="cpl-empty">No one has joined yet. Be the first: tap Join above.</p> : (
              <table className="ef-table">
                <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                <tbody>{lg.table.map((r, i) => (
                  <tr key={r.uid} style={r.uid === me?.uid ? { background: '#f3f8f4' } : undefined}><td>{i + 1}</td><td><strong>{r.username}</strong><small>{r.course}</small></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd}</td><td><strong>{r.pts}</strong></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ) : tab === 'courses' ? (
          <CourseTable lg={lg} me={me} reload={both} highlight={joinCourse} />
        ) : (
          <div className="cpl-card">
            {!lg.recent.length ? <p className="cpl-empty">No results yet.</p> : lg.recent.map((r) => (
              <div className="cpl-row" key={r.id}><div><strong>{r.p1} {r.s1} – {r.s2} {r.p2}</strong></div></div>
            ))}
          </div>
        )}
    </div>
  )
}

function JoinCard({ lg, me, signedIn, onSignIn, reload, inviteCourse }: { lg: League; me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void>; inviteCourse: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const p = me?.profile ?? null
  async function act(action: string, ok: string) {
    setBusy(true); setMsg(null)
    try { await ef(action); await reload(); setMsg({ ok: true, text: ok }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  const invited = inviteCourse && (!p || p.course !== inviteCourse)
  const invite = (c: string) => waLink('', `Join the ${c} team in the Chuka eFootball league. Daily fixtures, course table, free to join: ${leagueInviteLink(c)}`)

  let body
  if (!signedIn) body = <><p className="cpl-empty" style={{ textAlign: 'left' }}>Sign in with Google, register as a player and tap Join to get fixtures.</p><GoogleSignInButton onClick={onSignIn} label="Sign in to join" /></>
  else if (!me) body = <p className="cpl-empty">Loading your account…</p>
  else if (!p) body = <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Register your player profile first, then come back and tap Join.</p><a className="lp-btn" href="#/efootball/profile">Register as a player</a></>
  else if (p.inLeague) body = (
    <>
      <p className="cpl-msg"><span className={`ef-pill${p.paused ? ' red' : ''}`}>{p.paused ? 'Paused' : 'In the league'}</span> {p.course}</p>
      {p.paused
        ? <><p className="cpl-note" style={{ textAlign: 'left' }}>You missed {p.strikes} fixtures in a row, so you are not getting new ones. Tap Resume when you are ready to play again.</p>
          <div className="ef-actions"><button className="lp-btn" disabled={busy} onClick={() => act('resumeLeague', 'You are back in. Your next fixture comes on the next fixture day.')}>Resume</button></div></>
        : <p className="cpl-note" style={{ textAlign: 'left', marginTop: 4 }}>{lg.fixtureToday ? `Today is a fixture day: check My fixtures and report before ${lg.closeHour}:00.` : `Next fixtures come at 00:00 on ${lg.fixtureDays.join(', ')}.`}{(p.freeTimes.length > 0) && ' Only days you marked free get a fixture.'}</p>}
      <div className="ef-actions">
        <a className="lp-btn" href={invite(p.course)} target="_blank" rel="noopener noreferrer"><Share2 size={14} /> Invite classmates</a>
        <button className="lp-btn cpl-danger" disabled={busy} onClick={() => act('leaveLeague', 'You left the league.')}>Leave league</button>
      </div>
    </>
  )
  else if (!p.leagueOpen) body = (
    <>
      <p className="cpl-sub" style={{ margin: '0 0 12px' }}><strong>{p.course}</strong> is not in the league yet. The admin opens new courses when enough students ask.</p>
      <div className="ef-actions"><button className="lp-btn" disabled={busy} onClick={() => act('courseInterest', 'Thanks. The admin can see that your course wants in.')}>Request my course</button></div>
    </>
  )
  else body = (
    <>
      <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Join to play one match on every fixture day against a player of similar strength, and earn points for <strong>{p.course}</strong>.</p>
      <div className="ef-actions"><button className="lp-btn" disabled={busy} onClick={() => act('joinLeague', 'You are in. ' + (lg.fixtureToday ? 'If a fixture is available you will see it under My fixtures.' : 'Your first fixture comes on the next fixture day.'))}>{busy ? 'Joining…' : 'Join the league'}</button></div>
    </>
  )

  return (
    <section className="cpl-card">
      <h3>{invited ? `You were invited: ${inviteCourse}` : 'Join the league'}</h3>
      {invited && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{lg.openCourses.includes(inviteCourse) ? 'This course is open. Register with it as your course, then tap Join.' : 'This course is not open yet. Register anyway and request it.'}</p>}
      {body}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </section>
  )
}

function CourseTable({ lg, me, reload, highlight }: { lg: League; me: Me | null; reload: () => Promise<void>; highlight: string }) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const p = me?.profile ?? null
  async function join() {
    setBusy(true)
    try { await ef('joinLeague'); await reload() } catch { /* the join card above shows the reason */ } finally { setBusy(false) }
  }
  const copy = (c: string) => { void navigator.clipboard?.writeText(leagueInviteLink(c)); setCopied(c); setTimeout(() => setCopied(''), 2000) }
  return (
    <div className="cpl-card ef-scroll">
      <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Courses are ranked by average points per player, so big courses do not win just by size. A course needs 3 players to be ranked. More courses are added by the admin.</p>
      {!lg.courses.length ? <p className="cpl-empty">No course is open for the league yet.</p> : (
        <table className="ef-table">
          <thead><tr><th>#</th><th>Course</th><th>Players</th><th>Points</th><th>Avg</th><th /></tr></thead>
          <tbody>{lg.courses.map((c, i) => (
            <tr key={c.course} style={c.course === highlight ? { background: '#fff9e3' } : c.course === p?.course ? { background: '#f3f8f4' } : c.ranked ? undefined : { opacity: 0.8 }}>
              <td>{c.ranked ? i + 1 : '–'}</td><td>{c.course}</td><td>{c.players}</td><td>{c.pts}</td><td><strong>{c.avg}</strong></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {p && p.course === c.course && !p.inLeague
                  ? <button className="lp-btn" disabled={busy} onClick={join}>Join</button>
                  : <button type="button" className="cpl-link" onClick={() => copy(c.course)} aria-label={`Copy invite link for ${c.course}`}><Link2 size={13} /> {copied === c.course ? 'Copied' : 'Invite'}</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}

function Mine({ me, signedIn, reload }: { me: Me | null; signedIn: boolean; reload: () => Promise<void> }) {
  if (!signedIn) return <p className="cpl-empty">Sign in with Google to see your fixtures.</p>
  if (!me) return <p className="cpl-empty">Loading…</p>
  if (!me.profile) return <div className="cpl-card"><p className="cpl-empty">Register first to join the league.</p><div className="ef-actions"><a className="lp-btn" href="#/efootball/profile">Register</a></div></div>
  if (!me.matches.length) return <p className="cpl-empty">{me.profile.inLeague ? 'No fixtures yet. They are made at 00:00 on fixture days.' : 'Join the league above to get fixtures.'}</p>
  return <>{me.matches.map((m) => <MatchCard key={m.id} m={m} mySlots={me.profile?.freeTimes ?? []} reload={reload} />)}</>
}

function MatchCard({ m, mySlots, reload }: { m: MatchView; mySlots: string[]; reload: () => Promise<void> }) {
  const [mine, setMine] = useState(m.myClaim ? String(m.myClaim.mine) : '')
  const [theirs, setTheirs] = useState(m.myClaim ? String(m.myClaim.theirs) : '')
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const left = useCountdown(m.deadline)
  const slots = sharedSlots(mySlots, m.opp.freeTimes)
  const closed = m.status === 'confirmed' || m.status === 'void' || !left

  async function send() {
    setBusy(true); setMsg(null)
    try {
      const r = await ef<{ status: string }>('reportScore', { matchId: m.id, mine: Number(mine), theirs: Number(theirs), proof: proof || undefined })
      await reload()
      setMsg({ ok: true, text: r.status === 'confirmed' ? 'Both scores match. Result confirmed.' : r.status === 'disputed' ? 'The two scores differ. You can both update them before the deadline. If they still differ, a screenshot decides.' : 'Score sent. Waiting for your opponent to report.' })
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <section className="cpl-card">
      <h3>vs {m.opp.username} <span className={`ef-pill${m.status === 'disputed' || m.status === 'void' ? ' red' : m.status === 'confirmed' ? ' gold' : ''}`}>{m.status === 'pending' && !left ? 'closed' : m.status}</span></h3>
      <p className="cpl-sub" style={{ margin: '0 0 8px' }}>{m.day} · {m.opp.platform} · strength {m.opp.strength} · {m.opp.course}</p>
      {m.status === 'confirmed' && m.final && <p className="cpl-msg">Final score: you {m.final.mine} – {m.final.theirs} {m.opp.username}</p>}
      {m.note && closed && <p className="cpl-note" style={{ textAlign: 'left' }}>{m.note}</p>}
      {!closed && (
        <>
          <p className="ef-deadline"><Clock size={14} /> Report by {fmtTime(m.deadline)} · {left} left</p>
          <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{slots.length ? `You are both free: ${slots.slice(0, 4).join(', ')}.` : 'No shared free time on file. Agree a time on WhatsApp.'}</p>
          <div className="ef-actions" style={{ marginTop: 0, marginBottom: 14 }}>
            <a className="cpl-link" href={waLink(m.opp.whatsapp, `Hi ${m.opp.username}, we are matched in today's Chuka eFootball league fixture. When can we play? Results are due by ${fmtTime(m.deadline)}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> WhatsApp {m.opp.username}</a>
          </div>
          <div className="ef-score">
            <span>You</span><input type="number" min={0} max={30} value={mine} onChange={(e) => setMine(e.target.value)} aria-label="Your goals" />
            <span>–</span><input type="number" min={0} max={30} value={theirs} onChange={(e) => setTheirs(e.target.value)} aria-label="Their goals" /><span>{m.opp.username}</span>
          </div>
          <div style={{ marginTop: 12 }}><ImagePicker current="" fallback={<span style={{ fontSize: 11 }}>Screenshot</span>} label="result screenshot" max={1280} onChange={(v) => setProof(v.data)} /></div>
          <p className="cpl-note" style={{ textAlign: 'left' }}>Add a screenshot of the final score. If the scores differ, or your opponent never reports, the screenshot decides.</p>
          <div className="ef-actions"><button className="lp-btn" disabled={busy || mine === '' || theirs === ''} onClick={send}>{busy ? 'Sending…' : m.myClaim ? 'Update score' : 'Submit score'}</button></div>
          {m.myClaim && !msg && <p className="cpl-note" style={{ textAlign: 'left' }}>{m.oppReported ? 'Your opponent has reported too.' : 'Waiting for your opponent to report.'}</p>}
          {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
        </>
      )}
    </section>
  )
}
