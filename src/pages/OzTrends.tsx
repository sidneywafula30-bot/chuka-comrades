import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ExternalLink, MessageCircle, Play, Plus, Volume2, VolumeX, X } from 'lucide-react'
import { oz, waShare, type TrendItem, type TrendList } from '../lib/ozone'
import { Err, Gate, ShareButton, type OzCtx } from './OzCommon'
import './OzTrends.css'

const siteName = (t: TrendItem) => (t.source === 'telegram' ? 'Telegram' : t.source === 'tiktok' ? 'TikTok' : 'YouTube')

/** Official embed players. Only the one video the person tapped is ever loaded. */
function embedSrc(t: TrendItem) {
  return t.source === 'telegram' ? '' : t.source === 'tiktok'
    ? `https://www.tiktok.com/player/v1/${encodeURIComponent(t.videoId)}?autoplay=1&loop=0`
    : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.videoId)}?autoplay=1&rel=0&playsinline=1`
}

function ago(iso: string) {
  const t = Date.parse(iso)
  if (!t) return ''
  const d = Math.max(0, (Date.now() - t) / 1000)
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Card({ t, playing, onPlay, onStop }: { t: TrendItem; playing: boolean; onPlay: () => void; onStop: () => void }) {
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLElement>(null)
  // Stop the video once the card has scrolled out of view.
  useEffect(() => {
    if (!playing || !ref.current) return
    const io = new IntersectionObserver(([e]) => { if (e.intersectionRatio < 0.2) onStop() }, { threshold: [0, 0.2] })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [playing, onStop])
  const when = ago(t.createdAt)
  return (
    <article className={`tr-card${t.live ? ' live' : ''}`} ref={ref}>
      <div className="tr-media">
        <div className={`tr-stage${t.vertical ? ' v' : ''}`}>
          {playing && t.source === 'telegram' ? (
            <a className="tr-thumb" href={t.url} target="_blank" rel="noopener noreferrer" aria-label="Open video on Telegram"><span className="tr-fallback">Open video on Telegram</span><span className="tr-play"><ExternalLink size={24} /></span></a>
          ) : playing ? (
            <iframe title={t.title} src={embedSrc(t)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <button type="button" className="tr-thumb" onClick={onPlay} aria-label={`Play: ${t.title}`}>
              {t.thumb && !bad
                ? <img src={t.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
                : <span className="tr-fallback">{siteName(t)}</span>}
              <span className="tr-shade" />
              <span className="tr-play"><Play size={28} fill="currentColor" /></span>
              {t.live ? <span className="tr-badge live">● LIVE</span> : t.pinned ? <span className="tr-badge pin">Pinned</span> : null}
              <span className="tr-src">{siteName(t)}</span>
            </button>
          )}
        </div>
      </div>
      <div className="tr-meta">
        <strong>{t.title}</strong>
        <div className="tr-row">
          <small>{t.author}{when && ` · ${when}`}</small>
          <span className="tr-acts">
            <ShareButton text={`${t.title} (on Chuka Trends)`} url={t.url} />
            <a className="tr-open" href={t.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {siteName(t)}</a>
          </span>
        </div>
      </div>
    </article>
  )
}

function Suggest({ ctx }: { ctx: OzCtx }) {
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('')
    try { await oz('trend_submit', { url }); setUrl(''); setBad(false); setMsg('Thanks! The admin checks it before it appears.') }
    catch (x) { setBad(true); setMsg((x as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <Gate ctx={ctx} what="suggest a video">
      <form className="cpl-form oz-form" onSubmit={(e) => void submit(e)}>
        <label>YouTube or TikTok link<input type="url" inputMode="url" required maxLength={200} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@you/video/..." /></label>
        {msg && <p className={`cpl-msg${bad ? ' bad' : ''}`} role="status">{msg}</p>}
        <button className="lp-btn" disabled={busy || !url.trim()}>{busy ? 'Checking…' : 'Send for approval'}</button>
        <small>Only share videos you made or have permission to share.</small>
      </form>
    </Gate>
  )
}

/* ------------------------------------------------------------------ */
/* Shared data loading                                                 */
/* ------------------------------------------------------------------ */
function useTrendFeed() {
  const [items, setItems] = useState<TrendItem[]>([])
  const [live, setLive] = useState<TrendItem | null>(null)
  const [next, setNext] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async (offset: number) => {
    if (busyRef.current) return
    busyRef.current = true; setLoading(true)
    try {
      const r = await oz<TrendList>('trends_list', { offset })
      setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items.filter((n) => !prev.some((p) => p.key === n.key))]))
      if (offset === 0) setLive(r.live)
      setNext(r.next); setErr('')
    } catch (e) { setErr((e as Error).message); setNext(null) }
    finally { busyRef.current = false; setLoading(false) }
  }, [])
  useEffect(() => { void load(0) }, [load])

  const all = live ? [{ ...live, key: `live:${live.videoId}`, live: true }, ...items] : items
  return { all, next, loading, err, load }
}

function useIsPhone() {
  const q = '(max-width: 700px)'
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return m
}

/* ------------------------------------------------------------------ */
/* Phone: full-screen, swipe-up, autoplaying videos (TikTok style)     */
/* ------------------------------------------------------------------ */
type Cmd = 'play' | 'pause' | 'mute' | 'unMute'

function reelSrc(t: TrendItem, sound: boolean) {
  if (t.source === 'tiktok') {
    return `https://www.tiktok.com/player/v1/${encodeURIComponent(t.videoId)}?autoplay=1&loop=1&controls=0&play_button=0&progress_bar=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0`
  }
  const id = encodeURIComponent(t.videoId)
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${sound ? 0 : 1}&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`
}

/** Mounted only for the reel on screen, so only one video ever loads. */
function ReelPlayer({ t, sound }: { t: TrendItem; sound: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [src] = useState(() => reelSrc(t, sound))   // fixed for this mount: changing it would reload the video
  const [playing, setPlaying] = useState(true)

  const send = useCallback((cmd: Cmd) => {
    const w = frame.current?.contentWindow
    if (!w) return
    if (t.source === 'tiktok') w.postMessage({ type: cmd, 'x-tiktok-player': true }, '*')
    else w.postMessage(JSON.stringify({ event: 'command', func: { play: 'playVideo', pause: 'pauseVideo', mute: 'mute', unMute: 'unMute' }[cmd], args: [] }), '*')
  }, [t.source])

  // Keep our play/pause icon in step with what the player reports.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      let d: unknown = e.data
      if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return } }
      if (!d || typeof d !== 'object') return
      const o = d as Record<string, unknown>
      if (o['x-tiktok-player'] && o.type === 'onStateChange') setPlaying(o.value === 1 || o.value === 3)
      else if (o.event === 'onStateChange' && typeof o.info === 'number') setPlaying(o.info === 1 || o.info === 3)
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [])

  useEffect(() => { send(sound ? 'unMute' : 'mute') }, [sound, send])
  const onLoad = () => {
    if (t.source === 'youtube') frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
    send(sound ? 'unMute' : 'mute')
  }
  const toggle = () => { send(playing ? 'pause' : 'play'); setPlaying(!playing) }

  return (
    <>
      <iframe ref={frame} className="tt-frame" title={t.title} src={src} onLoad={onLoad} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
      {/* Transparent layer: swipes scroll the feed, a tap pauses or plays. */}
      <button type="button" className="tt-tap" onClick={toggle} aria-label={playing ? 'Pause video' : 'Play video'}>
        {!playing && <span className="tt-paused"><Play size={44} fill="currentColor" /></span>}
      </button>
    </>
  )
}

function Reel({ t, active, sound, onSound }: { t: TrendItem; active: boolean; sound: boolean; onSound: () => void }) {
  const [bad, setBad] = useState(false)
  const note = `${t.title} (Chuka Trends)`
  return (
    <section className="tt-item" data-k={t.key}>
      {t.thumb && !bad && <div className="tt-bg" style={{ backgroundImage: `url("${t.thumb}")` }} />}
      <div className={`tt-stage${t.vertical ? ' v' : ''}`}>
        {active && t.source === 'telegram' ? (
          <a className="tt-poster" href={t.url} target="_blank" rel="noopener noreferrer"><span>Open video on Telegram</span><span className="tt-spin" style={{ display: 'none' }} /></a>
        ) : active ? <ReelPlayer t={t} sound={sound} /> : (
          <div className="tt-poster">
            {t.thumb && !bad ? <img src={t.thumb} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : <span>{siteName(t)}</span>}
            <span className="tt-spin" />
          </div>
        )}
      </div>
      <div className="tt-shade" />
      {t.live && <span className="tt-live">● LIVE</span>}
      <div className="tt-info">
        <b>{t.author ? (t.author.startsWith('@') ? t.author : `@${t.author}`) : siteName(t)}</b>
        <p>{t.title}</p>
      </div>
      <div className="tt-rail">
        {active && t.source !== 'telegram' && <button type="button" onClick={onSound} aria-label={sound ? 'Mute' : 'Turn sound on'}>{sound ? <Volume2 size={26} /> : <VolumeX size={26} />}<small>{sound ? 'Sound' : 'Muted'}</small></button>}
        <a className="wa" href={waShare(`${note}\n\n${t.url}`)} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><MessageCircle size={26} /><small>Share</small></a>
        <a href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`Open on ${siteName(t)}`}><ExternalLink size={24} /><small>{t.source === 'telegram' ? 'Watch' : siteName(t)}</small></a>
      </div>
    </section>
  )
}

function Reels({ ctx }: { ctx: OzCtx }) {
  const { all, next, loading, err, load } = useTrendFeed()
  const [active, setActive] = useState('')
  const [sound, setSound] = useState(false)
  const [adding, setAdding] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // The page itself must not scroll behind the full-screen feed.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // The reel that fills the screen is the one that plays.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive((e.target as HTMLElement).dataset.k || '')
    }, { root, threshold: [0.6] })
    root.querySelectorAll('[data-k]').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [all.length])

  // Load more when the viewer gets near the last reel.
  useEffect(() => {
    const el = endRef.current, root = scroller.current
    if (!el || !root || next === null) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void load(next) }, { root, rootMargin: '0px 0px 160% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [next, load, all.length])

  return (
    <div className="tt" ref={scroller}>
      <header className="tt-top">
        <a href="#/ozone" aria-label="Back to O-Zone"><ArrowLeft size={22} /></a>
        <b>Chuka Trends</b>
        <button type="button" onClick={() => setAdding(true)}><Plus size={16} /> Suggest</button>
      </header>
      {all.map((t) => <Reel key={t.key} t={t} active={active === t.key} sound={sound} onSound={() => setSound((s) => !s)} />)}
      {loading && !all.length && <section className="tt-item tt-msg"><span className="tt-spin big" /></section>}
      {!loading && !err && !all.length && <section className="tt-item tt-msg"><p>No videos yet. Check back soon.</p></section>}
      {err && <section className="tt-item tt-msg"><p>{err}</p><button type="button" onClick={() => void load(0)}>Try again</button></section>}
      <div ref={endRef} aria-hidden="true" style={{ height: 1 }} />
      {all.length > 0 && !sound && active === all[0]?.key && <div className="tt-hint">Tap 🔇 for sound · swipe up for more</div>}
      {adding && (
        <div className="tt-sheet" role="dialog" aria-label="Suggest a video">
          <div className="tt-sheet-card">
            <button type="button" className="tt-sheet-x" onClick={() => setAdding(false)} aria-label="Close"><X size={20} /></button>
            <h3>Suggest a video</h3>
            <Suggest ctx={ctx} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Desktop / tablet: the original card feed                            */
/* ------------------------------------------------------------------ */
function CardFeed({ ctx }: { ctx: OzCtx }) {
  const { all, next, loading, err, load } = useTrendFeed()
  const [playing, setPlaying] = useState('')
  const [adding, setAdding] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  // Load the next batch when the end of the list comes near.
  useEffect(() => {
    const el = endRef.current
    if (!el || next === null) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void load(next) }, { rootMargin: '700px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [next, load, all.length])

  const stop = useCallback(() => setPlaying(''), [])

  return (
    <div className="oz-wrap">
      <div className="oz-title">
        <div>
          <h2>Chuka Trends</h2>
          <p className="cpl-sub">Tap a video to play it.{ctx.cfg?.youtubeUrl && <> <a className="cpl-link" href={ctx.cfg.youtubeUrl} target="_blank" rel="noopener noreferrer">Subscribe on YouTube</a></>}</p>
        </div>
        <button type="button" className="lp-btn lp-btn-soft" onClick={() => setAdding(!adding)}><Plus size={14} /> Suggest a video</button>
      </div>
      {adding && <Suggest ctx={ctx} />}
      <Err msg={err} />
      {!loading && !err && !all.length && <p className="cpl-empty">No videos yet. Check back soon.</p>}
      <div className="tr-feed">
        {all.map((t) => <Card key={t.key} t={t} playing={playing === t.key} onPlay={() => setPlaying(t.key)} onStop={stop} />)}
        {loading && !all.length && [0, 1].map((i) => <div className="tr-card tr-skel" key={i}><div className="tr-media"><div className="tr-stage" /></div><div className="tr-meta"><span /><span /></div></div>)}
        <div ref={endRef} aria-hidden="true" />
      </div>
    </div>
  )
}

export default function Trends({ ctx }: { ctx: OzCtx }) {
  const phone = useIsPhone()
  return phone ? <Reels ctx={ctx} /> : <CardFeed ctx={ctx} />
}
