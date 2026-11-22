import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ShareCardButton from '../components/ShareCardButton'
import { cardDate, type CardSpec } from '../lib/efCard'
import { countdown, ef, fmtStamp, fplJoinLink, type FplBoard, type FplOwn, type FplRow, type Me } from '../lib/efootball'
import { useTick } from '../lib/efHooks'
import { Live, ManagerModal, Matches, Overview, PlayerStats, PlTable } from './EfFplData'

type Section = 'overview' | 'matches' | 'table' | 'live' | 'players' | 'chuka'
type Tab = 'overall' | 'gw' | 'winners' | 'leagues' | 'picks'

const SECTIONS: [Section, string][] = [['overview', 'Overview'], ['matches', 'Fixtures & results'], ['table', 'EPL table'], ['live', 'Live points'], ['players', 'Players'], ['chuka', 'Chuka league']]

export default function EfFpl({ me, signedIn, onSignIn, reload }: { me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void> }) {
  const [sec, setSec] = useState<Section>('overview')
  // The Chuka board is loaded up front: the overview shows its captain picks, and the Chuka tab uses the rest.
  const [b, setB] = useState<FplBoard | null>(null)
  const [err, setErr] = useState('')
  const [skew, setSkew] = useState(0)
  useTick()

  const load = useCallback(async () => {
    try { const r = await ef<FplBoard>('fplBoard'); setB(r); setSkew(r.serverNow - Date.now()); setErr('') }
    catch (e) { setErr((e as Error).message) }
  }, [])
  // Reload once we know who is signed in (the server adds "my" line), then every 2 minutes while the page is visible.
  useEffect(() => {
    void load()
    const i = setInterval(() => { if (!document.hidden) void load() }, 120000)
    return () => clearInterval(i)
  }, [load, me?.uid])

  const chukaCaps = b?.captains && b.gw ? { gw: b.gw.name, got: b.captains.got, total: b.captains.total, list: b.captains.list } : null

  return (
    <div className="cpl-page fpl">
      <div className="fpl-banner"><span className="fpl-mark">FPL</span><div><h2>Fantasy Premier League</h2>
      <p>Premier League fixtures, results, table, live points and player statistics, plus the Chuka campus FPL league.</p></div></div>
      <div className="ef-tabs" role="tablist" aria-label="FPL sections">
        {SECTIONS.map(([id, label]) => <button key={id} role="tab" aria-selected={sec === id} className={sec === id ? 'on' : ''} onClick={() => setSec(id)}>{label}</button>)}
      </div>
      {sec === 'overview' && <Overview chuka={chukaCaps} />}
      {sec === 'matches' && <Matches />}
      {sec === 'table' && <PlTable />}
      {sec === 'live' && <Live />}
      {sec === 'players' && <PlayerStats />}
      {sec === 'chuka' && <ChukaLeague b={b} err={err} me={me} signedIn={signedIn} onSignIn={onSignIn} reload={reload} load={load} skew={skew} />}
    </div>
  )
}

/** Rank movement since the last gameweek. */
function Move({ n }: { n?: number | null }) {
  if (n === null || n === undefined) return <span className="ef-move" aria-label="no change data">·</span>
  if (n === 0) return <span className="ef-move" aria-label="no change">–</span>
  return <span className={`ef-move ${n > 0 ? 'up' : 'down'}`} aria-label={n > 0 ? `up ${n}` : `down ${-n}`}>{n > 0 ? '▲' : '▼'}{Math.abs(n)}</span>
}

/** Share card: the Chuka FPL board (top 10), my line, and the latest gameweek winner. */
async function fplCard(b: FplBoard): Promise<CardSpec> {
  const m = b.mine
  const win = b.winners[0]
  const top = b.rows.slice(0, 10)
  const rows = top.map((r) => ({ cells: [String(r.rank), r.username, r.move ? (r.move > 0 ? '▲' : '▼') + Math.abs(r.move) : '–', String(r.gwPts), String(r.total)], hot: r.uid === m?.uid }))
  if (m && !top.some((r) => r.uid === m.uid)) rows.push({ cells: [String(m.rank), m.username, m.move ? (m.move > 0 ? '▲' : '▼') + Math.abs(m.move) : '–', String(m.gwPts), String(m.total)], hot: true })
  return {
    theme: 'purple',
    eyebrow: `Chuka FPL · ${cardDate()}`,
    title: 'Chuka Fantasy League',
    subtitle: `${b.gw ? b.gw.name : 'Gameweek'}${b.gw?.finished ? ' · finished' : b.gw?.started ? ' · live' : ''} · ${b.rows.length} managers`,
    stats: m
      ? [{ value: `#${m.rank}`, label: 'My Chuka rank' }, { value: String(m.gwPts), label: 'GW points' }, { value: String(m.total), label: 'Total points' }]
      : win ? [{ value: win.w.map((x) => x.u).join(', '), label: `GW${win.gw} winner · ${win.pts} pts` }, { value: String(b.rows.length), label: 'Managers' }] : undefined,
    head: ['#', 'Manager', '', 'GW', 'Total'],
    rows,
    note: b.leagues[0]?.ranked ? `Top league: ${b.leagues[0].league} (${b.leagues[0].avg} avg of top ${b.leagues[0].counted ?? 5})` : '',
    footer: `${window.location.host}${window.location.pathname}#/efootball/fpl`,
  }
}

function Picks({ b }: { b: FplBoard }) {
  const c = b.captains
  if (!c) return <div className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>Picks appear after the gameweek deadline, once Chuka managers' teams are public.</p></div>
  const list = (items: FplOwn[] | undefined, empty: string, differential = false) => !items || !items.length ? <p className="cpl-empty" style={{ margin: 0, textAlign: 'left' }}>{empty}</p> : (
    <ol className="ef-mini">
      {items.map((x, i) => <li key={x.name}><b>{i + 1}</b><span><strong>{x.name}</strong><small>{differential ? `${x.all}% of all FPL managers own him` : `Chuka ${x.pct}% · all FPL ${x.all}%`}</small></span><em>{x.n} of {c.got}</em></li>)}
    </ol>
  )
  return (
    <>
      <div className="cpl-card"><h3>Most captained in Chuka</h3>
        <ol className="ef-mini">{c.list.map((x, i) => <li key={x.name}><b>{i + 1}</b><span><strong>{x.name}</strong></span><em>{x.n} of {c.got}</em></li>)}</ol>
      </div>
      <div className="cpl-card"><h3>Most owned in Chuka</h3>{list(c.own, 'Ownership will show after the next refresh (within 30 minutes).')}</div>
      <div className="cpl-card"><h3>Chuka differentials</h3>
        <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Players owned by 2 or more Chuka managers but by under 10% of all FPL managers.</p>
        {list(c.diff, 'No differentials this week.', true)}
      </div>
      <p className="cpl-note" style={{ textAlign: 'left' }}>Based on {c.got} of {c.total} linked managers' teams for {b.gw?.name ?? 'this gameweek'}.</p>
    </>
  )
}

function ChukaLeague({ b, err, me, signedIn, onSignIn, reload, load, skew }: { b: FplBoard | null; err: string; me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void>; load: () => Promise<void>; skew: number }) {
  const [tab, setTab] = useState<Tab>('overall')
  const [manager, setManager] = useState('')
  if (err && !b) return <p className="cpl-err" role="alert">{err}</p>
  if (!b) return <p className="cpl-empty">Loading…</p>
  if (!b.configured) return <p className="cpl-empty">The Chuka Fantasy Premier League is coming soon. The admin is setting up the campus league. The Premier League tabs above work already.</p>

  const left = b.next ? countdown(b.next.at, skew) : ''
  const m = b.mine
  const joinUrl = fplJoinLink(b.leagueCode)

  return (
    <>
      <p className="cpl-sub">Campus league: leaderboard, gameweek winners and a league table. {b.rows.length} Chuka managers. Tap a manager to see their statistics and team.</p>
      {b.error && <p className="ef-stale" role="status">FPL is updating or busy, so these standings are from {b.at ? fmtStamp(b.at) : 'earlier'}. They refresh on their own.</p>}

      <section className="ef-fpl-hero" aria-label="Chuka league">
        <small>{b.gw ? b.gw.name : 'Gameweek'}{b.gw?.finished ? ' · finished' : b.gw?.started ? ' · live' : ''}</small>
        <strong>{b.next ? `${b.next.name} deadline` : 'Season break'}</strong>
        {b.next && <p className="ef-deadline"><Clock size={14} /> {left ? `${left} left` : 'Deadline passing'} · {fmtStamp(b.next.at)}</p>}
        {m && (
          <div className="ef-fpl-stats">
            <div><b>#{m.rank}</b><span>Chuka rank of {b.rows.length}</span></div>
            <div><b>{m.gwPts}</b><span>This gameweek (#{m.gwRank})</span></div>
            <div><b>{m.total}</b><span>Total points</span></div>
          </div>
        )}
      </section>

      {b.rows.length > 0 && (
        <div className="ef-actions" style={{ margin: '0 0 14px' }}>
          <ShareCardButton label="Share FPL card" filename="chuka-fpl.png" text="Chuka Fantasy Premier League board" build={() => fplCard(b)} className="lp-btn ef-fpl-share" />
        </div>
      )}
      {(b.unlinked ?? 0) > 0 && b.status !== 'linked' && (
        <p className="ef-unlinked" role="status"><b>{b.unlinked}</b> more manager{b.unlinked === 1 ? ' is' : 's are'} in the Chuka FPL league but not on this board yet. Link your team below to join them.</p>
      )}

      <LinkCard b={b} me={me} signedIn={signedIn} onSignIn={onSignIn} joinUrl={joinUrl} done={async () => { await reload(); await load() }} />

      <div className="ef-tabs" role="tablist">
        {([['overall', 'Overall'], ['gw', 'This gameweek'], ['winners', 'GW winners'], ['picks', 'Chuka picks'], ['leagues', 'Leagues']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'overall' && <Board rows={b.rows} by="total" me={m?.uid} open={setManager} />}
      {tab === 'gw' && <Board rows={[...b.rows].sort((x, y) => x.gwRank - y.gwRank || y.total - x.total)} by="gw" me={m?.uid} open={setManager} note={b.gw && !b.gw.started ? 'The gameweek has not started, so points are 0 for now.' : ''} />}
      {tab === 'winners' && (
        <div className="cpl-card">
          {!b.winners.length ? <p className="cpl-empty" style={{ margin: 0 }}>No gameweek winner yet. The best Chuka score of each finished gameweek is saved here.</p> : (
            <ol className="ef-mini">
              {b.winners.map((w) => <li key={w.gw}><b>{w.gw}</b><span><strong>{w.w.map((x) => x.u).join(', ')}</strong><small>{w.w.map((x) => x.c).join(', ')}</small></span><em>{w.pts} pts</em></li>)}
            </ol>
          )}
        </div>
      )}
      {tab === 'picks' && <Picks b={b} />}
      {tab === 'leagues' && (
        <div className="cpl-card ef-scroll">
          <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Leagues are ranked by the average total of their best 5 managers, so a big league is not held back by casual managers and one star cannot win alone. A league needs 3 managers to be ranked.</p>
          {!b.leagues.length ? <p className="cpl-empty">No managers linked yet.</p> : (
            <table className="ef-table">
              <thead><tr><th>#</th><th>League</th><th>Managers</th><th>GW avg</th><th>Top-5 avg</th></tr></thead>
              <tbody>{b.leagues.map((c, i) => (
                <tr key={c.league} style={c.league === me?.profile?.league?.name ? { background: '#f3f8f4' } : c.ranked ? undefined : { opacity: 0.8 }}>
                  <td>{c.ranked ? i + 1 : '–'}</td><td>{c.league}</td><td>{c.managers}</td><td>{c.gwAvg}</td><td><strong>{c.avg}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <p className="cpl-note" style={{ textAlign: 'left' }}>Data comes from the official FPL site and refreshes about every 30 minutes. Only managers inside the Chuka FPL league are counted.</p>
      {manager && <ManagerModal entry={manager} onClose={() => setManager('')} />}
    </>
  )
}

function Board({ rows, by, me, note, open }: { rows: FplRow[]; by: 'total' | 'gw'; me?: string; note?: string; open: (entry: string) => void }) {
  const [shown, setShown] = useState(50)
  return (
    <div className="cpl-card ef-scroll">
      {note && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{note}</p>}
      {!rows.length ? <p className="cpl-empty" style={{ margin: 0 }}>No managers linked yet. Link your FPL team above to appear here.</p> : (
        <table className="ef-table">
          <thead><tr><th>#</th><th>Manager</th><th>{by === 'gw' ? 'Total' : 'GW'}</th><th>{by === 'gw' ? 'GW pts' : 'Total'}</th></tr></thead>
          <tbody>{rows.slice(0, shown).map((r) => (
            <tr key={r.uid} className={r.entry ? 'ef-click' : ''} onClick={() => r.entry && open(r.entry)} style={r.uid === me ? { background: '#fff9e3' } : undefined}>
              <td>{by === 'gw' ? r.gwRank : <>{r.rank} <Move n={r.move} /></>}</td>
              <td><strong>{r.username}</strong><small>{r.team ? `${r.team} · ` : ''}{r.league}</small></td>
              <td>{by === 'gw' ? r.total : r.gwPts}</td><td><strong>{by === 'gw' ? r.gwPts : r.total}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {rows.length > shown && <div className="ef-actions"><button className="lp-btn" onClick={() => setShown((n) => n + 50)}>Show more ({rows.length - shown} left)</button></div>}
    </div>
  )
}

function LinkCard({ b, me, signedIn, onSignIn, joinUrl, done }: { b: FplBoard; me: Me | null; signedIn: boolean; onSignIn: () => void; joinUrl: string; done: () => Promise<void> }) {
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function act(action: string, payload: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null)
    try { await ef(action, payload); await done(); setMsg({ ok: true, text: ok }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void act('fplLink', { entry: id.trim() }, 'Linked. You are on the board.') }
  const joinBtn = joinUrl && <a className="lp-btn" href={joinUrl} target="_blank" rel="noopener noreferrer">Join the Chuka league on FPL <ExternalLink size={13} /></a>

  if (b.status === 'linked') {
    return (
      <section className="cpl-card">
        <h3>Your FPL team <span className="ef-pill ef-badge-fpl">Linked</span></h3>
        <p className="cpl-sub" style={{ margin: '0 0 10px' }}>{b.mine?.team || `Team ${b.fplId}`} (ID {b.fplId})</p>
        <div className="ef-actions" style={{ marginTop: 0 }}><button className="lp-btn cpl-danger" disabled={busy} onClick={() => confirm('Unlink your FPL team?') && act('fplUnlink', {}, 'Unlinked.')}>Unlink</button></div>
        {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
      </section>
    )
  }
  if (b.status === 'anon') return <section className="cpl-card"><h3>Join the board</h3><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Sign in with Google, register as a player and link your FPL team.</p><GoogleSignInButton onClick={onSignIn} label="Sign in to link" /></section>
  if (!me && signedIn) return <section className="cpl-card"><p className="cpl-empty" style={{ margin: 0 }}>Loading your account…</p></section>
  if (b.status === 'unregistered') return <section className="cpl-card"><h3>Join the board</h3><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Register your player profile first (it takes a minute), then link your FPL team.</p><a className="lp-btn" href="#/efootball/profile">Register as a player</a></section>

  return (
    <section className="cpl-card">
      <h3>{b.status === 'outside' ? 'Your team is not in the Chuka league' : 'Link your FPL team'}</h3>
      {b.status === 'outside' ? (
        <p className="cpl-sub" style={{ margin: '0 0 12px' }}>Team {b.fplId} is linked but not inside the Chuka FPL league. Join the league on the FPL site; you appear on the board within 30 minutes.</p>
      ) : (
        <>
          <ol className="cpl-note" style={{ textAlign: 'left', margin: '0 0 12px', paddingLeft: 18 }}>
            <li>Join the Chuka league on the FPL site{b.leagueCode ? ' (button below)' : ` (league ID ${b.leagueId})`}.</li>
            <li>Open FPL, tap Points, and copy the number in the address: …/entry/<b>123456</b>/event/…</li>
            <li>Paste it here. New league members can take up to 30 minutes to be recognised.</li>
          </ol>
          <form onSubmit={submit} className="cpl-inline">
            <input className="ef-sel" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} placeholder="FPL team ID" aria-label="FPL team ID" maxLength={9} required />
            <button className="lp-btn" disabled={busy || !id}>{busy ? 'Linking…' : 'Link my team'}</button>
          </form>
        </>
      )}
      <div className="ef-actions">
        {joinBtn}
        {b.status === 'outside' && <button className="lp-btn cpl-danger" disabled={busy} onClick={() => act('fplUnlink', {}, 'Unlinked.')}>Unlink</button>}
      </div>
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </section>
  )
}
