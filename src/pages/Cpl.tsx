import { useEffect, useState, type FormEvent } from 'react'
import type { User } from 'firebase/auth'
import { ArrowLeft, ArrowRightLeft, BarChart3, CalendarDays, ClipboardCheck, ExternalLink, Globe, MessageCircle, Phone, Play, Search, Shield, ShieldCheck, UserRound, X } from 'lucide-react'
import { cpl, cplReady, type Category, type Highlight, type Me, type Profile, type SearchResult, type Fixture, type Season, type Venue } from '../lib/cpl'
import CplLive from './CplLive'
import CplProfile from './CplProfile'
import CplDashboard from './CplDashboard'
import CplSeasons from './CplSeasons'
import CplMyTeam from './CplMyTeam'
import CplPlayerProfile from './CplPlayerProfile'
import CplVenues from './CplVenues'
import CplReferees from './CplReferees'
import CplMatches from './CplMatches'
import CplTransfers from './CplTransfers'
import CplPlayerDashboard from './CplPlayerDashboard'
import CplStatsApproval from './CplStatsApproval'
import VenueCard from '../components/VenueCard'
import SeasonCard from './CplSeasonCard'
import './Cpl.css'

const BASE = import.meta.env.BASE_URL
const CHAIR_PAGES = ['dashboard', 'manage-seasons', 'venues', 'referees', 'stats-approvals']
const STAFF_PAGES = ['profile', 'my-team', 'my-player', 'my-matches', 'my-stats', 'transfers'] // chairmen, coaches and players

export default function Cpl({ user, route }: { user: User | null; route: string }) {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(false)
  const [meErr, setMeErr] = useState('')
  const page = route.split('/')[2] || ''
  const isChair = me?.role === 'owner' || me?.role === 'chairman'
  const isCoach = (me?.teams?.length ?? 0) > 0
  const isPlayer = (me?.players?.length ?? 0) > 0
  const isReferee = !!me?.isReferee

  // Ask the server whether this signed-in email is a chairman.
  useEffect(() => {
    if (!user || !cplReady) { setMe(null); return }
    let live = true
    setChecking(true); setMeErr('')
    cpl<Me>('me')
      .then((m) => {
        if (!live) return
        setMe(m)
        if (m && !Array.isArray(m.teams)) setMeErr('The CPL server is out of date. In Apps Script use Deploy > Manage deployments > Edit > New version.')
      })
      .catch((e) => { if (live) { setMe(null); setMeErr((e as Error).message) } })
      .finally(() => live && setChecking(false))
    return () => { live = false }
  }, [user])

  let body
  if (page === 'public') body = <Public />
  else if (page === 'seasons') body = <SeasonsPublic />
  else if (CHAIR_PAGES.includes(page)) {
    if (!user) body = <Gate text="Sign in with your chairman Google account first." />
    else if (checking) body = <Gate text="Checking access…" />
    else if (!isChair || !me) body = <Gate text="This area is for CPL chairmen only." />
    else if (page === 'manage-seasons') body = <CplSeasons />
    else if (page === 'venues') body = <CplVenues />
    else if (page === 'referees') body = <CplReferees />
    else if (page === 'stats-approvals') body = <CplStatsApproval />
    else body = <CplDashboard me={me} />
  } else if (STAFF_PAGES.includes(page)) {
    if (!user) body = <Gate text="Sign in with your Google account first." />
    else if (checking) body = <Gate text="Checking access…" />
    else if (!me || !(isChair || isCoach || isPlayer || isReferee)) body = <Gate text="This area is for CPL chairmen, coaches, players and referees only." />
    else if (page === 'my-team') body = isCoach ? <CplMyTeam teams={me.teams} /> : <Gate text="You are not assigned as a coach of any team." />
    else if (page === 'my-player') body = isPlayer ? <CplPlayerProfile players={me.players} /> : <Gate text="You are not registered as a player on any team." />
    else if (page === 'my-stats') body = isPlayer ? <CplPlayerDashboard /> : <Gate text="You are not registered as a player on any team." />
    else if (page === 'transfers') body = (isChair || isCoach || isPlayer) ? <CplTransfers me={me} /> : <Gate text="Transfers are for chairmen, coaches and players." />
    else if (page === 'my-matches') body = isReferee ? <MatchesLoader /> : <Gate text="You are not on the CPL referee panel." />
    else if (!isChair && !isCoach) body = <CplPlayerProfile players={me.players} />
    else body = <CplProfile user={user} role={isChair ? 'Chairman' : 'Coach'} />
  } else body = <Home isChair={isChair} isCoach={isCoach} isPlayer={isPlayer} isReferee={isReferee} signedIn={!!user} checking={checking} meErr={meErr} email={user?.email ?? ''} />

  return (
    <div className="cpl">
      <header className="cpl-top">
        <a className="cpl-back" href={page ? '#/cpl' : '#services'}>
          <ArrowLeft size={16} /> {page ? 'CPL home' : 'Student services'}
        </a>
        <img src={`${BASE}chukalogo.png`} alt="" height={34} />
      </header>
      <main className="cpl-main">{body}</main>
    </div>
  )
}

function Gate({ text }: { text: string }) {
  return (
    <div className="cpl-home">
      <p className="cpl-empty">{text}</p>
      <div className="cpl-links"><a className="cpl-link" href="#/cpl/public"><Globe size={16} /> Public page</a></div>
    </div>
  )
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'highlights', label: 'Highlights' }, { id: 'goals', label: 'Goals' },
  { id: 'skills', label: 'Skills' }, { id: 'shorts', label: 'Shorts' }, { id: 'news', label: 'News' },
]

function Home({ isChair, isCoach, isPlayer, isReferee, signedIn, checking, meErr, email }: { isChair: boolean; isCoach: boolean; isPlayer: boolean; isReferee: boolean; signedIn: boolean; checking: boolean; meErr: string; email: string }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category>('highlights')
  const [res, setRes] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try { setRes(await cpl<SearchResult>('searchHighlights', { q, category: cat })) }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="cpl-home">
      <div className="cpl-logo">
        <img
          src={`${BASE}cpl%20logo.jfif`}
          alt="Chuka Premier League logo"
          onError={(e) => { const i = e.currentTarget; if (!i.src.endsWith('cpl-logo.svg')) i.src = `${BASE}cpl-logo.svg` }}
        />
      </div>
      <h1>Chuka Premier League</h1>
      <p>Campus football, all season long.</p>

      <nav className="cpl-links" aria-label="CPL links">
        {isCoach && <a className="cpl-link" href="#/cpl/my-team"><Shield size={16} /> My team</a>}
        {isReferee && <a className="cpl-link" href="#/cpl/my-matches"><ClipboardCheck size={16} /> My matches</a>}
        {isPlayer && <a className="cpl-link" href="#/cpl/my-stats"><BarChart3 size={16} /> Player dashboard</a>}
        {isPlayer && <a className="cpl-link" href="#/cpl/my-player"><UserRound size={16} /> My player profile</a>}
        {(isChair || isCoach || isPlayer) && <a className="cpl-link" href="#/cpl/transfers"><ArrowRightLeft size={16} /> Transfers</a>}
        {(isChair || isCoach) && <a className="cpl-link" href="#/cpl/profile"><UserRound size={16} /> My profile</a>}
        {isChair && <a className="cpl-link" href="#/cpl/dashboard"><ShieldCheck size={16} /> Chairman dashboard</a>}
        <a className="cpl-link" href="#/cpl/seasons"><CalendarDays size={16} /> Seasons</a>
        <a className="cpl-link" href="#/cpl/public"><Globe size={16} /> Public page</a>
      </nav>
      {!signedIn && <p className="cpl-note">Sign in with Google to see your profile, team and dashboard links if you are a CPL chairman or team coach.</p>}
      {signedIn && checking && <p className="cpl-note">Checking your access…</p>}
      {signedIn && !checking && meErr && <p className="cpl-err" role="alert">Could not check your access: {meErr}</p>}
      {signedIn && !checking && !meErr && !isChair && !isCoach && !isPlayer && !isReferee && <p className="cpl-note">{email} is not a chairman, coach, player or referee. Ask your coach or the chairman to add this exact email.</p>}

      <form className="cpl-searchbox" onSubmit={submit} role="search">
        <div className="cpl-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos, e.g. “derby goals”" aria-label="Search videos" maxLength={100} />
          <button className="lp-btn" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
        </div>
        <div className="cpl-chips" role="group" aria-label="Video type">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
          ))}
        </div>
      </form>
      {err && <p className="cpl-err" role="alert">{err}</p>}

      {/* Videos appear straight under the search bar */}
      {busy && <div className="cpl-results"><div className="cpl-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="cpl-video cpl-skel" aria-hidden><div className="cpl-thumb" /><i /><i /></div>)}</div></div>}
      {res && !busy && (
        <div className="cpl-results">
          {res.warning && <p className="cpl-err" role="alert">{res.warning}</p>}
          {res.videos.length > 0 && (
            <div className="cpl-results-head">
              <h2>{q.trim() ? <>Results for “{q.trim()}”</> : CATEGORIES.find((c) => c.id === cat)?.label}</h2>
              <span>{res.videos.length} videos</span>
            </div>
          )}
          <Videos items={res.videos} />
        </div>
      )}

      {/* EPL fixtures (FPL API) + Chuka weather (Open-Meteo) */}
      <CplLive />

    </div>
  )
}

/** Result grid plus an in-page YouTube player (privacy-enhanced embed). */
function Videos({ items }: { items: Highlight[] }) {
  const [playing, setPlaying] = useState<Highlight | null>(null)
  useEffect(() => {
    if (playing) document.getElementById('cpl-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [playing])
  if (!items.length) return <p className="cpl-empty">No embeddable videos found. Try another search.</p>
  const date = (d: string) => (d && !isNaN(Date.parse(d)) ? new Date(d).toLocaleDateString() : '')
  return (
    <>
      {playing && (
        <section className="cpl-player" id="cpl-player" aria-label="Video player">
          <div className="cpl-player-head">
            <strong>{playing.title}</strong>
            <button type="button" onClick={() => setPlaying(null)} aria-label="Close player"><X size={18} /></button>
          </div>
          <iframe
            key={playing.videoId}
            title={playing.title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.videoId)}?rel=0&autoplay=1`}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <a href={`https://www.youtube.com/watch?v=${playing.videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={13} /></a>
        </section>
      )}
      <div className="cpl-grid">
        {items.map((h) => (
          <article key={h.videoId} className="cpl-video">
            <button type="button" className="cpl-thumb" onClick={() => setPlaying(h)} aria-label={`Play ${h.title}`}>
              {h.thumb && <img src={h.thumb} alt="" loading="lazy" />}
              <span className="cpl-play"><Play size={20} fill="currentColor" /></span>
              {h.cpl && <span className="cpl-tag">CPL</span>}
            </button>
            <strong>{h.title}</strong>
            <small>{[h.channelTitle, date(h.publishedAt)].filter(Boolean).join(' · ')}</small>
          </article>
        ))}
      </div>
    </>
  )
}

/** Public, read-only list of seasons (no create/edit here; chairmen do that from their dashboard). */
function SeasonsPublic() {
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    cpl<Season[]>('seasonsList').then(setSeasons).catch((e) => setErr(e.message))
  }, [])
  return (
    <div className="cpl-page">
      <h2>Seasons</h2>
      <p className="cpl-sub">Dates, transfer windows, rules and fixtures.</p>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {!seasons && !err && <p className="cpl-empty">Loading…</p>}
      {seasons?.length === 0 && <p className="cpl-empty">No seasons have been added yet.</p>}
      {seasons?.map((s) => <SeasonCard key={s.id} s={s} />)}
    </div>
  )
}

function MatchesLoader() {
  const [fx, setFx] = useState<Fixture[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { cpl<Fixture[]>('myFixtures').then(setFx).catch((e) => setErr(e.message)) }, [])
  if (err) return <Gate text={err} />
  if (!fx) return <Gate text="Loading your matches…" />
  return <CplMatches fixtures={fx} />
}

function PublicVenues() {
  const [v, setV] = useState<Venue[]>([])
  useEffect(() => { cpl<Venue[]>('venuesList').then(setV).catch(() => setV([])) }, [])
  if (!v.length) return null
  return (<><h3 className="cpl-h3">Venues</h3><div className="cpl-vn-grid">{v.map((x) => <VenueCard key={x.id} v={x} />)}</div></>)
}

type PublicData = { highlights: Highlight[]; chairman: Profile | null; seasons: Season[] }

function Public() {
  const [data, setData] = useState<PublicData | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    cpl<PublicData>('publicInfo').then(setData).catch((e) => setErr(e.message))
  }, [])
  const c = data?.chairman
  return (
    <div className="cpl-page">
      <h2>Chuka Premier League</h2>
      <p className="cpl-sub">Seasons, fixtures, highlights and who to talk to.</p>
      {err && <p className="cpl-err" role="alert">{err}</p>}
      {c && c.fullName && (
        <div className="cpl-card cpl-chairman cpl-chairman-pub">
          <div className="cpl-avatar-ring">{c.imageUrl ? <img src={c.imageUrl} alt={c.fullName} /> : <span className="ph"><UserRound size={34} /></span>}</div>
          <div className="cpl-chairman-info"><small className="cpl-eyebrow">CPL Chairman</small><strong>{c.fullName}</strong></div>
          <div className="cpl-chairman-actions">
            {c.whatsapp && <a className="lp-btn" href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>}
            {c.call && <a className="lp-btn lp-btn-soft" href={`tel:+${c.call}`}><Phone size={16} /> Call</a>}
          </div>
        </div>
      )}
      {data && data.seasons.length > 0 && <h3 className="cpl-h3">Seasons</h3>}
      {data?.seasons.map((s) => <SeasonCard key={s.id} s={s} />)}
      {data && <PublicVenues />}
      {data && data.highlights.length > 0 && <h3 className="cpl-h3">Latest highlights</h3>}
      {data && <Videos items={data.highlights} />}
      {!data && !err && <p className="cpl-empty">Loading…</p>}
    </div>
  )
}
