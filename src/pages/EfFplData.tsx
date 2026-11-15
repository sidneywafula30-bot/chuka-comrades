import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, RefreshCw, X } from 'lucide-react'
import { countdown, fmtDay, fmtStamp, fmtTime, isoOf, type FplFixture, type FplHub, type FplLive, type FplManager, type FplMatches, type FplPlayer, type FplPlayerDetail, type FplPlayers, type FplTableRow, type FplEvent } from '../lib/efootball'
import { useApi, useTick } from '../lib/efHooks'

const Loading = ({ err, retry }: { err: string; retry: () => void }) => err
  ? <div><p className="cpl-err" role="alert">{err}</p><div className="ef-actions"><button className="lp-btn" onClick={retry}><RefreshCw size={14} /> Try again</button></div></div>
  : <p className="cpl-empty">Loading…</p>

const Stale = ({ at }: { at: number }) => <p className="cpl-note" style={{ textAlign: 'left' }}>Official FPL data, updated {at ? fmtStamp(isoOf(at)) : 'recently'}. It refreshes by itself.</p>

/* ============================== overview: deadline, captain picks ============================== */
export function Overview({ chuka }: { chuka: { gw: string; got: number; total: number; list: { name: string; n: number }[] } | null }) {
  const { data: h, err, retry } = useApi<FplHub>('fplHub', {}, 120000)
  useTick()
  const [skew, setSkew] = useState(0)
  useEffect(() => { if (h?.serverNow) setSkew(h.serverNow - Date.now()) }, [h?.serverNow])
  if (!h) return <Loading err={err} retry={retry} />
  const left = h.next ? countdown(h.next.at, skew) : ''
  return (
    <>
      <section className="ef-fpl-hero" aria-label="Gameweek hub">
        <small>{h.gw ? h.gw.name : 'Gameweek hub'}{h.gw?.finished ? ' · finished' : h.gw?.started ? ' · live' : ''}</small>
        <strong>{h.next ? `${h.next.name} deadline` : 'Season break'}</strong>
        {h.next && <p className="ef-deadline"><Clock size={14} /> {left ? `${left} left` : 'Deadline passing'} · {fmtStamp(h.next.at)}</p>}
        {h.gw && (h.gw.avg > 0 || h.gw.hi > 0) && (
          <div className="ef-fpl-stats">
            <div><b>{h.gw.avg}</b><span>Average score</span></div>
            <div><b>{h.gw.hi}</b><span>Highest score</span></div>
            <div><b>{h.picks?.topPlayer ? h.picks.topPlayer.pts : '–'}</b><span>{h.picks?.topPlayer ? h.picks.topPlayer.name : 'Top player'}</span></div>
          </div>
        )}
      </section>

      <section className="cpl-card">
        <h3>Top captain picks</h3>
        <p className="cpl-sub" style={{ margin: '0 0 10px' }}>Best captain options by expected points for the next gameweek (FPL's own estimate), available players only.</p>
        {h.candidates.length ? (
          <ol className="ef-mini">
            {h.candidates.map((p, i) => <li key={p.id}><b>{i + 1}</b><span><strong>{p.name}</strong><small>{p.team} · {p.pos} · form {p.form} · {p.sel}% owned</small></span><em>{p.ep} xP</em></li>)}
          </ol>
        ) : <p className="cpl-empty" style={{ margin: 0 }}>No estimates yet.</p>}
        {h.picks && (
          <div className="ef-facts">
            {h.picks.mostCaptained && <div><small>Most captained ({h.gw?.name})</small><b>{h.picks.mostCaptained}</b></div>}
            {h.picks.mostVice && <div><small>Most vice-captained</small><b>{h.picks.mostVice}</b></div>}
            {h.picks.mostSelected && <div><small>Most selected</small><b>{h.picks.mostSelected}</b></div>}
            {h.picks.mostTransferredIn && <div><small>Most transferred in</small><b>{h.picks.mostTransferredIn}</b></div>}
          </div>
        )}
      </section>

      <section className="cpl-card">
        <h3>Chuka managers' captains</h3>
        {chuka && chuka.list.length ? (
          <>
            <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{chuka.gw}: captains of {chuka.got} of {chuka.total} Chuka managers.</p>
            <div className="ef-cap">
              {chuka.list.slice(0, 6).map((c) => (
                <span key={c.name} style={{ display: 'contents' }}>
                  <strong>{c.name}</strong><span>{c.n} ({Math.round((c.n / chuka.got) * 100)}%)</span>
                  <i style={{ width: `${Math.max(4, (c.n / chuka.list[0].n) * 100)}%` }} />
                </span>
              ))}
            </div>
          </>
        ) : <p className="cpl-empty" style={{ margin: 0 }}>Captain picks are secret until the deadline. Chuka managers' picks show up here soon after it passes.</p>}
      </section>
      <Stale at={h.at} />
    </>
  )
}

/* ============================== fixtures and results ============================== */
const ev = (list: FplEvent[], side: 'h' | 'a') => list.filter((x) => x.side === side).map((x) => (x.n > 1 ? `${x.name} ×${x.n}` : x.name)).join(', ')

export function Matches() {
  const [gw, setGw] = useState(0)
  const { data: m, err, retry } = useApi<FplMatches>('fplMatches', gw ? { gw } : {}, 60000)
  const [open, setOpen] = useState('')
  if (!m) return <Loading err={err} retry={retry} />
  const cur = m.gw
  const go = (n: number) => { setGw(Math.min(38, Math.max(1, n))); setOpen('') }
  const days = new Map<string, FplFixture[]>()
  m.fixtures.forEach((f) => { const k = f.ko ? fmtDay(f.ko) : 'Date to be confirmed'; days.set(k, [...(days.get(k) ?? []), f]) })
  return (
    <>
      <div className="ef-gwnav">
        <button className="lp-btn" onClick={() => go(cur - 1)} disabled={cur <= 1} aria-label="Previous gameweek"><ChevronLeft size={16} /></button>
        <select className="ef-sel" value={cur} onChange={(e) => go(Number(e.target.value))} aria-label="Gameweek">
          {m.events.map((e) => <option key={e.id} value={e.id}>{e.name}{e.current ? ' (current)' : e.finished ? '' : ''}</option>)}
        </select>
        <button className="lp-btn" onClick={() => go(cur + 1)} disabled={cur >= 38} aria-label="Next gameweek"><ChevronRight size={16} /></button>
        {m.current > 0 && cur !== m.current && <button type="button" className="cpl-link" onClick={() => go(m.current)}>Back to current</button>}
      </div>
      {!m.fixtures.length && <p className="cpl-empty">No fixtures in this gameweek.</p>}
      {[...days.entries()].map(([day, list]) => (
        <section className="cpl-card" key={day}>
          <h3>{day}</h3>
          {list.map((f) => {
            const isOpen = open === String(f.id)
            const has = f.goals.length + f.assists.length + f.reds.length + f.ownGoals.length + f.bonus.length > 0
            return (
              <div className="ef-fx" key={f.id}>
                <button type="button" className="ef-fx-row" onClick={() => setOpen(isOpen ? '' : String(f.id))} aria-expanded={isOpen}>
                  <span className="t h">{f.h.name}</span>
                  <span className={`sc ${f.status}`}>
                    {f.status === 'upcoming' ? (f.ko ? fmtTime(f.ko) : 'TBC') : `${f.hg ?? 0} - ${f.ag ?? 0}`}
                    {f.status === 'live' && <small>{f.min ? `${f.min}'` : 'LIVE'}</small>}
                    {f.status === 'finished' && <small>FT</small>}
                  </span>
                  <span className="t a">{f.a.name}</span>
                </button>
                {isOpen && (
                  <div className="ef-fx-detail">
                    {!has ? <p className="cpl-note" style={{ margin: 0, textAlign: 'left' }}>{f.status === 'upcoming' ? `Kick-off ${f.ko ? fmtStamp(f.ko) : 'to be confirmed'}.` : 'No goals, cards or bonus points yet.'}</p> : (
                      <div className="ef-fx-grid">
                        {([['Goals', f.goals], ['Assists', f.assists], ['Own goals', f.ownGoals], ['Red cards', f.reds], ['Bonus points', f.bonus]] as [string, FplEvent[]][]).filter(([, l]) => l.length).map(([label, l]) => (
                          <div key={label}><small>{label}</small><span>{ev(l, 'h') || '–'}</span><span>{ev(l, 'a') || '–'}</span></div>
                        ))}
                        <div className="ef-fx-sides"><small /><b>{f.h.short}</b><b>{f.a.short}</b></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
      <p className="cpl-note" style={{ textAlign: 'left' }}>Tap a match for scorers, assists, red cards and bonus points. Times are Nairobi time. Live scores refresh every minute.</p>
    </>
  )
}

/* ============================== Premier League table ============================== */
export function PlTable() {
  const { data, err, retry } = useApi<{ at: number; rows: FplTableRow[] }>('fplTable', {}, 120000)
  if (!data) return <Loading err={err} retry={retry} />
  const n = data.rows.length
  return (
    <div className="cpl-card ef-scroll">
      <table className="ef-table ef-pl">
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
        <tbody>{data.rows.map((r, i) => (
          <tr key={r.id} className={i < 4 ? 'ucl' : i >= n - 3 ? 'rel' : i < 6 ? 'uel' : ''}>
            <td>{i + 1}</td><td><strong>{r.name}</strong></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><strong>{r.pts}</strong></td>
            <td><span className="ef-form">{r.form.map((x, j) => <i key={j} className={x}>{x}</i>)}</span></td>
          </tr>
        ))}</tbody>
      </table>
      <p className="cpl-note" style={{ textAlign: 'left' }}>Green: Champions League places. Blue: Europa League. Red: relegation. Worked out from every finished and live match.</p>
    </div>
  )
}

/* ============================== live points ============================== */
export function Live() {
  const { data, err, retry } = useApi<FplLive>('fplLive', {}, 60000)
  if (!data) return <Loading err={err} retry={retry} />
  if (!data.gw) return <p className="cpl-empty">No gameweek is on right now.</p>
  return (
    <div className="cpl-card ef-scroll">
      <h3>{data.gw.name} · {data.gw.finished ? 'final points' : data.gw.started ? 'live points' : 'not started'}</h3>
      {!data.top.length ? <p className="cpl-empty" style={{ margin: 0 }}>The gameweek has not started, so nobody has points yet. Check back after the first kick-off.</p> : (
        <table className="ef-table ef-pl">
          <thead><tr><th>#</th><th>Player</th><th>Mins</th><th>G</th><th>A</th><th>CS</th><th>Bonus</th><th>Pts</th></tr></thead>
          <tbody>{data.top.map((p, i) => (
            <tr key={p.id}><td>{i + 1}</td><td><strong>{p.name}</strong><small>{p.team} · {p.pos}</small></td><td>{p.mins}</td><td>{p.g}</td><td>{p.a}</td><td>{p.cs}</td><td>{p.bonus}</td><td><strong>{p.pts}</strong></td></tr>
          ))}</tbody>
        </table>
      )}
      <p className="cpl-note" style={{ textAlign: 'left' }}>Top 25 players of the gameweek so far, refreshed every minute. Bonus points are provisional until the match ends. Updated {fmtStamp(isoOf(data.at))}.</p>
    </div>
  )
}

/* ============================== player statistics ============================== */
const SORTS: [string, string][] = [['pts', 'Total points'], ['form', 'Form'], ['gw', 'This gameweek'], ['ep', 'Expected next'], ['sel', 'Selected by'], ['price', 'Price'], ['g', 'Goals'], ['a', 'Assists'], ['cs', 'Clean sheets'], ['bonus', 'Bonus'], ['ppg', 'Points per game'], ['mins', 'Minutes'], ['ict', 'ICT index'], ['xg', 'Expected goals']]
const POSITIONS: [number, string][] = [[0, 'All positions'], [1, 'Goalkeepers'], [2, 'Defenders'], [3, 'Midfielders'], [4, 'Forwards']]

export function PlayerStats() {
  const [q, setQ] = useState('')
  const [pos, setPos] = useState(0)
  const [team, setTeam] = useState(0)
  const [sort, setSort] = useState('pts')
  const [limit, setLimit] = useState(40)
  const [sel, setSel] = useState<number | null>(null)
  // The search box is applied when you stop typing, so the server is not called on every key.
  const [qs, setQs] = useState('')
  const payload = useMemo(() => ({ q: qs, pos, team, sort, limit }), [qs, pos, team, sort, limit])
  const { data, err, retry } = useApi<FplPlayers>('fplPlayers', payload)
  const timer = useMemo(() => ({ t: 0 as unknown as ReturnType<typeof setTimeout> }), [])
  const typing = (v: string) => { setQ(v); clearTimeout(timer.t); timer.t = setTimeout(() => { setQs(v); setLimit(40) }, 350) }
  const col = SORTS.find((s) => s[0] === sort)
  const extra = !['pts', 'price', 'form', 'sel'].includes(sort)
  const val = (p: FplPlayer) => (p as unknown as Record<string, number>)[sort]
  return (
    <>
      <div className="cpl-search" style={{ width: '100%', marginBottom: 10 }}>
        <input value={q} onChange={(e) => typing(e.target.value)} placeholder="Search a player, e.g. Haaland" aria-label="Search players" maxLength={40} />
      </div>
      <div className="cpl-inline" style={{ marginBottom: 14 }}>
        <select className="ef-sel" value={pos} onChange={(e) => { setPos(Number(e.target.value)); setLimit(40) }} aria-label="Position">{POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="ef-sel" value={team} onChange={(e) => { setTeam(Number(e.target.value)); setLimit(40) }} aria-label="Team"><option value={0}>All teams</option>{data?.teams.map((t) => <option key={t.id} value={t.id}>{t.n}</option>)}</select>
        <select className="ef-sel" value={sort} onChange={(e) => { setSort(e.target.value); setLimit(40) }} aria-label="Sort by">{SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
      </div>
      {!data ? <Loading err={err} retry={retry} /> : (
        <div className="cpl-card ef-scroll">
          <table className="ef-table ef-pl">
            <thead><tr><th>#</th><th>Player</th><th>£</th><th>Form</th><th>Sel%</th><th>Pts</th>{extra && <th>{col?.[1]}</th>}</tr></thead>
            <tbody>{data.rows.map((p, i) => (
              <tr key={p.id} className="ef-click" onClick={() => setSel(p.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(p.id)}>
                <td>{i + 1}</td><td><strong>{p.name}{p.status !== 'a' && <span className={`ef-dot ${p.status}`} title={p.news} />}</strong><small>{p.team} · {p.pos}</small></td>
                <td>{p.price.toFixed(1)}</td><td>{p.form}</td><td>{p.sel}</td><td><strong>{p.pts}</strong></td>{extra && <td><strong>{val(p)}</strong></td>}
              </tr>
            ))}</tbody>
          </table>
          {!data.rows.length && <p className="cpl-empty">No players match.</p>}
          {data.total > data.rows.length && <div className="ef-actions"><button className="lp-btn" onClick={() => setLimit((n) => Math.min(100, n + 40))} disabled={limit >= 100}>Show more ({data.total - data.rows.length} more match)</button></div>}
          <p className="cpl-note" style={{ textAlign: 'left' }}>Tap a player for last matches and next fixtures. A coloured dot means injured, doubtful or unavailable.</p>
        </div>
      )}
      {sel !== null && <PlayerModal id={sel} onClose={() => setSel(null)} />}
    </>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ef-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ef-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="ef-modal-head"><h3>{title}</h3><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  )
}

function PlayerModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, err, retry } = useApi<FplPlayerDetail>('fplPlayer', { id })
  const p = data?.player
  return (
    <Modal title={p ? `${p.name} · ${p.team} · ${p.pos}` : 'Player'} onClose={onClose}>
      {!data || !p ? <Loading err={err} retry={retry} /> : (
        <>
          {p.news && <p className="ef-stale" role="status">{p.news}</p>}
          <div className="ef-facts">
            {([['Price', `£${p.price.toFixed(1)}`], ['Total pts', p.pts], ['Form', p.form], ['Pts / game', p.ppg], ['Selected', `${p.sel}%`], ['Expected next', p.ep], ['Goals', p.g], ['Assists', p.a], ['Clean sheets', p.cs], ['Minutes', p.mins], ['Bonus', p.bonus], ['Yellow / red', `${p.yc} / ${p.rc}`], ['xG', p.xg], ['xA', p.xa], ['ICT', p.ict], ['Saves', p.saves]] as [string, string | number][]).map(([l, v]) => (
              <div key={l}><small>{l}</small><b>{v}</b></div>
            ))}
          </div>
          <h4>Last matches</h4>
          {!data.history.length ? <p className="cpl-note" style={{ textAlign: 'left' }}>No matches played yet.</p> : (
            <div className="ef-scroll"><table className="ef-table ef-pl">
              <thead><tr><th>GW</th><th>Opp</th><th>Score</th><th>Min</th><th>G</th><th>A</th><th>CS</th><th>Pts</th></tr></thead>
              <tbody>{data.history.map((h, i) => <tr key={i}><td>{h.gw}</td><td>{h.opp} ({h.home ? 'H' : 'A'})</td><td>{h.hs}-{h.as}</td><td>{h.mins}</td><td>{h.g}</td><td>{h.a}</td><td>{h.cs}</td><td><strong>{h.pts}</strong></td></tr>)}</tbody>
            </table></div>
          )}
          <h4>Next fixtures</h4>
          <div className="ef-fixrow">
            {data.fixtures.length ? data.fixtures.map((f, i) => <span key={i} className={`d${f.diff}`}><small>GW{f.gw}</small>{f.opp} ({f.home ? 'H' : 'A'})</span>) : <p className="cpl-note" style={{ margin: 0 }}>No fixtures listed.</p>}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ============================== a Chuka manager: statistics and this gameweek's team ============================== */
export function ManagerModal({ entry, onClose }: { entry: string; onClose: () => void }) {
  const { data: m, err, retry } = useApi<FplManager>('fplManager', { entry })
  return (
    <Modal title={m ? `${m.name || 'FPL team'} · ${m.username}` : 'Manager'} onClose={onClose}>
      {!m ? <Loading err={err} retry={retry} /> : (
        <>
          {m.stale && <p className="ef-stale" role="status">FPL is busy, so this is the last saved copy.</p>}
          <p className="cpl-sub" style={{ margin: '0 0 10px' }}>{[m.manager, m.course, m.region].filter(Boolean).join(' · ')}</p>
          <div className="ef-facts">
            {([['Total points', m.overall.points], ['Overall rank', m.overall.rank ? `#${m.overall.rank.toLocaleString()}` : '–'], ['This GW', m.overall.gwPoints], ['GW rank', m.overall.gwRank ? `#${m.overall.gwRank.toLocaleString()}` : '–'], ['Team value', `£${m.overall.value}`], ['In the bank', `£${m.overall.bank}`], ['Transfers', m.overall.transfers]] as [string, string | number][]).map(([l, v]) => <div key={l}><small>{l}</small><b>{v}</b></div>)}
          </div>
          <h4>Season statistics</h4>
          <div className="ef-facts">
            {([['Gameweeks played', m.stats.played], ['Average GW', m.stats.avg], ['Best GW', m.stats.best ? `${m.stats.best.pts} (GW${m.stats.best.gw})` : '–'], ['Worst GW', m.stats.worst ? `${m.stats.worst.pts} (GW${m.stats.worst.gw})` : '–'], ['Best rank', m.stats.bestRank ? `#${m.stats.bestRank.toLocaleString()}` : '–'], ['Points lost to hits', m.stats.hits], ['Transfers made', m.stats.transfers], ['Points left on bench', m.stats.benchPts]] as [string, string | number][]).map(([l, v]) => <div key={l}><small>{l}</small><b>{v}</b></div>)}
          </div>
          {m.chips.length > 0 && <p className="cpl-note" style={{ textAlign: 'left' }}>Chips used: {m.chips.map((c) => `${c.name} (GW${c.gw})`).join(', ')}</p>}

          <h4>{m.team ? `Team for gameweek ${m.team.gw}${m.team.chip ? ` · ${m.team.chip}` : ''}` : 'This gameweek'}</h4>
          {m.team ? (
            <>
              <p className="cpl-msg" style={{ marginTop: 0 }}>Live: <strong>{m.team.live}</strong>{m.team.hit ? ` (after −${m.team.hit} hit)` : ''} · Bench: {m.team.bench}</p>
              <div className="ef-picks">
                {m.team.picks.map((p) => (
                  <div key={p.id} className={p.mult === 0 ? 'bench' : ''}>
                    <span className="pos">{p.pos}</span><strong>{p.name}{p.captain ? ' (C)' : p.vice ? ' (V)' : ''}</strong><small>{p.team}{p.g ? ` · ${p.g}G` : ''}{p.a ? ` · ${p.a}A` : ''}</small><em>{p.pts * (p.mult || 1)}</em>
                  </div>
                ))}
              </div>
              <p className="cpl-note" style={{ textAlign: 'left' }}>{m.team.note}</p>
            </>
          ) : <p className="cpl-note" style={{ textAlign: 'left' }}>{m.teamNote || 'No team to show.'}</p>}

          {m.gws.length > 0 && (
            <>
              <h4>Gameweek history</h4>
              <div className="ef-scroll"><table className="ef-table ef-pl">
                <thead><tr><th>GW</th><th>Pts</th><th>Total</th><th>Rank</th><th>Bench</th></tr></thead>
                <tbody>{[...m.gws].reverse().slice(0, 15).map((g) => <tr key={g.gw}><td>{g.gw}</td><td><strong>{g.pts}</strong>{g.cost ? ` (−${g.cost})` : ''}</td><td>{g.total}</td><td>{g.rank ? g.rank.toLocaleString() : '–'}</td><td>{g.bench}</td></tr>)}</tbody>
              </table></div>
            </>
          )}
          {m.past.length > 0 && <p className="cpl-note" style={{ textAlign: 'left' }}>Past seasons: {m.past.slice(-5).map((s) => `${s.season}: ${s.pts} pts (#${s.rank.toLocaleString()})`).join(' · ')}</p>}
        </>
      )}
    </Modal>
  )
}
