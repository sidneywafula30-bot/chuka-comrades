import { useState, type FormEvent } from 'react'
import { BarChart3, ClipboardCheck } from 'lucide-react'
import { cpl, fmtDate, type Fixture } from '../lib/cpl'
import FixtureRow from '../components/FixtureRow'
import MatchStats from '../components/MatchStats'

type Msg = { text: string; bad?: boolean } | null

/** Referee page: the matches assigned to me, and the match report form for each. */
export default function CplMatches({ fixtures: initial }: { fixtures: Fixture[] }) {
  const [list, setList] = useState(initial)
  const [openId, setOpenId] = useState<string | null>(null)
  const [statsId, setStatsId] = useState<string | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const today = new Date().toLocaleDateString('en-CA')
  const todo = list.filter((x) => !x.summary)
  const done = list.filter((x) => x.summary)

  const row = (x: Fixture) => (
    <FixtureRow key={x.id} x={x}>
      {openId === x.id
        ? <ReportForm x={x} onDone={(l) => { if (l) { setList(l); setMsg({ text: 'Match report submitted. The final score is now recorded.' }) } setOpenId(null) }} />
        : (
          <div className="cpl-fxc-actions">
            <button className="lp-btn" disabled={x.date > today} onClick={() => { setOpenId(x.id); setMsg(null) }}>
              <ClipboardCheck size={14} /> {x.summary ? 'Edit report' : 'Submit match report'}
            </button>
            {x.summary && (
              <button className="lp-btn lp-btn-soft" onClick={() => setStatsId(statsId === x.id ? null : x.id)} aria-expanded={statsId === x.id}>
                <BarChart3 size={14} /> Player stats
              </button>
            )}
            {x.date > today && <small>Available from match day ({fmtDate(x.date)})</small>}
          </div>
        )}
      {statsId === x.id && x.summary && <MatchStats x={x} />}
    </FixtureRow>
  )

  return (
    <div className="cpl-page">
      <h2>My matches</h2>
      <p className="cpl-sub">Matches you are refereeing. After each match, submit the report: it records the final score and is shown on the team pages. Then add the player stats (goals, assists, clean sheets, cards); a chairman approves them before they count.</p>
      {msg && <p className="cpl-msg" role="status">{msg.text}</p>}
      <h3 className="cpl-h3">Awaiting your report ({todo.length})</h3>
      {todo.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>Nothing pending.</p>}
      <div className="cpl-fixtures">{todo.map(row)}</div>
      {done.length > 0 && <><h3 className="cpl-h3">Reported ({done.length})</h3><div className="cpl-fixtures">{done.map(row)}</div></>}
    </div>
  )
}

function ReportForm({ x, onDone }: { x: Fixture; onDone: (l: Fixture[] | null) => void }) {
  const [f, setF] = useState({ homeScore: x.homeScore, awayScore: x.awayScore, summary: x.summary, scorers: x.scorers, cards: x.cards })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { onDone(await cpl<Fixture[]>('reportSave', { id: x.id, ...f })) }
    catch (err) { setMsg({ text: (err as Error).message, bad: true }); setBusy(false) }
  }
  return (
    <form className="cpl-form cpl-reportform" onSubmit={save}>
      <div className="cpl-grid2">
        <label>{x.home} score<input type="number" required min={0} max={99} value={f.homeScore} onChange={(e) => setF({ ...f, homeScore: e.target.value })} /></label>
        <label>{x.away} score<input type="number" required min={0} max={99} value={f.awayScore} onChange={(e) => setF({ ...f, awayScore: e.target.value })} /></label>
      </div>
      <label>Match summary<textarea rows={4} required minLength={10} maxLength={2000} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="How the match went, incidents, conduct of players and officials…" /></label>
      <label>Goal scorers<textarea rows={2} maxLength={600} value={f.scorers} onChange={(e) => setF({ ...f, scorers: e.target.value })} placeholder="e.g. J. Mwangi 12', 55' (Comrades FC); B. Kamau 70' (Lions)" /></label>
      <label>Cards<textarea rows={2} maxLength={600} value={f.cards} onChange={(e) => setF({ ...f, cards: e.target.value })} placeholder="e.g. Yellow: K. Njeru 33'. Red: none" /></label>
      <div className="cpl-inline">
        <button className="lp-btn" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button>
        <button type="button" className="lp-btn lp-btn-soft" disabled={busy} onClick={() => onDone(null)}>Cancel</button>
      </div>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
    </form>
  )
}
