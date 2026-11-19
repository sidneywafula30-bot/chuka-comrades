import { useEffect, useState } from 'react'
import { Clock, Link2, MessageCircle, Share2 } from 'lucide-react'
import DriveImage from '../components/DriveImage'
import ShareCardButton from '../components/ShareCardButton'
import { cardDate, type CardSpec } from '../lib/efCard'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ImagePicker from '../components/ImagePicker'
import { PayBox, PendingPay, usePayCfg } from '../components/EfPay'
import { courseLogoData, ef, fmtTime, ksh, leagueInviteLink, sharedSlots, waLink, type League, type MatchView, type Me } from '../lib/efootball'

type Tab = 'table' | 'courses' | 'mine' | 'recent'
type Props = { me: Me | null; reload: () => Promise<void>; signedIn: boolean; onSignIn: () => void; joinCourse: string; joining: boolean }

/** Time left to a deadline, by the SERVER clock (skew = server time minus this phone's time), so a wrong phone clock cannot hide the score form. */
function useCountdown(iso: string, skew: number) {
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i) }, [])
  const ms = Date.parse(iso) - (Date.now() + skew)
  if (!(ms > 0)) return ''
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export default function EfLeague({ me, reload, signedIn, onSignIn, joinCourse, joining }: Props) {
  const [lg, setLg] = useState<League | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>(joining ? 'courses' : 'table')
  const [skew, setSkew] = useState(0)
  const load = () => ef<League>('league').then((r) => { setLg(r); setSkew(r.serverNow - Date.now()) }).catch((e) => setErr((e as Error).message))
  useEffect(() => { void load() }, [])
  const both = async () => { await Promise.all([reload(), load()]) }

  const open = me?.matches.filter((m) => m.status === 'pending' || m.status === 'disputed').length ?? 0
  return (
    <div className="cpl-page">
      <h2>Chuka League</h2>
      <p className="cpl-sub">
        {lg ? `Fixtures are made at 00:00 on ${lg.fixtureDays.join(', ')}. Send your score before ${lg.closeHour}:00 the same day. ` : ''}
        A win is 3 points, a draw 1. Results are settled automatically at {lg?.closeHour ?? 21}:00. If nobody reports a fixture, it counts as a 0-0 draw (1 point each).
      </p>
      {lg && <JoinCard lg={lg} me={me} signedIn={signedIn} onSignIn={onSignIn} reload={both} inviteCourse={joinCourse} />}
      <div className="ef-tabs" role="tablist">
        {([['table', 'Player table'], ['courses', 'Course table'], ['mine', `My fixtures${open ? ` (${open})` : ''}`], ['recent', 'Recent results']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {tab === 'mine' ? <Mine me={me} signedIn={signedIn} reload={both} skew={skew} /> : !lg ? <p className="cpl-empty">Loading…</p>
        : tab === 'table' ? (
          <div className="cpl-card ef-scroll">
            {lg.table.length > 0 && (
              <div className="ef-actions" style={{ marginTop: 0, marginBottom: 12 }}>
                <ShareCardButton label="Share league card" filename="chuka-league.png" text="Chuka eFootball league table" build={() => leagueCard(lg, me?.profile?.course || '')} />
              </div>
            )}
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
          <CourseTable lg={lg} me={me} reload={both} highlight={joinCourse} signedIn={signedIn} onSignIn={onSignIn} />
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

/** Share card: a course league (logo, standing, top players) or, with no course, the whole player table. */
async function leagueCard(lg: League, course: string): Promise<CardSpec> {
  const c = lg.courses.find((x) => x.course === course)
  const players = course && c ? lg.table.filter((r) => r.course === course) : lg.table
  const rank = c ? lg.courses.filter((x) => x.ranked).findIndex((x) => x.course === c.course) + 1 : 0
  const logo = c?.logoId ? await courseLogoData(c.course) : ''
  return {
    theme: 'green', logo,
    eyebrow: `Chuka League · ${cardDate()}`,
    title: c ? c.course : 'Chuka eFootball League',
    subtitle: c ? `${c.players} player${c.players === 1 ? '' : 's'} · 3 days free to join` : `${lg.registered} players in the league`,
    stats: c ? [
      { value: c.ranked && rank ? `#${rank}` : '–', label: 'Course rank' },
      { value: String(c.avg), label: 'Avg pts / player' },
      { value: String(c.pts), label: 'Total points' },
      { value: String(c.players), label: 'Players' },
    ] : undefined,
    head: ['#', 'Player', 'P', 'W', 'D', 'L', 'GD', 'Pts'],
    rows: players.slice(0, 10).map((r, i) => ({ cells: [String(i + 1), r.username, String(r.p), String(r.w), String(r.d), String(r.l), String(r.gd), String(r.pts)] })),
    note: players.length > 10 ? `+ ${players.length - 10} more players` : '',
    footer: `${window.location.host}${window.location.pathname}#/efootball/league`,
  }
}

/** Any member can set the logo of their class league. */
function LogoCard({ me, lg, reload }: { me: Me; lg: League; reload: () => Promise<void> }) {
  const p = me.profile!
  const row = lg.courses.find((c) => c.course === p.course)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function send(v: { data: string; removed: boolean }) {
    setBusy(true); setMsg(null)
    try { await ef('setLeagueLogo', v.removed ? { remove: true } : { logo: v.data }); await reload(); setMsg({ ok: true, text: v.removed ? 'Logo removed.' : 'League logo updated for everyone in your course.' }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <div style={{ marginTop: 14 }}>
      <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 8px' }}>Your class league logo. Any member of {p.course} can change it.</p>
      <div style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
        <ImagePicker key={row?.logoId || 'none'} current={row?.logoId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(row.logoId)}&sz=w300` : ''} fallback={<span style={{ fontSize: 11 }}>Logo</span>} label="league logo" max={320} onChange={(v) => void send(v)} />
      </div>
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
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
      <p className="cpl-msg"><span className={`ef-pill${p.paused || p.leagueState === 'expired' ? ' red' : ''}`}>{p.leagueState === 'expired' ? 'Trial ended' : p.paused ? 'Paused' : p.leagueState === 'trial' ? 'Free trial' : 'In the league'}</span> {p.course}</p>
      <Activation me={me} lg={lg} reload={reload} />
      {p.paused
        ? <><p className="cpl-note" style={{ textAlign: 'left' }}>You missed {p.strikes} fixtures in a row, so you are not getting new ones. Tap Resume when you are ready to play again.</p>
          <div className="ef-actions"><button className="lp-btn" disabled={busy} onClick={() => act('resumeLeague', 'You are back in. Your next fixture comes on the next fixture day.')}>Resume</button></div></>
        : <p className="cpl-note" style={{ textAlign: 'left', marginTop: 4 }}>{lg.fixtureToday ? `Today is a fixture day: check My fixtures and report before ${lg.closeHour}:00.` : `Next fixtures come at 00:00 on ${lg.fixtureDays.join(', ')}.`}{(p.freeTimes.length > 0) && ' Only days you marked free get a fixture.'}</p>}
      <div className="ef-actions">
        <a className="lp-btn" href={invite(p.course)} target="_blank" rel="noopener noreferrer"><Share2 size={14} /> Invite classmates</a>
        <ShareCardButton label="Share league card" filename="chuka-course-league.png" text={`${p.course} in the Chuka eFootball league`} build={() => leagueCard(lg, p.course)} />
        <button className="lp-btn cpl-danger" disabled={busy} onClick={() => act('leaveLeague', 'You left the league.')}>Leave league</button>
      </div>
      {me && <LogoCard me={me} lg={lg} reload={reload} />}
    </>
  )
  else if (!p.leagueOpen) body = <ListMyCourse course={p.course} me={me} reload={reload} />
  else body = <JoinPaid lg={lg} me={me} reload={reload} />

  return (
    <section className="cpl-card">
      <h3>{invited ? `You were invited: ${inviteCourse}` : 'Join the league'}</h3>
      {invited && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{lg.openCourses.includes(inviteCourse) ? 'This course is open. Register with it as your course, then tap Join.' : 'This course is not open yet. Register anyway and request it.'}</p>}
      {body}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </section>
  )
}

function CourseTable({ lg, me, reload, highlight, signedIn, onSignIn }: { lg: League; me: Me | null; reload: () => Promise<void>; highlight: string; signedIn: boolean; onSignIn: () => void }) {
  const [copied, setCopied] = useState('')
  const p = me?.profile ?? null
  const copy = (c: string) => { void navigator.clipboard?.writeText(leagueInviteLink(c)); setCopied(c); setTimeout(() => setCopied(''), 2000) }
  return (
    <>
      <div className="cpl-card ef-scroll">
        <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Courses are ranked by average points per player, so big courses do not win just by size. A course needs 3 players to be ranked.</p>
        {!lg.courses.length ? <p className="cpl-empty">No course is open for the league yet.</p> : (
          <table className="ef-table">
            <thead><tr><th>#</th><th>Course</th><th>Players</th><th>Points</th><th>Avg</th><th /></tr></thead>
            <tbody>{lg.courses.map((c, i) => (
              <tr key={c.course} style={c.course === highlight ? { background: '#fff9e3' } : c.course === p?.course ? { background: '#f3f8f4' } : c.ranked ? undefined : { opacity: 0.8 }}>
                <td>{c.ranked ? i + 1 : '–'}</td><td><span className="ef-cname">{c.logoId && <span className="ef-clogo"><DriveImage id={c.logoId} w={80} /></span>}<span>{c.course}{c.founder && <small>Set up by {c.founder}</small>}</span></span></td><td>{c.players}</td><td>{c.pts}</td><td><strong>{c.avg}</strong></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {p && p.course === c.course && !p.inLeague
                    ? <button className="lp-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Join</button>
                    : <button type="button" className="cpl-link" onClick={() => copy(c.course)} aria-label={`Copy invite link for ${c.course}`}><Link2 size={13} /> {copied === c.course ? 'Copied' : 'Invite'}</button>}
                  <ShareCardButton className="cpl-link" label="Card" filename="chuka-course-league.png" text={`${c.course} in the Chuka eFootball league`} build={() => leagueCard(lg, c.course)} />
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <ListCourseCard signedIn={signedIn} onSignIn={onSignIn} me={me} reload={reload} />
    </>
  )
}

/** "My course is not in the league": pick it (or type it), pay KSh 10 by M-Pesa, the admin verifies and opens it. */
function ListCourseCard({ signedIn, onSignIn, me, reload }: { signedIn: boolean; onSignIn: () => void; me: Me | null; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const [catalog, setCatalog] = useState<string[]>([])
  const [pick, setPick] = useState('')
  const [typed, setTyped] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { ef<string[]>('courseCatalog').then(setCatalog).catch(() => {}) }, [])
  const name = (typed.trim() || pick).trim()
  const waiting = me?.pending.some((x) => x.kind === 'course' && x.ref.toLowerCase() === name.toLowerCase())
  async function send() {
    setBusy(true); setMsg(null)
    try { await ef('courseRequest', { name, mpesa: code }); await reload(); setCode(''); setMsg({ ok: true, text: 'Payment code received. Chat the admin on WhatsApp so the course is opened.' }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <section className="cpl-card">
      <h3>List my course ({ksh(cfg.fees.course)})</h3>
      <p className="cpl-sub" style={{ margin: '0 0 12px' }}>The league starts with Electrical Engineering and Nursing. Pay {ksh(cfg.fees.course)} and the admin opens your course too. Then every classmate can register, join and play for it.</p>
      {!signedIn ? <GoogleSignInButton onClick={onSignIn} label="Sign in to list a course" /> : (
        <>
          <div className="cpl-inline" style={{ marginBottom: 10 }}>
            <select className="ef-sel" value={pick} onChange={(e) => { setPick(e.target.value); setTyped('') }} aria-label="Choose your course">
              <option value="">Choose your course</option>{catalog.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="ef-sel" value={typed} onChange={(e) => { setTyped(e.target.value); setPick('') }} placeholder="or type the course name" aria-label="Course name" maxLength={120} />
          </div>
          {waiting ? <PendingPay label={`List course: ${name}`} amount={cfg.fees.course} /> : name.length >= 3 && <PayBox amount={cfg.fees.course} label={`List course: ${name}`} code={code} onCode={setCode} onSubmit={send} busy={busy} button="Send payment code" />}
          {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
        </>
      )}
    </section>
  )
}

/** Player's own course exists but the league is not open for it yet. */
function ListMyCourse({ course, me, reload }: { course: string; me: Me | null; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const waiting = !!me?.pending.some((x) => x.kind === 'course' && x.ref === course)
  async function send() {
    setBusy(true); setMsg(null)
    try { await ef('courseRequest', { name: course, mpesa: code }); await reload(); setCode(''); setMsg({ ok: true, text: 'Payment code received. Chat the admin on WhatsApp so your course is opened.' }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <>
      <p className="cpl-sub" style={{ margin: '0 0 12px' }}><strong>{course}</strong> is not in the league yet. Only Electrical Engineering and Nursing are open at the start. Pay {ksh(cfg.fees.course)} and the admin lists your course.</p>
      {waiting ? <PendingPay label={`List course: ${course}`} amount={cfg.fees.course} /> : <PayBox amount={cfg.fees.course} label={`List course: ${course}`} code={code} onCode={setCode} onSubmit={send} busy={busy} button="Send payment code" />}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </>
  )
}

/** Join the class league of my course: 3 days free, then a one-time activation. */
function JoinPaid({ lg, me, reload }: { lg: League; me: Me | null; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const p = me!.profile!
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const expired = p.leagueState === 'expired'
  async function join() {
    setBusy(true); setMsg(null)
    try { await ef('joinLeague'); await reload(); setMsg({ ok: true, text: 'You are in. ' + (lg.fixtureToday ? 'If a fixture is available you will see it under My fixtures.' : 'Your first fixture comes on the next fixture day.') }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  return (
    <>
      <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Join to play one match on every fixture day against a player of similar strength, and earn points for <strong>{p.course}</strong>.</p>
      <p className="ef-deadline" style={{ color: 'var(--green)' }}>{expired ? `Your 3 free days are over. Activate for ${ksh(cfg.fees.activation ?? 20)} to keep playing.` : `Free for 3 days. After that, activate once for ${ksh(cfg.fees.activation ?? 20)} to keep automatic fixtures and saved results.`}</p>
      <div className="ef-actions"><button className="lp-btn" disabled={busy} onClick={join}>{busy ? 'Joining…' : expired ? 'Rejoin the league' : 'Join free for 3 days'}</button></div>
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </>
  )
}

/** Free-trial countdown and the one-time activation (M-Pesa code, then chat the admin). */
function Activation({ me, lg, reload }: { me: Me; lg: League; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const p = me.profile!
  const amount = cfg.fees.activation ?? 20
  const [skew] = useState(lg.serverNow - Date.now())
  const left = useCountdown(p.trialEnds ?? '', skew)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(false)
  async function send() {
    setBusy(true); setMsg(null)
    try { await ef('activateLeague', { mpesa: code }); await reload(); setCode(''); setMsg({ ok: true, text: 'Payment code received. Chat the admin on WhatsApp to get activated.' }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  const st = p.leagueState
  if (st === 'active') return <p className="cpl-note" style={{ textAlign: 'left', margin: '0 0 8px' }}><span className="ef-pill gold">Activated</span> Automatic fixtures and saved results are on.</p>
  if (st !== 'trial' && st !== 'expired') return null
  const label = `League activation: ${p.course}`
  const box = p.leaguePending ? <PendingPay label={label} amount={amount} />
    : <PayBox amount={amount} label={label} code={code} onCode={setCode} onSubmit={send} busy={busy} button="Send code to activate" />
  return (
    <div style={{ marginBottom: 10 }}>
      {st === 'trial'
        ? <p className="ef-deadline"><Clock size={14} /> Free trial: {left ? `${left} left` : 'ending now'}</p>
        : <p className="cpl-msg bad">Your 3 free days are over. You are not getting new fixtures and you are hidden from the tables. Your results are saved and come back when you activate for {ksh(amount)}.</p>}
      {st === 'trial' && !open && !p.leaguePending
        ? <button type="button" className="cpl-link" onClick={() => setOpen(true)}>Activate now for {ksh(amount)}</button>
        : (st === 'expired' || open || p.leaguePending) && box}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 8 }}>{msg.text}</p>}
    </div>
  )
}

function Mine({ me, signedIn, reload, skew }: { me: Me | null; signedIn: boolean; reload: () => Promise<void>; skew: number }) {
  if (!signedIn) return <p className="cpl-empty">Sign in with Google to see your fixtures.</p>
  if (!me) return <p className="cpl-empty">Loading…</p>
  if (!me.profile) return <div className="cpl-card"><p className="cpl-empty">Register first to join the league.</p><div className="ef-actions"><a className="lp-btn" href="#/efootball/profile">Register</a></div></div>
  if (!me.matches.length) return <p className="cpl-empty">{me.profile.inLeague ? 'No fixtures yet. They are made at 00:00 on fixture days.' : 'Join the league above to get fixtures.'}</p>
  return <>{me.matches.map((m) => <MatchCard key={m.id} m={m} mySlots={me.profile?.freeTimes ?? []} reload={reload} skew={skew} />)}</>
}

function MatchCard({ m, mySlots, reload, skew }: { m: MatchView; mySlots: string[]; reload: () => Promise<void>; skew: number }) {
  const [mine, setMine] = useState(m.myClaim ? String(m.myClaim.mine) : '')
  const [theirs, setTheirs] = useState(m.myClaim ? String(m.myClaim.theirs) : '')
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const left = useCountdown(m.deadline, skew)
  const slots = sharedSlots(mySlots, m.opp.freeTimes)
  const closed = m.status === 'confirmed' || m.status === 'void' || !left
  // A one-sided win with no screenshot is voided at 21:00 unless the opponent agrees, so the form asks for the proof up front.
  const needProof = Number(mine) > Number(theirs) && mine !== '' && theirs !== '' && !proof && !m.myClaim && !m.oppReported

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
          <p className="cpl-note" style={{ textAlign: 'left' }}>{needProof ? <strong>You are claiming a win, so a screenshot of the final score is required. Without it the match is voided and nobody gets points.</strong> : 'Add a screenshot of the final score. If the scores differ, or your opponent never reports, the screenshot decides.'}</p>
          <div className="ef-actions"><button className="lp-btn" disabled={busy || mine === '' || theirs === '' || needProof} onClick={send}>{busy ? 'Sending…' : m.myClaim ? 'Update score' : 'Submit score'}</button></div>
          {m.myClaim && !msg && <p className="cpl-note" style={{ textAlign: 'left' }}>{m.oppReported ? 'Your opponent has reported too.' : 'Waiting for your opponent to report.'}</p>}
          {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
        </>
      )}
    </section>
  )
}
