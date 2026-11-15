import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { countdown, ef, fmtStamp, fplJoinLink, type FplBoard, type FplRow, type Me } from '../lib/efootball'

type Tab = 'overall' | 'gw' | 'winners' | 'courses'

function useTick() {
  const [, set] = useState(0)
  useEffect(() => { const i = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(i) }, [])
}

export default function EfFpl({ me, signedIn, onSignIn, reload }: { me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void> }) {
  const [b, setB] = useState<FplBoard | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>('overall')
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

  if (err && !b) return <div className="cpl-page"><h2>Chuka FPL</h2><p className="cpl-err" role="alert">{err}</p></div>
  if (!b) return <div className="cpl-page"><h2>Chuka FPL</h2><p className="cpl-empty">Loading…</p></div>
  if (!b.configured) return <div className="cpl-page"><h2>Chuka FPL</h2><p className="cpl-empty">The Chuka Fantasy Premier League is coming soon. The admin is setting up the campus league.</p></div>

  const left = b.next ? countdown(b.next.at, skew) : ''
  const m = b.mine
  const joinUrl = fplJoinLink(b.leagueCode)

  return (
    <div className="cpl-page">
      <h2>Chuka FPL</h2>
      <p className="cpl-sub">Campus Fantasy Premier League: leaderboard, gameweek winners and a course table. {b.rows.length} Chuka managers.</p>

      {b.error && <p className="ef-stale" role="status">FPL is updating or busy, so these standings are from {b.at ? fmtStamp(b.at) : 'earlier'}. They refresh on their own.</p>}

      <section className="ef-fpl-hero" aria-label="Gameweek hub">
        <small>{b.gw ? b.gw.name : 'Gameweek hub'}{b.gw?.finished ? ' · finished' : b.gw?.started ? ' · live' : ''}</small>
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

      <LinkCard b={b} me={me} signedIn={signedIn} onSignIn={onSignIn} joinUrl={joinUrl} done={async () => { await reload(); await load() }} />

      <section className="cpl-card">
        <h3>Top captain picks</h3>
        {b.captains && b.captains.list.length ? (
          <>
            <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{b.gw?.name}: captains of {b.captains.got} of {b.captains.total} Chuka managers.</p>
            <div className="ef-cap">
              {b.captains.list.slice(0, 6).map((c) => (
                <span key={c.name} style={{ display: 'contents' }}>
                  <strong>{c.name}</strong><span>{c.n} ({Math.round((c.n / b.captains!.got) * 100)}%)</span>
                  <i style={{ width: `${Math.max(4, (c.n / b.captains!.list[0].n) * 100)}%` }} />
                </span>
              ))}
            </div>
          </>
        ) : <p className="cpl-empty" style={{ margin: 0 }}>Captain picks are secret until the deadline. They show up here soon after it passes.</p>}
      </section>

      <div className="ef-tabs" role="tablist">
        {([['overall', 'Overall'], ['gw', 'This gameweek'], ['winners', 'GW winners'], ['courses', 'Courses']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'overall' && <Board rows={b.rows} by="total" me={m?.uid} />}
      {tab === 'gw' && <Board rows={[...b.rows].sort((x, y) => x.gwRank - y.gwRank || y.total - x.total)} by="gw" me={m?.uid} note={b.gw && !b.gw.started ? 'The gameweek has not started, so points are 0 for now.' : ''} />}
      {tab === 'winners' && (
        <div className="cpl-card">
          {!b.winners.length ? <p className="cpl-empty" style={{ margin: 0 }}>No gameweek winner yet. The best Chuka score of each finished gameweek is saved here.</p> : (
            <ol className="ef-mini">
              {b.winners.map((w) => <li key={w.gw}><b>{w.gw}</b><span><strong>{w.w.map((x) => x.u).join(', ')}</strong><small>{w.w.map((x) => x.c).join(', ')}</small></span><em>{w.pts} pts</em></li>)}
            </ol>
          )}
        </div>
      )}
      {tab === 'courses' && (
        <div className="cpl-card ef-scroll">
          <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Courses are ranked by average points per manager, so size does not decide it. A course needs 3 managers to be ranked.</p>
          {!b.courses.length ? <p className="cpl-empty">No managers linked yet.</p> : (
            <table className="ef-table">
              <thead><tr><th>#</th><th>Course</th><th>Managers</th><th>GW avg</th><th>Avg total</th></tr></thead>
              <tbody>{b.courses.map((c, i) => (
                <tr key={c.course} style={c.course === me?.profile?.course ? { background: '#f3f8f4' } : c.ranked ? undefined : { opacity: 0.8 }}>
                  <td>{c.ranked ? i + 1 : '–'}</td><td>{c.course}</td><td>{c.managers}</td><td>{c.gwAvg}</td><td><strong>{c.avg}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <p className="cpl-note" style={{ textAlign: 'left' }}>Data comes from the official FPL site and refreshes about every 30 minutes. Only managers inside the Chuka FPL league are counted.</p>
    </div>
  )
}

function Board({ rows, by, me, note }: { rows: FplRow[]; by: 'total' | 'gw'; me?: string; note?: string }) {
  const [shown, setShown] = useState(50)
  return (
    <div className="cpl-card ef-scroll">
      {note && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{note}</p>}
      {!rows.length ? <p className="cpl-empty" style={{ margin: 0 }}>No managers linked yet. Link your FPL team above to appear here.</p> : (
        <table className="ef-table">
          <thead><tr><th>#</th><th>Manager</th><th>{by === 'gw' ? 'Total' : 'GW'}</th><th>{by === 'gw' ? 'GW pts' : 'Total'}</th></tr></thead>
          <tbody>{rows.slice(0, shown).map((r) => (
            <tr key={r.uid} style={r.uid === me ? { background: '#fff9e3' } : undefined}>
              <td>{by === 'gw' ? r.gwRank : r.rank}</td>
              <td><strong>{r.username}</strong><small>{r.team ? `${r.team} · ` : ''}{r.course}</small></td>
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
