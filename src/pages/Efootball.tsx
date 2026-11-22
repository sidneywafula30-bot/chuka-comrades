import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { signInWithPopup, type User } from 'firebase/auth'
import { ArrowLeft, Clock, Crown, ExternalLink, MessageCircle, Target, Play, Search, ShieldCheck, Swords, Trophy, UserRound, Users, X, Table2, Tag } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import { countdown, ef, efReady, fmtDay, fmtTime, type HomeData, type Me, type Video, type VideoCategory, type VideoResult } from '../lib/efootball'
import GoogleSignInButton from '../components/GoogleSignInButton'
import EfProfile from './EfProfile'
import EfPlayers from './EfPlayers'
import EfTournament from './EfTournament'
import EfLeague from './EfLeague'
import EfAdmin from './EfAdmin'
import EfFpl from './EfFpl'
import EfMarket from './EfMarket'
import { AdminFab } from '../components/EfPay'
import './Cpl.css'
import './Efootball.css'

const CATEGORIES: { id: VideoCategory; label: string }[] = [
  { id: 'highlights', label: 'Highlights' }, { id: 'goals', label: 'Goals' }, { id: 'skills', label: 'Skills' },
  { id: 'tips', label: 'Tips & tricks' }, { id: 'formations', label: 'Formations' }, { id: 'updates', label: 'Updates' },
]

export default function Efootball({ user, route }: { user: User | null; route: string }) {
  const [me, setMe] = useState<Me | null>(null)
  const [meErr, setMeErr] = useState('')
  const [busy, setBusy] = useState(false)
  const parts = route.split('/')
  const page = parts[2] || ''
  const arg = parts[3] || ''
  const arg2 = parts[4] || ''

  const reload = useCallback(async () => {
    if (!user || !efReady) { setMe(null); return }
    try { setMe(await ef<Me>('me')); setMeErr('') }
    catch (e) { setMeErr((e as Error).message) }
  }, [user])
  useEffect(() => { void reload() }, [reload])

  async function signIn() {
    if (!auth) return
    setBusy(true)
    try { await signInWithPopup(auth, googleProvider) } finally { setBusy(false) }
  }

  const needSignIn = (
    <div className="cpl-home">
      <p className="cpl-empty">Sign in with Google to continue.</p>
      <GoogleSignInButton onClick={signIn} disabled={busy} />
    </div>
  )

  let body
  if (!efReady) body = <p className="cpl-empty">The eFootball server is not connected yet. Add <code>VITE_EFOOTBALL_API_URL</code> to <code>.env</code> and restart.</p>
  else if (page === 'players') body = <EfPlayers me={me} signedIn={!!user} />
  else if (page === 'league') body = <EfLeague me={me} reload={reload} signedIn={!!user} onSignIn={signIn} sub={arg} arg={arg2} />
  else if (page === 'market') body = <EfMarket me={me} signedIn={!!user} onSignIn={signIn} />
  else if (page === 'fpl') body = <EfFpl me={me} signedIn={!!user} onSignIn={signIn} reload={reload} />
  else if (page === 'tournament' || page === 'join') body = <EfTournament token={page === 'join' ? arg : ''} me={me} signedIn={!!user} onSignIn={signIn} reload={reload} />
  else if (page === 'profile') body = !user ? needSignIn : <EfProfile me={me} reload={reload} error={meErr} />
  else if (page === 'admin') body = !user ? needSignIn : !me ? <p className="cpl-empty">Checking access…</p> : me.isAdmin ? <EfAdmin /> : <p className="cpl-empty">This area is for eFootball admins only.</p>
  else body = <Home me={me} signedIn={!!user} meErr={meErr} retry={reload} />

  return (
    <div className="cpl ef">
      <header className="cpl-top">
        <a className="cpl-back" href={page ? '#/efootball' : '#services'}><ArrowLeft size={16} /> {page ? 'eFootball home' : 'Student services'}</a>
        <img src={`${import.meta.env.BASE_URL}chukalogo.png`} alt="" height={34} />
      </header>
      <main className="cpl-main">{body}</main>
      <AdminFab page={page} />
    </div>
  )
}

function useTick() {
  const [, set] = useState(0)
  useEffect(() => { const i = setInterval(() => set((n) => n + 1), 1000); return () => clearInterval(i) }, [])
}

function pendingInvite() { try { return sessionStorage.getItem('ef-invite') || '' } catch { return '' } }

function Home({ me, signedIn, meErr, retry }: { me: Me | null; signedIn: boolean; meErr: string; retry: () => Promise<void> }) {
  const [h, setH] = useState<HomeData | null>(null)
  const [skew, setSkew] = useState(0)
  useEffect(() => { ef<HomeData>('home').then((r) => { setH(r); setSkew(r.serverNow - Date.now()) }).catch(() => {}) }, [])
  useTick()

  const t = h?.tournament ?? null
  const toStart = t && t.status !== 'done' ? countdown(t.start, skew) : ''
  const next = me?.matches.filter((m) => m.status === 'pending' || m.status === 'disputed').filter((m) => Date.parse(m.deadline) > Date.now() + skew).sort((a, b) => (a.deadline < b.deadline ? -1 : 1))[0]
  const p = me?.profile ?? null

  return (
    <div className="cpl-home">
      <header className="ef-hero">
        <img className="ef-hero-logo" src={`${import.meta.env.BASE_URL}efootball.png`} alt="Chuka eFootball logo" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <div className="ef-hero-text">
          <span className="ef-eyebrow">Chuka University</span>
          <h1>Chuka eFootball</h1>
          <p>A weekly knockout, closed leagues for your friends, hostel or class, and every eFootball player in Chuka{h ? ` · ${h.players} registered` : ''}.</p>
          <div className="ef-hero-cta">
            {!p ? <a className="lp-btn" href="#/efootball/profile">Register as a player</a> : !p.inLeague ? <a className="lp-btn" href="#/efootball/league">Find a league</a> : <a className="lp-btn" href="#/efootball/league">My league</a>}
            <a className="ef-ghost" href="#/efootball/tournament">Weekly knockout</a>
            {h?.waGroup && <a className="ef-wa-group" href={h.waGroup} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Join our WhatsApp group</a>}
          </div>
        </div>
      </header>

      <nav className="ef-tiles" aria-label="eFootball sections">
        <a href="#/efootball/tournament"><Trophy size={20} /><b>Knockout</b><small>Weekly, hosts earn</small></a>
        <a href="#/efootball/league"><Table2 size={20} /><b>Leagues</b><small>Start or join one</small></a>
        <a href="#/efootball/fpl"><Target size={20} /><b>FPL</b><small>EPL fixtures &amp; Chuka league</small></a>
        <a href="#/efootball/market"><Tag size={20} /><b>Marketplace</b><small>Buy &amp; sell accounts</small></a>
        <a href="#/efootball/players"><Users size={20} /><b>Players</b><small>Find a match</small></a>
        <a href="#/efootball/profile"><UserRound size={20} /><b>{me?.profile ? 'My profile' : 'Register'}</b><small>Free times, squad</small></a>
        {me?.isAdmin && <a href="#/efootball/admin"><ShieldCheck size={20} /><b>Admin</b><small>Manage</small></a>}
      </nav>

      {p && !p.inLeague && pendingInvite() && <a className="ef-resume" href={`#/efootball/league/join/${pendingInvite()}`}>You have an unfinished league invite. <b>Finish joining</b></a>}

      <div className="ef-dash">
        <section className="cpl-card ef-dcard">
          <h3><Swords size={15} /> {next ? 'Your next fixture' : p?.league ? p.league.name : 'Your league'}</h3>
          {next ? (
            <>
              <p className="ef-big">vs {next.opp.username}</p>
              <p className="ef-deadline"><Clock size={14} /> Report by {fmtTime(next.deadline)} · {countdown(next.deadline, skew)} left</p>
              <a className="lp-btn" href="#/efootball/league">Open fixture</a>
            </>
          ) : !signedIn ? <p className="cpl-sub" style={{ margin: 0 }}>Sign in with Google (top of the main page) to register and join the league.</p>
            : !me ? <p className="cpl-sub" style={{ margin: 0 }}>{meErr ? <>{meErr} <button type="button" className="cpl-link" onClick={() => void retry()}>Try again</button></> : 'Loading your account…'}</p>
            : !p ? <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>You are not registered yet.</p><a className="lp-btn" href="#/efootball/profile">Register</a></>
            : !p.inLeague ? <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>Join a league or start your own to get fixtures. Free for your first 3 matches.</p><a className="lp-btn" href="#/efootball/league">Find a league</a></>
            : p.paused ? <><p className="cpl-sub" style={{ margin: '0 0 12px' }}>You are paused after missed fixtures.</p><a className="lp-btn" href="#/efootball/league">Resume</a></>
            : <p className="cpl-sub" style={{ margin: 0 }}>{h?.league.fixtureToday ? 'No open fixture for you today. ' : ''}New fixtures come at 00:00 on {h?.league.fixtureDays.join(', ') ?? 'Mon, Wed, Fri, Sun'}.</p>}
        </section>

        <a className="cpl-card ef-dcard ef-dlink" href="#/efootball/tournament">
          <h3><Trophy size={15} /> Weekly knockout</h3>
          {t ? (
            <>
              <p className="ef-big">{t.name}</p>
              <p className="cpl-sub" style={{ margin: 0 }}>
                {t.status === 'open' ? `Registration open · ${t.count} joined` : t.status === 'running' ? `Live now: ${t.round === t.stages ? 'Final' : `Round ${t.round}`}` : t.champion ? `Champion: ${t.champion}` : 'Finished'}
              </p>
              {toStart && <p className="ef-deadline" style={{ marginTop: 8 }}><Clock size={14} /> Starts in {toStart}</p>}
            </>
          ) : <p className="cpl-sub" style={{ margin: 0 }}>No tournament yet. The next one is announced here.</p>}
        </a>

        <section className="cpl-card ef-dcard">
          <h3><Table2 size={15} /> Leagues</h3>
          {!h ? <p className="cpl-sub" style={{ margin: 0 }}>Loading…</p> : !h.topLeagues.length ? <p className="cpl-sub" style={{ margin: 0 }}>No public leagues yet. Start the first one.</p> : (
            <ol className="ef-mini">
              {h.topLeagues.map((l, i) => <li key={l.id}><b>{i + 1}</b><span><strong>{l.name}</strong><small>{l.members} {l.members === 1 ? 'member' : 'members'}</small></span><a className="cpl-link" href={`#/efootball/league/join/${l.code}`}>Join</a></li>)}
            </ol>
          )}
          {h && <p className="cpl-note" style={{ textAlign: 'left', margin: '10px 0 0' }}>{h.leagues} {h.leagues === 1 ? 'league' : 'leagues'} · {h.inLeague} players inside</p>}
          <div className="ef-actions" style={{ marginTop: 10 }}><a className="cpl-link" href="#/efootball/league">Browse leagues</a><a className="cpl-link" href="#/efootball/league/new">Start a league</a></div>
        </section>

        <a className="cpl-card ef-dcard ef-dlink" href="#/efootball/fpl">
          <h3><Target size={15} /> Fantasy Premier League</h3>
          {!h?.fpl?.configured ? <p className="cpl-sub" style={{ margin: 0 }}>EPL fixtures, results, live points and player stats. The Chuka campus league is coming soon.</p> : (
            <>
              {h.fpl.next && <p className="ef-big">{h.fpl.next.name}</p>}
              {h.fpl.next && <p className="ef-deadline"><Clock size={14} /> Deadline in {countdown(h.fpl.next.at, skew) || 'moments'}</p>}
              {h.fpl.top.length > 0 ? (
                <ol className="ef-mini">
                  {h.fpl.top.map((r, i) => <li key={r.username}><b>{i + 1}</b><span><strong>{r.username}</strong><small>{r.league}</small></span><em>{r.total}</em></li>)}
                </ol>
              ) : <p className="cpl-sub" style={{ margin: 0 }}>No managers linked yet. Be the first.</p>}
            </>
          )}
        </a>

        <section className="cpl-card ef-dcard">
          <h3><Crown size={15} /> Latest champion</h3>
          {h?.champion ? <><p className="ef-big">{h.champion.username}</p><p className="cpl-sub" style={{ margin: 0 }}>{h.champion.league}<br />{h.champion.name} · {fmtDay(h.champion.date)}</p></>
            : <p className="cpl-sub" style={{ margin: 0 }}>No champion yet. Win the first knockout.</p>}
        </section>
      </div>

      <Watch />

    </div>
  )
}

/** Videos. The category rows are saved by the server twice a day, so opening a row costs no YouTube quota; only typed searches do. */
function Watch() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<VideoCategory>('highlights')
  const [res, setRes] = useState<VideoResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load(category: VideoCategory, query: string) {
    setBusy(true); setErr('')
    try { setRes(query.trim() ? await ef<VideoResult>('searchVideos', { q: query, category }) : await ef<VideoResult>('featured', { category })) }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load('highlights', '') }, [])
  function submit(e: FormEvent) { e.preventDefault(); void load(cat, q) }

  return (
    <div className="ef-watch">
      <h2>Watch</h2>
      <form className="cpl-searchbox" onSubmit={submit} role="search">
        <div className="cpl-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search eFootball videos, e.g. “dribbling”" aria-label="Search videos" maxLength={80} />
          <button className="lp-btn" disabled={busy}>{busy ? 'Loading…' : 'Search'}</button>
        </div>
        <div className="cpl-chips" role="group" aria-label="Video type">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => { setCat(c.id); void load(c.id, q) }}>{c.label}</button>
          ))}
        </div>
      </form>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {res && (
        <div className="cpl-results">
          {res.warning && <p className="cpl-err" role="alert">{res.warning}</p>}
          <Videos items={res.videos} />
        </div>
      )}
    </div>
  )
}

function Videos({ items }: { items: Video[] }) {
  const [playing, setPlaying] = useState<Video | null>(null)
  if (!items.length) return <p className="cpl-empty">No videos found. Try another search.</p>
  return (
    <>
      {playing && (
        <section className="cpl-player" aria-label="Video player">
          <div className="cpl-player-head">
            <strong>{playing.title}</strong>
            <button type="button" onClick={() => setPlaying(null)} aria-label="Close player"><X size={18} /></button>
          </div>
          <iframe key={playing.videoId} title={playing.title} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.videoId)}?rel=0&autoplay=1`}
            referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen />
          <a href={`https://www.youtube.com/watch?v=${playing.videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={13} /></a>
        </section>
      )}
      <div className="cpl-grid">
        {items.map((h) => (
          <article key={h.videoId} className="cpl-video">
            <button type="button" className="cpl-thumb" onClick={() => setPlaying(h)} aria-label={`Play ${h.title}`}>
              {h.thumb && <img src={h.thumb} alt="" loading="lazy" />}
              <span className="cpl-play"><Play size={20} fill="currentColor" /></span>
            </button>
            <strong>{h.title}</strong>
            <small>{h.channelTitle}</small>
          </article>
        ))}
      </div>
    </>
  )
}
