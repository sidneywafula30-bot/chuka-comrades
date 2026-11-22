import { useEffect, useMemo, useState } from 'react'
import { Gamepad2, MessageCircle, Search } from 'lucide-react'
import DriveImage from '../components/DriveImage'
import { DAYS, PARTS, PLATFORMS, ef, sharedSlots, slotsByDay, waDigits, waLink, type Me, type PublicPlayer } from '../lib/efootball'

const PAGE = 24

export default function EfPlayers({ me, signedIn }: { me: Me | null; signedIn: boolean }) {
  const [all, setAll] = useState<PublicPlayer[] | null>(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [league, setLeague] = useState('')
  const [platform, setPlatform] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [zoom, setZoom] = useState('')
  const myName = me?.profile?.username ?? ''
  const mySlots = me?.profile?.freeTimes ?? []
  const registered = !!me?.profile

  // Reload once we know who is signed in: the server only sends WhatsApp buttons to registered players.
  useEffect(() => { ef<PublicPlayer[]>('players').then(setAll).catch((e) => setErr((e as Error).message)) }, [me?.uid])

  const leagues = useMemo(() => [...new Set((all ?? []).map((p) => p.league).filter(Boolean))].sort(), [all])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (all ?? [])
      .filter((p) => (!s || p.username.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.league.toLowerCase().includes(s)) && (!league || p.league === league) && (!platform || p.platform === platform))
      .sort((a, b) => b.strength - a.strength)
  }, [all, q, league, platform])

  return (
    <div className="cpl-page">
      <h2>Registered players</h2>
      <p className="cpl-sub">{all ? `${all.length} players registered` : 'Loading…'}</p>
      {!registered && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>{signedIn ? 'Register as a player (free) and the WhatsApp Chat buttons on these cards open a chat.' : 'Sign in and register (free) and the WhatsApp Chat buttons on these cards open a chat.'}</p>}
      {registered && me?.profile && !me.profile.showWhatsapp && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>Your card has no WhatsApp button, so nobody can chat to you from here. <a href="#/efootball/profile">Turn it on in your profile</a>.</p>}
      {registered && <p className="cpl-note" style={{ textAlign: 'left', marginTop: 0 }}>The green Chat button opens WhatsApp with that player. Players who turned it off in their profile have no button.</p>}
      <div className="cpl-search" style={{ width: '100%', marginBottom: 12 }}>
        <Search size={18} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search username, name or league" aria-label="Search players" />
      </div>
      <div className="cpl-inline" style={{ marginBottom: 18 }}>
        <select className="ef-sel" value={league} onChange={(e) => { setLeague(e.target.value); setShown(PAGE) }} aria-label="Filter by league">
          <option value="">All leagues</option>{leagues.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="ef-sel" value={platform} onChange={(e) => { setPlatform(e.target.value); setShown(PAGE) }} aria-label="Filter by platform">
          <option value="">All platforms</option>{PLATFORMS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {all && !list.length && <p className="cpl-empty">No players match your search.</p>}
      <div className="ef-card-grid">
        {list.slice(0, shown).map((p) => {
          const shared = sharedSlots(mySlots, p.freeTimes)
          return (
            <article key={p.uid} className="ef-pcard">
              {p.squadId
                ? <button type="button" onClick={() => setZoom(p.squadId)} aria-label={`View ${p.username}'s squad`}><DriveImage id={p.squadId} w={400} fallback={<span className="ph"><Gamepad2 size={26} /></span>} /></button>
                : <span className="ph"><Gamepad2 size={26} /></span>}
              <div>
                <strong>{p.username}</strong>
                <small>{p.league || 'No league yet'}{p.year ? ` · year ${p.year}` : ''}</small>
                <small>{p.platform} · strength {p.strength}</small>
                <span className="ef-tags">
                  {p.canHost && <span className="ef-pill">Can host</span>}
                  {p.inLeague && <span className="ef-pill gold">In league</span>}
                  {p.fpl && <span className="ef-pill ef-badge-fpl">FPL</span>}
                </span>
                <FreeTimes free={p.freeTimes} mine={mySlots} />
                {shared.length > 0 && <small className="ef-shared">You are both free: {shared.slice(0, 3).join(', ')}</small>}
                {p.username !== myName && (p.whatsapp ? (
                  <a className="ef-wa" href={waLink(waDigits(p.whatsapp), `Hi ${p.username}, I saw you on Chuka eFootball. Want a friendly match${shared.length ? ` (${shared[0]}?)` : ''}?`)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={14} /> Chat on WhatsApp
                  </a>
                ) : p.chat ? (
                  <a className="ef-wa locked" href={signedIn ? '#/efootball/profile' : '#/efootball/players'} onClick={(e) => { if (!signedIn) { e.preventDefault(); alert('Sign in with Google on the main page, register as a player, then the WhatsApp chat opens.') } }}>
                    <MessageCircle size={14} /> {signedIn ? 'Register to chat on WhatsApp' : 'Sign in to chat on WhatsApp'}
                  </a>
                ) : null)}
              </div>
            </article>
          )
        })}
      </div>
      {list.length > shown && <div className="ef-actions"><button className="lp-btn" onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button></div>}
      {zoom && <div className="ef-zoom" onClick={() => setZoom('')} role="dialog" aria-label="Squad image"><DriveImage id={zoom} w={1200} alt="Squad" /></div>}
    </div>
  )
}

/** Compact 7 x 4 grid of free times. Slots shared with the viewer are highlighted. */
function FreeTimes({ free, mine }: { free: string[]; mine: string[] }) {
  if (!free.length) return <small>Free times: any day</small>
  const by = slotsByDay(free)
  const m = new Set(mine)
  return (
    <span className="ef-free" role="img" aria-label={`Free: ${DAYS.filter((d) => by[d]).map((d) => `${d} ${by[d].join(' ')}`).join(', ')}`}>
      <span className="ef-free-head"><i />{PARTS.map((x) => <b key={x}>{x[0]}</b>)}</span>
      {DAYS.map((d) => (
        <span className="ef-free-row" key={d}>
          <b>{d}</b>
          {PARTS.map((x) => { const k = `${d}-${x}`; const on = free.includes(k); return <i key={x} className={on ? (m.has(k) ? 'both' : 'on') : ''} /> })}
        </span>
      ))}
    </span>
  )
}
