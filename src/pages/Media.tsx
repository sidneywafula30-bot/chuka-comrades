import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ExternalLink, Film, Music2, Play, RefreshCw, Search, X } from 'lucide-react'
import {
  MOVIE_CATEGORIES, decodeHtml, fmtDuration, mediaApi, mediaReady,
  type AppleTrack, type AudiusTrack, type Movie, type MovieCategory,
} from '../lib/media'
import './Media.css'

const BASE = import.meta.env.BASE_URL
type Tab = 'music' | 'movies'

export default function Media() {
  const [tab, setTab] = useState<Tab>('music')
  return (
    <div className="mm">
      <header className="mm-top">
        <a className="mm-back" href="#services"><ArrowLeft size={16} /> Back</a>
        <span className="mm-brand">
          <img src={`${BASE}music-movies-logo.svg`} alt="" />
          <strong>Chuka Music &amp; Movies</strong>
        </span>
        <span className="mm-top-gap" />
      </header>

      <main className="mm-main">
        <section className="mm-hero">
          <span className="mm-kicker">ENTERTAINMENT FOR COMRADES</span>
          <h1>Listen. Watch. Unwind.</h1>
          <p>Stream free tracks, find songs you love, and watch movies and trailers, all in one place.</p>
          <div className="mm-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'music'} className={tab === 'music' ? 'on' : ''} onClick={() => setTab('music')}><Music2 size={16} /> Music</button>
            <button role="tab" aria-selected={tab === 'movies'} className={tab === 'movies' ? 'on' : ''} onClick={() => setTab('movies')}><Film size={16} /> Movies</button>
          </div>
        </section>

        {!mediaReady && (
          <div className="mm-note">
            Music &amp; Movies is not connected yet. Deploy the Music &amp; Movies Apps Script, then add its <code>/exec</code> link to <code>.env</code> as <code>VITE_MEDIA_API_URL</code> and restart.
          </div>
        )}

        {/* both stay mounted so switching tabs keeps results and the playing song */}
        <div hidden={tab !== 'music'}><MusicTab /></div>
        <div hidden={tab !== 'movies'}><MoviesTab active={tab === 'movies'} /></div>
      </main>
    </div>
  )
}

/* ------------------------------- Music ------------------------------- */

function MusicTab() {
  const [query, setQuery] = useState('')
  const [audius, setAudius] = useState<AudiusTrack[]>([])
  const [apple, setApple] = useState<AppleTrack[]>([])
  const [warn, setWarn] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('Trending this week')
  const [now, setNow] = useState<AudiusTrack | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const load = useCallback(async (q: string) => {
    if (!mediaReady) return
    setLoading(true); setError('')
    try {
      const r = await mediaApi.music(q)
      setAudius(r.audius); setApple(r.apple); setWarn(r.warnings.join(' '))
      setTitle(q.trim() ? `Results for “${q.trim()}”` : 'Trending this week')
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load('') }, [load])

  function submit(e: FormEvent) { e.preventDefault(); void load(query) }

  function play(t: AudiusTrack) {
    setNow(t)
    // set src + play inside the click so mobile browsers allow it
    const a = audioRef.current
    if (!a) return
    a.src = t.streamUrl
    void a.play().catch(() => { /* user can press play on the bar */ })
  }

  return (
    <section className="mm-panel">
      <form className="mm-search" onSubmit={submit}>
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={120} placeholder="Search songs, artists or genres" aria-label="Search music" />
        <button className="mm-btn" disabled={loading}>{loading ? <RefreshCw size={15} className="mm-spin" /> : 'Search'}</button>
      </form>

      {error && <div className="mm-error">{error}</div>}
      {warn && !error && <div className="mm-note">{warn}</div>}

      <h2 className="mm-h">{title}</h2>
      {loading && !audius.length ? <p className="mm-muted">Loading…</p> : audius.length === 0 && !error ? (
        <p className="mm-muted">No streamable tracks found. Try another search.</p>
      ) : (
        <div className="mm-grid">
          {audius.map((t) => (
            <article key={t.id} className={`mm-card${now?.id === t.id ? ' playing' : ''}`}>
              <button className="mm-art" onClick={() => play(t)} aria-label={`Play ${t.title}`}>
                {t.artwork ? <img src={t.artwork} alt="" loading="lazy" /> : <span className="mm-art-empty"><Music2 size={34} /></span>}
                <span className="mm-play"><Play size={20} fill="currentColor" /></span>
              </button>
              <div className="mm-card-body">
                <h3 title={t.title}>{t.title}</h3>
                <p>{t.artist}</p>
                <small>{[t.genre, fmtDuration(t.duration)].filter(Boolean).join(' · ')}</small>
                {t.pageUrl && <a className="mm-link" href={t.pageUrl} target="_blank" rel="noopener noreferrer">Open on Audius <ExternalLink size={12} /></a>}
              </div>
            </article>
          ))}
        </div>
      )}

      {apple.length > 0 && (
        <>
          <h2 className="mm-h">Also on Apple Music <small>(catalogue, opens in Apple Music)</small></h2>
          <div className="mm-grid">
            {apple.map((t) => (
              <article key={t.id} className="mm-card">
                <div className="mm-art static">
                  {t.artwork ? <img src={t.artwork} alt="" loading="lazy" /> : <span className="mm-art-empty"><Music2 size={34} /></span>}
                </div>
                <div className="mm-card-body">
                  <h3 title={t.title}>{t.title}</h3>
                  <p>{t.artist}</p>
                  <small>{[t.album, fmtDuration(t.duration)].filter(Boolean).join(' · ')}</small>
                  <a className="mm-link" href={t.storeUrl} target="_blank" rel="noopener noreferrer">Open in Apple Music <ExternalLink size={12} /></a>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className={`mm-bar${now ? ' show' : ''}`}>
        {now && (
          <div className="mm-bar-info">
            {now.artwork && <img src={now.artwork} alt="" />}
            <span><strong>{now.title}</strong><small>{now.artist}</small></span>
          </div>
        )}
        <audio ref={audioRef} controls preload="none" />
      </div>
    </section>
  )
}

/* ------------------------------- Movies ------------------------------- */

function MoviesTab({ active }: { active: boolean }) {
  const [category, setCategory] = useState<MovieCategory>('full')
  const [query, setQuery] = useState('')
  const [videos, setVideos] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [open, setOpen] = useState<Movie | null>(null)

  const load = useCallback(async (q: string, c: MovieCategory) => {
    if (!mediaReady) return
    setLoading(true); setError(''); setStarted(true)
    try { setVideos((await mediaApi.movies(q, c)).videos) }
    catch (e) { setError((e as Error).message); setVideos([]) }
    finally { setLoading(false) }
  }, [])

  // Load the first category the first time the Movies tab is shown (saves YouTube quota).
  useEffect(() => { if (active && !started) void load('', 'full') }, [active, started, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function pick(c: MovieCategory) { setCategory(c); void load(query, c) }
  function submit(e: FormEvent) { e.preventDefault(); void load(query, category) }

  return (
    <section className="mm-panel">
      <form className="mm-search" onSubmit={submit}>
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Search movies (e.g. comedy, action, Tinga Tinga)" aria-label="Search movies" />
        <button className="mm-btn" disabled={loading}>{loading ? <RefreshCw size={15} className="mm-spin" /> : 'Search'}</button>
      </form>

      <div className="mm-chips">
        {MOVIE_CATEGORIES.map((c) => (
          <button key={c.id} className={category === c.id ? 'on' : ''} onClick={() => pick(c.id)}>{c.label}</button>
        ))}
      </div>

      {error && <div className="mm-error">{error}</div>}

      {loading && !videos.length ? <p className="mm-muted">Loading…</p> : started && videos.length === 0 && !error ? (
        <p className="mm-muted">No movies found. Try another search or category.</p>
      ) : (
        <div className="mm-grid movies">
          {videos.map((v) => (
            <button key={v.videoId} className="mm-movie" onClick={() => setOpen(v)}>
              <span className="mm-thumb">
                {v.thumb && <img src={v.thumb} alt="" loading="lazy" />}
                <span className="mm-play big"><Play size={26} fill="currentColor" /></span>
              </span>
              <span className="mm-movie-body">
                <strong>{decodeHtml(v.title)}</strong>
                <small>{decodeHtml(v.channel)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mm-fine">Videos play from YouTube. Availability, ads and rights belong to YouTube and the owners.</p>

      {open && (
        <div className="mm-modal" role="dialog" aria-modal="true" aria-label={decodeHtml(open.title)} onClick={() => setOpen(null)}>
          <div className="mm-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="mm-close" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button>
            <div className="mm-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${open.videoId}?rel=0&autoplay=1`}
                title={decodeHtml(open.title)}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            <div className="mm-modal-info">
              <strong>{decodeHtml(open.title)}</strong>
              <a className="mm-link" href={open.watchUrl} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={12} /></a>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
