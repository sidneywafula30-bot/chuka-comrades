import { useState, type FormEvent } from 'react'
import { Check, Copy, ExternalLink, LoaderCircle, Play, Plus, Search } from 'lucide-react'
import type { User } from 'firebase/auth'
import { labsApi, youtubeWatchUrl, type YtVideo } from '../lib/labs'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

type Props = {
  user: User | null
  onSignIn: () => void
  /** Pre-filled search text, usually the unit name. */
  defaultQuery?: string
  /** One-tap searches shown under the box. */
  chips?: string[]
  /** Called when the student picks a video. May return a short confirmation shown on the card. */
  onPick?: (v: YtVideo) => Promise<string | void> | string | void
  pickLabel?: string
}

export default function YouTubePanel({ user, onSignIn, defaultQuery = '', chips = [], onPick, pickLabel = 'Use this video' }: Props) {
  const [q, setQ] = useState(defaultQuery)
  const [list, setList] = useState<YtVideo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [playing, setPlaying] = useState('')
  const [copied, setCopied] = useState('')
  const [note, setNote] = useState<Record<string, string>>({})
  const [picking, setPicking] = useState('')

  async function run(text: string) {
    const term = text.trim()
    if (term.length < 2) return setErr('Type at least 2 letters to search.')
    setBusy(true); setErr(''); setPlaying('')
    try { setList(await labsApi.ytSearch(term)) } catch (e) { setErr(errMsg(e)); setList(null) } finally { setBusy(false) }
  }

  function submit(e: FormEvent) { e.preventDefault(); void run(q) }

  async function copy(v: YtVideo) {
    const url = youtubeWatchUrl(v.videoId)
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link', url) }
    setCopied(v.videoId); setTimeout(() => setCopied(''), 1800)
  }

  async function pick(v: YtVideo) {
    if (!onPick) return
    setPicking(v.videoId)
    try {
      const m = await onPick(v)
      setNote((n) => ({ ...n, [v.videoId]: m || 'Done.' }))
    } catch (e) { setErr(errMsg(e)) } finally { setPicking('') }
  }

  if (!user) {
    return (
      <div className="sl-empty">
        <Play size={26} />
        <h3>Find lectures on YouTube</h3>
        <p>Sign in with Google to search YouTube for this unit and share good videos with your class.</p>
        <button className="sl-primary small" onClick={onSignIn}>Sign in</button>
      </div>
    )
  }

  return (
    <div className="sl-yt">
      <form className="sl-search" onSubmit={submit}>
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search YouTube for a topic or unit…" maxLength={80} />
        <button className="sl-primary small" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      {chips.length > 0 && (
        <div className="sl-chips">
          {chips.map((c) => <button key={c} type="button" className="sl-chip btn" onClick={() => { setQ(c); void run(c) }}>{c}</button>)}
        </div>
      )}
      {err && <p className="sl-alert err">{err}</p>}
      {busy && <div className="sl-empty"><LoaderCircle className="sl-spin" size={22} /><span>Searching YouTube…</span></div>}
      {!busy && list && list.length === 0 && <p className="sl-sub">No videos found. Try different words.</p>}

      {!busy && list && list.length > 0 && (
        <div className="sl-yt-grid">
          {list.map((v) => (
            <article key={v.videoId} className="sl-yt-card">
              {playing === v.videoId ? (
                <div className="sl-yt-frame">
                  <iframe src={`https://www.youtube-nocookie.com/embed/${v.videoId}?autoplay=1&rel=0`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                </div>
              ) : (
                <button className="sl-yt-thumb" onClick={() => setPlaying(v.videoId)} aria-label={`Play ${v.title}`}>
                  {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span />}
                  <i><Play size={20} fill="currentColor" /></i>
                </button>
              )}
              <h4>{v.title}</h4>
              <small>{v.channel}{v.publishedAt ? ` · ${v.publishedAt}` : ''}</small>
              <div className="sl-foot-actions">
                <a className="sl-mini" href={youtubeWatchUrl(v.videoId)} target="_blank" rel="noreferrer noopener"><ExternalLink size={12} /> YouTube</a>
                <button className="sl-mini ghost" onClick={() => copy(v)}>{copied === v.videoId ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}</button>
                {onPick && !note[v.videoId] && <button className="sl-mini" disabled={picking === v.videoId} onClick={() => pick(v)}><Plus size={12} /> {picking === v.videoId ? '…' : pickLabel}</button>}
              </div>
              {note[v.videoId] && <p className="sl-ok-note"><Check size={13} /> {note[v.videoId]}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
