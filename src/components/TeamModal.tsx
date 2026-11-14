import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cpl, POSITIONS, type Fixture, type Player, type Team } from '../lib/cpl'
import PlayerCard from './PlayerCard'
import FixtureRow from './FixtureRow'

/** Public team profile window: squad and fixtures (with venue, referee and match reports). */
export default function TeamModal({ team, tab: first = 'players', onClose }: { team: Team; tab?: 'players' | 'fixtures'; onClose: () => void }) {
  const [tab, setTab] = useState(first)
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    cpl<Player[]>('playersList', { teamId: team.id }).then(setPlayers).catch((e) => setErr(e.message))
    cpl<Fixture[]>('fixturesList', { teamId: team.id }).then(setFixtures).catch((e) => setErr(e.message))
  }, [team.id])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="cpl-modal" role="dialog" aria-modal="true" aria-label={`${team.name} profile`} onClick={onClose}>
      <div className="cpl-modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><strong>{team.name}</strong><small>Coach {team.coachName}</small></div>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="cpl-chips" style={{ justifyContent: 'flex-start', marginTop: 0 }} role="tablist">
          <button role="tab" aria-selected={tab === 'players'} className={tab === 'players' ? 'on' : ''} onClick={() => setTab('players')}>Players{players ? ` (${players.length})` : ''}</button>
          <button role="tab" aria-selected={tab === 'fixtures'} className={tab === 'fixtures' ? 'on' : ''} onClick={() => setTab('fixtures')}>Fixtures{fixtures ? ` (${fixtures.length})` : ''}</button>
        </div>
        {err && <p className="cpl-err">{err}</p>}
        {tab === 'players' && (<>
          {!players && !err && <p className="cpl-empty">Loading…</p>}
          {players?.length === 0 && <p className="cpl-empty">No players have been added yet.</p>}
          {players && POSITIONS.map((pos) => {
            const g = players.filter((p) => p.position === pos)
            return g.length === 0 ? null : (
              <div key={pos}><h4 className="cpl-div-title">{pos}s</h4><div className="cpl-pl-grid">{g.map((p) => <PlayerCard key={p.id} p={p} />)}</div></div>
            )
          })}
        </>)}
        {tab === 'fixtures' && (<>
          {!fixtures && !err && <p className="cpl-empty">Loading…</p>}
          {fixtures?.length === 0 && <p className="cpl-empty">No fixtures for this team yet.</p>}
          <div className="cpl-fixtures">{fixtures?.map((x) => <FixtureRow key={x.id} x={x} highlight={team.name} />)}</div>
        </>)}
      </div>
    </div>
  )
}
