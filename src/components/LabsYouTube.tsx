import { useRef, useState, type FormEvent } from 'react'
import { ExternalLink, LoaderCircle, Play, Plus, Search, CirclePlay } from 'lucide-react'
import { labsApi, type YtVideo } from '../lib/labs'

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
const validId = (id: string) => /^[\w-]{11}$/.test(id)

/**
 * Search YouTube through the Study Labs server (the API key never reaches the browser).
 * Videos always play in place. With `onPick` each result also gets a button (used by the upload form
 * to fill in the link and title, and by the unit page to share a video with the class).
 */
export default function LabsYouTube({ initialQuery = '', onPick, pickLabel = 'Use this video', compact = false }: {
  initialQuery?: string; onPick?: (v: YtVideo) => void; pickLabel?: string; compact?: boolean
}) {
  const [q, setQ] = useState(initialQuery)
  const [list, setList] = useState<YtVideo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState('')
  const memo = useRef(new Map<string, YtVideo[]>()) // same search in one visit costs nothing

  async function run(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (term.length < 2) return setErr('Type at least 2 letters to search.')
    setErr(''); setPlaying('')
    const hit = memo.current.get(term.toLowerCase())
    if (hit) return setList(hit)
    setBusy(true)
    try {
      const r = await labsApi.ytSearch(term)
      memo.current.set(term.toLowerCase(), r); setList(r)
    } catch (ex) { setErr(ex instanceof Error ? ex.message : 'Search failed. Please try again.') } finally { setBusy(false) }
  }

  return (
    <div className={`sl-yt${compact ? ' compact' : ''}`}>
      <form className="sl-search" onSubmit={run}>
        <CirclePlay size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lectures, tutorials, revision…" maxLength={80} aria-label="Search YouTube" />
        <button className="sl-primary small" disabled={busy}>{busy ? <LoaderCircle className="sl-spin" size={15} /> : <><Search size={14} /> Search</>}</button>
      </form>
      {err && <p className="sl-alert err">{err}</p>}
      {list && list.length === 0 && <p className="sl-sub">No videos found. Try different words.</p>}
      {!list && !busy && !err && <p className="sl-sub">Press Search to find videos{initialQuery ? <> for <strong>{initialQuery}</strong></> : ''}. Tip: add words like “lecture”, “tutorial” or “past paper”.</p>}
      {list && list.length > 0 && (
        <div className="sl-yt-grid">
          {list.map((v) => (
            <article key={v.videoId} className="sl-yt-card">
              {playing === v.videoId && validId(v.videoId) ? (
                <iframe className="sl-yt-frame" src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`} title={v.title}
                  allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <button type="button" className="sl-yt-thumb" onClick={() => setPlaying(v.videoId)} aria-label={`Play ${v.title}`}>
                  {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                  <span className="sl-yt-play"><Play size={18} /></span>
                </button>
              )}
              <h4>{v.title}</h4>
              <small>{v.channel}{v.publishedAt ? ` · ${v.publishedAt.slice(0, 4)}` : ''}</small>
              <div className="sl-foot-actions">
                {onPick && <button type="button" className="sl-mini" onClick={() => onPick(v)}><Plus size={13} /> {pickLabel}</button>}
                <a className="sl-link" href={watchUrl(v.videoId)} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> YouTube</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
