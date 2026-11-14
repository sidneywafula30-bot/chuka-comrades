import { useEffect, useState } from 'react'
import { ArrowRightLeft, UserRound } from 'lucide-react'
import { cpl, fmtDate, STAT_LABEL, type MyStats, type Transfer } from '../lib/cpl'

/** Player dashboard: the statistics the referee entered and the chairman approved, plus transfer requests that need the player. */
export default function CplPlayerDashboard() {
  const [stats, setStats] = useState<MyStats[] | null>(null)
  const [waiting, setWaiting] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    cpl<MyStats[]>('myStats').then(setStats).catch((e) => setErr(e.message))
    cpl<Transfer[]>('transfers').then((t) => setWaiting(t.filter((x) => x.youAct).length)).catch(() => setWaiting(0))
  }, [])

  return (
    <div className="cpl-page">
      <h2>Player dashboard</h2>
      <p className="cpl-sub">Your official statistics. A goal, assist, clean sheet or card only counts after the referee records it and the chairman approves it.</p>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {!stats && !err && <p className="cpl-empty">Loading…</p>}
      {waiting > 0 && (
        <a className="cpl-alert" href="#/cpl/transfers"><ArrowRightLeft size={16} /> You have {waiting} transfer request{waiting > 1 ? 's' : ''} waiting for you. Open Transfers</a>
      )}
      {stats?.map((s) => (
        <section className="cpl-card cpl-pdash" key={s.playerId}>
          <div className="cpl-pdash-head">
            <div className="cpl-avatar-ring">{s.imageUrl ? <img src={s.imageUrl} alt={s.name} /> : <span className="ph"><UserRound size={26} /></span>}</div>
            <div>
              <strong>{s.name}</strong>
              <small className="cpl-muted-block">{s.teamName} · <span className={`cpl-pos pos-${s.position}`}>{s.position}</span></small>
            </div>
          </div>
          <div className="cpl-tiles">
            <Tile n={s.goals} label="Goals" />
            <Tile n={s.assists} label="Assists" />
            <Tile n={s.cleanSheets} label="Clean sheets" />
            <Tile n={s.yellow} label="Yellow cards" tone="y" />
            <Tile n={s.red} label="Red cards" tone="r" />
            <Tile n={s.matches} label="Matches with stats" />
          </div>
          {s.pending > 0 && <p className="cpl-note" style={{ margin: '12px 0 0' }}>{s.pending} entr{s.pending > 1 ? 'ies are' : 'y is'} waiting for the chairman's approval.</p>}
          <h4 className="cpl-h4">Approved match events</h4>
          {s.events.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>No approved stats yet.</p>}
          <ul className="cpl-stat-list">
            {s.events.map((e) => (
              <li key={e.id}>
                <span className={`cpl-stat-ico t-${e.type}`}>{STAT_LABEL[e.type]}</span>
                <span>{e.fixture}<small className="cpl-muted-block">{fmtDate(e.date)}{e.minute && ` · ${e.minute}'`} · for {e.teamName}</small></span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Tile({ n, label, tone }: { n: number; label: string; tone?: 'y' | 'r' }) {
  return <div className={`cpl-tile${tone ? ` tone-${tone}` : ''}`}><strong>{n}</strong><span>{label}</span></div>
}
