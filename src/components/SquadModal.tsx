import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cpl, POSITIONS, type Player, type Team } from '../lib/cpl'
import PlayerCard from './PlayerCard'

/** Public squad list for one team, grouped by position. */
export default function SquadModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const [list, setList] = useState<Player[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { cpl<Player[]>('playersList', { teamId: team.id }).then(setList).catch((e) => setErr(e.message)) }, [team.id])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="cpl-modal" role="dialog" aria-modal="true" aria-label={`${team.name} players`} onClick={onClose}>
      <div className="cpl-modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><strong>{team.name}</strong><small>Squad{list ? ` · ${list.length} players` : ''}</small></div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {err && <p className="cpl-err">{err}</p>}
        {!list && !err && <p className="cpl-empty">Loading…</p>}
        {list?.length === 0 && <p className="cpl-empty">No players have been added yet.</p>}
        {list && POSITIONS.map((pos) => {
          const g = list.filter((p) => p.position === pos)
          return g.length === 0 ? null : (
            <div key={pos}>
              <h4 className="cpl-div-title">{pos}s</h4>
              <div className="cpl-pl-grid">{g.map((p) => <PlayerCard key={p.id} p={p} />)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
