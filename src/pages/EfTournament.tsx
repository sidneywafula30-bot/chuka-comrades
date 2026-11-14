import { useCallback, useEffect, useState } from 'react'
import { Copy, Crown, MessageCircle, Trophy } from 'lucide-react'
import GoogleSignInButton from '../components/GoogleSignInButton'
import ImagePicker from '../components/ImagePicker'
import { driveImg, ef, fmtDay, fmtStamp, fmtTime, stageName, stageWindow, waLink, type Champion, type Me, type Pool, type Tournament } from '../lib/efootball'

type Props = { token: string; me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void> }

function useCountdown(iso: string, skew: number) {
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i) }, [])
  const ms = Date.parse(iso) - (Date.now() + skew)
  if (!(ms > 0)) return ''
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${String(s % 60).padStart(2, '0')}s` : `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export default function EfTournament({ token, me, signedIn, onSignIn, reload }: Props) {
  const [t, setT] = useState<Tournament | null | undefined>(undefined)
  const [skew, setSkew] = useState(0)
  const [err, setErr] = useState('')
  const [champs, setChamps] = useState<Champion[]>([])

  const load = useCallback(async () => {
    try {
      const r = await ef<Tournament | null>('tournament', token ? { token } : {})
      if (r) setSkew(r.serverNow - Date.now())
      setT(r); setErr('')
    } catch (e) { setErr((e as Error).message); setT(null) }
  }, [token])

  useEffect(() => { void load() }, [load])
  useEffect(() => { ef<Champion[]>('champions').then(setChamps).catch(() => {}) }, [])
  useEffect(() => {
    if (!t || t.status === 'done') return
    const i = setInterval(() => { void load() }, 45000)
    return () => clearInterval(i)
  }, [t, load])

  if (t === undefined) return <p className="cpl-empty">Loading…</p>
  if (!t) return (
    <div className="cpl-page">
      <h2>Weekly knockout</h2>
      <p className="cpl-empty">{err || 'No tournament has been created yet. Check back soon.'}</p>
      {token && <div className="ef-actions"><a className="lp-btn" href="#/efootball/tournament">See the current tournament</a></div>}
      <Champions list={champs} />
    </div>
  )
  return <View t={t} skew={skew} me={me} signedIn={signedIn} onSignIn={onSignIn} reload={reload} refresh={load} champs={champs} />
}

function View({ t, skew, me, signedIn, onSignIn, reload, refresh, champs }: { t: Tournament; skew: number; me: Me | null; signedIn: boolean; onSignIn: () => void; reload: () => Promise<void>; refresh: () => Promise<void>; champs: Champion[] }) {
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const left = useCountdown(t.regClose, skew)
  const joined = !!me && me.tid === t.id && me.joined
  const profile = me?.profile ?? null
  const link = `${window.location.origin}${window.location.pathname}#/efootball/join/${t.token}`
  const myPools = t.pools.filter((p) => p.members.some((m) => m.uid === me?.uid))
  const current = myPools.find((p) => p.stage === t.round) ?? null
  const eliminated = t.status !== 'open' && myPools.length > 0 && !current && !(t.status === 'done' && t.champion?.uid === me?.uid)
  const stages = t.status === 'open' ? [1, 2, 3] : Array.from({ length: t.stages }, (_, i) => i + 1)

  async function act(fn: () => Promise<unknown>, ok = '') {
    setBusy(true); setMsg(null)
    try { await fn(); await Promise.all([refresh(), reload()]); if (ok) setMsg({ ok: true, text: ok }) }
    catch (x) { setMsg({ ok: false, text: (x as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <div className="cpl-page">
      <div className="ef-head">
        {t.logoId ? <img src={driveImg(t.logoId, 300)} alt={`${t.name} logo`} /> : <span className="ef-logo-ph"><Trophy size={34} /></span>}
        <div>
          <h2>{t.name}</h2>
          <p>{t.status === 'open' ? 'Registration open' : t.status === 'running' ? `${stageName(t.round, t.stages)} in progress` : 'Finished'} · {fmtDay(t.windows[0][0])}</p>
        </div>
      </div>

      {t.status === 'done' && t.champion && (
        <div className="cpl-card"><h3><Crown size={16} /> Champion</h3><div className="ef-members"><Member m={t.champion} win /></div></div>
      )}

      {t.status === 'open' && (
        <section className="cpl-card">
          <h3>Join this tournament</h3>
          <div className="ef-bar" aria-hidden><i style={{ width: `${Math.min(100, (t.count / t.cap) * 100)}%` }} /></div>
          <p className="cpl-sub" style={{ margin: '0 0 14px' }}>{t.count} of {t.cap} players joined · closes {fmtStamp(t.regClose)}{left && ` (${left} left)`}</p>
          {!signedIn ? <GoogleSignInButton onClick={onSignIn} label="Sign in to join" />
            : !me ? <p className="cpl-empty">Loading your account…</p>
            : !profile ? <a className="lp-btn" href="#/efootball/profile">Register as a player first</a>
            : joined ? (
              <>
                <p className="cpl-msg">You are in. Your pool is announced when registration closes{left ? '' : ' (any moment now)'}.</p>
                <div className="ef-actions"><button className="lp-btn cpl-danger" disabled={busy} onClick={() => act(() => ef('leaveTournament', { tid: t.id }))}>Leave tournament</button></div>
              </>
            ) : (
              <>
                {t.rules && <label className="cpl-file"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> I have read and accept the rules below</label>}
                <div className="ef-actions"><button className="lp-btn" disabled={busy || (!!t.rules && !accept)} onClick={() => act(() => ef('joinTournament', { tid: t.id }), 'You have joined.')}>{busy ? 'Joining…' : 'Join tournament'}</button></div>
              </>
            )}
          {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
        </section>
      )}

      {t.status !== 'open' && signedIn && me && (
        current ? <MyPool t={t} pool={current} me={me} act={act} busy={busy} msg={msg} />
          : eliminated ? <section className="cpl-card"><h3>Your tournament</h3><p className="cpl-msg">You are out of this tournament. Thanks for playing; join the next one on Monday.</p></section>
          : t.status === 'running' ? <section className="cpl-card"><h3>Your tournament</h3><p className="cpl-empty" style={{ textAlign: 'left' }}>You did not join this tournament, but you can follow it below.</p></section>
          : null
      )}

      <section className="cpl-card">
        <h3>Schedule</h3>
        <ul className="ef-steps">
          <li><span>Registration closes</span><strong>{fmtStamp(t.regClose)}</strong></li>
          {stages.map((s) => {
            const w = t.status === 'open' ? t.windows[s - 1] : stageWindow(t, s)
            const label = t.status === 'open' ? (s === 3 ? 'Final' : `Round ${s}`) : stageName(s, t.stages)
            return <li key={s} className={t.status === 'running' && s === t.round ? 'now' : ''}><span>{label}</span><strong>{fmtTime(w[0])} to {fmtTime(w[1])}</strong></li>
          })}
        </ul>
        <p className="cpl-note" style={{ textAlign: 'left' }}>Pools of 8 play an in-game knockout. The pool host reports the winner, and winners go on to the next round.</p>
      </section>

      <section className="cpl-card">
        <h3>Invite link</h3>
        <div className="ef-copy"><span style={{ flex: 1 }}>{link}</span><button className="lp-btn" onClick={() => { void navigator.clipboard?.writeText(link); setMsg({ ok: true, text: 'Link copied.' }) }}><Copy size={14} /> Copy</button></div>
      </section>

      {t.rules && <section className="cpl-card"><h3>Rules</h3><div className="ef-rules">{t.rules}</div></section>}

      {t.pools.length > 0 && <Bracket t={t} />}
      <Champions list={champs} />
    </div>
  )
}

function Member({ m, win, tag }: { m: { username: string; strength: number; platform: string; course: string; squadId: string }; win?: boolean; tag?: string }) {
  return (
    <div className={`ef-member${win ? ' win' : ''}`}>
      {m.squadId ? <img src={driveImg(m.squadId, 120)} alt="" loading="lazy" /> : <img alt="" />}
      <div><strong>{m.username}</strong><small>{m.platform} · {m.strength}</small>{tag && <span className="ef-pill">{tag}</span>}</div>
    </div>
  )
}

type Act = (fn: () => Promise<unknown>, ok?: string) => Promise<void>

function MyPool({ t, pool, me, act, busy, msg }: { t: Tournament; pool: Pool; me: Me; act: Act; busy: boolean; msg: { ok: boolean; text: string } | null }) {
  const [contacts, setContacts] = useState<{ uid: string; username: string; whatsapp: string }[] | null>(null)
  const [winner, setWinner] = useState(pool.winnerUid)
  const [proof, setProof] = useState('')
  const [reason, setReason] = useState('')
  const w = stageWindow(t, pool.stage)
  const isHost = pool.hostUid === me.uid || pool.backupUid === me.uid
  const host = pool.members.find((m) => m.uid === pool.hostUid)
  const winnerM = pool.members.find((m) => m.uid === pool.winnerUid)
  const canConfirm = pool.status === 'reported' && me.uid !== pool.reportedBy && (pool.winnerUid === pool.reportedBy || me.uid === pool.winnerUid)

  return (
    <section className="cpl-card">
      <h3>Your pool: {stageName(pool.stage, t.stages)}, pool {pool.idx + 1}</h3>
      <p className="cpl-sub" style={{ margin: '0 0 6px' }}>Plays {fmtTime(w[0])} to {fmtTime(w[1])}. Host: <strong>{host?.username}</strong>{pool.hostUid === me.uid ? ' (you)' : ''}.</p>
      <div className="ef-members">
        {pool.members.map((m) => <Member key={m.uid} m={m} win={m.uid === pool.winnerUid && pool.status === 'locked'} tag={m.uid === pool.hostUid ? 'Host' : m.uid === pool.backupUid ? 'Backup host' : m.uid === me.uid ? 'You' : undefined} />)}
      </div>
      <div className="ef-actions">
        {contacts
          ? contacts.filter((c) => c.uid !== me.uid).map((c) => <a key={c.uid} className="cpl-link" href={waLink(c.whatsapp, 'Hi, we are in the same Chuka eFootball pool.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> {c.username}</a>)
          : <button className="cpl-link" onClick={() => act(async () => setContacts(await ef('poolContacts', { poolId: pool.id })))}><MessageCircle size={15} /> Show WhatsApp contacts</button>}
      </div>

      {pool.hostUid === me.uid && pool.status === 'waiting' && <p className="cpl-msg" style={{ marginTop: 14 }}>You are the host: create the in-game tournament room, invite everyone by username, then report the winner below.</p>}

      {isHost && (pool.status === 'waiting' || pool.status === 'reported') && (
        <div className="cpl-form" style={{ marginTop: 14 }}>
          <label>Winner of the pool
            <select value={winner} onChange={(e) => setWinner(e.target.value)}>
              <option value="">Choose the winner</option>
              {pool.members.map((m) => <option key={m.uid} value={m.uid}>{m.username}</option>)}
            </select>
          </label>
          <ImagePicker current={driveImg(pool.proofId, 400)} fallback={<Trophy size={24} />} label="final screenshot" max={1280} onChange={(v) => setProof(v.data)} />
          <button className="lp-btn" disabled={busy || !winner} onClick={() => act(() => ef('reportWinner', { poolId: pool.id, winnerUid: winner, proof: proof || undefined }), 'Winner reported.')}>{pool.status === 'reported' ? 'Update report' : 'Report winner'}</button>
        </div>
      )}

      {pool.status === 'reported' && (
        <div style={{ marginTop: 14 }}>
          <p className="cpl-msg">Reported winner: <strong>{winnerM?.username}</strong>. It locks if nobody disputes within 10 minutes{pool.winnerUid === pool.reportedBy ? ', and another player in the pool must confirm it' : ''}.</p>
          {pool.proofId && <a href={driveImg(pool.proofId, 1200)} target="_blank" rel="noopener noreferrer">View the screenshot</a>}
          <div className="ef-actions">
            {canConfirm && <button className="lp-btn" disabled={busy} onClick={() => act(() => ef('confirmWinner', { poolId: pool.id }), 'Confirmed.')}>Confirm result</button>}
            {me.uid !== pool.reportedBy && (
              <>
                <input className="ef-sel" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this wrong?" maxLength={200} aria-label="Dispute reason" />
                <button className="lp-btn cpl-danger" disabled={busy} onClick={() => act(() => ef('disputeWinner', { poolId: pool.id, reason }), 'Dispute sent to the admin.')}>Dispute</button>
              </>
            )}
          </div>
        </div>
      )}
      {pool.status === 'disputed' && <p className="cpl-msg bad" style={{ marginTop: 14 }}>This result is disputed. The admin will decide.</p>}
      {pool.status === 'locked' && <p className="cpl-msg" style={{ marginTop: 14 }}>Result confirmed: <strong>{winnerM?.username}</strong> {t.status === 'done' || pool.stage === t.stages ? 'wins the tournament.' : 'goes through to the next round.'}</p>}
      {msg && <p className={`cpl-msg${msg.ok ? '' : ' bad'}`} role="status" style={{ marginTop: 10 }}>{msg.text}</p>}
    </section>
  )
}

function Bracket({ t }: { t: Tournament }) {
  const byStage = new Map<number, Pool[]>()
  t.pools.forEach((p) => byStage.set(p.stage, [...(byStage.get(p.stage) ?? []), p]))
  const stages = [...byStage.keys()].sort((a, b) => b - a)
  return (
    <section className="cpl-card">
      <h3>All pools</h3>
      {stages.map((s) => {
        const pools = byStage.get(s) ?? []
        const done = pools.filter((p) => p.status === 'locked').length
        return (
          <details key={s} open={s === t.round}>
            <summary><strong>{stageName(s, t.stages)}</strong> · {pools.length} pool{pools.length === 1 ? '' : 's'} · {done} finished</summary>
            {pools.map((p) => {
              const win = p.members.find((m) => m.uid === p.winnerUid)
              const host = p.members.find((m) => m.uid === p.hostUid)
              return (
                <div className="cpl-row" key={p.id}>
                  <div><strong>Pool {p.idx + 1}</strong><small>Host {host?.username ?? '?'} · {p.members.map((m) => m.username).join(', ')}</small></div>
                  {p.status === 'locked' && win ? <span className="ef-pill gold">{win.username}</span> : <span className={`ef-pill${p.status === 'disputed' ? ' red' : ''}`}>{p.status}</span>}
                </div>
              )
            })}
          </details>
        )
      })}
    </section>
  )
}

function Champions({ list }: { list: Champion[] }) {
  if (!list.length) return null
  return (
    <section className="cpl-card">
      <h3><Crown size={16} /> Champions</h3>
      {list.map((c, i) => (
        <div className="cpl-row" key={i}><div><strong>{c.username}</strong><small>{c.course}</small></div><span className="ef-pill gold">{c.name}</span></div>
      ))}
    </section>
  )
}
