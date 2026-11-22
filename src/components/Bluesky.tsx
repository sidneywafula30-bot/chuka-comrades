import { useEffect, useState } from 'react'
import { ExternalLink, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react'
import './Cit.css'

// Set VITE_BSKY_HANDLE in .env (e.g. chukaai.bsky.social). No key or login is needed:
// reading uses Bluesky's public, read-only endpoint.
const HANDLE = ((import.meta.env.VITE_BSKY_HANDLE as string | undefined) ?? '').trim().replace(/^@/, '')
const API = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed'

type BskyPost = { id: string; text: string; when: string; url: string; image: string; likes: number; replies: number; reposts: number }
type Raw = {
  reason?: unknown
  post: {
    uri: string
    author: { handle: string }
    record?: { text?: string; createdAt?: string }
    embed?: { images?: { thumb?: string }[] }
    likeCount?: number; replyCount?: number; repostCount?: number
  }
}

const ago = (iso: string) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d`
  return new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' })
}

export function BlueskyStrip() {
  const [posts, setPosts] = useState<BskyPost[] | null>(null)
  useEffect(() => {
    if (!HANDLE) return
    const ctl = new AbortController()
    fetch(`${API}?actor=${encodeURIComponent(HANDLE)}&limit=12&filter=posts_no_replies`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { feed?: Raw[] }) => {
        const list = (d.feed ?? []).filter((f) => !f.reason).slice(0, 6).map((f): BskyPost => ({
          id: f.post.uri,
          text: f.post.record?.text ?? '',
          when: f.post.record?.createdAt ?? '',
          url: `https://bsky.app/profile/${f.post.author.handle}/post/${f.post.uri.split('/').pop()}`,
          image: f.post.embed?.images?.[0]?.thumb ?? '',
          likes: f.post.likeCount ?? 0, replies: f.post.replyCount ?? 0, reposts: f.post.repostCount ?? 0,
        }))
        setPosts(list)
      })
      .catch(() => { if (!ctl.signal.aborted) setPosts([]) })
    return () => ctl.abort()
  }, [])

  if (!HANDLE || !posts || posts.length === 0) return null // hide quietly if not set up or unavailable
  return (
    <>
      <div className="hub-sec"><h2>Latest from Bluesky</h2>
        <a className="sl-link" href={`https://bsky.app/profile/${HANDLE}`} target="_blank" rel="noreferrer noopener">@{HANDLE} <ExternalLink size={12} /></a></div>
      <div className="cit-bsky">
        {posts.map((p) => (
          <a key={p.id} className="cit-bsky-card" href={p.url} target="_blank" rel="noreferrer noopener">
            {p.image && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
            <p>{p.text}</p>
            <small><span>{p.when && ago(p.when)}</span><span><MessageCircle size={12} /> {p.replies}</span><span><Repeat2 size={12} /> {p.reposts}</span><span><Heart size={12} /> {p.likes}</span></small>
          </a>))}
      </div>
    </>
  )
}

const siteUrl = () => `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`

/** Share buttons that need no keys: opens Bluesky's and WhatsApp's own compose pages. */
export function ShareBar({ text, tags = [] }: { text: string; tags?: string[] }) {
  const msg = `${text}${tags.length ? ' ' + tags.map((t) => '#' + t.replace(/\s+/g, '')).join(' ') : ''}\n${siteUrl()}`
  const [copied, setCopied] = useState(false)
  async function nativeOrCopy() {
    try {
      if (navigator.share) { await navigator.share({ text: msg }); return }
      await navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { /* user cancelled */ }
  }
  return (
    <span className="cit-share">
      <a className="sl-mini" href={`https://bsky.app/intent/compose?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer noopener"><Share2 size={13} /> Bluesky</a>
      <a className="sl-mini" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer noopener"><Share2 size={13} /> WhatsApp</a>
      <button className="sl-mini ghost" onClick={() => void nativeOrCopy()}>{copied ? 'Copied!' : 'Copy'}</button>
    </span>
  )
}
