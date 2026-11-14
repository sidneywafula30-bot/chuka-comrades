import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ExternalLink, Play, Plus } from 'lucide-react'
import { oz, type TrendItem, type TrendList } from '../lib/ozone'
import { Err, Gate, type OzCtx } from './OzCommon'

const siteName = (t: TrendItem) => (t.source === 'tiktok' ? 'TikTok' : 'YouTube')

/** Official embed players. Only the one video the person tapped is ever loaded. */
function embedSrc(t: TrendItem) {
  return t.source === 'tiktok'
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
          {playing ? (
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
          <a className="tr-open" href={t.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {siteName(t)}</a>
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

export default function Trends({ ctx }: { ctx: OzCtx }) {
  const [items, setItems] = useState<TrendItem[]>([])
  const [live, setLive] = useState<TrendItem | null>(null)
  const [next, setNext] = useState<number | null>(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState('')
  const [adding, setAdding] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
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

  // Load the next batch when the end of the list comes near.
  useEffect(() => {
    const el = endRef.current
    if (!el || next === null) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) void load(next) }, { rootMargin: '700px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [next, load, items.length])

  const stop = useCallback(() => setPlaying(''), [])
  const all = live ? [{ ...live, key: `live:${live.videoId}`, live: true }, ...items] : items

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
