import { useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, EyeOff, Heart, MessageCircle, Repeat2, Send, Share2 } from 'lucide-react'
import { skillsApi } from '../lib/skills'
import { ago, authorFeed, fixActor, postThread, type BskyConfig, type BskyNode, type BskyPost } from '../lib/bluesky'
import { errMsg } from '../lib/hub'
import './Cit.css'

// The handle comes from Admin > Bluesky. VITE_BSKY_HANDLE in .env still works as a fallback.
const ENV_HANDLE = ((import.meta.env.VITE_BSKY_HANDLE as string | undefined) ?? '').trim().replace(/^@/, '')
export const bskyHandle = (c?: BskyConfig) => fixActor(c?.handle || ENV_HANDLE)

/* ---------- a post ---------- */
export function BskyCard({ post, admin, onHide, children }: { post: BskyPost; admin?: boolean; onHide?: (p: BskyPost) => void; children?: ReactNode }) {
  return (
    <article className="cit-bpost">
      <header>
        {post.avatar ? <img src={post.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="cit-bav" />}
        <div><b>{post.name}</b><small>@{post.handle} · {ago(post.when)}</small></div>
      </header>
      <p>{post.text}</p>
      {post.image && <img className="cit-bpic" src={post.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <footer>
        <span><MessageCircle size={13} /> {post.replies}</span><span><Repeat2 size={13} /> {post.reposts}</span><span><Heart size={13} /> {post.likes}</span>
        <span className="cit-bpost-actions">
          {children}
          <a className="sl-mini ghost" href={post.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> Open</a>
          {admin && onHide && <button className="sl-mini danger" onClick={() => onHide(post)} title="Hide this post for everyone"><EyeOff size={12} /> Hide</button>}
        </span>
      </footer>
    </article>
  )
}

/* ---------- replies under a post ---------- */
function Replies({ list, depth }: { list: BskyNode[]; depth: number }) {
  return (
    <>
      {list.map((n) => (
        <div key={n.post.uri} className="cit-breply" style={{ marginLeft: Math.min(depth, 4) * 14 }}>
          <BskyCard post={n.post} />
          {n.replies.length > 0 && <Replies list={n.replies} depth={depth + 1} />}
        </div>))}
    </>
  )
}

export function BskyThread({ url, hidden = [], showRoot = true }: { url: string; hidden?: string[]; showRoot?: boolean }) {
  const [root, setRoot] = useState<BskyNode | null | undefined>(undefined)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setRoot(undefined); setErr('')
    postThread(url).then((r) => { if (live) setRoot(r) }).catch((e) => { if (live) { setErr(errMsg(e)); setRoot(null) } })
    return () => { live = false }
  }, [url])
  if (root === undefined) return <p className="sl-sub">Loading Bluesky replies…</p>
  if (!root) return <p className="sl-alert err">{err || 'This Bluesky post could not be loaded.'}</p>
  const strip = (l: BskyNode[]): BskyNode[] => l.filter((n) => !hidden.includes(n.post.uri)).map((n) => ({ ...n, replies: strip(n.replies) }))
  const replies = strip(root.replies)
  return (
    <div className="cit-bthread">
      {showRoot && <BskyCard post={root.post} />}
      {replies.length === 0 ? <p className="sl-sub">No replies yet. Be the first on Bluesky.</p> : <Replies list={replies} depth={0} />}
      <p style={{ margin: '8px 0 0' }}><a className="sl-primary small" href={root.post.url} target="_blank" rel="noreferrer noopener"><MessageCircle size={14} /> Reply on Bluesky</a></p>
    </div>
  )
}

/* ---------- Bluesky replies under a hackathon or an idea ---------- */
export function BskyDiscussion({ room, bsky, isAdmin, announce }: { room: string; bsky?: BskyConfig; isAdmin: boolean; announce: string }) {
  const [url, setUrl] = useState(bsky?.links?.[room] ?? '')
  const [paste, setPaste] = useState('')
  const [text, setText] = useState(announce)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { setUrl(bsky?.links?.[room] ?? '') }, [bsky, room])
  async function save(link: string) {
    setBusy(true); setMsg('')
    try { const r = await skillsApi.admin.bskyLink(room, link); setUrl(r.links[room] ?? ''); setPaste('') } catch (e) { setMsg(errMsg(e)) } finally { setBusy(false) }
  }
  async function announceNow() {
    setBusy(true); setMsg('')
    try { const r = await skillsApi.admin.bskyPost(text, room); setUrl(r.links[room] ?? r.url) } catch (e) { setMsg(errMsg(e)) } finally { setBusy(false) }
  }
  if (!url && !isAdmin) return null
  return (
    <>
      <div className="hub-sec"><h2>Bluesky replies</h2></div>
      {url ? (
        <>
          <BskyThread url={url} hidden={bsky?.hidden} />
          {isAdmin && <p style={{ margin: '8px 0 0' }}><button className="sl-mini danger" disabled={busy} onClick={() => void save('')}>Remove the Bluesky link</button></p>}
        </>
      ) : (
        <div className="cit-note">
          <p style={{ margin: '0 0 8px' }}>Admin: connect a Bluesky post so its replies show here.</p>
          <div className="sl-form">
            <label>Paste the link of the Bluesky post<input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://bsky.app/profile/…/post/…" /></label>
            <button className="sl-mini" disabled={busy || !paste.trim()} onClick={() => void save(paste.trim())}>Connect this post</button>
            {bsky?.posting && (
              <>
                <label>Or post a new announcement from the CIT account<textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></label>
                <button className="sl-primary small" disabled={busy || !text.trim()} onClick={() => void announceNow()}><Send size={14} /> {busy ? 'Posting…' : 'Post to Bluesky'}</button>
              </>
            )}
          </div>
          {msg && <p className="sl-alert err" style={{ marginTop: 8 }}>{msg}</p>}
        </div>
      )}
    </>
  )
}

/* ---------- "Latest from Bluesky" strip on Learn ---------- */
export function BlueskyStrip({ bsky }: { bsky?: BskyConfig }) {
  const handle = bskyHandle(bsky)
  const hidden = bsky?.hidden
  const [posts, setPosts] = useState<BskyPost[] | null>(null)
  useEffect(() => {
    if (!handle) return
    let live = true
    authorFeed(handle, 12).then((p) => { if (live) setPosts(p) }).catch(() => { if (live) setPosts([]) })
    return () => { live = false }
  }, [handle])
  const shown = (posts ?? []).filter((p) => !hidden?.includes(p.uri)).slice(0, 6)
  if (!handle || shown.length === 0) return null // stays hidden if not set up or unreachable
  return (
    <>
      <div className="hub-sec"><h2>Latest from Bluesky</h2>
        <a className="sl-link" href={`https://bsky.app/profile/${handle}`} target="_blank" rel="noreferrer noopener">@{handle} <ExternalLink size={12} /></a></div>
      <div className="cit-bsky">
        {shown.map((p) => (
          <a key={p.uri} className="cit-bsky-card" href={p.url} target="_blank" rel="noreferrer noopener">
            {p.image && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
            <p>{p.text}</p>
            <small><span>{ago(p.when)}</span><span><MessageCircle size={12} /> {p.replies}</span><span><Repeat2 size={12} /> {p.reposts}</span><span><Heart size={12} /> {p.likes}</span></small>
          </a>))}
      </div>
    </>
  )
}

/* ---------- chat with the admin on Bluesky ---------- */
export function BskyDm({ bsky, className = 'sl-mini' }: { bsky?: BskyConfig; className?: string }) {
  const handle = bskyHandle(bsky)
  if (!handle) return null
  return <a className={className} href={`https://bsky.app/profile/${handle}`} target="_blank" rel="noreferrer noopener" title="Opens our Bluesky profile. Tap the message icon there."><MessageCircle size={13} /> Message us on Bluesky</a>
}

/* ---------- share buttons (no keys needed) ---------- */
const siteUrl = () => `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`

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
