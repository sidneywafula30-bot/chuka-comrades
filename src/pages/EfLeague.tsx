import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import ImagePicker from '../components/ImagePicker'
import { ef, sharedSlots, waLink, type League, type MatchView, type Me } from '../lib/efootball'

type Tab = 'table' | 'courses' | 'mine' | 'recent'

export default function EfLeague({ me, reload, signedIn }: { me: Me | null; reload: () => Promise<void>; signedIn: boolean }) {
  const [lg, setLg] = useState<League | null>(null)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>('table')
  const load = () => ef<League>('league').then(setLg).catch((e) => setErr((e as Error).message))
  useEffect(() => { void load() }, [])

  const open = me?.matches.filter((m) => m.status !== 'confirmed').length ?? 0
  return (
    <div className="cpl-page">
      <h2>Chuka League</h2>
      <p className="cpl-sub">Join any time. Every week you get 2 matches against players of similar strength. A win is 3 points, a draw 1.</p>
      <div className="ef-tabs" role="tablist">
        {([['table', 'Player table'], ['courses', 'Course table'], ['mine', `My matches${open ? ` (${open})` : ''}`], ['recent', 'Recent results']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {tab === 'mine' ? <Mine me={me} signedIn={signedIn} reload={async () => { await Promise.all([reload(), load()]) }} /> : !lg ? <p className="cpl-empty">Loading…</p>
        : tab === 'table' ? (
          <div className="cpl-card ef-scroll">
            {!lg.table.length ? <p className="cpl-empty">No results yet. {lg.registered} players are registered; this week's matches are being played.</p> : (
              <table className="ef-table">
                <thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                <tbody>{lg.table.map((r, i) => (
                  <tr key={r.uid} style={r.uid === me?.uid ? { background: '#f3f8f4' } : undefined}><td>{i + 1}</td><td><strong>{r.username}</strong><small>{r.course}</small></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd}</td><td><strong>{r.pts}</strong></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ) : tab === 'courses' ? (
          <div className="cpl-card ef-scroll">
            <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Courses are ranked by average points per player, so big courses do not win just by size. A course needs 3 players with results to be ranked.</p>
            {!lg.courses.length ? <p className="cpl-empty">No results yet.</p> : (
              <table className="ef-table">
                <thead><tr><th>#</th><th>Course</th><th>Players</th><th>Points</th><th>Avg</th></tr></thead>
                <tbody>{lg.courses.map((c, i) => (
                  <tr key={c.course} style={c.ranked ? undefined : { opacity: 0.55 }}><td>{c.ranked ? i + 1 : '–'}</td><td>{c.course}</td><td>{c.players}</td><td>{c.pts}</td><td><strong>{c.avg}</strong></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
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

function Mine({ me, signedIn, reload }: { me: Me | null; signedIn: boolean; reload: () => Promise<void> }) {
  if (!signedIn) return <p className="cpl-empty">Sign in with Google to see your matches.</p>
  if (!me) return <p className="cpl-empty">Loading…</p>
  if (!me.profile) return <div className="cpl-card"><p className="cpl-empty">Register first to be paired automatically.</p><div className="ef-actions"><a className="lp-btn" href="#/efootball/profile">Register</a></div></div>
  if (!me.matches.length) return <p className="cpl-empty">No matches yet. You are paired automatically when other players are waiting, and every Monday.</p>
  return <>{me.matches.map((m) => <MatchCard key={m.id} m={m} mySlots={me.profile?.freeTimes ?? []} reload={reload} />)}</>
}

function MatchCard({ m, mySlots, reload }: { m: MatchView; mySlots: string[]; reload: () => Promise<void> }) {
  const [mine, setMine] = useState(m.myClaim ? String(m.myClaim.mine) : '')
  const [theirs, setTheirs] = useState(m.myClaim ? String(m.myClaim.theirs) : '')
  const [proof, setProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const slots = sharedSlots(mySlots, m.opp.freeTimes)

  async function send() {
    setBusy(true); setMsg(null)
    try {
      const r = await ef<{ status: string }>('reportScore', { matchId: m.id, mine: Number(mine), theirs: Number(theirs), proof: proof || undefined })
      await reload()
      setMsg({ ok: true, text: r.status === 'confirmed' ? 'Both scores match. Result confirmed.' : r.status === 'disputed' ? 'The two scores differ. The admin will decide.' : 'Score sent. Waiting for your opponent to report.' })
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <section className="cpl-card">
      <h3>vs {m.opp.username} <span className={`ef-pill${m.status === 'disputed' ? ' red' : m.status === 'confirmed' ? ' gold' : ''}`}>{m.status}</span></h3>
      <p className="cpl-sub" style={{ margin: '0 0 8px' }}>Week of {m.week} · {m.opp.platform} · strength {m.opp.strength} · {m.opp.course}</p>
      {m.status === 'confirmed' && m.final
        ? <p className="cpl-msg">Final score: you {m.final.mine} – {m.final.theirs} {m.opp.username}</p>
        : (
          <>
            <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{slots.length ? `You are both free: ${slots.slice(0, 4).join(', ')}.` : 'No shared free time on file. Agree a time on WhatsApp.'}</p>
            <div className="ef-actions" style={{ marginTop: 0, marginBottom: 14 }}>
              <a className="cpl-link" href={waLink(m.opp.whatsapp, `Hi ${m.opp.username}, we are matched in the Chuka eFootball league. When can we play?`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> WhatsApp {m.opp.username}</a>
            </div>
            <div className="ef-score">
              <span>You</span><input type="number" min={0} max={30} value={mine} onChange={(e) => setMine(e.target.value)} aria-label="Your goals" />
              <span>–</span><input type="number" min={0} max={30} value={theirs} onChange={(e) => setTheirs(e.target.value)} aria-label="Their goals" /><span>{m.opp.username}</span>
            </div>
            <div style={{ marginTop: 12 }}><ImagePicker current="" fallback={<span style={{ fontSize: 11 }}>Optional</span>} label="result screenshot" max={1280} onChange={(v) => setProof(v.data)} /></div>
            <div className="ef-actions"><button className="lp-btn" disabled={busy || mine === '' || theirs === ''} onClick={send}>{busy ? 'Sending…' : m.myClaim ? 'Update score' : 'Submit score'}</button></div>
            {m.myClaim && !msg && <p className="cpl-note" style={{ textAlign: 'left' }}>{m.oppReported ? 'Your opponent has reported too.' : 'Waiting for your opponent to report.'}</p>}
            {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
          </>
        )}
    </section>
  )
}
