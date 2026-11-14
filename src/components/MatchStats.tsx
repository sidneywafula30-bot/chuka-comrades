import { useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { cpl, fmtStamp, STAT_LABEL, STAT_TYPES, type Fixture, type Player, type StatEntry, type StatType } from '../lib/cpl'

type Msg = { text: string; bad?: boolean } | null

/** Referee: record who scored, assisted, kept a clean sheet or was carded. A chairman approves each entry before it counts. */
export default function MatchStats({ x }: { x: Fixture }) {
  const [list, setList] = useState<StatEntry[] | null>(null)
  const [squads, setSquads] = useState<{ team: string; players: Player[] }[]>([])
  const [f, setF] = useState<{ playerId: string; type: StatType; minute: string }>({ playerId: '', type: 'goal', minute: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  useEffect(() => {
    cpl<StatEntry[]>('fixtureStats', { fixtureId: x.id }).then(setList).catch((e) => setMsg({ text: e.message, bad: true }))
    Promise.all([cpl<Player[]>('playersList', { teamId: x.homeId }), cpl<Player[]>('playersList', { teamId: x.awayId })])
      .then(([h, a]) => setSquads([{ team: x.home, players: h }, { team: x.away, players: a }]))
      .catch((e) => setMsg({ text: e.message, bad: true }))
  }, [x.id, x.homeId, x.awayId, x.home, x.away])

  async function add(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null)
    try { setList(await cpl<StatEntry[]>('statAdd', { fixtureId: x.id, ...f })); setMsg({ text: 'Added. It counts once a chairman approves it.' }); setF({ ...f, minute: '' }) }
    catch (err) { setMsg({ text: (err as Error).message, bad: true }) }
    finally { setBusy(false) }
  }
  async function remove(s: StatEntry) {
    setBusy(true); setMsg(null)
    try { setList(await cpl<StatEntry[]>('statDelete', { fixtureId: x.id, id: s.id })) }
    catch (err) { setMsg({ text: (err as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  const noSquads = squads.length > 0 && squads.every((s) => s.players.length === 0)
  return (
    <div className="cpl-statbox">
      <h4>Player stats for this match</h4>
      <p className="cpl-sub" style={{ margin: 0, fontSize: 13 }}>Final score {x.homeScore}–{x.awayScore}. Goals cannot exceed a team's score, and a clean sheet needs the other team on 0. A chairman approves each entry before it counts.</p>
      <form className="cpl-stat-add" onSubmit={add}>
        <select required value={f.playerId} onChange={(e) => setF({ ...f, playerId: e.target.value })} aria-label="Player">
          <option value="">Player…</option>
          {squads.map((s) => (
            <optgroup key={s.team} label={s.team}>
              {s.players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.number && ` #${p.number}`} ({p.position})</option>)}
            </optgroup>
          ))}
        </select>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as StatType })} aria-label="What happened">
          {STAT_TYPES.map((t) => <option key={t} value={t}>{STAT_LABEL[t]}</option>)}
        </select>
        <input type="number" min={0} max={130} placeholder="Min" value={f.minute} onChange={(e) => setF({ ...f, minute: e.target.value })} aria-label="Minute (optional)" />
        <button className="lp-btn" disabled={busy}>Add</button>
      </form>
      {noSquads && <p className="cpl-err">Neither team has players registered yet.</p>}
      {msg && <p className={`cpl-msg${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</p>}
      {list === null && <p className="cpl-empty" style={{ textAlign: 'left' }}>Loading…</p>}
      {list?.length === 0 && <p className="cpl-empty" style={{ textAlign: 'left' }}>Nothing recorded yet.</p>}
      <ul className="cpl-stat-list">
        {list?.map((s) => (
          <li key={s.id}>
            <span className={`cpl-stat-ico t-${s.type}`}>{STAT_LABEL[s.type]}</span>
            <span><b>{s.playerName}</b> <small>{s.teamName}{s.minute && ` · ${s.minute}'`} · {fmtStamp(s.addedAt)}</small></span>
            <span className={`cpl-badge sv-${s.status}`}>{s.status}</span>
            {s.status !== 'approved' && <button type="button" className="lp-btn lp-btn-soft cpl-danger" disabled={busy} onClick={() => remove(s)} aria-label="Remove entry"><Trash2 size={14} /></button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
