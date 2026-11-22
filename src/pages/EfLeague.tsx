import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Clock, MessageCircle, X } from 'lucide-react'
import DriveImage from '../components/DriveImage'
import ImagePicker from '../components/ImagePicker'
import ShareCardButton from '../components/ShareCardButton'
import { AdminChat, PayBox, PendingPay, usePayCfg } from '../components/EfPay'
import { cardDate, type CardSpec } from '../lib/efCard'
import { ef, fmtDay, fmtTime, ksh, leagueLogoData, sharedSlots, waLink, type Fixtures, type FixtureRow, type FixtureSide, type League, type LeagueInfo, type MatchView, type Me } from '../lib/efootball'
import { useApi, useCountdown } from '../lib/efHooks'
import { CreateLeague, Discover, InvitePage, LeagueInviteCard, LeagueMark, LeagueSettings, TermsAgree } from './EfLeagueSetup'

type Tab = 'today' | 'mine' | 'table' | 'results' | 'invite'
type Props = { me: Me | null; reload: () => Promise<void>; signedIn: boolean; onSignIn: () => void; sub: string; arg: string }
type Msg = { ok: boolean; text: string } | null

/** Routes: /league (my league, or browse), /league/new, /league/join/CODE, /league/view/ID. */
export default function EfLeague({ me, reload, signedIn, onSignIn, sub, arg }: Props) {
  if (sub === 'new') return <CreateLeague me={me} signedIn={signedIn} onSignIn={onSignIn} reload={reload} />
  if (sub === 'join') return <InvitePage code={decodeURIComponent(arg)} me={me} signedIn={signedIn} onSignIn={onSignIn} reload={reload} />
  if (sub === 'view' && arg) return <PublicView id={decodeURIComponent(arg)} me={me} />
  const L = me?.profile?.league ?? null
  if (signedIn && !me) return <p className="cpl-empty">Loading…</p>
  if (L && me?.profile) return <MyLeague key={L.id} L={L} me={me} reload={reload} />
  return <Discover signedIn={signedIn} />
}

/* ---------------- a league you can look at but are not in ---------------- */
function PublicView({ id, me }: { id: string; me: Me | null }) {
  const { data, err } = useApi<League>('league', { id })
  const [zoom, setZoom] = useState('')
  const [tab, setTab] = useState<'today' | 'table' | 'results'>('today')
  if (err) return <div className="cpl-page"><p className="cpl-err" role="alert">{err}</p><a className="lp-btn" href="#/efootball/league">Back to leagues</a></div>
  if (!data) return <p className="cpl-empty">Loading…</p>
  const L = data.league
  return (
    <div className="cpl-page">
      <a className="cpl-link" href="#/efootball/league">Back to leagues</a>
      <Banner L={L} sub={`${L.members} ${L.members === 1 ? 'member' : 'members'} · ${L.isPublic ? 'public league' : 'invite-only'}`} action={L.isPublic && L.code && !me?.profile?.league ? <a className="lp-btn" href={`#/efootball/league/join/${L.code}`}>Join this league</a> : null} />
      <Tabs value={tab} onChange={setTab} items={[['today', 'Today'], ['table', 'Table'], ['results', 'Results']]} />
      {tab === 'today' ? <TodayBoard id={L.id} me={me?.uid ?? ''} zoom={setZoom} /> : tab === 'table' ? <Table lg={data} me={me?.uid ?? ''} zoom={setZoom} /> : <Results lg={data} zoom={setZoom} />}
      <Zoom id={zoom} close={() => setZoom('')} />
    </div>
  )
}

/* ---------------- my league ---------------- */
function MyLeague({ L, me, reload }: { L: LeagueInfo; me: Me; reload: () => Promise<void> }) {
  const p = me.profile!
  const [tab, setTab] = useState<Tab>('today')
  const [zoom, setZoom] = useState('')
  const [skew, setSkew] = useState(0)
  const lg = useApi<League>('league', { id: L.id })
  useEffect(() => { if (lg.data) setSkew(lg.data.serverNow - Date.now()) }, [lg.data])
  const both = useCallback(async () => { await Promise.all([reload(), Promise.resolve(lg.retry())]) }, [reload, lg])
  const open = me.matches.filter((m) => m.status === 'pending' || m.status === 'disputed').length
  const isFounder = L.founderUid === me.uid
  const members = (lg.data?.table ?? []).map((r) => ({ uid: r.uid, username: r.username }))

  return (
    <div className="cpl-page">
      <Banner L={L} sub={`${L.members} ${L.members === 1 ? 'member' : 'members'}${L.founder ? ` · set up by ${L.founder}` : ''} · ${L.isPublic ? 'public' : 'invite-only'}`}
        action={<span className={`ef-pill${p.paused || p.leagueState === 'expired' ? ' red' : p.leagueState === 'active' ? ' gold' : ''}`}>{p.paused ? 'Paused' : p.leagueState === 'expired' ? 'Activation needed' : p.leagueState === 'trial' ? `Free: ${p.trialLeft} match${p.trialLeft === 1 ? '' : 'es'} left` : 'Activated'}</span>} />
      {!p.termsOk && <AcceptTerms reload={reload} />}
      <Status me={me} lg={lg.data} reload={both} />
      <Tabs value={tab} onChange={setTab} items={[['today', 'Today'], ['mine', `My fixtures${open ? ` (${open})` : ''}`], ['table', 'Table'], ['results', 'Results'], ['invite', 'Invite & settings']]} />
      {lg.err && <p className="cpl-err" role="alert">{lg.err}</p>}
      {tab === 'mine' ? <Mine me={me} reload={both} skew={skew} zoom={setZoom} />
        : tab === 'today' ? <TodayBoard id={L.id} me={me.uid} zoom={setZoom} />
        : tab === 'invite' ? (
          <>
            <section className="cpl-card">
              <h3>Invite friends</h3>
              <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Save the card or share it straight to WhatsApp. Tap the card to open the link, or scan the QR from a screenshot.</p>
              <LeagueInviteCard league={L} />
            </section>
            <LeagueSettings league={L} isFounder={isFounder} members={members} reload={reload} onChanged={() => lg.retry()} />
          </>
        )
        : !lg.data ? <p className="cpl-empty">Loading…</p>
        : tab === 'table' ? (
          <>
            {lg.data.table.length > 0 && <div className="ef-actions" style={{ marginTop: 0, marginBottom: 12 }}><ShareCardButton label="Share league card" filename="chuka-league.png" text={`${L.name} table in the Chuka eFootball league`} build={() => leagueCard(lg.data!, L)} /></div>}
            <Table lg={lg.data} me={me.uid} zoom={setZoom} />
          </>
        ) : <Results lg={lg.data} zoom={setZoom} />}
      <Zoom id={zoom} close={() => setZoom('')} />
    </div>
  )
}

function Banner({ L, sub, action }: { L: LeagueInfo; sub: string; action?: ReactNode }) {
  return (
    <header className="ef-lhead">
      <LeagueMark l={L} size={72} />
      <div className="ef-lhead-text">
        <h2>{L.name}</h2>
        <p>{L.about || sub}</p>
        {L.about && <small>{sub}</small>}
      </div>
      {action && <div className="ef-lhead-act">{action}</div>}
    </header>
  )
}

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="ef-tabs" role="tablist">
      {items.map(([id, label]) => <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>)}
    </div>
  )
}

function Zoom({ id, close }: { id: string; close: () => void }) {
  useEffect(() => {
    if (!id) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [id, close])
  if (!id) return null
  return <div className="ef-zoom" onClick={close} role="dialog" aria-label="Squad image"><button className="ef-zoom-x" aria-label="Close"><X size={18} /></button><DriveImage id={id} w={1200} alt="Squad" /></div>
}

/** Members who joined before the conditions existed accept them once. */
function AcceptTerms({ reload }: { reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  async function go() {
    setBusy(true); setMsg(null)
    try { await ef('acceptTerms', { agree: true, terms: cfg.termsV }); await reload() } catch (x) { setMsg({ ok: false, text: (x as Error).message }) } finally { setBusy(false) }
  }
  return (
    <section className="cpl-card">
      <h3>Accept the league conditions</h3>
      <p className="cpl-sub" style={{ margin: '0 0 10px' }}>The league now has written conditions. Please read and accept them once to keep playing.</p>
      <TermsAgree checked={agree} onChange={setAgree} />
      <div className="ef-actions"><button className="lp-btn" disabled={busy || !agree} onClick={go}>{busy ? 'Saving…' : 'I accept'}</button></div>
      {msg && <p className="cpl-msg bad" role="status">{msg.text}</p>}
    </section>
  )
}

/** Paused / trial / expired: the only things that stop a player from getting fixtures. */
function Status({ me, lg, reload }: { me: Me; lg: League | null; reload: () => Promise<void> }) {
  const cfg = usePayCfg()
  const p = me.profile!
  const amount = p.leagueFee || cfg.fees.activation
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [open, setOpen] = useState(false)
  async function call(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try { await ef(action, payload); await reload(); setCode(''); setMsg({ ok: true, text: ok }) } catch (x) { setMsg({ ok: false, text: (x as Error).message }) } finally { setBusy(false) }
  }
  const label = `League activation: ${p.league?.name ?? ''}`
  const needsPay = p.leagueState === 'expired' || (p.leagueState === 'trial' && open)
  return (
    <>
      {p.paused && (
        <section className="cpl-card ef-alert">
          <h3>You are paused</h3>
          <p className="cpl-sub" style={{ margin: '0 0 10px' }}>You missed {p.strikes} fixtures in a row, so you are not getting new ones. Tap Resume when you are ready to play again.</p>
          <button className="lp-btn" disabled={busy} onClick={() => call('resumeLeague', {}, 'You are back in. Your next fixture comes on the next fixture day.')}>Resume</button>
        </section>
      )}
      {p.leagueState === 'expired' && (
        <section className="cpl-card ef-alert">
          <h3>Your {cfg.trialMatches} free matches are used</h3>
          <p className="cpl-sub" style={{ margin: '0 0 10px' }}>You are not getting new fixtures and you are hidden from the table. Your results are saved and come back when you activate once for {ksh(amount)}.</p>
        </section>
      )}
      {p.leagueState === 'trial' && !open && !p.leaguePending && (
        <p className="ef-trialbar"><Clock size={14} /> {p.trialLeft} free match{p.trialLeft === 1 ? '' : 'es'} left. <button type="button" className="cpl-link" onClick={() => setOpen(true)}>Activate now for {ksh(amount)}</button></p>
      )}
      {(needsPay || p.leaguePending) && p.leagueState !== 'active' && (
        <div style={{ marginBottom: 14 }}>
          {p.leaguePending ? <PendingPay label={label} amount={amount} />
            : <PayBox amount={amount} label={label} code={code} onCode={setCode} onSubmit={() => call('activateLeague', { mpesa: code }, 'Payment code received. Chat the admin on WhatsApp to get activated.')} busy={busy} button="Send code to activate" />}
        </div>
      )}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status">{msg.text}</p>}
      {lg && lg.table.length < 2 && !p.paused && p.leagueState !== 'expired' && <p className="ef-trialbar">You are the only active member so far. Fixtures need two players: open Invite &amp; settings and share your card.</p>}
    </>
  )
}

/* ---------------- Today: every pairing, both squads ---------------- */
function Side({ s, mine, onZoom, flip }: { s: FixtureSide; mine: boolean; onZoom: (id: string) => void; flip?: boolean }) {
  return (
    <div className={`ef-side${flip ? ' flip' : ''}${mine ? ' me' : ''}`}>
      <button type="button" className="ef-thumb" onClick={() => s.squadId && onZoom(s.squadId)} aria-label={`View ${s.username}'s squad`}>
        <DriveImage id={s.squadId} w={240} fallback={<span className="ph">{s.username.slice(0, 2).toUpperCase()}</span>} />
      </button>
      <strong>{s.username}{mine ? ' (you)' : ''}</strong>
      <small>{s.platform} · {s.strength}</small>
    </div>
  )
}

function FixtureCard({ f, me, zoom }: { f: FixtureRow; me: string; zoom: (id: string) => void }) {
  const done = f.status === 'confirmed' && f.s1 !== null
  const mine = f.p1.uid === me || f.p2.uid === me
  return (
    <article className={`ef-fixture${mine ? ' mine' : ''}`}>
      <Side s={f.p1} mine={f.p1.uid === me} onZoom={zoom} />
      <div className="ef-vs">
        {done ? <b className="score">{f.s1} – {f.s2}</b> : <b>VS</b>}
        <span className={`ef-pill${f.status === 'void' || f.status === 'disputed' ? ' red' : f.status === 'confirmed' ? ' gold' : ''}`}>
          {f.status === 'confirmed' ? 'Full time' : f.status === 'void' ? 'Void' : f.status === 'disputed' ? 'Scores differ' : f.reported ? 'Reported' : 'To play'}
        </span>
      </div>
      <Side s={f.p2} mine={f.p2.uid === me} onZoom={zoom} flip />
    </article>
  )
}

function TodayBoard({ id, me, zoom }: { id: string; me: string; zoom: (id: string) => void }) {
  const { data, err } = useApi<Fixtures>('fixtures', { id }, 60000)
  const skew = data ? data.serverNow - Date.now() : 0
  const left = useCountdown(data?.closeAt ?? '', skew)
  if (err) return <p className="cpl-err" role="alert">{err}</p>
  if (!data) return <p className="cpl-empty">Loading fixtures…</p>
  if (!data.day) return (
    <section className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>No fixtures yet. They are made at 00:00 on {data.fixtureDays.join(', ')} once the league has two active members.</p></section>
  )
  const pct = data.total ? Math.round((data.reported / data.total) * 100) : 0
  return (
    <>
      <section className="cpl-card ef-daybar">
        <div>
          <h3 style={{ margin: 0 }}>{data.isToday ? 'Today’s fixtures' : 'Latest fixtures'}</h3>
          <small>{fmtDay(data.closeAt)}{data.isToday && left ? ` · results close in ${left}` : data.isToday ? ' · results closed' : ''}</small>
        </div>
        <strong>{data.reported} of {data.total} reported</strong>
        <div className="ef-bar" aria-hidden><i style={{ width: `${pct}%` }} /></div>
      </section>
      <div className="ef-fixtures">{data.list.map((f) => <FixtureCard key={f.id} f={f} me={me} zoom={zoom} />)}</div>
    </>
  )
}

/* ---------------- table + results ---------------- */
function Form({ f }: { f: string[] }) { return <span className="ef-form">{f.map((x, i) => <i key={i} className={x}>{x}</i>)}</span> }

function Table({ lg, me, zoom }: { lg: League; me: string; zoom: (id: string) => void }) {
  if (!lg.table.length) return <section className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>No one is in the table yet.</p></section>
  return (
    <div className="cpl-card ef-scroll">
      <table className="ef-table ef-ltable">
        <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>{lg.table.map((r, i) => (
          <tr key={r.uid} className={r.uid === me ? 'me' : ''}>
            <td>{i + 1}</td>
            <td>
              <span className="ef-pl-cell">
                <button type="button" className="ef-mini-thumb" onClick={() => r.squadId && zoom(r.squadId)} aria-label={`View ${r.username}'s squad`}><DriveImage id={r.squadId} w={96} fallback={<span>{r.username.slice(0, 1).toUpperCase()}</span>} /></button>
                <span><strong>{r.username}</strong>{r.form.length > 0 && <Form f={r.form} />}</span>
              </span>
            </td>
            <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd}</td><td><strong>{r.pts}</strong></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Results({ lg, zoom }: { lg: League; zoom: (id: string) => void }) {
  if (!lg.recent.length) return <section className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>No results yet.</p></section>
  return (
    <section className="cpl-card">
      {lg.recent.map((r) => (
        <div className="ef-result" key={r.id}>
          <button type="button" className="ef-mini-thumb" onClick={() => r.sq1 && zoom(r.sq1)} aria-label={`${r.p1} squad`}><DriveImage id={r.sq1} w={96} fallback={<span>{r.p1.slice(0, 1).toUpperCase()}</span>} /></button>
          <span className="t h">{r.p1}</span>
          <b>{r.s1} – {r.s2}</b>
          <span className="t">{r.p2}</span>
          <button type="button" className="ef-mini-thumb" onClick={() => r.sq2 && zoom(r.sq2)} aria-label={`${r.p2} squad`}><DriveImage id={r.sq2} w={96} fallback={<span>{r.p2.slice(0, 1).toUpperCase()}</span>} /></button>
        </div>
      ))}
    </section>
  )
}

/** Share card of the league table: logo, top 10 players. */
async function leagueCard(lg: League, L: LeagueInfo): Promise<CardSpec> {
  const logo = L.logoId ? await leagueLogoData(L.id) : ''
  const leader = lg.table[0]
  return {
    theme: 'green', logo,
    eyebrow: `Chuka League · ${cardDate()}`,
    title: L.name,
    subtitle: `${L.members} ${L.members === 1 ? 'player' : 'players'}${L.founder ? ` · set up by ${L.founder}` : ''}`,
    stats: leader ? [{ value: leader.username, label: 'Leading the table' }, { value: String(leader.pts), label: 'Points' }, { value: String(lg.table.length), label: 'Players' }] : undefined,
    head: ['#', 'Player', 'P', 'W', 'D', 'L', 'GD', 'Pts'],
    rows: lg.table.slice(0, 10).map((r, i) => ({ cells: [String(i + 1), r.username, String(r.p), String(r.w), String(r.d), String(r.l), String(r.gd), String(r.pts)] })),
    note: lg.table.length > 10 ? `+ ${lg.table.length - 10} more players` : '',
    footer: `${window.location.host}${window.location.pathname}#/efootball/league`,
  }
}

/* ---------------- my fixtures ---------------- */
function Mine({ me, reload, skew, zoom }: { me: Me; reload: () => Promise<void>; skew: number; zoom: (id: string) => void }) {
  if (!me.matches.length) return <section className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>No fixtures yet. They are made at 00:00 on fixture days, between members of your league.</p></section>
  return <>{me.matches.map((m) => <MatchCard key={m.id} m={m} me={me} reload={reload} skew={skew} zoom={zoom} />)}</>
}

function MatchCard({ m, me, reload, skew, zoom }: { m: MatchView; me: Me; reload: () => Promise<void>; skew: number; zoom: (id: string) => void }) {
  const [mine, setMine] = useState(m.myClaim ? String(m.myClaim.mine) : '')
  const [theirs, setTheirs] = useState(m.myClaim ? String(m.myClaim.theirs) : '')
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const cfg = usePayCfg()
  const left = useCountdown(m.deadline, skew)
  const mySlots = me.profile?.freeTimes ?? []
  const slots = sharedSlots(mySlots, m.opp.freeTimes)
  const closed = m.status === 'confirmed' || m.status === 'void' || !left
  // A one-sided win with no screenshot is voided at 21:00 unless the opponent reports too, so the form asks for the proof up front.
  const needProof = Number(mine) > Number(theirs) && mine !== '' && theirs !== '' && !proof && !m.myClaim && !m.oppReported
  const meSide: FixtureSide = { uid: me.uid, username: me.profile?.username ?? 'You', squadId: me.profile?.squadId ?? '', strength: me.profile?.strength ?? 0, platform: me.profile?.platform ?? '' }
  const oppSide: FixtureSide = { uid: m.opp.uid, username: m.opp.username, squadId: m.opp.squadId, strength: m.opp.strength, platform: m.opp.platform }

  async function send() {
    setBusy(true); setMsg(null)
    try {
      const r = await ef<{ status: string }>('reportScore', { matchId: m.id, mine: Number(mine), theirs: Number(theirs), proof: proof || undefined })
      await reload()
      setMsg({ ok: true, text: r.status === 'confirmed' ? 'Both scores match. Result confirmed.' : r.status === 'disputed' ? `The two scores differ. You can both update them before ${cfg.closeHour}:00. If they still differ, a screenshot decides.` : 'Score sent. Waiting for your opponent to report.' })
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <section className="cpl-card ef-match">
      <div className="ef-matchtop">
        <small>{fmtDay(m.deadline)}</small>
        <span className={`ef-pill${m.status === 'disputed' || m.status === 'void' ? ' red' : m.status === 'confirmed' ? ' gold' : ''}`}>{m.status === 'pending' && !left ? 'closed' : m.status}</span>
      </div>
      <div className="ef-fixture solo">
        <Side s={meSide} mine onZoom={zoom} />
        <div className="ef-vs">{m.status === 'confirmed' && m.final ? <b className="score">{m.final.mine} – {m.final.theirs}</b> : <b>VS</b>}</div>
        <Side s={oppSide} mine={false} onZoom={zoom} flip />
      </div>
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
          <p className="cpl-note" style={{ textAlign: 'left' }}>{needProof ? <strong>You are claiming a win, so a screenshot of the final score is required. Without it the win is void and nobody gets points.</strong> : 'Add a screenshot of the final score. If the scores differ, or your opponent never reports, the screenshot decides. If nobody reports, the fixture is void.'}</p>
          <div className="ef-actions"><button className="lp-btn" disabled={busy || mine === '' || theirs === '' || needProof} onClick={send}>{busy ? 'Sending…' : m.myClaim ? 'Update score' : 'Submit score'}</button></div>
          {m.myClaim && !msg && <p className="cpl-note" style={{ textAlign: 'left' }}>{m.oppReported ? 'Your opponent has reported too.' : 'Waiting for your opponent to report.'}</p>}
          {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
        </>
      )}
      {closed && m.status === 'void' && <AdminChat label="Something wrong? Chat admin" message={`Hi eFootball admin, my fixture vs ${m.opp.username} on ${m.day} was voided. `} />}
    </section>
  )
}
