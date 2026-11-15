import { useEffect, useState } from 'react'
import './CplHighlights.css'

/**
 * Latest CPL YouTube highlights for the landing page.
 *
 * Needs in your .env:
 *   VITE_CPL_API_URL=<your Apps Script web app URL>
 *   VITE_YOUTUBE_CHANNEL_URL=<channel url>   (already used by Landing.tsx)
 *
 * Use:  <CplHighlights limit={6} />
 */

type Video = {
  videoId: string
  title: string
  thumbnailUrl: string
  publishedAt: string
  watchUrl: string
  embedUrl: string
}

const API_URL = (import.meta.env.VITE_CPL_API_URL as string) || ''
const CHANNEL_URL = (import.meta.env.VITE_YOUTUBE_CHANNEL_URL as string) || 'https://www.youtube.com'

function formatDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CplHighlights({ limit = 6 }: { limit?: number }) {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => {
    if (!API_URL) { setError(true); return }
    const ctrl = new AbortController()

    // Plain GET with no custom headers: no CORS preflight needed for Apps Script.
    fetch(`${API_URL}?action=highlights&limit=${limit}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json && json.success && Array.isArray(json.data?.videos)) setVideos(json.data.videos)
        else setError(true)
      })
      .catch((e) => { if (e.name !== 'AbortError') setError(true) })

    return () => ctrl.abort()
  }, [limit])

  // Hide the whole section if highlights are not set up or unavailable.
  if (error || (videos && videos.length === 0)) {
    return (
      <section className="cplh">
        <h2>CPL Highlights</h2>
        <p className="cplh-note">
          Watch the latest match highlights on <a href={CHANNEL_URL} target="_blank" rel="noreferrer">YouTube</a>.
        </p>
      </section>
    )
  }

  return (
    <section className="cplh" aria-label="CPL highlights">
      <div className="cplh-head">
        <h2>CPL Highlights</h2>
        <a href={CHANNEL_URL} target="_blank" rel="noreferrer">All videos</a>
      </div>

      <div className="cplh-grid">
        {videos === null
          ? Array.from({ length: Math.min(limit, 3) }).map((_, i) => <div className="cplh-card cplh-skel" key={i} />)
          : videos.map((v) => (
              <article className="cplh-card" key={v.videoId}>
                {playing === v.videoId ? (
                  <iframe
                    className="cplh-frame"
                    src={`${v.embedUrl}?autoplay=1&rel=0`}
                    title={v.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <button className="cplh-thumb" onClick={() => setPlaying(v.videoId)} aria-label={`Play ${v.title}`}>
                    {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" loading="lazy" />}
                    <span className="cplh-play" aria-hidden="true">▶</span>
                  </button>
                )}
                <div className="cplh-meta">
                  <h3>{v.title}</h3>
                  <time dateTime={v.publishedAt}>{formatDate(v.publishedAt)}</time>
                </div>
              </article>
            ))}
      </div>
    </section>
  )
}
