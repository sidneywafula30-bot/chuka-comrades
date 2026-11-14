import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cpl, fmtDate, STAT_LABEL, type PendingStat } from '../lib/cpl'

/** Chairman: approve or reject the stats the referees have entered. Only approved stats appear on player dashboards. */
export default function CplStatsApproval() {
  const [list, setList] = useState<PendingStat[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => { cpl<PendingStat[]>('statsPending').then(setList).catch((e) => setMsg({ text: e.message, bad: true })) }, [])

  async function decide(ids: string[], decision: 'approved' | 'rejected') {
    setBusy(true); setMsg(null)
    try { setList(await cpl<PendingStat[]>('statDecide', { ids, decision })); setMsg({ text: decision === 'approved' ? 'Approved.' : 'Rejected.' }) }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  const groups = new Map<string, PendingStat[]>()
  list?.forEach((s) => groups.set(s.fixtureId, [...(groups.get(s.fixtureId) ?? []), s]))

  return (
    <div className="cpl-page">
      <h2>Player stats approvals</h2>
      <p className="cpl-sub">Goals, assists, clean sheets and cards entered by referees. Approved entries appear on the player's dashboard.</p>
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      {list === null && !msg && <p className="cpl-empty">Loading…</p>}
      {list?.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>Nothing waiting for approval.</p>}
      {[...groups.entries()].map(([fid, items]) => (
        <section className="cpl-card" key={fid}>
          <div className="cpl-tr-head">
            <div>
              <strong>{items[0].fixture}</strong>
              <small className="cpl-muted-block">{[items[0].matchday && `Matchday ${items[0].matchday}`, fmtDate(items[0].date)].filter(Boolean).join(' · ')}</small>
            </div>
            <div className="cpl-inline">
              <button className="lp-btn" disabled={busy} onClick={() => decide(items.map((s) => s.id), 'approved')}><Check size={14} /> Approve all</button>
              <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => decide(items.map((s) => s.id), 'rejected')}>Reject all</button>
            </div>
          </div>
          <ul className="cpl-stat-list">
            {items.map((s) => (
              <li key={s.id}>
                <span className={`cpl-stat-ico t-${s.type}`}>{STAT_LABEL[s.type]}</span>
                <span><b>{s.playerName}</b> <small>{s.teamName}{s.minute && ` · ${s.minute}'`}</small></span>
                <button className="lp-btn" disabled={busy} onClick={() => decide([s.id], 'approved')} aria-label="Approve"><Check size={14} /></button>
                <button className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => decide([s.id], 'rejected')} aria-label="Reject"><X size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
