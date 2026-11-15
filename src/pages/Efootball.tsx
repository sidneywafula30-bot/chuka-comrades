import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { signInWithPopup, type User } from 'firebase/auth'
import { ArrowLeft, ExternalLink, Play, Search, ShieldCheck, Swords, Trophy, UserRound, Users, X, Table2 } from 'lucide-react'
import { auth, googleProvider } from '../lib/firebase'
import { ef, efReady, fmtStamp, type Me, type Tournament, type Video, type VideoCategory, type VideoResult } from '../lib/efootball'
import GoogleSignInButton from '../components/GoogleSignInButton'
import EfProfile from './EfProfile'
import EfPlayers from './EfPlayers'
import EfTournament from './EfTournament'
import EfLeague from './EfLeague'
import EfAdmin from './EfAdmin'
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
  else if (page === 'players') body = <EfPlayers />
  else if (page === 'league') body = <EfLeague me={me} reload={reload} signedIn={!!user} />
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
    </div>
  )
}

function Home({ me, signedIn, meErr, retry }: { me: Me | null; signedIn: boolean; meErr: string; retry: () => Promise<void> }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<VideoCategory>('highlights')
  const [res, setRes] = useState<VideoResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [t, setT] = useState<Tournament | null>(null)

  useEffect(() => { ef<Tournament | null>('tournament').then(setT).catch(() => {}) }, [])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true); setErr('')
    try { setRes(await ef<VideoResult>('searchVideos', { q, category: cat })) }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="cpl-home">
      <div className="ef-mark">
        <img src={`${import.meta.env.BASE_URL}efootball.png`} alt="Chuka eFootball logo"
          onError={(e) => { const i = e.currentTarget; if (!i.src.endsWith('efootball-logo.svg')) i.src = `${import.meta.env.BASE_URL}efootball-logo.svg` }} />
      </div>
      <h1>Chuka eFootball</h1>
      <p>Weekly knockout, a campus league and every eFootball player in Chuka.</p>

      {t && (
        <a className="ef-banner" href="#/efootball/tournament">
          <Trophy size={20} />
          <span><strong>{t.name}</strong>
            <small>{t.status === 'open' ? `Registration open · ${t.count} joined · closes ${fmtStamp(t.regClose)}` : t.status === 'running' ? 'Live now: see your pool' : t.champion ? `Champion: ${t.champion.username}` : 'Finished'}</small>
          </span>
        </a>
      )}

      <form className="cpl-searchbox" onSubmit={submit} role="search">
        <div className="cpl-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search eFootball videos, e.g. “dribbling”" aria-label="Search videos" maxLength={80} />
          <button className="lp-btn" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
        </div>
        <div className="cpl-chips" role="group" aria-label="Video type">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
          ))}
        </div>
      </form>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {res && !busy && (
        <div className="cpl-results">
          {res.warning && <p className="cpl-err" role="alert">{res.warning}</p>}
          <Videos items={res.videos} />
        </div>
      )}

      <nav className="cpl-links" aria-label="eFootball links">
        <a className="cpl-link" href="#/efootball/tournament"><Trophy size={16} /> Weekly knockout</a>
        <a className="cpl-link" href="#/efootball/league"><Table2 size={16} /> League</a>
        <a className="cpl-link" href="#/efootball/players"><Users size={16} /> Players</a>
        <a className="cpl-link" href="#/efootball/profile"><UserRound size={16} /> {me?.profile ? 'My profile' : 'Register'}</a>
        {me?.isAdmin && <a className="cpl-link" href="#/efootball/admin"><ShieldCheck size={16} /> Admin</a>}
      </nav>
      {!signedIn && <p className="cpl-note">Sign in with Google (top of the home page) to register and play.</p>}
      {signedIn && !me && !meErr && <p className="cpl-note">Loading your account…</p>}
      {meErr && <p className="cpl-err" role="alert">{meErr} <button type="button" className="cpl-link" onClick={() => void retry()}>Try again</button></p>}
      {signedIn && me && !me.profile && <p className="cpl-note"><Swords size={13} /> You are not registered yet. Tap Register to join the league and tournaments.</p>}
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